/* gs: tiny SDL2 + Lua 2D game runtime.
 *
 *   gs <cart.cart | dir>      run a cartridge (or an unpacked directory)
 *   gs pack <dir> <out.cart>  pack a directory into a cartridge
 *
 * A cartridge is a game built on the embedded framework (engine/gs/): it has a game.lua, which names its console (screen size, palette,
 * limits). The framework defines the init(), update(dt), draw() this file calls every frame.
 */
#if defined(__linux__) && !defined(_GNU_SOURCE)
#define _GNU_SOURCE /* dladdr, for the console's RAM (runtime/ram.c) */
#endif
#define SDL_MAIN_HANDLED
#include <SDL.h>
#include <stdbool.h>
#include "synth.h"
#include "fonts.h"
#include <lua.h>
#include <lauxlib.h>
#include <lualib.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <math.h>
#include <stdarg.h>
#include <ctype.h>
#include <time.h>
#ifdef __linux__
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <linux/fb.h>
#include <linux/input.h>
#endif

/* the studio's embedded preview talks to the runtime over a local socket (see "embedded preview" below) */
#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
typedef SOCKET embed_sock;
#define EMBED_NONE INVALID_SOCKET
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <arpa/inet.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
typedef int embed_sock;
#define EMBED_NONE (-1)
#endif

#define STB_IMAGE_IMPLEMENTATION
#define STBI_ONLY_PNG
#include "../third_party/stb/stb_image.h"

extern const unsigned char gs_framework_lua[];
extern const unsigned long gs_framework_lua_len;

/* Logical screen until the framework sets the console's own size (gs.set_resolution) at start-up. */
#define DEFAULT_SCREEN_W 640
#define DEFAULT_SCREEN_H 480
static int g_screen_w = DEFAULT_SCREEN_W, g_screen_h = DEFAULT_SCREEN_H;
static SDL_Window *g_win;

/* Time in nanoseconds, and a wait as fine as the system allows: SDL2 counts milliseconds, and a frame paced to whole milliseconds drifts. */
static Uint64 ticks_ns(void) {
    static Uint64 freq;
    if (!freq) freq = SDL_GetPerformanceFrequency();
    const Uint64 c = SDL_GetPerformanceCounter();
    return c / freq * 1000000000ULL + c % freq * 1000000000ULL / freq;
}
/* A sleep can wake a few ms late (macOS gathers timers), which costs a frame: sleep until 2 ms before the end, then wait out the rest. */
static void delay_ns(Uint64 ns) {
    const Uint64 end = ticks_ns() + ns;
    if (ns > 2000000) {
#ifdef _WIN32
        SDL_Delay((Uint32)((ns - 2000000) / 1000000));
#else
        struct timespec ts = { (time_t)((ns - 2000000) / 1000000000ULL), (long)((ns - 2000000) % 1000000000ULL) };
        while (nanosleep(&ts, &ts) != 0 && errno == EINTR) {}
#endif
    }
    while (ticks_ns() < end) {}
}
/* The folder the program is in, with a trailing slash (SDL2 hands out a fresh copy each call, so it is asked once). */
static char *g_base_override; /* the libretro core's own folder: SDL's base path is the folder of the emulator that loaded it */
static const char *base_path(void) {
    static char *p; static bool asked;
    if (g_base_override) return g_base_override;
    if (!asked) { p = SDL_GetBasePath(); asked = true; }
    return p;
}

/* ---------- virtual filesystem: directory or packed cart ---------- */

typedef struct { char *name; unsigned char *data; Uint32 size; } CartFile;
static CartFile *g_files; static int g_nfiles;
static const char *g_dir; /* non-NULL when running from a directory */

static unsigned char *read_all(const char *path, size_t *size) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    fseek(f, 0, SEEK_END); long n = ftell(f); fseek(f, 0, SEEK_SET);
    unsigned char *buf = malloc(n ? n : 1);
    if (!buf || fread(buf, 1, n, f) != (size_t)n) { fclose(f); free(buf); return NULL; }
    fclose(f); *size = n; return buf;
}

/* Returns a malloc'd buffer the caller frees, or NULL. */
static unsigned char *vfs_read(const char *name, size_t *size) {
    if (strstr(name, "..") || name[0] == '/') return NULL;
    if (g_dir) {
        char path[1024]; snprintf(path, sizeof path, "%s/%s", g_dir, name);
        return read_all(path, size);
    }
    for (int i = 0; i < g_nfiles; i++)
        if (!strcmp(g_files[i].name, name)) {
            unsigned char *b = malloc(g_files[i].size ? g_files[i].size : 1);
            memcpy(b, g_files[i].data, g_files[i].size);
            *size = g_files[i].size; return b;
        }
    return NULL;
}

/* Cart format: "GSC1", u32 count, then per file: u16 namelen, name, u32 size, data (little-endian). */
static int load_cart(const char *path) {
    size_t n; unsigned char *buf = read_all(path, &n);
    if (!buf || n < 8 || memcmp(buf, "GSC1", 4)) { free(buf); return 0; }
    size_t p = 4; Uint32 count; memcpy(&count, buf + p, 4); p += 4;
    g_files = calloc(count, sizeof *g_files);
    for (Uint32 i = 0; i < count; i++) {
        Uint16 nl; Uint32 sz;
        if (p + 2 > n) return 0;
        memcpy(&nl, buf + p, 2); p += 2;
        if (p + nl + 4 > n) return 0;
        g_files[i].name = strndup((char *)buf + p, nl); p += nl;
        memcpy(&sz, buf + p, 4); p += 4;
        if (p + sz > n) return 0;
        g_files[i].data = buf + p; g_files[i].size = sz; p += sz;
        g_nfiles++;
    }
    return 1; /* buf intentionally kept: file data points into it */
}

static void collect(const char *root, const char *rel, FILE *out, Uint32 *count, long countpos) {
    char dirpath[1024]; snprintf(dirpath, sizeof dirpath, "%s/%s", root, rel);
    DIR *d = opendir(dirpath); if (!d) return;
    struct dirent *e;
    while ((e = readdir(d))) {
        if (e->d_name[0] == '.') continue;
        char r[1024]; snprintf(r, sizeof r, "%s%s%s", rel, *rel ? "/" : "", e->d_name);
        char full[2048]; snprintf(full, sizeof full, "%s/%s", root, r);
        struct stat st; if (stat(full, &st)) continue;
        /* meta/ holds things for the studio and game lists (box art), never for the game itself: it stays out of the cartridge */
        if (S_ISDIR(st.st_mode)) { if (*rel || strcmp(e->d_name, "meta")) collect(root, r, out, count, countpos); continue; }
        size_t sz; unsigned char *data = read_all(full, &sz); if (!data) continue;
        Uint16 nl = strlen(r); Uint32 s32 = sz;
        fwrite(&nl, 2, 1, out); fwrite(r, 1, nl, out); fwrite(&s32, 4, 1, out); fwrite(data, 1, sz, out);
        free(data); (*count)++;
    }
    closedir(d);
    (void)countpos;
}

static int pack(const char *dir, const char *outpath) {
    FILE *out = fopen(outpath, "wb"); if (!out) { perror(outpath); return 1; }
    Uint32 count = 0, zero = 0;
    fwrite("GSC1", 1, 4, out); fwrite(&zero, 4, 1, out);
    collect(dir, "", out, &count, 4);
    fseek(out, 4, SEEK_SET); fwrite(&count, 4, 1, out); fclose(out);
    printf("packed %u files -> %s\n", count, outpath); return 0;
}

/* ---------- input ---------- */

enum { B_UP, B_DOWN, B_LEFT, B_RIGHT, B_A, B_B, B_X, B_Y, B_L, B_R, B_START, B_SELECT, B_L2, B_R2, B_L3, B_R3, B_COUNT };
static const char *btn_names[B_COUNT] = {"up","down","left","right","a","b","x","y","l","r","start","select","l2","r2","l3","r3"};
static const SDL_Scancode key_map[B_COUNT] = {
    SDL_SCANCODE_UP, SDL_SCANCODE_DOWN, SDL_SCANCODE_LEFT, SDL_SCANCODE_RIGHT,
    SDL_SCANCODE_Z, SDL_SCANCODE_X, SDL_SCANCODE_A, SDL_SCANCODE_S,
    SDL_SCANCODE_Q, SDL_SCANCODE_W, SDL_SCANCODE_RETURN, SDL_SCANCODE_RSHIFT,
    SDL_SCANCODE_E, SDL_SCANCODE_R, SDL_SCANCODE_D, SDL_SCANCODE_F };
/* Face buttons follow physical position (SDL2's A is the bottom one, B the right, X the left, Y the top), so a Nintendo-style layout is not assumed.
 * L2/R2 are analog triggers in SDL, so they have no button here: poll_buttons reads the trigger axes for them. */
static const SDL_GameControllerButton pad_map[B_COUNT] = {
    SDL_CONTROLLER_BUTTON_DPAD_UP, SDL_CONTROLLER_BUTTON_DPAD_DOWN, SDL_CONTROLLER_BUTTON_DPAD_LEFT, SDL_CONTROLLER_BUTTON_DPAD_RIGHT,
    SDL_CONTROLLER_BUTTON_A, SDL_CONTROLLER_BUTTON_B, SDL_CONTROLLER_BUTTON_X, SDL_CONTROLLER_BUTTON_Y,
    SDL_CONTROLLER_BUTTON_LEFTSHOULDER, SDL_CONTROLLER_BUTTON_RIGHTSHOULDER, SDL_CONTROLLER_BUTTON_START, SDL_CONTROLLER_BUTTON_BACK,
    SDL_CONTROLLER_BUTTON_INVALID, SDL_CONTROLLER_BUTTON_INVALID, SDL_CONTROLLER_BUTTON_LEFTSTICK, SDL_CONTROLLER_BUTTON_RIGHTSTICK };
static bool btn_now[B_COUNT], btn_prev[B_COUNT];
static Uint16 g_embed_buttons; /* buttons held in the studio's embedded preview (bit i = button i), see "embedded preview" */
static Uint16 g_embed_tapped;  /* buttons pressed there since the last frame: a tap shorter than a frame still counts once */
static bool g_hotkey;               /* the hotkey is held (see g_raw_hotkey) */
static bool g_start_raw;            /* START as pressed, before the hotkey hides it from the game */
/* While the hotkey is held the game sees no buttons: HOTKEY + something is for the handheld (quit, volume, brightness), not the game.
 * A button pressed during the hotkey stays hidden until it is let go, so releasing the hotkey first does not press it in the game. */
static bool g_swallow[B_COUNT];

/* Handheld frontends describe the handheld's buttons in SDL_GAMECONTROLLERCONFIG, which SDL2 reads by itself: on the handheld gs uses the
 * system's SDL2, the one the mapping was written for. GS_DEBUG_INPUT=1 prints every joystick and button press to stderr, to find out what a
 * device does. */
static bool g_debug_input;

/* Per-device button map. SDL's guessed gamepad layout is wrong for some handhelds, so the "pad setup" cart asks the player to press the
 * button they want for each name and stores the raw joystick button numbers in padmap.txt beside the program ("a=5" per line). When a
 * name has an entry, that raw button is used instead of the gamepad mapping. The d-pad and sticks keep the gamepad mapping. */
static int g_rawmap[B_COUNT];
static int g_raw_last = -1;         /* last raw joystick button pressed, for the setup cart to read */
/* The handheld's hotkey (Menu / function button) is not a game button: HOTKEY + START leaves the game, like every other app on Knulli and
 * Knulli. The pad setup cart can record it as "hotkey" in padmap.txt; without an entry it is the gamepad's guide button. */
static int g_raw_hotkey = -1;
static SDL_Joystick *g_joys[8]; static int g_njoys;
/* GS_BUTTON_ALIAS="l3=select,r3=start": a button the game's console does not have stands in for one it does, set by a device's launcher
 * (the TrimUI Brick's L3 and R4 sit where Select and Start are easier to reach). The first button is then never seen by the game. */
static int g_alias_from[B_COUNT], g_alias_to[B_COUNT], g_nalias;
static int alias_button(const char *name, size_t len) {
    for (int i = 0; i < B_COUNT; i++) if (strlen(btn_names[i]) == len && !strncmp(name, btn_names[i], len)) return i;
    return -1;
}
static void alias_load(void) {
    const char *p = getenv("GS_BUTTON_ALIAS");
    while (p && *p && g_nalias < B_COUNT) {
        const char *eq = strchr(p, '='); if (!eq) break;
        const char *end = strchr(eq, ','); if (!end) end = eq + strlen(eq);
        const int from = alias_button(p, (size_t)(eq - p)), to = alias_button(eq + 1, (size_t)(end - eq - 1));
        if (from >= 0 && to >= 0 && from != to) { g_alias_from[g_nalias] = from; g_alias_to[g_nalias++] = to; }
        p = *end ? end + 1 : end;
    }
}
static SDL_GameController *g_pads[8]; static int g_npads;

static bool padmap_path(char *out, size_t cap) {
    const char *base = base_path(); if (!base) return false;
    snprintf(out, cap, "%spadmap.txt", base); return true;
}
static void padmap_load(void) {
    for (int i = 0; i < B_COUNT; i++) g_rawmap[i] = -1;
    g_raw_hotkey = -1;
    char path[1100]; if (!padmap_path(path, sizeof path)) return;
    FILE *f = fopen(path, "r"); if (!f) return;
    char line[64];
    while (fgets(line, sizeof line, f)) {
        char *eq = strchr(line, '='); if (!eq) continue;
        *eq = 0; int n = atoi(eq + 1);
        for (int i = 0; i < B_COUNT; i++) if (!strcmp(line, btn_names[i]) && n >= 0) g_rawmap[i] = n;
        if (!strcmp(line, "hotkey") && n >= 0) g_raw_hotkey = n;
    }
    fclose(f);
}
static bool padmap_save(void) {
    char path[1100]; if (!padmap_path(path, sizeof path)) return false;
    FILE *f = fopen(path, "w"); if (!f) return false;
    for (int i = 0; i < B_COUNT; i++) if (g_rawmap[i] >= 0) fprintf(f, "%s=%d\n", btn_names[i], g_rawmap[i]);
    if (g_raw_hotkey >= 0) fprintf(f, "hotkey=%d\n", g_raw_hotkey);
    fclose(f); return true;
}

/* With GS_DEBUG_INPUT=1 on Linux, also read the raw evdev devices (read-only, no grab) and print every key code. That shows what the
 * hardware really sends when SDL's joystick layer reports fewer buttons than the device has. */
#ifdef __linux__
static int g_ev_fd[32], g_ev_id[32], g_ev_n;
static void evdev_debug_open(void) {
    for (int i = 0; i < 32 && g_ev_n < 32; i++) {
        char path[32], name[128] = "?"; snprintf(path, sizeof path, "/dev/input/event%d", i);
        int fd = open(path, O_RDONLY | O_NONBLOCK); if (fd < 0) continue;
        ioctl(fd, EVIOCGNAME(sizeof name), name);
        fprintf(stderr, "evdev event%d: %s\n", i, name);
        g_ev_fd[g_ev_n] = fd; g_ev_id[g_ev_n++] = i;
    }
}
static void evdev_debug_poll(void) {
    bool any = false;
    for (int d = 0; d < g_ev_n; d++) {
        struct input_event ev;
        while (read(g_ev_fd[d], &ev, sizeof ev) == (ssize_t)sizeof ev) {
            if (ev.type == EV_KEY) { fprintf(stderr, "evdev event%d key %d value %d\n", g_ev_id[d], ev.code, ev.value); any = true; }
            else if (ev.type == EV_ABS && (ev.code == ABS_HAT0X || ev.code == ABS_HAT0Y)) { fprintf(stderr, "evdev event%d hat %d value %d\n", g_ev_id[d], ev.code, ev.value); any = true; }
        }
    }
    if (any) fsync(2);
}
#endif

/* Open every controller SDL knows a mapping for, and every joystick (for raw button numbers: pad setup, the hotkey). A controller that is
 * already open is skipped, so this also serves the "device added" event SDL sends for each one at start-up. */
static void open_controller(int index) {
    if (SDL_IsGameController(index) && g_npads < 8) {
        const SDL_JoystickID id = SDL_JoystickGetDeviceInstanceID(index);
        if (!SDL_GameControllerFromInstanceID(id)) { SDL_GameController *c = SDL_GameControllerOpen(index); if (c) g_pads[g_npads++] = c; }
    }
    if (g_debug_input) {
        char guid[64]; SDL_JoystickGetGUIDString(SDL_JoystickGetDeviceGUID(index), guid, sizeof guid);
        fprintf(stderr, "joystick %d: %s guid=%s gamepad=%d\n", index, SDL_JoystickNameForIndex(index), guid, (int)SDL_IsGameController(index));
        /* the mapping SDL uses, as a starting point for a device whose frontend hands games none */
        char *m = SDL_GameControllerMappingForDeviceIndex(index);
        if (m) { fprintf(stderr, "mapping %s\n", m); SDL_free(m); }
    }
}
static void open_controllers(void) {
    const int n = SDL_NumJoysticks();
    for (int i = 0; i < n; i++) {
        open_controller(i);
        if (g_njoys < 8) { SDL_Joystick *j = SDL_JoystickOpen(i); if (j) g_joys[g_njoys++] = j; }
    }
}
static void close_controller(SDL_JoystickID id) {
    for (int i = 0; i < g_npads; i++)
        if (SDL_JoystickInstanceID(SDL_GameControllerGetJoystick(g_pads[i])) == id) { SDL_GameControllerClose(g_pads[i]); g_pads[i] = g_pads[--g_npads]; return; }
}

static void poll_buttons(void) {
    memcpy(btn_prev, btn_now, sizeof btn_now);
    const Uint8 *keys = SDL_GetKeyboardState(NULL);
    for (int i = 0; i < B_COUNT; i++) {
        bool down = keys[key_map[i]] || ((g_embed_buttons | g_embed_tapped) >> i & 1);
        if (g_rawmap[i] >= 0) for (int j = 0; j < g_njoys && !down; j++) if (SDL_JoystickGetButton(g_joys[j], g_rawmap[i])) down = true;
        for (int g = 0; g < g_npads && !down && g_rawmap[i] < 0; g++) {
            SDL_GameController *pad = g_pads[g];
            if (i == B_L2) down = SDL_GameControllerGetAxis(pad, SDL_CONTROLLER_AXIS_TRIGGERLEFT) > 16000;
            else if (i == B_R2) down = SDL_GameControllerGetAxis(pad, SDL_CONTROLLER_AXIS_TRIGGERRIGHT) > 16000;
            else if (SDL_GameControllerGetButton(pad, pad_map[i])) down = true;
        }
        btn_now[i] = down;
    }
    for (int k = 0; k < g_nalias; k++) { if (btn_now[g_alias_from[k]]) btn_now[g_alias_to[k]] = true; btn_now[g_alias_from[k]] = false; }
    g_hotkey = false;
    if (g_raw_hotkey >= 0) for (int j = 0; j < g_njoys && !g_hotkey; j++) g_hotkey = SDL_JoystickGetButton(g_joys[j], g_raw_hotkey);
    else for (int g = 0; g < g_npads && !g_hotkey; g++) g_hotkey = SDL_GameControllerGetButton(g_pads[g], SDL_CONTROLLER_BUTTON_GUIDE);
    /* left stick acts as d-pad */
    for (int g = 0; g < g_npads; g++) {
        Sint16 ax = SDL_GameControllerGetAxis(g_pads[g], SDL_CONTROLLER_AXIS_LEFTX), ay = SDL_GameControllerGetAxis(g_pads[g], SDL_CONTROLLER_AXIS_LEFTY);
        if (ax < -16000) btn_now[B_LEFT] = true; if (ax > 16000) btn_now[B_RIGHT] = true;
        if (ay < -16000) btn_now[B_UP] = true;   if (ay > 16000) btn_now[B_DOWN] = true;
    }
    g_embed_tapped = 0;
    g_start_raw = btn_now[B_START];
    for (int i = 0; i < B_COUNT; i++) {
        if (g_hotkey && btn_now[i]) g_swallow[i] = true;
        else if (!btn_now[i]) g_swallow[i] = false;
        if (g_hotkey || g_swallow[i]) btn_now[i] = false;
    }
}

/* ---------- Lua API: gs.* ---------- */

static SDL_Renderer *g_ren;
static bool g_use_fb; /* drawing into the framebuffer ourselves (see "framebuffer output" below) */
/* Sets the logical screen: drawn into a texture of its size and enlarged by present_window on a window, or drawn 1:1 into the top-left corner of the
 * framebuffer surface and enlarged by fb_present. */
static void screen_logical(int w, int h);

/* gs.camera(x, y): everything drawn afterwards is shifted by -(x, y), so a world bigger than the screen can scroll.
 * gs.camera() puts it back at 0,0 (for a heads-up display). It is reset at the start of every frame. */
static float g_cam_x, g_cam_y;
static int l_camera(lua_State *L) { g_cam_x = (float)luaL_optnumber(L, 1, 0); g_cam_y = (float)luaL_optnumber(L, 2, 0); return 0; }
/* gs.zoom(z): everything drawn afterwards is enlarged by z around the screen's top-left, after the camera offset (so a zoomed world shows
 * screen/z world pixels). gs.zoom() returns it. Like the camera it is reset every frame; the framework sets it from gs.camera.zoom. */
static float g_zoom = 1;
static int l_zoom(lua_State *L) {
    if (lua_gettop(L) == 0) { lua_pushnumber(L, g_zoom); return 1; }
    const float z = (float)luaL_checknumber(L, 1);
    if (!(z >= 0.125f && z <= 16)) return luaL_error(L, "zoom out of range (0.125..16): %f", z);
    g_zoom = z; return 0;
}
#define ZX(x) (((float)(x) - g_cam_x) * g_zoom)
#define ZY(y) (((float)(y) - g_cam_y) * g_zoom)

/* gs.set_resolution(w, h): choose the logical screen size. It is shown at the largest whole-number scale that fits the
 * display, with bars around it. On a desktop the window is resized to a comfortable multiple of it. */
static int l_set_resolution(lua_State *L) {
    int w = (int)luaL_checkinteger(L, 1), h = (int)luaL_checkinteger(L, 2);
    if (w < 64 || h < 64 || w > 2048 || h > 2048) return luaL_error(L, "resolution out of range (64..2048): %dx%d", w, h);
    g_screen_w = w; g_screen_h = h;
    screen_logical(w, h);
    if (g_win && !(SDL_GetWindowFlags(g_win) & SDL_WINDOW_FULLSCREEN)) {
        int k = SDL_max(1, SDL_min(960 / w, 720 / h));
        SDL_SetWindowSize(g_win, w * k, h * k);
        SDL_SetWindowPosition(g_win, SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED);
    }
    return 0;
}
static int l_screen(lua_State *L) { lua_pushinteger(L, g_screen_w); lua_pushinteger(L, g_screen_h); return 2; } /* gs.screen() -> w, h */
static bool g_quit;

static Uint8 cu8(lua_State *L, int i, Uint8 def) {
    return lua_isnoneornil(L, i) ? def : (Uint8)SDL_clamp((int)luaL_checknumber(L, i), 0, 255);
}
static void set_color(lua_State *L, int i) {
    SDL_SetRenderDrawColor(g_ren, cu8(L, i, 255), cu8(L, i + 1, 255), cu8(L, i + 2, 255), cu8(L, i + 3, 255));
}
/* How much a frame draws: pixels of the screen covered (counted per draw call, so overlapping draws count twice: the cost of drawing is the
 * pixels written) and the number of draw calls. gs.stats() gives the figures of the last finished frame; the engine compares them with the
 * console's budget. gs.clear is left out: it is the same on every frame. */
static double g_px_frame, g_px_last; static long g_calls_frame, g_calls_last;
static void count_px(float x, float y, float w, float h) {
    const float x0 = fmaxf(x, 0), y0 = fmaxf(y, 0), x1 = fminf(x + w, (float)g_screen_w), y1 = fminf(y + h, (float)g_screen_h);
    if (x1 > x0 && y1 > y0) g_px_frame += (double)(x1 - x0) * (y1 - y0);
    g_calls_frame++;
}
static int l_stats(lua_State *L) { lua_pushnumber(L, g_px_last); lua_pushinteger(L, g_calls_last); lua_pushinteger(L, (lua_Integer)g_screen_w * g_screen_h); return 3; }
/* The console's RAM (runtime/ram.c), when Lua's memory comes from it: the libretro core, and the program with GS_RAM=1 (the studio's Play
 * panel runs it so, so a game runs out of memory where it would on the handheld). Bytes in use now and at most, block overhead included.
 * gs.ram() gives them and the RAM's size, or nothing when Lua has the computer's memory. */
static size_t g_ram_used, g_ram_peak, g_ram_size;
static int l_ram(lua_State *L) {
    if (!g_ram_size) return 0;
    lua_pushinteger(L, (lua_Integer)g_ram_used); lua_pushinteger(L, (lua_Integer)g_ram_peak); lua_pushinteger(L, (lua_Integer)g_ram_size); return 3;
}
static bool g_perf_on; static void perf_log(const char *fmt, ...); /* both defined further down */
static double g_fb_copy_last; /* ms the copy to the framebuffer took in the last frame (0 without it); the CPU floor controller reads it */
static int l_mark(lua_State *L) { const char *s = luaL_checkstring(L, 1); if (g_perf_on) perf_log("mark: %s\n", s); return 0; } /* gs.mark(text): a line in the GS_PERF log; nothing otherwise */
static int l_clear(lua_State *L) { set_color(L, 1); SDL_RenderClear(g_ren); return 0; }
/* gs.blend(mode): how everything drawn from now on mixes with what is already there, like the GBA's blend register.
 * "normal" (see-through by alpha), "add" (adds light: glows, fire, light shafts) or "darken" (multiplies: shadows, tinted glass, night).
 * Alpha still sets the strength in all three. The framework sets it around a thing that asks for it and puts "normal" back; each frame
 * starts at "normal". Returns the mode that was set before. */
static SDL_BlendMode g_blend = SDL_BLENDMODE_BLEND;
static const char *blend_name(SDL_BlendMode m) { return m == SDL_BLENDMODE_ADD ? "add" : m == SDL_BLENDMODE_MUL ? "darken" : "normal"; }
static int l_blend(lua_State *L) {
    const char *m = luaL_optstring(L, 1, "normal"), *was = blend_name(g_blend);
    if (!strcmp(m, "normal")) g_blend = SDL_BLENDMODE_BLEND;
    else if (!strcmp(m, "add")) g_blend = SDL_BLENDMODE_ADD;
    else if (!strcmp(m, "darken")) g_blend = SDL_BLENDMODE_MUL;
    else return luaL_error(L, "blend mode must be \"normal\", \"add\" or \"darken\", not \"%s\"", m);
    SDL_SetRenderDrawBlendMode(g_ren, g_blend);
    lua_pushstring(L, was); return 1;
}
static int l_rect(lua_State *L) { /* x,y,w,h,r,g,b[,a] */
    SDL_FRect r = {ZX(luaL_checknumber(L,1)), ZY(luaL_checknumber(L,2)), (float)luaL_checknumber(L,3) * g_zoom, (float)luaL_checknumber(L,4) * g_zoom};
    set_color(L, 5); SDL_RenderFillRectF(g_ren, &r); count_px(r.x, r.y, r.w, r.h); return 0;
}
static int l_line(lua_State *L) { /* x1,y1,x2,y2,r,g,b[,a] */
    set_color(L, 5);
    SDL_RenderDrawLineF(g_ren, ZX(luaL_checknumber(L,1)), ZY(luaL_checknumber(L,2)), ZX(luaL_checknumber(L,3)), ZY(luaL_checknumber(L,4))); return 0;
}
/* The built-in fonts (fonts.h) as one picture each, made the first time a font is used: the glyphs in a row, and under them the same
 * glyphs' shadows (the pixels right of, under and diagonally under the ink that are not ink themselves), so a shadow is one more copy
 * in another colour. Each glyph has a blank pixel around it so an enlarged glyph never picks up its neighbour's edge. */
static SDL_Texture *g_font_tex[GS_FONTS];
static int g_font_x[GS_FONTS][GS_FONT_GLYPHS];
static bool font_texture(int f) {
    if (g_font_tex[f]) return true;
    const GsFont *ft = &gs_fonts[f];
    int w = 0;
    for (int g = 0; g < GS_FONT_GLYPHS; g++) { g_font_x[f][g] = w + 1; w += ft->w[g] + 3; }
    const int ch = ft->h + 2, h = ch * 2;
    Uint32 *px = calloc((size_t)w * h, 4);
    if (!px) return false;
    for (int g = 0; g < GS_FONT_GLYPHS; g++) {
        const unsigned short *rows = ft->rows + g * ft->h;
        for (int y = 0; y <= ft->h; y++) for (int x = 0; x <= ft->w[g]; x++) {
            const bool ink = y < ft->h && (rows[y] >> x & 1);
            const bool near = (y < ft->h && x > 0 && (rows[y] >> (x - 1) & 1)) || (y > 0 && (rows[y - 1] >> x & 1)) || (y > 0 && x > 0 && (rows[y - 1] >> (x - 1) & 1));
            if (ink) px[(1 + y) * w + g_font_x[f][g] + x] = 0xffffffff;
            else if (near) px[(ch + 1 + y) * w + g_font_x[f][g] + x] = 0xffffffff;
        }
    }
    g_font_tex[f] = SDL_CreateTexture(g_ren, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STATIC, w, h);
    if (g_font_tex[f]) { SDL_UpdateTexture(g_font_tex[f], NULL, px, w * 4); SDL_SetTextureBlendMode(g_font_tex[f], SDL_BLENDMODE_BLEND); SDL_SetTextureScaleMode(g_font_tex[f], SDL_ScaleModeNearest); }
    free(px);
    return g_font_tex[f] != NULL;
}
/* The next character of UTF-8 text (a broken sequence counts as one unknown character). */
static Uint32 utf8_next(const char **s) {
    const unsigned char *p = (const unsigned char *)*s;
    int n = p[0] < 0x80 ? 0 : p[0] >= 0xf0 ? 3 : p[0] >= 0xe0 ? 2 : p[0] >= 0xc0 ? 1 : -1;
    if (n < 0) { (*s)++; return 0xfffd; }
    Uint32 c = n ? p[0] & (0x3f >> n) : p[0];
    for (int i = 1; i <= n; i++) { if ((p[i] & 0xc0) != 0x80) { *s += i; return 0xfffd; } c = c << 6 | (p[i] & 0x3f); }
    *s += n + 1; return c;
}
static int glyph_of(Uint32 c) { return c >= GS_FONT_FIRST && c < GS_FONT_FIRST + GS_FONT_GLYPHS - 1 ? (int)(c - GS_FONT_FIRST) : c == '\t' ? 0 : GS_FONT_GLYPHS - 1; }
static int font_arg(lua_State *L, int i) {
    const int f = (int)luaL_optinteger(L, i, 0);
    if (f < 0 || f >= GS_FONTS) luaL_error(L, "there is no built-in font %d", f);
    return f;
}
/* How wide text is in a built-in font at scale 1: each letter's width, and a gap between letters (none after the last). */
static int text_width(const char *s, int f) {
    int w = 0, n = 0;
    for (const char *p = s; *p; n++) w += gs_fonts[f].w[glyph_of(utf8_next(&p))];
    return n ? w + (n - 1) * GS_FONT_GAP : 0;
}
static int l_print(lua_State *L) { /* text,x,y[,r,g,b,a,scale,font,sr,sg,sb,sa] — a built-in font (fonts.h, 0 = round_small); the shadow colour is optional */
    const char *s = luaL_checkstring(L, 1);
    const float sc = (float)luaL_optnumber(L, 8, 1) * g_zoom, x = ZX(luaL_checknumber(L,2)), y = ZY(luaL_checknumber(L,3));
    const int f = font_arg(L, 9);
    if (!font_texture(f)) return 0;
    const GsFont *ft = &gs_fonts[f];
    SDL_Texture *tex = g_font_tex[f];
    /* the shadow first, for the whole text, so it never covers the letter beside it */
    for (int pass = lua_isnoneornil(L, 10) ? 1 : 0; pass < 2; pass++) {
        if (pass == 0) { SDL_SetTextureColorMod(tex, cu8(L, 10, 0), cu8(L, 11, 0), cu8(L, 12, 0)); SDL_SetTextureAlphaMod(tex, cu8(L, 13, 255)); }
        else { SDL_SetTextureColorMod(tex, cu8(L, 4, 255), cu8(L, 5, 255), cu8(L, 6, 255)); SDL_SetTextureAlphaMod(tex, cu8(L, 7, 255)); }
        float cx = x;
        for (const char *p = s; *p;) {
            const Uint32 c = utf8_next(&p);
            const int g = glyph_of(c), gw = ft->w[g];
            if (c > 32) {
                const SDL_Rect src = { g_font_x[f][g], 1 + (pass == 0 ? ft->h + 2 : 0), gw + 1, ft->h + 1 };
                const SDL_FRect dst = { cx, y, (float)(gw + 1) * sc, (float)(ft->h + 1) * sc };
                SDL_RenderCopyF(g_ren, tex, &src, &dst);
            }
            cx += (float)(gw + GS_FONT_GAP) * sc;
        }
    }
    count_px(x, y, (float)text_width(s, f) * sc, (float)ft->h * sc); return 0;
}
static int l_text_width(lua_State *L) { /* text[,font] -> pixels at scale 1 */
    lua_pushinteger(L, text_width(luaL_checkstring(L, 1), font_arg(L, 2))); return 1;
}
static int l_font(lua_State *L) { /* name -> number, height, line height (or nil when there is no built-in font of that name) */
    const char *name = luaL_checkstring(L, 1);
    for (int f = 0; f < GS_FONTS; f++) if (!strcmp(gs_fonts[f].name, name)) {
        lua_pushinteger(L, f); lua_pushinteger(L, gs_fonts[f].h); lua_pushinteger(L, gs_fonts[f].line); return 3;
    }
    return 0;
}
static int l_circle(lua_State *L) { /* cx,cy,radius,r,g,b[,a] filled */
    float cx = ZX(luaL_checknumber(L,1)), cy = ZY(luaL_checknumber(L,2)), r = (float)luaL_checknumber(L,3) * g_zoom;
    set_color(L, 4);
    for (float dy = -r; dy <= r; dy += 1) {
        float dx = sqrtf(fmaxf(r * r - dy * dy, 0));
        SDL_RenderDrawLineF(g_ren, cx - dx, cy + dy, cx + dx, cy + dy);
    }
    g_px_frame += 3.14159 * r * r; g_calls_frame++;
    return 0;
}

/* images: gs.image("a.png") -> {id=, w=, h=}; textures are cached by name and live until exit */
#define MAX_IMAGES 256
static struct { char *name; SDL_Texture *tex; unsigned char *px; int w, h; unsigned seq; unsigned char *recipe; size_t recipe_len; } g_images[MAX_IMAGES]; static int g_nimages;
/* How each picture was made, so a game resumed in a new run (a libretro save state, runtime/libretro.c) can make it again in the same slot:
 * 'F' + file name, 'P' + w, h and the pixels, 'R' + a recolour (source slot and colours), 'C' + a composed tile grid (source slot, sizes, cells).
 * seq orders them: a picture is always made after the pictures it is made from, even when it reuses an older slot. */
static unsigned g_image_seq;
static void image_recipe(int id, char kind, const void *a, size_t alen, const void *b, size_t blen) {
    free(g_images[id].recipe);
    g_images[id].recipe = malloc(1 + alen + blen); g_images[id].recipe_len = 0;
    if (!g_images[id].recipe) return;
    g_images[id].recipe[0] = (unsigned char)kind;
    if (alen) memcpy(g_images[id].recipe + 1, a, alen);
    if (blen) memcpy(g_images[id].recipe + 1 + alen, b, blen);
    g_images[id].recipe_len = 1 + alen + blen; g_images[id].seq = ++g_image_seq;
}
/* A texture for pixels already made, as every picture is drawn: blended unless told it has no see-through pixel, crisp when scaled. */
static SDL_Texture *image_texture(const unsigned char *px, int w, int h, bool opaque) {
    SDL_Texture *t = SDL_CreateTexture(g_ren, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STATIC, w, h);
    if (!t) return NULL;
    SDL_UpdateTexture(t, NULL, px, w * 4);
    SDL_SetTextureBlendMode(t, opaque ? SDL_BLENDMODE_NONE : SDL_BLENDMODE_BLEND);
    SDL_SetTextureScaleMode(t, SDL_ScaleModeNearest); /* crisp pixel art */
    return t;
} /* px: the decoded RGBA pixels, kept for gs.compose (NULL for composed pictures) */

static void push_image(lua_State *L, int id) {
    int w, h; SDL_QueryTexture(g_images[id].tex, NULL, NULL, &w, &h);
    lua_createtable(L, 0, 3);
    lua_pushinteger(L, id); lua_setfield(L, -2, "id");
    lua_pushinteger(L, (lua_Integer)w); lua_setfield(L, -2, "w");
    lua_pushinteger(L, (lua_Integer)h); lua_setfield(L, -2, "h");
}
/* Reads a picture file into slot id (a new slot, or a reload of the same one). NULL, or what went wrong. */
static const char *image_load_file(int id, const char *name) {
    static char err[300];
    size_t n; unsigned char *buf = vfs_read(name, &n);
    if (!buf) { snprintf(err, sizeof err, "image not found: %s", name); return err; }
    int w, h, ch;
    unsigned char *px = stbi_load_from_memory(buf, (int)n, &w, &h, &ch, 4); free(buf);
    if (!px) { snprintf(err, sizeof err, "bad image %s: %s", name, stbi_failure_reason()); return err; }
    SDL_Texture *t = image_texture(px, w, h, false);
    if (!t) { stbi_image_free(px); snprintf(err, sizeof err, "texture: %s", SDL_GetError()); return err; }
    if (id < g_nimages && g_images[id].tex) { SDL_DestroyTexture(g_images[id].tex); free(g_images[id].px); } /* a reload: swap the picture in the same slot */
    if (!g_images[id].name || strcmp(g_images[id].name, name)) { free(g_images[id].name); g_images[id].name = strdup(name); }
    g_images[id].tex = t; g_images[id].px = px; g_images[id].w = w; g_images[id].h = h;
    image_recipe(id, 'F', name, strlen(name) + 1, NULL, 0);
    return NULL;
}
static int l_image(lua_State *L) {
    const char *name = luaL_checkstring(L, 1);
    const bool fresh = lua_toboolean(L, 2); /* gs.image(name, true): read the file again (live reload); the slot stays the same */
    int slot = -1;
    for (int i = 0; i < g_nimages; i++)
        if (!strcmp(g_images[i].name, name)) { slot = i; break; }
    if (slot >= 0 && !fresh) { push_image(L, slot); return 1; }
    if (slot < 0 && g_nimages >= MAX_IMAGES) return luaL_error(L, "too many images");
    const char *err = image_load_file(slot >= 0 ? slot : g_nimages, name);
    if (err) return luaL_error(L, "%s", err);
    if (slot < 0) slot = g_nimages++;
    push_image(L, slot); return 1;
}

/* gs.compose(sheet, tw, th, sheet_cols, count, cw, ch, grid_cols, grid_rows, rows[, old]) -> picture
 * One picture of a whole tile grid, so a layer that does not change is one draw call a frame instead of hundreds. Cell (c, r) of the grid shows tile
 * number rows[r][c] of the sheet (a tw x th piece, taken left to right, top to bottom, sheet_cols to a row; with count < 0 the number wraps around the
 * sheet_cols pieces of a single-row strip), or nothing when it is nil, negative or past `count`. Cells are cw x ch and the tile must be that size. `old`
 * is a picture this call made before: its slot is reused, so entering a room again does not use up image slots. */
/* The composed picture's pixels (see gs.compose above): cells[r * gc + c] is the tile number of each cell, -1 for none. NULL when out of memory. */
typedef struct { int sid, tw, th, sheet_cols, count, cw, ch, gc, gr; } ComposeArgs;
static unsigned char *compose_px(const ComposeArgs *a, const int *cells, bool *opaque) {
    const int W = a->gc * a->cw, H = a->gr * a->ch, sw = g_images[a->sid].w, sh = g_images[a->sid].h, tw = a->tw, th = a->th;
    unsigned char *out = calloc((size_t)W * H, 4);
    if (!out) return NULL;
    for (int r = 0; r < a->gr; r++)
        for (int c = 0; c < a->gc; c++) {
            int f = cells[r * a->gc + c];
            if (a->count < 0 && f >= 0) f %= a->sheet_cols;
            if (f < 0 || (a->count >= 0 && f >= a->count)) continue;
            const int sx = (f % a->sheet_cols) * tw, sy = (f / a->sheet_cols) * th;
            if (sx + tw <= sw && sy + th <= sh)
                for (int y = 0; y < th; y++)
                    memcpy(out + ((size_t)(r * a->ch + y) * W + (size_t)c * a->cw) * 4, g_images[a->sid].px + ((size_t)(sy + y) * sw + sx) * 4, (size_t)tw * 4);
        }
    /* A picture with no see-through pixel at all (a background wall of panels) is copied instead of blended: the software renderer on the
     * handhelds blends every pixel of a blended picture, which made a full-screen background cost several milliseconds a frame. */
    *opaque = true;
    for (size_t p = 3; p < (size_t)W * H * 4 && *opaque; p += 4) if (out[p] != 255) *opaque = false;
    return out;
}
/* Makes (or remakes, in the same slot) a composed picture and records its recipe. NULL, or what went wrong. */
static const char *compose_into(int id, const ComposeArgs *a, const int *cells) {
    bool opaque; unsigned char *out = compose_px(a, cells, &opaque);
    if (!out) return "compose: out of memory";
    SDL_Texture *t = image_texture(out, a->gc * a->cw, a->gr * a->ch, opaque); free(out);
    if (!t) return "compose: no texture";
    if (id < g_nimages && g_images[id].tex) { SDL_DestroyTexture(g_images[id].tex); free(g_images[id].px); }
    if (!g_images[id].name || strcmp(g_images[id].name, "(composed)")) { free(g_images[id].name); g_images[id].name = strdup("(composed)"); }
    g_images[id].tex = t; g_images[id].px = NULL; g_images[id].w = a->gc * a->cw; g_images[id].h = a->gr * a->ch;
    image_recipe(id, 'C', a, sizeof *a, cells, (size_t)a->gc * a->gr * sizeof(int));
    return NULL;
}
static int l_compose(lua_State *L) {
    luaL_checktype(L, 1, LUA_TTABLE);
    ComposeArgs a;
    lua_getfield(L, 1, "id"); a.sid = (int)luaL_checkinteger(L, -1); lua_pop(L, 1);
    if (a.sid < 0 || a.sid >= g_nimages || !g_images[a.sid].px) return luaL_error(L, "compose: that picture has no pixels to copy from");
    a.tw = (int)luaL_checkinteger(L, 2); a.th = (int)luaL_checkinteger(L, 3); a.sheet_cols = (int)luaL_checkinteger(L, 4); a.count = (int)luaL_checkinteger(L, 5);
    a.cw = (int)luaL_checkinteger(L, 6); a.ch = (int)luaL_checkinteger(L, 7); a.gc = (int)luaL_checkinteger(L, 8); a.gr = (int)luaL_checkinteger(L, 9);
    luaL_checktype(L, 10, LUA_TTABLE);
    if (a.tw != a.cw || a.th != a.ch || a.tw < 1 || a.th < 1 || a.sheet_cols < 1 || a.gc < 1 || a.gr < 1 || (long)a.gc * a.cw > 4096 || (long)a.gr * a.ch > 4096) return luaL_error(L, "compose: bad sizes");
    int *cells = malloc((size_t)a.gc * a.gr * sizeof(int));
    if (!cells) return luaL_error(L, "compose: out of memory");
    for (int r = 0; r < a.gr; r++) {
        lua_rawgeti(L, 10, r + 1);
        const bool row = lua_istable(L, -1);
        for (int c = 0; c < a.gc; c++) {
            int f = -1;
            if (row) { lua_rawgeti(L, -1, c + 1); if (lua_isnumber(L, -1)) f = (int)lua_tointeger(L, -1); lua_pop(L, 1); }
            cells[r * a.gc + c] = f;
        }
        lua_pop(L, 1);
    }
    int id = -1;
    if (lua_istable(L, 11)) { /* reuse the slot of an earlier picture from this function */
        lua_getfield(L, 11, "id"); const int oid = (int)luaL_optinteger(L, -1, -1); lua_pop(L, 1);
        if (oid >= 0 && oid < g_nimages && !g_images[oid].px && g_images[oid].tex) id = oid;
    }
    if (id < 0 && g_nimages >= MAX_IMAGES) { free(cells); return luaL_error(L, "too many images"); }
    const char *err = compose_into(id >= 0 ? id : g_nimages, &a, cells);
    free(cells);
    if (err) return luaL_error(L, "%s", err);
    if (id < 0) id = g_nimages++;
    push_image(L, id); return 1;
}
static int l_mosaic(lua_State *L); /* with the frame's end, below */
/* gs.recolor(img, from, to[, old]) -> picture
 * A copy of a picture with colour from[i] replaced by to[i] (both lists of 0xRRGGBB numbers), for GBA-style palette swaps: the same sprite drawn
 * with another bank's colours, place for place. Transparency is kept; colours not in `from` stay as they are. `old` is a picture this call made
 * before, whose slot is reused (live reload, a bank edited). Done once per sprite and bank, so a plain search of at most 16 colours is fine.
 * With `from` false and `to` one number, every pixel that shows becomes that colour: the white silhouette a hit flashes with. */
typedef struct { int sid, all, n; unsigned from[64], to[64]; } RecolorArgs;
static const char *recolor_into(int id, const RecolorArgs *a) {
    const int w = g_images[a->sid].w, h = g_images[a->sid].h;
    const size_t bytes = (size_t)w * h * 4;
    unsigned char *out = malloc(bytes);
    if (!out) return "recolor: out of memory";
    memcpy(out, g_images[a->sid].px, bytes);
    for (size_t p = 0; p < bytes; p += 4) {
        if (!out[p + 3]) continue;
        if (a->all) { out[p] = (unsigned char)(a->to[0] >> 16); out[p + 1] = (unsigned char)(a->to[0] >> 8); out[p + 2] = (unsigned char)a->to[0]; continue; }
        const unsigned c = ((unsigned)out[p] << 16) | ((unsigned)out[p + 1] << 8) | out[p + 2];
        for (int i = 0; i < a->n; i++)
            if (a->from[i] == c) { out[p] = (unsigned char)(a->to[i] >> 16); out[p + 1] = (unsigned char)(a->to[i] >> 8); out[p + 2] = (unsigned char)a->to[i]; break; }
    }
    SDL_Texture *t = image_texture(out, w, h, false);
    if (!t) { free(out); return "recolor: no texture"; }
    if (id < g_nimages && g_images[id].tex) { SDL_DestroyTexture(g_images[id].tex); free(g_images[id].px); }
    if (!g_images[id].name || strcmp(g_images[id].name, "(recolored)")) { free(g_images[id].name); g_images[id].name = strdup("(recolored)"); }
    /* the pixels are kept (like a loaded picture), so a recoloured sheet can itself be composed into a tile layer */
    g_images[id].tex = t; g_images[id].px = out; g_images[id].w = w; g_images[id].h = h;
    image_recipe(id, 'R', a, sizeof *a, NULL, 0);
    return NULL;
}
static int l_recolor(lua_State *L) {
    luaL_checktype(L, 1, LUA_TTABLE);
    RecolorArgs a; memset(&a, 0, sizeof a);
    lua_getfield(L, 1, "id"); a.sid = (int)luaL_checkinteger(L, -1); lua_pop(L, 1);
    if (a.sid < 0 || a.sid >= g_nimages || !g_images[a.sid].px) return luaL_error(L, "recolor: that picture has no pixels to copy from");
    a.all = !lua_toboolean(L, 2);
    if (a.all) a.to[0] = (unsigned)luaL_checkinteger(L, 3) & 0xffffff;
    else {
        luaL_checktype(L, 2, LUA_TTABLE); luaL_checktype(L, 3, LUA_TTABLE);
        a.n = (int)lua_rawlen(L, 2);
        if (a.n > 64) a.n = 64;
        if ((int)lua_rawlen(L, 3) < a.n) a.n = (int)lua_rawlen(L, 3);
    }
    for (int i = 0; i < a.n; i++) {
        lua_rawgeti(L, 2, i + 1); a.from[i] = (unsigned)luaL_checkinteger(L, -1) & 0xffffff; lua_pop(L, 1);
        lua_rawgeti(L, 3, i + 1); a.to[i] = (unsigned)luaL_checkinteger(L, -1) & 0xffffff; lua_pop(L, 1);
    }
    int id = -1;
    if (lua_istable(L, 4)) {
        lua_getfield(L, 4, "id"); const int oid = (int)luaL_optinteger(L, -1, -1); lua_pop(L, 1);
        if (oid >= 0 && oid < g_nimages && g_images[oid].tex && !strcmp(g_images[oid].name, "(recolored)")) id = oid;
    }
    if (id < 0 && g_nimages >= MAX_IMAGES) return luaL_error(L, "too many images");
    const char *err = recolor_into(id >= 0 ? id : g_nimages, &a);
    if (err) return luaL_error(L, "%s", err);
    if (id < 0) id = g_nimages++;
    push_image(L, id); return 1;
}
/* gs.raw.pixels(w, h, rgba) -> picture: a picture made from w * h * 4 bytes of RGBA, for art the framework itself carries (the button
 * icons). The pixels are kept, so it can be recoloured like a loaded one. */
static const char *pixels_into(int id, int w, int h, const unsigned char *src) {
    const size_t n = (size_t)w * h * 4;
    unsigned char *px = malloc(n);
    if (!px) return "pixels: out of memory";
    memcpy(px, src, n);
    SDL_Texture *t = image_texture(px, w, h, false);
    if (!t) { free(px); return "pixels: no texture"; }
    if (id < g_nimages && g_images[id].tex) { SDL_DestroyTexture(g_images[id].tex); free(g_images[id].px); }
    if (!g_images[id].name) g_images[id].name = strdup("(pixels)");
    g_images[id].tex = t; g_images[id].px = px; g_images[id].w = w; g_images[id].h = h;
    const int wh[2] = { w, h };
    image_recipe(id, 'P', wh, sizeof wh, src, n);
    return NULL;
}
static int l_pixels(lua_State *L) {
    const int w = (int)luaL_checkinteger(L, 1), h = (int)luaL_checkinteger(L, 2);
    size_t n; const char *src = luaL_checklstring(L, 3, &n);
    if (w < 1 || h < 1 || w > 4096 || h > 4096 || n != (size_t)w * h * 4) return luaL_error(L, "pixels: want %d x %d x 4 bytes", w, h);
    if (g_nimages >= MAX_IMAGES) return luaL_error(L, "too many images");
    const char *err = pixels_into(g_nimages, w, h, (const unsigned char *)src);
    if (err) return luaL_error(L, "%s", err);
    push_image(L, g_nimages++); return 1;
}
static SDL_Texture *check_image(lua_State *L, int i) {
    luaL_checktype(L, i, LUA_TTABLE);
    lua_getfield(L, i, "id"); int id = (int)luaL_checkinteger(L, -1); lua_pop(L, 1);
    if (id < 0 || id >= g_nimages) luaL_error(L, "invalid image");
    return g_images[id].tex;
}
/* SDL2 takes the part of a picture to draw in whole pixels: edges are rounded to the nearest one (a sprite cut at the screen edge can start
 * mid-pixel). */
static SDL_Rect src_rect(SDL_FRect f) {
    const int x0 = (int)floorf(f.x + 0.5f), y0 = (int)floorf(f.y + 0.5f);
    return (SDL_Rect){ x0, y0, (int)floorf(f.x + f.w + 0.5f) - x0, (int)floorf(f.y + f.h + 0.5f) - y0 };
}
static void draw_tex(SDL_Texture *t, SDL_FRect src, float x, float y, float scale, bool flipx) {
    SDL_FRect dst = {ZX(x), ZY(y), src.w * scale * g_zoom, src.h * scale * g_zoom};
    SDL_BlendMode own = SDL_BLENDMODE_BLEND; SDL_GetTextureBlendMode(t, &own);
    if (g_blend != SDL_BLENDMODE_BLEND) SDL_SetTextureBlendMode(t, g_blend);
    const SDL_Rect s = src_rect(src);
    SDL_RenderCopyExF(g_ren, t, &s, &dst, 0, NULL, flipx ? SDL_FLIP_HORIZONTAL : SDL_FLIP_NONE);
    if (g_blend != SDL_BLENDMODE_BLEND) SDL_SetTextureBlendMode(t, own);
    count_px(dst.x, dst.y, dst.w, dst.h);
}
static int l_sprite(lua_State *L) { /* img,x,y[,scale,flipx] whole image */
    SDL_Texture *t = check_image(L, 1); int w, h; SDL_QueryTexture(t, NULL, NULL, &w, &h);
    draw_tex(t, (SDL_FRect){0, 0, (float)w, (float)h}, luaL_checknumber(L,2), luaL_checknumber(L,3), (float)luaL_optnumber(L,4,1), lua_toboolean(L,5));
    return 0;
}
static int l_tile(lua_State *L) { /* img,sx,sy,sw,sh,x,y[,scale,flipx,angle,yscale,alpha,pivotx,pivoty] sub-rectangle of a sheet.
                                      * x,y is where the unscaled sprite's top-left would go; scaling and rotation (degrees, clockwise)
                                      * happen around the pivot (a point in the sprite, default its top-left), which stays put. */
    SDL_Texture *t = check_image(L, 1);
    SDL_FRect src = {luaL_checknumber(L,2), luaL_checknumber(L,3), luaL_checknumber(L,4), luaL_checknumber(L,5)};
    float x = luaL_checknumber(L,6), y = luaL_checknumber(L,7);
    float xs = (float)luaL_optnumber(L,8,1); int flip = lua_toboolean(L,9); float angle = (float)luaL_optnumber(L,10,0);
    float ys = (float)luaL_optnumber(L,11,xs), alpha = (float)luaL_optnumber(L,12,255);
    float px = (float)luaL_optnumber(L,13,0), py = (float)luaL_optnumber(L,14,0);
    SDL_FRect dst = {ZX(x + px - px * xs), ZY(y + py - py * ys), src.w * xs * g_zoom, src.h * ys * g_zoom};
    if (dst.w < 0) { dst.x += dst.w; dst.w = -dst.w; } /* a negative scale mirrors like the flip flag does */
    if (dst.h < 0) { dst.y += dst.h; dst.h = -dst.h; }
    SDL_FPoint c = {fabsf(px * xs * g_zoom), fabsf(py * ys * g_zoom)};
    bool flipx = (flip != (xs < 0)), flipy = ys < 0;
    /* SDL's software renderer loses the alpha of a see-through picture that is only partly on the screen (it comes out with a black box), so an
     * unrotated draw is cut to the screen here and SDL only ever gets a picture that is wholly inside. Pictures fully off screen are skipped. */
    if (angle == 0 && dst.w > 0 && dst.h > 0) {
        const float x1 = dst.x + dst.w, y1 = dst.y + dst.h;
        if (x1 <= 0 || y1 <= 0 || dst.x >= (float)g_screen_w || dst.y >= (float)g_screen_h) { count_px(dst.x, dst.y, dst.w, dst.h); return 0; }
        if (dst.x < 0 || dst.y < 0 || x1 > (float)g_screen_w || y1 > (float)g_screen_h) {
            const float fx = src.w / dst.w, fy = src.h / dst.h;
            const float l = fmaxf(0, -dst.x), r = fmaxf(0, x1 - (float)g_screen_w), tp = fmaxf(0, -dst.y), bt = fmaxf(0, y1 - (float)g_screen_h);
            src.x += (flipx ? r : l) * fx; src.w -= (l + r) * fx;
            src.y += (flipy ? bt : tp) * fy; src.h -= (tp + bt) * fy;
            dst.x += l; dst.w -= l + r; dst.y += tp; dst.h -= tp + bt;
            c.x -= l; c.y -= tp;
        }
    }
    /* an opaque picture (blend mode none) is copied, unless this draw wants it see-through or blended another way */
    SDL_BlendMode own = SDL_BLENDMODE_BLEND; SDL_GetTextureBlendMode(t, &own);
    const SDL_BlendMode use = g_blend != SDL_BLENDMODE_BLEND ? g_blend : (own == SDL_BLENDMODE_NONE && alpha < 255) ? SDL_BLENDMODE_BLEND : own;
    if (alpha < 255) SDL_SetTextureAlphaMod(t, (Uint8)(alpha < 0 ? 0 : alpha));
    if (use != own) SDL_SetTextureBlendMode(t, use);
    const SDL_Rect s = src_rect(src);
    SDL_RenderCopyExF(g_ren, t, &s, &dst, angle, &c, (SDL_RendererFlip)((flipx ? SDL_FLIP_HORIZONTAL : SDL_FLIP_NONE) | (flipy ? SDL_FLIP_VERTICAL : 0)));
    if (use != own) SDL_SetTextureBlendMode(t, own);
    if (alpha < 255) SDL_SetTextureAlphaMod(t, 255);
    count_px(dst.x, dst.y, dst.w, dst.h);
    return 0;
}
static int btn_index(lua_State *L) {
    const char *n = luaL_checkstring(L, 1);
    for (int i = 0; i < B_COUNT; i++) if (!strcmp(n, btn_names[i])) return i;
    return luaL_error(L, "unknown button '%s'", n);
}
static int l_btn(lua_State *L)  { lua_pushboolean(L, btn_now[btn_index(L)]); return 1; }
static int l_btnp(lua_State *L) { int i = btn_index(L); lua_pushboolean(L, btn_now[i] && !btn_prev[i]); return 1; }
static int l_clock(lua_State *L) { lua_pushnumber(L, ticks_ns() / 1e9); return 1; } /* gs.clock(): seconds since start, fine-grained (for timing) */
static int l_time(lua_State *L) { lua_pushnumber(L, SDL_GetTicks() / 1000.0); return 1; }
static int l_quit(lua_State *L) { (void)L; g_quit = true; return 0; }
/* gs.pad_last(): the number of the raw joystick button pressed most recently (then forgotten), or nil. For the pad setup cart. */
static int l_pad_last(lua_State *L) { if (g_raw_last < 0) lua_pushnil(L); else lua_pushinteger(L, g_raw_last); g_raw_last = -1; return 1; }
/* gs.pad_set(name, n): use raw joystick button n for the button called name, and remember it for next time. Returns false if it could not be saved. */
static int l_pad_set(lua_State *L) {
    if (!strcmp(luaL_checkstring(L, 1), "hotkey")) g_raw_hotkey = (int)luaL_checkinteger(L, 2);
    else { int i = btn_index(L); g_rawmap[i] = (int)luaL_checkinteger(L, 2); }
    lua_pushboolean(L, padmap_save()); return 1;
}
/* gs.pad_reset(): forget the saved map and go back to the default gamepad mapping. */
static int l_pad_reset(lua_State *L) {
    for (int i = 0; i < B_COUNT; i++) g_rawmap[i] = -1;
    g_raw_hotkey = -1;
    char path[1100]; if (padmap_path(path, sizeof path)) remove(path);
    (void)L; return 0;
}
static int l_load(lua_State *L) { /* read a cartridge file as a string */
    size_t n; unsigned char *b = vfs_read(luaL_checkstring(L, 1), &n);
    if (!b) { lua_pushnil(L); return 1; }
    lua_pushlstring(L, (char *)b, n); free(b); return 1;
}

/* saves: one file per key under a per-cart directory (override with GS_SAVE_DIR; useful on devices) */
static char g_savedir[1024];

static bool valid_key(const char *k) {
    if (!*k || strlen(k) > 64 || k[0] == '.') return false;
    for (; *k; k++)
        if (!(isalnum((unsigned char)*k) || *k == '_' || *k == '-' || *k == '.')) return false;
    return true;
}
static int l_save(lua_State *L) { /* gs.save(key, string) -> ok */
    const char *k = luaL_checkstring(L, 1); size_t n; const char *data = luaL_checklstring(L, 2, &n);
    if (!valid_key(k) || !g_savedir[0]) { lua_pushboolean(L, 0); return 1; }
    char path[1200], tmp[1210];
    snprintf(path, sizeof path, "%s/%s", g_savedir, k); snprintf(tmp, sizeof tmp, "%s.tmp", path);
    FILE *f = fopen(tmp, "wb");
    bool ok = f && fwrite(data, 1, n, f) == n;
    if (f) ok = (fclose(f) == 0) && ok;
    if (ok) ok = rename(tmp, path) == 0; /* atomic replace so a power-off can't leave a half-written save */
    lua_pushboolean(L, ok); return 1;
}
static int l_loadsave(lua_State *L) { /* gs.loadsave(key) -> string or nil */
    const char *k = luaL_checkstring(L, 1);
    char path[1200]; size_t n;
    if (!valid_key(k) || !g_savedir[0]) { lua_pushnil(L); return 1; }
    snprintf(path, sizeof path, "%s/%s", g_savedir, k);
    unsigned char *b = read_all(path, &n);
    if (!b) { lua_pushnil(L); return 1; }
    lua_pushlstring(L, (char *)b, n); free(b); return 1;
}
static void init_savedir(const char *cartpath) {
    const char *env = getenv("GS_SAVE_DIR");
    if (env && *env) snprintf(g_savedir, sizeof g_savedir, "%s", env);
    else {
        char name[128]; const char *base = strrchr(cartpath, '/'); base = base ? base + 1 : cartpath;
        snprintf(name, sizeof name, "%s", base);
        char *dot = strrchr(name, '.'); if (dot && !strcmp(dot, ".cart")) *dot = 0;
        char *p = SDL_GetPrefPath("gs", name);
        if (p) { snprintf(g_savedir, sizeof g_savedir, "%s", p); SDL_free(p); }
    }
    size_t l = strlen(g_savedir);
    while (l > 1 && g_savedir[l - 1] == '/') g_savedir[--l] = 0;
    if (g_savedir[0]) mkdir(g_savedir, 0755);
}

/* audio: WAV only. One audio device; a small software mixer runs in SDL's audio thread.
 * Sounds are converted to the mix format (float stereo 44.1k) at load time so play() is cheap. */
#define MAX_SOUNDS 128
#define MAX_VOICES 16
#define MIX_FREQ 44100
/* GS_PERF: how long the game thread waits for the audio lock, and how long one run of the audio callback takes (both in ms, worst and total). */
static bool g_perf_on;
static double g_lock_wait_max, g_lock_wait_sum, g_lock_count, g_cb_max, g_cb_sum, g_cb_count;
static struct { char *name; float *pcm; Uint32 frames; } g_sounds[MAX_SOUNDS]; static int g_nsounds;
static struct { bool active, loop; int snd; Uint32 pos; float gain; } g_voices[MAX_VOICES];
static SDL_AudioDeviceID g_audio_dev; /* 0: no sound */
static bool g_audio_ok;

/* Starting and stopping sounds is posted to a small queue instead of done under the audio lock. The audio thread holds that lock for the whole of
 * every mix (3 to 6 ms on the RG35XX Pro), so a game that took the lock to start a sound waited for the end of the mix: gs.sfx_play cost 3 to 10 ms
 * and every brick hit made a frame late. The queue has its own tiny lock; the audio thread carries the commands out at the start of its next run
 * (about 11 ms of sound later at most), and anything that takes the audio lock itself (loading sounds) carries out the waiting ones first, so the
 * order of calls is kept. */
enum { SC_SFX_PLAY, SC_SFX_STOP, SC_MUSIC_PLAY, SC_SONG_PLAY, SC_MUSIC_STOP };
typedef struct { int op, n, hs[SYNTH_MAX_SFX_CHANNELS], arg; float v; } SoundCmd;
#define SOUND_QUEUE 128
static SoundCmd g_sound_q[SOUND_QUEUE]; static int g_sound_head, g_sound_count; static SDL_mutex *g_sound_mutex; static long g_sound_ran; /* commands carried out so far */
static void sound_post(const SoundCmd *c) {
    if (!g_sound_mutex) return;
    SDL_LockMutex(g_sound_mutex);
    if (g_sound_count < SOUND_QUEUE) { g_sound_q[(g_sound_head + g_sound_count) % SOUND_QUEUE] = *c; g_sound_count++; }
    SDL_UnlockMutex(g_sound_mutex);
}
/* The caller holds the audio lock (the audio thread inside its callback does). */
static void sound_run_commands(void) {
    for (;;) {
        SoundCmd c;
        SDL_LockMutex(g_sound_mutex);
        if (g_sound_count == 0) { SDL_UnlockMutex(g_sound_mutex); return; }
        c = g_sound_q[g_sound_head]; g_sound_head = (g_sound_head + 1) % SOUND_QUEUE; g_sound_count--;
        SDL_UnlockMutex(g_sound_mutex);
        g_sound_ran++;
        switch (c.op) {
        case SC_SFX_PLAY: synth_play_sfx_group(c.hs, c.n, c.v); break;
        case SC_SFX_STOP: synth_stop_sfx(); break;
        case SC_MUSIC_PLAY: synth_play_music(c.arg); break;
        case SC_SONG_PLAY: synth_play_song(c.arg); break;
        case SC_MUSIC_STOP: synth_stop_music(c.arg); break;
        }
    }
}

/* Audio thread. SDL holds the device lock while calling this, and the main thread takes the same lock to touch voices. */
static void SDLCALL mix_cb(void *ud, Uint8 *stream, int len) {
    (void)ud;
    const Uint64 cb_start = g_perf_on ? ticks_ns() : 0;
    sound_run_commands();
    float *out = (float *)stream;
    int left = len / (int)(2 * sizeof(float)); /* stereo frames still to fill */
    while (left > 0) {
        const int frames = SDL_min(left, 512);
        float *buf = out;
        memset(buf, 0, frames * 2 * sizeof(float));
        for (int v = 0; v < MAX_VOICES; v++) {
            if (!g_voices[v].active) continue;
            const float *pcm = g_sounds[g_voices[v].snd].pcm; Uint32 len = g_sounds[g_voices[v].snd].frames;
            for (int f = 0; f < frames; f++) {
                if (g_voices[v].pos >= len) {
                    if (g_voices[v].loop && len) g_voices[v].pos = 0; else { g_voices[v].active = false; break; }
                }
                buf[f * 2]     += pcm[g_voices[v].pos * 2]     * g_voices[v].gain;
                buf[f * 2 + 1] += pcm[g_voices[v].pos * 2 + 1] * g_voices[v].gain;
                g_voices[v].pos++;
            }
        }
        synth_mix(buf, frames); /* the chiptune channels (sound effects and music) */
        for (int i = 0; i < frames * 2; i++) buf[i] = SDL_clamp(buf[i], -1.0f, 1.0f);
        out += frames * 2; left -= frames;
    }
    if (g_perf_on) { const double ms = (ticks_ns() - cb_start) * 1e-6; g_cb_sum += ms; g_cb_count++; if (ms > g_cb_max) g_cb_max = ms; }
}

static void init_audio(void) {
    synth_reset(MIX_FREQ); /* so sound effects and music can be loaded even when there is no audio device */
    g_sound_mutex = SDL_CreateMutex();
    g_audio_ok = SDL_InitSubSystem(SDL_INIT_AUDIO) == 0; /* no audio device is not fatal: play() becomes a no-op */
    if (g_audio_ok) {
        /* GS_AUDIO_FRAMES=N asks for a device buffer of N frames. The default, 1024 (23 ms), is what SDL3 chose here before: measured on the
         * RG35XX Pro, the game's wait for the audio lock was under 3 ms with it, and 512 frames made no difference to the hitches. */
        const char *af = getenv("GS_AUDIO_FRAMES"); const int n = af ? atoi(af) : 0;
        SDL_AudioSpec want = { .freq = MIX_FREQ, .format = AUDIO_F32SYS, .channels = 2, .samples = (Uint16)(n > 0 && n <= 8192 ? n : 1024), .callback = mix_cb };
        g_audio_dev = SDL_OpenAudioDevice(NULL, 0, &want, NULL, 0); /* SDL converts to what the device wants */
        if (g_audio_dev) SDL_PauseAudioDevice(g_audio_dev, 0); else g_audio_ok = false;
    }
    if (!g_audio_ok) fprintf(stderr, "audio disabled: %s\n", SDL_GetError());
}

/* Converts sound data to float samples with the given channels and rate. *out is SDL_malloc'd (the caller frees it). */
static bool convert_audio(const SDL_AudioSpec *from, const Uint8 *data, int len, int channels, int freq, Uint8 **out, int *outlen) {
    *out = NULL; *outlen = 0;
    SDL_AudioStream *st = SDL_NewAudioStream(from->format, from->channels, from->freq, AUDIO_F32SYS, (Uint8)channels, freq);
    if (!st) return false;
    bool ok = SDL_AudioStreamPut(st, data, len) == 0 && SDL_AudioStreamFlush(st) == 0;
    const int avail = ok ? SDL_AudioStreamAvailable(st) : 0;
    if (ok) { *out = SDL_malloc(avail ? avail : 1); ok = *out != NULL; }
    if (ok) { *outlen = SDL_AudioStreamGet(st, *out, avail); ok = *outlen >= 0; }
    SDL_FreeAudioStream(st);
    if (!ok) { SDL_free(*out); *out = NULL; *outlen = 0; }
    return ok;
}
/* Loads a WAV into the next sound slot. NULL, or what went wrong. */
static const char *sound_load_file(const char *name) {
    static char err[300];
    if (g_nsounds >= MAX_SOUNDS) return "too many sounds";
    size_t n; unsigned char *buf = vfs_read(name, &n);
    if (!buf) { snprintf(err, sizeof err, "sound not found: %s", name); return err; }
    SDL_AudioSpec spec; Uint8 *wav; Uint32 wavlen;
    bool ok = SDL_LoadWAV_RW(SDL_RWFromConstMem(buf, (int)n), 1, &spec, &wav, &wavlen) != NULL;
    free(buf);
    if (!ok) { snprintf(err, sizeof err, "bad wav %s: %s", name, SDL_GetError()); return err; }
    Uint8 *out; int outlen;
    ok = convert_audio(&spec, wav, (int)wavlen, 2, MIX_FREQ, &out, &outlen);
    SDL_FreeWAV(wav);
    if (!ok) { snprintf(err, sizeof err, "convert %s: %s", name, SDL_GetError()); return err; }
    int i = g_nsounds;
    g_sounds[i].name = strdup(name); g_sounds[i].pcm = (float *)out; g_sounds[i].frames = outlen / (2 * sizeof(float));
    g_nsounds++;
    return NULL;
}
static int l_sound(lua_State *L) { /* gs.sound("hit.wav") -> handle (cached by name) */
    const char *name = luaL_checkstring(L, 1);
    for (int i = 0; i < g_nsounds; i++)
        if (!strcmp(g_sounds[i].name, name)) { lua_newtable(L); lua_pushinteger(L, i); lua_setfield(L, -2, "id"); return 1; }
    const char *err = sound_load_file(name);
    if (err) return luaL_error(L, "%s", err);
    lua_newtable(L); lua_pushinteger(L, g_nsounds - 1); lua_setfield(L, -2, "id"); return 1;
}
static int l_play(lua_State *L) { /* gs.play(snd[,volume 0..1][,loop]) -> voice id, or nil if unavailable/busy */
    luaL_checktype(L, 1, LUA_TTABLE);
    lua_getfield(L, 1, "id"); int id = (int)luaL_checkinteger(L, -1); lua_pop(L, 1);
    if (id < 0 || id >= g_nsounds) return luaL_error(L, "invalid sound");
    if (!g_audio_ok) return 0;
    float gain = (float)luaL_optnumber(L, 2, 1); bool loop = lua_toboolean(L, 3);
    int v = -1;
    SDL_LockAudioDevice(g_audio_dev);
    for (int i = 0; i < MAX_VOICES; i++) if (!g_voices[i].active) { v = i; break; }
    if (v >= 0) {
        g_voices[v].snd = id; g_voices[v].pos = 0; g_voices[v].gain = gain; g_voices[v].loop = loop; g_voices[v].active = true;
    }
    SDL_UnlockAudioDevice(g_audio_dev);
    if (v < 0) return 0; /* all voices busy: drop the sound */
    lua_pushinteger(L, v + 1); return 1;
}
static int l_stop(lua_State *L) { /* gs.stop(voice) or gs.stop() for everything */
    int v = (int)luaL_optinteger(L, 1, 0) - 1;
    if (!g_audio_ok) return 0;
    SDL_LockAudioDevice(g_audio_dev);
    for (int i = 0; i < MAX_VOICES; i++) if (v < 0 || v == i) g_voices[i].active = false;
    SDL_UnlockAudioDevice(g_audio_dev);
    return 0;
}

/* ---- chiptune: instruments, sound effects and music (see synth.h) ---- */
static void synth_lock(void) {
    if (!g_audio_dev) return;
    if (!g_perf_on) { SDL_LockAudioDevice(g_audio_dev); sound_run_commands(); return; }
    const Uint64 t = ticks_ns();
    SDL_LockAudioDevice(g_audio_dev); sound_run_commands();
    const double ms = (ticks_ns() - t) * 1e-6; g_lock_wait_sum += ms; g_lock_count++; if (ms > g_lock_wait_max) g_lock_wait_max = ms;
}
static void synth_unlock(void) { if (g_audio_dev) SDL_UnlockAudioDevice(g_audio_dev); }
static int clampi(lua_Integer v, int lo, int hi) { return v < lo ? lo : v > hi ? hi : (int)v; }
static lua_Integer table_int(lua_State *L, int t, int i) { lua_rawgeti(L, t, i); lua_Integer v = lua_tointeger(L, -1); lua_pop(L, 1); return v; }
static double field_num(lua_State *L, int t, const char *k, double def) {
    lua_getfield(L, t, k); double v = lua_isnumber(L, -1) ? lua_tonumber(L, -1) : def; lua_pop(L, 1); return v;
}

/* Decode a WAV file in memory to mono float samples at its own rate and register it with the synth. -1 if it can't be used. */
static int sample_from_wav(const unsigned char *bytes, size_t n) {
    SDL_AudioSpec spec; Uint8 *data = NULL; Uint32 len = 0;
    if (!SDL_LoadWAV_RW(SDL_RWFromConstMem(bytes, (int)n), 1, &spec, &data, &len)) return -1;
    Uint8 *out = NULL; int outlen = 0;
    bool ok = convert_audio(&spec, data, (int)len, 1, spec.freq, &out, &outlen);
    SDL_FreeWAV(data);
    if (!ok) return -1;
    int h = synth_add_sample((const float *)out, outlen / (int)sizeof(float), spec.freq);
    SDL_free(out);
    return h;
}

/* The General MIDI SoundFont lives next to the runtime, not in each game (it is about 6 MB): $GS_SOUNDFONT, else TimGM6mb.sf2 beside
 * the executable, in a soundfonts/ folder there, or in the repository's assets/soundfonts/ (found from build/ and build-aarch64/). */
static int ensure_soundfont(char *err, size_t errlen) {
    if (synth_have_soundfont()) return 1;
    const char *base = base_path(), *env = getenv("GS_SOUNDFONT");
    char path[1024];
    const char *tries[5]; int n = 0;
    if (env && *env) tries[n++] = env;
    static char t1[1024], t2[1024], t3[1024];
    snprintf(t1, sizeof t1, "%sTimGM6mb.sf2", base ? base : "./"); tries[n++] = t1;
    snprintf(t2, sizeof t2, "%ssoundfonts/TimGM6mb.sf2", base ? base : "./"); tries[n++] = t2;
    snprintf(t3, sizeof t3, "%s../assets/soundfonts/TimGM6mb.sf2", base ? base : "./"); tries[n++] = t3;
    for (int i = 0; i < n; i++) {
        FILE *f = fopen(tries[i], "rb");
        if (!f) continue;
        fseek(f, 0, SEEK_END); long len = ftell(f); fseek(f, 0, SEEK_SET);
        unsigned char *buf = len > 0 ? malloc((size_t)len) : NULL;
        int ok = buf && fread(buf, 1, (size_t)len, f) == (size_t)len;
        fclose(f);
        if (ok) { synth_lock(); int r = synth_load_soundfont(buf, (int)len); synth_unlock(); free(buf); if (r) return 1; }
        else free(buf);
    }
    (void)path;
    snprintf(err, errlen, "General MIDI instruments need the SoundFont TimGM6mb.sf2 next to the runtime (or set GS_SOUNDFONT to a .sf2 file)");
    return 0;
}
static int l_soundfont_load(lua_State *L) { /* gs.soundfont_load(): make the General MIDI sounds available (errors if the file is missing) */
    char err[300];
    if (!ensure_soundfont(err, sizeof err)) return luaL_error(L, "%s", err);
    return 0;
}
static int l_synth_config(lua_State *L) { /* gs.synth_config(music_tracks, sfx_channels, lofi) */
    synth_lock(); synth_config((int)luaL_checkinteger(L, 1), (int)luaL_checkinteger(L, 2), lua_toboolean(L, 3)); synth_unlock(); return 0;
}
/* the file each synth sample came from, by handle: a game resumed in a new run loads them again in the same order (runtime/libretro.c) */
static char *g_sample_names[256]; static int g_nsample_names;
static int l_sample_load(lua_State *L) { /* gs.sample_load("sounds/kick.wav") -> handle */
    const char *name = luaL_checkstring(L, 1);
    size_t n; unsigned char *buf = vfs_read(name, &n);
    if (!buf) return luaL_error(L, "sample not found: %s", name);
    synth_lock(); int h = sample_from_wav(buf, n); synth_unlock(); free(buf);
    if (h < 0) return luaL_error(L, "could not use %s as a sample (is it a WAV, and are there too many or too big?)", name);
    if (h < 256) { free(g_sample_names[h]); g_sample_names[h] = strdup(name); if (h >= g_nsample_names) g_nsample_names = h + 1; }
    lua_pushinteger(L, h); return 1;
}
/* gs.inst_load{type=, duty=, wave=, noise_short=, sample=, root=, loop_start=, loop_end=, volume=, pan=, attack=, decay=,
 * sustain=, release=, vib_depth=, vib_rate=, vib_delay=} -> handle */
static int l_inst_load(lua_State *L) {
    luaL_checktype(L, 1, LUA_TTABLE);
    SynthInstrument in; synth_default_instrument(&in);
    lua_getfield(L, 1, "type"); const char *type = lua_isstring(L, -1) ? lua_tostring(L, -1) : "pulse";
    if (!strcmp(type, "pulse")) in.type = INST_PULSE;
    else if (!strcmp(type, "wave")) in.type = INST_WAVE;
    else if (!strcmp(type, "noise")) in.type = INST_NOISE;
    else if (!strcmp(type, "sample")) in.type = INST_SAMPLE;
    else if (!strcmp(type, "gm")) in.type = INST_GM;
    else return luaL_error(L, "unknown instrument type '%s'", type);
    lua_pop(L, 1);
    in.duty = clampi((lua_Integer)field_num(L, 1, "duty", 2), 0, 3);
    in.noise_short = field_num(L, 1, "noise_short", 0) != 0;
    in.sample = (int)field_num(L, 1, "sample", -1); in.root = clampi((lua_Integer)field_num(L, 1, "root", 48), 0, 95);
    in.loop_start = (int)field_num(L, 1, "loop_start", -1); in.loop_end = (int)field_num(L, 1, "loop_end", -1);
    in.volume = (float)SDL_clamp(field_num(L, 1, "volume", 1), 0, 1); in.pan = (float)SDL_clamp(field_num(L, 1, "pan", 0), -1, 1);
    in.sustain = (float)SDL_clamp(field_num(L, 1, "sustain", 1), 0, 1);
    in.attack_ms = clampi((lua_Integer)field_num(L, 1, "attack", 0), 0, 5000); in.decay_ms = clampi((lua_Integer)field_num(L, 1, "decay", 0), 0, 5000);
    in.release_ms = clampi((lua_Integer)field_num(L, 1, "release", 0), 0, 5000);
    in.vib_depth = (float)SDL_clamp(field_num(L, 1, "vib_depth", 0), 0, 4); in.vib_rate = (float)SDL_clamp(field_num(L, 1, "vib_rate", 5), 0.1, 20);
    in.vib_delay_ms = clampi((lua_Integer)field_num(L, 1, "vib_delay", 0), 0, 5000);
    in.gm_program = clampi((lua_Integer)field_num(L, 1, "program", 0), 0, 127); in.gm_drum = field_num(L, 1, "drum", 0) != 0;
    in.fixed_note = clampi((lua_Integer)field_num(L, 1, "fixed_note", -1), -1, 127);
    in.sweep = (float)SDL_clamp(field_num(L, 1, "sweep", 0), -48, 48); in.sweep_ms = clampi((lua_Integer)field_num(L, 1, "sweep_ms", 0), 0, 2000);
    lua_getfield(L, 1, "wave");
    if (lua_isstring(L, -1)) { /* 32 hex digits, one per step of the wavetable */
        size_t wl; const char *w = lua_tolstring(L, -1, &wl);
        for (size_t i = 0; i < 32 && i < wl; i++) {
            char ch = w[i]; in.wave[i] = (unsigned char)(ch >= '0' && ch <= '9' ? ch - '0' : ch >= 'a' && ch <= 'f' ? ch - 'a' + 10 : ch >= 'A' && ch <= 'F' ? ch - 'A' + 10 : 8);
        }
    }
    lua_pop(L, 1);
    synth_lock(); int h = synth_add_instrument(&in); synth_unlock();
    if (h < 0) return luaL_error(L, "too many instruments");
    lua_pushinteger(L, h); return 1;
}

/* gs.sfx_load(speed, n, steps, loop_start, loop_end, volume_step) -> handle. `steps` is a flat list: pitch, instrument, volume, effect per step. */
static int l_sfx_load(lua_State *L) {
    int speed = clampi(luaL_checkinteger(L, 1), 1, 64), n = (int)luaL_checkinteger(L, 2);
    luaL_checktype(L, 3, LUA_TTABLE);
    if (n < 1 || n > SYNTH_STEPS) return luaL_error(L, "a sound effect has 1 to %d steps", SYNTH_STEPS);
    SynthSfx s; memset(&s, 0, sizeof s);
    s.speed = speed; s.n = n; s.loop_start = clampi(luaL_optinteger(L, 4, -1), -1, n - 1); s.loop_end = clampi(luaL_optinteger(L, 5, -1), -1, n - 1);
    s.vol_step = clampi(luaL_optinteger(L, 6, 0), -3, 3);
    s.reverb = clampi(luaL_optinteger(L, 7, 0), 0, 100); /* how much goes into the reverb (0: dry) */
    for (int i = 0; i < n; i++) {
        s.steps[i].pitch = (unsigned char)clampi(table_int(L, 3, i * 4 + 1), 0, 63);
        s.steps[i].inst = (unsigned char)clampi(table_int(L, 3, i * 4 + 2), 0, SYNTH_MAX_INSTRUMENTS - 1);
        s.steps[i].vol = (unsigned char)clampi(table_int(L, 3, i * 4 + 3), 0, 7);
        s.steps[i].fx = (unsigned char)clampi(table_int(L, 3, i * 4 + 4), 0, FX_COUNT - 1);
    }
    synth_lock(); int h = synth_add_sfx(&s); synth_unlock();
    if (h < 0) return luaL_error(L, "too many sound effects");
    lua_pushinteger(L, h); return 1;
}
static int l_sfx_play(lua_State *L) { /* gs.sfx_play(handle or {handles}[, volume 0..1]): a table plays a multi-track sound effect */
    float v = (float)luaL_optnumber(L, 2, 1);
    int hs[SYNTH_MAX_SFX_CHANNELS], n = 0;
    if (lua_istable(L, 1)) {
        for (int i = 1; i <= SYNTH_MAX_SFX_CHANNELS; i++) { lua_rawgeti(L, 1, i); if (lua_isinteger(L, -1)) hs[n++] = (int)lua_tointeger(L, -1); lua_pop(L, 1); }
    } else hs[n++] = (int)luaL_checkinteger(L, 1);
    if (!g_audio_ok) return 0;
    SoundCmd c = { .op = SC_SFX_PLAY, .n = n, .v = v }; memcpy(c.hs, hs, sizeof(int) * (size_t)n); sound_post(&c); return 0;
}
static int l_sfx_stop(lua_State *L) { (void)L; if (g_audio_ok) { SoundCmd c = { .op = SC_SFX_STOP }; sound_post(&c); } return 0; }
/* gs.music_load(patterns, slots, loop_from, loop_to) -> handle: the older music, patterns of sound effects. */
static int l_music_load(lua_State *L) {
    int np = (int)luaL_checkinteger(L, 1);
    luaL_checktype(L, 2, LUA_TTABLE);
    if (np < 1 || np > SYNTH_MAX_PATTERNS) return luaL_error(L, "music has 1 to %d patterns", SYNTH_MAX_PATTERNS);
    SynthMusic *m = calloc(1, sizeof *m);
    m->n = np; m->loop_from = clampi(luaL_optinteger(L, 3, -1), -1, np - 1); m->loop_to = clampi(luaL_optinteger(L, 4, -1), -1, np - 1);
    for (int i = 0; i < np; i++)
        for (int c = 0; c < SYNTH_LEGACY_SLOTS; c++) {
            lua_rawgeti(L, 2, i * SYNTH_LEGACY_SLOTS + c + 1);
            m->pat[i].sfx[c] = lua_isnil(L, -1) ? -1 : (int)lua_tointeger(L, -1);
            lua_pop(L, 1);
        }
    synth_lock(); int h = synth_add_music(m); synth_unlock(); free(m);
    if (h < 0) return luaL_error(L, "too many music tracks");
    lua_pushinteger(L, h); return 1;
}
/* gs.song_load{bpm=, rows_per_beat=, tracks=, loop_to=, reverb=, slots={handles}, order={patterns}, rows={per pattern},
 * cells={pattern, track, row, note, instrument, volume, effect, parameter, ...}, chords={pattern, track, row, note, ...}} -> handle: a tracker song. All numbers are
 * counted from 0; a cell not listed is empty. */
static int l_song_load(lua_State *L) {
    luaL_checktype(L, 1, LUA_TTABLE);
    SynthSong *sg = calloc(1, sizeof *sg);
    sg->bpm = clampi((lua_Integer)field_num(L, 1, "bpm", 120), 30, 300);
    sg->rows_per_beat = clampi((lua_Integer)field_num(L, 1, "rows_per_beat", 4), 1, 16);
    sg->tracks = clampi((lua_Integer)field_num(L, 1, "tracks", 4), 1, SYNTH_MAX_CHANNELS);
    sg->loop_to = (int)field_num(L, 1, "loop_to", -1); sg->reverb = clampi((lua_Integer)field_num(L, 1, "reverb", 0), 0, 100);
    lua_getfield(L, 1, "reverb_type"); /* "room" (also for songs saved before there was a choice), "hall" or "cave" */
    { const char *k = lua_tostring(L, -1); sg->reverb_kind = k && !strcmp(k, "hall") ? REVERB_HALL : k && !strcmp(k, "cave") ? REVERB_CAVE : REVERB_ROOM; }
    lua_pop(L, 1);
    for (int i = 0; i < SONG_SLOTS; i++) sg->slots[i] = -1;
    lua_getfield(L, 1, "tvol"); /* each track's volume step, -3..3 */
    if (lua_istable(L, -1)) for (int i = 0; i < SONG_TRACKS; i++) { lua_rawgeti(L, -1, i + 1); sg->tvol[i] = lua_isnumber(L, -1) ? clampi(lua_tointeger(L, -1), -3, 3) : 0; lua_pop(L, 1); }
    lua_pop(L, 1);
    lua_getfield(L, 1, "slots");
    if (lua_istable(L, -1)) for (int i = 0; i < SONG_SLOTS; i++) { lua_rawgeti(L, -1, i + 1); sg->slots[i] = lua_isnumber(L, -1) ? (int)lua_tointeger(L, -1) : -1; lua_pop(L, 1); }
    lua_pop(L, 1);
    lua_getfield(L, 1, "rows");
    int np = lua_istable(L, -1) ? (int)lua_rawlen(L, -1) : 0;
    if (np < 1 || np > SONG_MAX_PATTERNS) { lua_pop(L, 1); free(sg); return luaL_error(L, "a song has 1 to %d patterns", SONG_MAX_PATTERNS); }
    sg->npatterns = np;
    for (int p = 0; p < np; p++) {
        sg->pat[p].rows = clampi(table_int(L, lua_gettop(L), p + 1), 1, SONG_MAX_ROWS);
        for (int t = 0; t < SYNTH_MAX_CHANNELS; t++) for (int r = 0; r < SONG_MAX_ROWS; r++) { SynthCell *c = &sg->pat[p].cell[t][r]; c->note = NOTE_EMPTY; c->vol = NO_VOLUME; c->extra[0] = c->extra[1] = c->extra[2] = -1; }
    }
    lua_pop(L, 1);
    lua_getfield(L, 1, "order");
    sg->norder = lua_istable(L, -1) ? (int)lua_rawlen(L, -1) : 0;
    if (sg->norder < 1 || sg->norder > SONG_MAX_ORDER) { lua_pop(L, 1); free(sg); return luaL_error(L, "a song's order has 1 to %d entries", SONG_MAX_ORDER); }
    for (int i = 0; i < sg->norder; i++) sg->order[i] = clampi(table_int(L, lua_gettop(L), i + 1), 0, np - 1);
    lua_pop(L, 1);
    lua_getfield(L, 1, "cells");
    if (lua_istable(L, -1)) {
        int top = lua_gettop(L); size_t n = lua_rawlen(L, -1);
        for (size_t i = 0; i + 7 < n; i += 8) {
            int p = clampi(table_int(L, top, (int)i + 1), 0, np - 1), t = clampi(table_int(L, top, (int)i + 2), 0, SYNTH_MAX_CHANNELS - 1);
            int r = clampi(table_int(L, top, (int)i + 3), 0, SONG_MAX_ROWS - 1);
            SynthCell *c = &sg->pat[p].cell[t][r];
            lua_Integer note = table_int(L, top, (int)i + 4), vol = table_int(L, top, (int)i + 6);
            c->note = (signed char)(note < 0 ? (note == -1 ? NOTE_OFF : NOTE_EMPTY) : clampi(note, 0, 95));
            c->inst = (unsigned char)clampi(table_int(L, top, (int)i + 5), 0, SONG_SLOTS - 1);
            c->vol = (unsigned char)(vol < 0 ? NO_VOLUME : clampi(vol, 0, 15));
            c->fx = (unsigned char)clampi(table_int(L, top, (int)i + 7), 0, TFX_COUNT - 1); c->fxp = (unsigned char)clampi(table_int(L, top, (int)i + 8), 0, 15);
        }
    }
    lua_pop(L, 1);
    lua_getfield(L, 1, "chords"); /* more notes struck together with a cell's note: pattern, track, row, note, ... */
    if (lua_istable(L, -1)) {
        int top = lua_gettop(L); size_t n = lua_rawlen(L, -1);
        for (size_t i = 0; i + 3 < n; i += 4) {
            int p = clampi(table_int(L, top, (int)i + 1), 0, np - 1), t = clampi(table_int(L, top, (int)i + 2), 0, SYNTH_MAX_CHANNELS - 1);
            int r = clampi(table_int(L, top, (int)i + 3), 0, SONG_MAX_ROWS - 1), note = clampi(table_int(L, top, (int)i + 4), 0, 127);
            SynthCell *c = &sg->pat[p].cell[t][r];
            for (int e = 0; e < 3; e++) if (c->extra[e] < 0) { c->extra[e] = (signed char)note; break; }
        }
    }
    lua_pop(L, 1);
    synth_lock(); int h = synth_add_song(sg); synth_unlock(); free(sg);
    if (h < 0) return luaL_error(L, "too many songs");
    lua_pushinteger(L, h); return 1;
}
static int l_music_play(lua_State *L) { int h = (int)luaL_checkinteger(L, 1); if (g_audio_ok) { SoundCmd c = { .op = SC_MUSIC_PLAY, .arg = h }; sound_post(&c); } return 0; }
static int l_song_play(lua_State *L) { int h = (int)luaL_checkinteger(L, 1); if (g_audio_ok) { SoundCmd c = { .op = SC_SONG_PLAY, .arg = h }; sound_post(&c); } return 0; }
static int l_music_stop(lua_State *L) { int ms = (int)luaL_optinteger(L, 1, 0); if (g_audio_ok) { SoundCmd c = { .op = SC_MUSIC_STOP, .arg = ms }; sound_post(&c); } return 0; }

#ifdef __APPLE__
#define MTIME_NSEC(st) ((st).st_mtimespec.tv_nsec)
#else
#define MTIME_NSEC(st) ((st).st_mtim.tv_nsec)
#endif
/* gs.list(dir) -> array of every file under dir ("sprites" -> "sprites/ball.json", ...), from the cart directory or the packed cart. Dot files are skipped. */
static void list_walk(lua_State *L, const char *rel, int *n) {
    char dirpath[1024]; snprintf(dirpath, sizeof dirpath, "%s/%s", g_dir, rel);
    DIR *d = opendir(dirpath); if (!d) return;
    struct dirent *e;
    while ((e = readdir(d))) {
        if (e->d_name[0] == '.') continue;
        char r[1024]; snprintf(r, sizeof r, "%s%s%s", rel, *rel ? "/" : "", e->d_name);
        char full[2048]; snprintf(full, sizeof full, "%s/%s", g_dir, r);
        struct stat st; if (stat(full, &st)) continue;
        if (S_ISDIR(st.st_mode)) list_walk(L, r, n);
        else { lua_pushstring(L, r); lua_rawseti(L, -2, ++*n); }
    }
    closedir(d);
}
static int l_list(lua_State *L) {
    const char *prefix = luaL_optstring(L, 1, "");
    if (strstr(prefix, "..") || prefix[0] == '/') { lua_newtable(L); return 1; }
    lua_newtable(L);
    int n = 0;
    if (g_dir) { list_walk(L, prefix, &n); return 1; }
    size_t pl = strlen(prefix);
    for (int i = 0; i < g_nfiles; i++) {
        const char *name = g_files[i].name;
        if (pl == 0 || (!strncmp(name, prefix, pl) && name[pl] == '/')) { lua_pushstring(L, name); lua_rawseti(L, -2, ++n); }
    }
    return 1;
}
/* gs.mtime(path) -> seconds since the epoch when the file was last changed, or nil (packed carts have no such thing). For live reload. */
static int l_mtime(lua_State *L) {
    const char *name = luaL_checkstring(L, 1);
    if (!g_dir || strstr(name, "..") || name[0] == '/') { lua_pushnil(L); return 1; }
    char path[1024]; snprintf(path, sizeof path, "%s/%s", g_dir, name);
    struct stat st; if (stat(path, &st)) { lua_pushnil(L); return 1; }
    lua_pushnumber(L, (lua_Number)st.st_mtime + (lua_Number)MTIME_NSEC(st) * 1e-9);
    return 1;
}

static const luaL_Reg gs_lib[] = {
    {"sfx_load", l_sfx_load}, {"sfx_play", l_sfx_play}, {"sfx_stop", l_sfx_stop},
    {"music_load", l_music_load}, {"music_play", l_music_play}, {"music_stop", l_music_stop},
    {"synth_config", l_synth_config}, {"soundfont_load", l_soundfont_load}, {"sample_load", l_sample_load}, {"inst_load", l_inst_load}, {"song_load", l_song_load}, {"song_play", l_song_play},
    {"save", l_save}, {"loadsave", l_loadsave}, {"sound", l_sound}, {"play", l_play}, {"stop", l_stop},
    {"clear", l_clear}, {"rect", l_rect}, {"line", l_line}, {"print", l_print}, {"text_width", l_text_width}, {"font", l_font},
    {"camera", l_camera}, {"compose", l_compose}, {"recolor", l_recolor}, {"pixels", l_pixels}, {"mosaic", l_mosaic}, {"blend", l_blend}, {"stats", l_stats}, {"ram", l_ram}, {"mark", l_mark}, {"set_resolution", l_set_resolution}, {"screen", l_screen}, {"circle", l_circle}, {"image", l_image}, {"sprite", l_sprite}, {"tile", l_tile},
    {"btn", l_btn}, {"btnp", l_btnp}, {"time", l_time}, {"clock", l_clock}, {"quit", l_quit}, {"zoom", l_zoom}, {"load", l_load}, {"list", l_list}, {"mtime", l_mtime},
    {"pad_last", l_pad_last}, {"pad_set", l_pad_set}, {"pad_reset", l_pad_reset}, {NULL, NULL}};

/* require("foo.bar") loads foo/bar.lua from the cartridge */
static int cart_searcher(lua_State *L) {
    const char *mod = luaL_checkstring(L, 1);
    char path[512]; snprintf(path, sizeof path, "%s.lua", mod);
    for (char *c = path; *c; c++) if (*c == '.' && strcmp(c, ".lua")) *c = '/';
    size_t n; unsigned char *b = vfs_read(path, &n);
    if (!b) { lua_pushfstring(L, "no cart file '%s'", path); return 1; }
    char chunk[520]; snprintf(chunk, sizeof chunk, "@%s", path); /* "@" so errors say entities/ball.lua:12: */
    int rc = luaL_loadbuffer(L, (char *)b, n, chunk); free(b);
    if (rc) return lua_error(L);
    return 1;
}

static int call_global(lua_State *L, const char *name, int nargs, double arg) {
    lua_getglobal(L, name);
    if (!lua_isfunction(L, -1)) { lua_pop(L, 1); return 0; }
    if (nargs) lua_pushnumber(L, arg);
    if (lua_pcall(L, nargs, 0, 0)) {
        /* print each distinct error once, not every frame */
        static char last[512];
        const char *msg = lua_tostring(L, -1);
        if (msg && strncmp(msg, last, sizeof last - 1)) {
            fprintf(stderr, "lua error: %s\n", msg);
            snprintf(last, sizeof last, "%s", msg);
        }
        lua_pop(L, 1); return -1;
    }
    return 0;
}

/* gs render-audio <description.txt> <out.wav>: render a sound effect, music or a song to a WAV file (44.1 kHz, 16-bit, mono
 * unless the description says "stereo"). The studio uses this to preview sounds, so previews are produced by exactly the
 * code the game runs. The description is plain text, one item per line (ids count up from 0 in the order they appear,
 * instruments from 6, after the six built in):
 *   stereo | style gba|clean | channels <music tracks> | sfxchannels <n>
 *   sample <id> <path under sounds/>
 *   inst <id> pulse <duty> <common>      inst <id> wave <32 hex digits> <common>      inst <id> noise <short> <common>
 *   inst <id> sample <sample id> <root> <loop_start> <loop_end> <common>
 *   inst <id> gm <program 0..127> <drum kit 0|1> <common>   (needs the SoundFont, see ensure_soundfont)
 *       common = volume% pan% attack_ms decay_ms sustain% release_ms vibrato_depth*100 vibrato_rate*10 vibrato_delay_ms
 *                [sweep_semitones*100 sweep_ms [fixed_note or -1]]  (the last three may be left off)
 *   sfx <id> <speed> <n> <loop_start> <loop_end> [<volume step> [<reverb 0..100>]], then n lines:  s <pitch> <instrument> <volume> <effect>
 *   music <id> <patterns> <loop_from> <loop_to>, then that many lines:  p <sfx> <sfx> <sfx> <sfx>
 *   song <id> <bpm> <rows_per_beat> <voices> <loop_to> <reverb> [<space: 0 room, 1 hall, 2 cave>]   then  slots <16 instrument handles>,
 *       order <n> <patterns...>, and per pattern  pattern <index> <rows>  with  cell <pattern> <track> <row> <note> <inst> <vol> <fx> <fxp> [<extra note>...]
 *   with sfx <id>[,<id>...] [volume]   (before a render: also play these sound effect tracks, to hear effects over music)
 *   render sfx <id>[,<id>...] [volume [seconds]]   (several ids = the tracks of one sound effect)  |  render music <id> <seconds>  |  render song <id> <seconds> */
static int safe_sound_path(const char *p) {
    return strncmp(p, "sounds/", 7) == 0 && !strstr(p, "..") && !strchr(p, '\\') && strlen(p) < 200;
}
static void read_common(const char *rest, SynthInstrument *in) {
    int vol = 100, pan = 0, a = 0, d = 0, sus = 100, r = 0, vd = 0, vr = 50, vdel = 0, sw = 0, swms = 0, fixed = -1;
    sscanf(rest, "%d %d %d %d %d %d %d %d %d %d %d %d", &vol, &pan, &a, &d, &sus, &r, &vd, &vr, &vdel, &sw, &swms, &fixed);
    in->fixed_note = SDL_clamp(fixed, -1, 127);
    in->sweep = SDL_clamp(sw, -4800, 4800) / 100.0f; in->sweep_ms = SDL_clamp(swms, 0, 2000);
    in->volume = SDL_clamp(vol, 0, 100) / 100.0f; in->pan = SDL_clamp(pan, -100, 100) / 100.0f;
    in->attack_ms = SDL_clamp(a, 0, 5000); in->decay_ms = SDL_clamp(d, 0, 5000); in->sustain = SDL_clamp(sus, 0, 100) / 100.0f;
    in->release_ms = SDL_clamp(r, 0, 5000); in->vib_depth = SDL_clamp(vd, 0, 400) / 100.0f; in->vib_rate = SDL_clamp(vr, 1, 200) / 10.0f;
    in->vib_delay_ms = SDL_clamp(vdel, 0, 5000);
}
static const char *skip_words(const char *p, int n) { /* past n space-separated words */
    while (n-- > 0) { while (*p == ' ') p++; while (*p && *p != ' ' && *p != '\n') p++; }
    return p;
}
static int render_audio(const char *descpath, const char *outpath) {
    FILE *f = fopen(descpath, "r");
    if (!f) { perror(descpath); return 1; }
    synth_reset(44100);
    char line[1024]; SynthSfx sfx; SynthMusic *mus = calloc(1, sizeof *mus); SynthSong *song = calloc(1, sizeof *song);
    int sfx_left = 0, mus_left = 0, si = 0, mi = 0, ni = 0, ngi = 0, song_open = 0, stereo = 0, lofi = 0, channels = 6, sfx_channels = 3;
    float *pcm = NULL; long frames = 0;
    int with_ids[SYNTH_MAX_SFX_CHANNELS], with_n = 0; float with_vol = 1;
    memset(&sfx, 0, sizeof sfx);
#define FINISH_SONG() do { if (song_open) { if (synth_add_song(song) < 0) { fprintf(stderr, "too many songs\n"); return 1; } song_open = 0; } } while (0)
    while (fgets(line, sizeof line, f)) {
        int a, b, c, d, e, g; char word[16], path[256], hex[64];
        if (sfx_left > 0 && sscanf(line, "s %d %d %d %d", &a, &b, &c, &d) == 4) {
            SynthStep *st = &sfx.steps[sfx.n - sfx_left];
            st->pitch = (unsigned char)SDL_clamp(a, 0, 63); st->inst = (unsigned char)SDL_clamp(b, 0, SYNTH_MAX_INSTRUMENTS - 1);
            st->vol = (unsigned char)SDL_clamp(c, 0, 7); st->fx = (unsigned char)SDL_clamp(d, 0, FX_COUNT - 1);
            if (--sfx_left == 0 && synth_add_sfx(&sfx) < 0) { fprintf(stderr, "too many sound effects\n"); return 1; }
        } else if (mus_left > 0 && sscanf(line, "p %d %d %d %d", &a, &b, &c, &d) == 4) {
            SynthPattern *p = &mus->pat[mus->n - mus_left];
            p->sfx[0] = a; p->sfx[1] = b; p->sfx[2] = c; p->sfx[3] = d;
            if (--mus_left == 0 && synth_add_music(mus) < 0) { fprintf(stderr, "too many music tracks\n"); return 1; }
        } else if (!strncmp(line, "stereo", 6)) { stereo = 1;
        } else if (sscanf(line, "style %15s", word) == 1) { lofi = !strcmp(word, "gba");
        } else if (!strncmp(line, "with sfx ", 9)) { /* play these sound effect tracks together with whatever is rendered next */
            const char *p = line + 9; int used = 0; with_n = 0;
            while (with_n < SYNTH_MAX_SFX_CHANNELS && sscanf(p, "%d%n", &with_ids[with_n], &used) == 1) { with_n++; p += used; if (*p == ',') p++; else break; }
            sscanf(p, "%f", &with_vol);
        } else if (sscanf(line, "sfxchannels %d", &a) == 1) { sfx_channels = SDL_clamp(a, 1, SYNTH_MAX_SFX_CHANNELS);
        } else if (sscanf(line, "channels %d", &a) == 1) { channels = SDL_clamp(a, 1, SYNTH_MAX_CHANNELS);
        } else if (sscanf(line, "sample %d %255s", &a, path) == 2) {
            if (a != ni++ || !safe_sound_path(path)) { fprintf(stderr, "bad sample line: %s", line); return 1; }
            FILE *wf = fopen(path, "rb"); unsigned char *buf = NULL; long n = 0;
            if (wf) { fseek(wf, 0, SEEK_END); n = ftell(wf); fseek(wf, 0, SEEK_SET); buf = malloc(n > 0 ? n : 1); if (buf && fread(buf, 1, n, wf) != (size_t)n) n = 0; fclose(wf); }
            if (!buf || n < 44 || sample_from_wav(buf, (size_t)n) < 0) { fprintf(stderr, "can't use sample %s\n", path); return 1; }
            free(buf);
        } else if (!strncmp(line, "inst ", 5)) {
            SynthInstrument in; synth_default_instrument(&in);
            if (sscanf(line, "inst %d %15s", &a, word) != 2 || a != SYNTH_BUILTIN_INSTRUMENTS + ngi) { fprintf(stderr, "bad inst line: %s", line); return 1; }
            const char *rest = skip_words(line, 3);
            if (!strcmp(word, "pulse")) { in.type = INST_PULSE; sscanf(rest, "%d", &b); in.duty = SDL_clamp(b, 0, 3); read_common(skip_words(rest, 1), &in); }
            else if (!strcmp(word, "wave")) {
                in.type = INST_WAVE; if (sscanf(rest, "%63s", hex) != 1) hex[0] = 0;
                for (int i = 0; i < 32 && hex[i]; i++) { char ch = hex[i]; in.wave[i] = (unsigned char)(ch >= '0' && ch <= '9' ? ch - '0' : ch >= 'a' && ch <= 'f' ? ch - 'a' + 10 : ch >= 'A' && ch <= 'F' ? ch - 'A' + 10 : 8); }
                read_common(skip_words(rest, 1), &in);
            }
            else if (!strcmp(word, "gm")) { /* General MIDI: program, drum kit (0/1) */
                in.type = INST_GM; int pr = 0, dr = 0; sscanf(rest, "%d %d", &pr, &dr); in.gm_program = SDL_clamp(pr, 0, 127); in.gm_drum = dr != 0;
                char err[300]; if (!ensure_soundfont(err, sizeof err)) { fprintf(stderr, "%s\n", err); return 1; }
                read_common(skip_words(rest, 2), &in);
            }
            else if (!strcmp(word, "noise")) { in.type = INST_NOISE; sscanf(rest, "%d", &b); in.noise_short = b != 0; read_common(skip_words(rest, 1), &in); }
            else if (!strcmp(word, "sample")) {
                in.type = INST_SAMPLE;
                if (sscanf(rest, "%d %d %d %d", &b, &c, &d, &e) != 4) { fprintf(stderr, "bad inst line: %s", line); return 1; }
                in.sample = b; in.root = SDL_clamp(c, 0, 95); in.loop_start = d; in.loop_end = e;
                read_common(skip_words(rest, 4), &in);
            } else { fprintf(stderr, "unknown instrument type: %s\n", word); return 1; }
            if (synth_add_instrument(&in) < 0) { fprintf(stderr, "too many instruments\n"); return 1; }
            ngi++;
        } else if (sscanf(line, "sfx %d %d %d %d %d %d", &a, &b, &c, &d, &e, &g) >= 5) {
            int rv = 0;
            if (sscanf(line, "sfx %*d %*d %*d %*d %*d %d %d", &g, &rv) < 1) g = 0; /* optional: the track's volume step, then its reverb amount */
            if (a != si++ || c < 1 || c > SYNTH_STEPS) { fprintf(stderr, "bad sfx line: %s", line); return 1; }
            memset(&sfx, 0, sizeof sfx);
            sfx.speed = SDL_clamp(b, 1, 64); sfx.n = c; sfx.loop_start = SDL_clamp(d, -1, c - 1); sfx.loop_end = SDL_clamp(e, -1, c - 1); sfx.vol_step = SDL_clamp(g, -3, 3);
            sfx.reverb = SDL_clamp(rv, 0, 100);
            sfx_left = c;
        } else if (sscanf(line, "music %d %d %d %d", &a, &b, &c, &d) == 4) {
            if (a != mi++ || b < 1 || b > SYNTH_MAX_PATTERNS) { fprintf(stderr, "bad music line: %s", line); return 1; }
            memset(mus, 0, sizeof *mus);
            mus->n = b; mus->loop_from = SDL_clamp(c, -1, b - 1); mus->loop_to = SDL_clamp(d, -1, b - 1);
            mus_left = b;
        } else if (sscanf(line, "song %d %d %d %d %d %d", &a, &b, &c, &d, &e, &g) == 6) {
            FINISH_SONG();
            if (a != ngi + 0 * 0 + (int)0 && 0) return 1;
            memset(song, 0, sizeof *song);
            song->bpm = SDL_clamp(b, 30, 300); song->rows_per_beat = SDL_clamp(c, 1, 16); song->tracks = SDL_clamp(d, 1, SYNTH_MAX_CHANNELS);
            song->loop_to = e; song->reverb = SDL_clamp(g, 0, 100); song->npatterns = 0;
            int kind = 0; if (sscanf(line, "song %*d %*d %*d %*d %*d %*d %d", &kind) == 1) song->reverb_kind = SDL_clamp(kind, 0, REVERB_KINDS - 1); /* optional: 0 room, 1 hall, 2 cave */
            for (int i = 0; i < SONG_SLOTS; i++) song->slots[i] = -1;
            for (int p = 0; p < SONG_MAX_PATTERNS; p++) {
                song->pat[p].rows = 32;
                for (int t = 0; t < SYNTH_MAX_CHANNELS; t++) for (int r = 0; r < SONG_MAX_ROWS; r++) { SynthCell *c0 = &song->pat[p].cell[t][r]; c0->note = NOTE_EMPTY; c0->vol = NO_VOLUME; c0->extra[0] = c0->extra[1] = c0->extra[2] = -1; }
            }
            song_open = 1;
        } else if (song_open && !strncmp(line, "tvol ", 5)) {
            const char *p = line + 5;
            for (int i = 0; i < SONG_TRACKS; i++) { char *end; long v = strtol(p, &end, 10); if (end == p) break; song->tvol[i] = (int)SDL_clamp(v, -3, 3); p = end; }
        } else if (song_open && !strncmp(line, "slots", 5)) {
            const char *p = line + 5;
            for (int i = 0; i < SONG_SLOTS; i++) { char *end; long v = strtol(p, &end, 10); if (end == p) break; song->slots[i] = (int)v; p = end; }
        } else if (song_open && !strncmp(line, "order ", 6)) {
            const char *p = line + 6; char *end; long n = strtol(p, &end, 10); p = end;
            song->norder = (int)SDL_clamp(n, 0, SONG_MAX_ORDER);
            for (int i = 0; i < song->norder; i++) { long v = strtol(p, &end, 10); p = end; song->order[i] = (int)SDL_clamp(v, 0, SONG_MAX_PATTERNS - 1); }
        } else if (song_open && sscanf(line, "pattern %d %d", &a, &b) == 2) {
            if (a >= 0 && a < SONG_MAX_PATTERNS) { song->pat[a].rows = SDL_clamp(b, 1, SONG_MAX_ROWS); if (a + 1 > song->npatterns) song->npatterns = a + 1; }
        } else if (song_open && !strncmp(line, "cell ", 5)) {
            int pp, t, r, note, in, vol, fx, fxp, x[3] = {-1, -1, -1};
            if (sscanf(line, "cell %d %d %d %d %d %d %d %d %d %d %d", &pp, &t, &r, &note, &in, &vol, &fx, &fxp, &x[0], &x[1], &x[2]) >= 8 &&
                pp >= 0 && pp < SONG_MAX_PATTERNS && t >= 0 && t < SYNTH_MAX_CHANNELS && r >= 0 && r < SONG_MAX_ROWS) {
                SynthCell *cl = &song->pat[pp].cell[t][r];
                cl->note = (signed char)(note == -1 ? NOTE_OFF : note < 0 ? NOTE_EMPTY : SDL_clamp(note, 0, 95));
                cl->inst = (unsigned char)SDL_clamp(in, 0, SONG_SLOTS - 1); cl->vol = (unsigned char)(vol < 0 ? NO_VOLUME : SDL_clamp(vol, 0, 15));
                cl->fx = (unsigned char)SDL_clamp(fx, 0, TFX_COUNT - 1); cl->fxp = (unsigned char)SDL_clamp(fxp, 0, 15);
                for (int e = 0; e < 3; e++) cl->extra[e] = (signed char)(x[e] < 0 ? -1 : SDL_clamp(x[e], 0, 127));
            }
        } else if (!strncmp(line, "render ", 7)) {
            FINISH_SONG();
            synth_config(channels, sfx_channels, lofi);
            if (!strncmp(line, "render sfx ", 11)) {
                int ids[SYNTH_MAX_SFX_CHANNELS], nid = 0, used = 0; float vol = 1; double secs = -1, longest = 0;
                const char *p = line + 11;
                while (nid < SYNTH_MAX_SFX_CHANNELS && sscanf(p, "%d%n", &ids[nid], &used) == 1) { /* ids may be a comma list: the tracks of one sound effect */
                    longest = SDL_max(longest, synth_sfx_seconds(ids[nid])); nid++; p += used;
                    if (*p == ',') p++; else break;
                }
                sscanf(p, "%f %lf", &vol, &secs);
                if (secs < 0) secs = longest + 0.05;
                if (secs > 60) secs = 60;
                synth_play_sfx_group(ids, nid, vol);
                frames = (long)(secs * 44100);
            } else if (!strncmp(line, "render music ", 13)) {
                int id = 0; double secs = 10;
                sscanf(line + 13, "%d %lf", &id, &secs);
                if (secs > 120) secs = 120;
                synth_play_music(id);
                frames = (long)(secs * 44100);
            } else if (!strncmp(line, "render song ", 12)) {
                int id = 0; double secs = 10;
                sscanf(line + 12, "%d %lf", &id, &secs);
                if (secs > 180) secs = 180;
                synth_play_song(id);
                frames = (long)(secs * 44100);
            }
            if (with_n > 0 && strncmp(line, "render sfx ", 11)) synth_play_sfx_group(with_ids, with_n, with_vol);
            if (frames > 0) pcm = calloc((size_t)frames * 2, sizeof(float));
        }
    }
    fclose(f);
    if (!pcm || frames < 1) { fprintf(stderr, "nothing to render\n"); return 1; }
    for (long done = 0; done < frames; ) { int n = (int)SDL_min(512, frames - done); synth_mix(pcm + done * 2, n); done += n; }
    FILE *o = fopen(outpath, "wb");
    if (!o) { perror(outpath); return 1; }
    unsigned short chs = stereo ? 2 : 1, fmt = 1, align = (unsigned short)(chs * 2), bits = 16;
    unsigned data = (unsigned)frames * align, riff = 36 + data, rate = 44100, brate = rate * align, fmtlen = 16;
    fwrite("RIFF", 1, 4, o); fwrite(&riff, 4, 1, o); fwrite("WAVEfmt ", 1, 8, o); fwrite(&fmtlen, 4, 1, o);
    fwrite(&fmt, 2, 1, o); fwrite(&chs, 2, 1, o); fwrite(&rate, 4, 1, o); fwrite(&brate, 4, 1, o); fwrite(&align, 2, 1, o); fwrite(&bits, 2, 1, o);
    fwrite("data", 1, 4, o); fwrite(&data, 4, 1, o);
    for (long i = 0; i < frames; i++) {
        for (int c = 0; c < chs; c++) {
            float v = SDL_clamp(pcm[i * 2 + c], -1.0f, 1.0f);
            short q = (short)lrintf(v * 32767.0f);
            fwrite(&q, 2, 1, o);
        }
    }
    fclose(o); free(pcm); free(mus); free(song);
    return 0;
}

/* ---------- framebuffer output (handhelds with no display server) ----------
 * Knulli on the RG35XX Pro has no KMS/DRM and no window system: the screen is /dev/fb0. When SDL finds no video device we draw with the
 * software renderer into a plain surface and copy every frame to the framebuffer ourselves (checked on the device).
 * GS_FBDEV overrides the device path; the pixel format and page flipping follow what the driver reports. */
#ifdef __linux__
static struct {
    int fd; unsigned char *map;
    struct fb_var_screeninfo var; struct fb_fix_screeninfo fix;
    int pages, shown; /* two pages = double buffered: draw the hidden one, then pan to it */
    int dirty_pages;  /* pages still to be blanked before the next frame is copied in */
    unsigned char *rowbuf; size_t rowbuf_len;
    SDL_Surface *surf;
} g_fb = { .fd = -1 };

static bool fb_open(void) {
    const char *dev = getenv("GS_FBDEV"); if (!dev) dev = "/dev/fb0";
    g_fb.fd = open(dev, O_RDWR);
    if (g_fb.fd < 0) { perror(dev); return false; }
    struct fb_var_screeninfo *v = &g_fb.var;
    if (ioctl(g_fb.fd, FBIOGET_VSCREENINFO, v) || ioctl(g_fb.fd, FBIOGET_FSCREENINFO, &g_fb.fix)) { perror("framebuffer info"); return false; }
    fprintf(stderr, "fb: %ux%u (virtual %ux%u) %u bpp, line %u, r%u/%u g%u/%u b%u/%u a%u/%u\n", v->xres, v->yres, v->xres_virtual, v->yres_virtual,
            v->bits_per_pixel, g_fb.fix.line_length, v->red.offset, v->red.length, v->green.offset, v->green.length, v->blue.offset, v->blue.length,
            v->transp.offset, v->transp.length);
    if (v->bits_per_pixel != 32 && v->bits_per_pixel != 16) { fprintf(stderr, "fb: %u bits per pixel is not supported\n", v->bits_per_pixel); return false; }
    Uint32 rm = ((1u << v->red.length) - 1) << v->red.offset, gm = ((1u << v->green.length) - 1) << v->green.offset;
    Uint32 bm = ((1u << v->blue.length) - 1) << v->blue.offset, am = v->transp.length ? ((1u << v->transp.length) - 1) << v->transp.offset : 0;
    const Uint32 pf = SDL_MasksToPixelFormatEnum((int)v->bits_per_pixel, rm, gm, bm, am);
    if (pf == SDL_PIXELFORMAT_UNKNOWN) { fprintf(stderr, "fb: unknown pixel layout\n"); return false; }
    g_fb.map = mmap(NULL, g_fb.fix.smem_len, PROT_READ | PROT_WRITE, MAP_SHARED, g_fb.fd, 0);
    if (g_fb.map == MAP_FAILED) { perror("mmap framebuffer"); return false; }
    g_fb.pages = v->yres_virtual >= 2 * v->yres ? 2 : 1;
    g_fb.shown = g_fb.pages == 2 && v->yres ? (int)(v->yoffset / v->yres) % 2 : 0;
    g_fb.surf = SDL_CreateRGBSurfaceWithFormat(0, (int)v->xres, (int)v->yres, (int)v->bits_per_pixel, pf);
    if (!g_fb.surf) { fprintf(stderr, "fb surface: %s\n", SDL_GetError()); return false; }
    return true;
}
static void fb_thread_start(void); static void fb_thread_stop(void);

/* The software renderer is the slow part on a handheld, and it costs by pixels drawn. So the game is drawn at its own size (320x240, not the
 * 640x480 display) into the top-left corner of the surface, and this copies it to the framebuffer enlarged by a whole number, centred, with
 * black bars. Each output row is built once in a small buffer and then copied, which keeps reads out of the slow framebuffer memory. */
static void fb_clear_pages(void) { g_fb.dirty_pages = g_fb.pages; }

static double g_fb_copy_ms, g_fb_copy_max; static long g_fb_copy_n; /* GS_PERF: the copy into the framebuffer, apart from the pan and the wait for the screen */
/* Copy a finished frame (lw x lh pixels at src) into the hidden page, enlarged, and flip to it. */
static void fb_copy_and_flip(const unsigned char *src, size_t pitch, int lw, int lh) {
    const Uint64 t_copy0 = ticks_ns();
    struct fb_var_screeninfo *v = &g_fb.var;
    const int target = g_fb.pages == 2 ? 1 - g_fb.shown : 0, bpp = (int)v->bits_per_pixel / 8;
    const size_t line = g_fb.fix.line_length;
    unsigned char *page = g_fb.map + (size_t)target * v->yres * line;
    if (g_fb.dirty_pages > 0) { memset(page, 0, (size_t)v->yres * line); g_fb.dirty_pages--; } /* the bars move when the screen size changes */

    const int k = SDL_max(1, SDL_min((int)v->xres / lw, (int)v->yres / lh));
    const int ox = ((int)v->xres - lw * k) / 2, oy = ((int)v->yres - lh * k) / 2;
    if (g_fb.rowbuf_len < (size_t)lw * k * bpp) {
        g_fb.rowbuf_len = (size_t)lw * k * bpp; g_fb.rowbuf = SDL_realloc(g_fb.rowbuf, g_fb.rowbuf_len);
    }
    unsigned char *rb = g_fb.rowbuf;
    for (int y = 0; y < lh; y++) {
        const unsigned char *s = src + (size_t)y * pitch;
        if (bpp == 4) {
            Uint32 *d = (Uint32 *)rb; const Uint32 *s32 = (const Uint32 *)s;
            for (int x = 0; x < lw; x++) { const Uint32 px = s32[x]; for (int j = 0; j < k; j++) *d++ = px; }
        } else {
            Uint16 *d = (Uint16 *)rb; const Uint16 *s16 = (const Uint16 *)s;
            for (int x = 0; x < lw; x++) { const Uint16 px = s16[x]; for (int j = 0; j < k; j++) *d++ = px; }
        }
        for (int j = 0; j < k; j++)
            memcpy(page + (size_t)(oy + y * k + j) * line + (size_t)ox * bpp, rb, (size_t)lw * k * bpp);
    }
    { const double ms = (ticks_ns() - t_copy0) * 1e-6; g_fb_copy_last = ms; g_fb_copy_ms += ms; g_fb_copy_n++; if (ms > g_fb_copy_max) g_fb_copy_max = ms; }
    if (g_fb.pages == 2) {
        v->yoffset = (unsigned)target * v->yres;
        static int wait = -1; /* GS_FB_WAIT=0: flip only, without the extra wait for the refresh (a test: some drivers already wait in the flip) */
        if (wait < 0) { const char *w = getenv("GS_FB_WAIT"); wait = !(w && !strcmp(w, "0")); }
        if (!ioctl(g_fb.fd, FBIOPAN_DISPLAY, v)) g_fb.shown = target;
        if (wait) { int zero = 0; ioctl(g_fb.fd, FBIO_WAITFORVSYNC, &zero); }
    }
}

/* The flip waits for the screen, and on the RG35XX Pro (muOS and Knulli) it must come several milliseconds before the refresh, so a game
 * that waited for it had only about 11 of each frame's 16.7 ms: any frame over that missed a refresh (a stutter) although the work was
 * light. So a thread of its own copies each finished frame to the screen and flips, while the game already makes the next one; the game
 * waits only when the frame before is not on the screen yet, which also paces it to the screen's own refresh. A frame reaches the screen
 * one refresh later than before. GS_FB_THREAD=0 presents on the game's thread as before. */
static struct { SDL_Thread *th; SDL_mutex *mu; SDL_cond *cv; unsigned char *stage; size_t cap, pitch; int w, h; bool busy, quit; } g_fbt;
static int fb_thread_main(void *unused) {
    (void)unused;
    SDL_LockMutex(g_fbt.mu);
    for (;;) {
        while (!g_fbt.busy && !g_fbt.quit) SDL_CondWait(g_fbt.cv, g_fbt.mu);
        if (!g_fbt.busy) break;
        SDL_UnlockMutex(g_fbt.mu);
        fb_copy_and_flip(g_fbt.stage, g_fbt.pitch, g_fbt.w, g_fbt.h);
        SDL_LockMutex(g_fbt.mu);
        g_fbt.busy = false;
        SDL_CondSignal(g_fbt.cv);
    }
    SDL_UnlockMutex(g_fbt.mu);
    return 0;
}
static void fb_thread_start(void) {
    const char *t = getenv("GS_FB_THREAD");
    if (g_fb.pages != 2 || (t && !strcmp(t, "0"))) return;
    g_fbt.mu = SDL_CreateMutex(); g_fbt.cv = SDL_CreateCond();
    if (g_fbt.mu && g_fbt.cv) g_fbt.th = SDL_CreateThread(fb_thread_main, "gs-present", NULL);
}
static void fb_thread_stop(void) {
    if (!g_fbt.th) return;
    SDL_LockMutex(g_fbt.mu); g_fbt.quit = true; SDL_CondSignal(g_fbt.cv); SDL_UnlockMutex(g_fbt.mu);
    SDL_WaitThread(g_fbt.th, NULL); g_fbt.th = NULL;
}
static void fb_present(void) {
    const int lw = SDL_min(g_screen_w, (int)g_fb.var.xres), lh = SDL_min(g_screen_h, (int)g_fb.var.yres);
    const size_t row = (size_t)lw * (g_fb.var.bits_per_pixel / 8);
    if (!g_fbt.th) { fb_copy_and_flip(g_fb.surf->pixels, (size_t)g_fb.surf->pitch, lw, lh); return; }
    SDL_LockMutex(g_fbt.mu);
    while (g_fbt.busy) SDL_CondWait(g_fbt.cv, g_fbt.mu); /* the frame before is still on its way to the screen */
    if (g_fbt.cap < row * lh) { unsigned char *n = SDL_realloc(g_fbt.stage, row * lh); if (n) { g_fbt.stage = n; g_fbt.cap = row * lh; } }
    if (g_fbt.cap >= row * lh) {
        for (int y = 0; y < lh; y++) memcpy(g_fbt.stage + (size_t)y * row, (const unsigned char *)g_fb.surf->pixels + (size_t)y * g_fb.surf->pitch, row);
        g_fbt.pitch = row; g_fbt.w = lw; g_fbt.h = lh; g_fbt.busy = true;
        SDL_CondSignal(g_fbt.cv);
    }
    SDL_UnlockMutex(g_fbt.mu);
}
#endif

/* GS_PERF lines are kept in memory and written when the game ends: a write to a file on the SD card can block for several ms, which would
 * make the very frames being measured slow. (If the process is killed, nothing is written; the test launchers end by themselves.) */
static char g_perf_buf[1 << 16]; static size_t g_perf_len;
static void perf_log(const char *fmt, ...) {
    va_list ap; va_start(ap, fmt);
    if (g_perf_len < sizeof g_perf_buf - 512) g_perf_len += (size_t)vsnprintf(g_perf_buf + g_perf_len, sizeof g_perf_buf - g_perf_len, fmt, ap);
    va_end(ap);
}
static void perf_flush(void) { if (g_perf_len) { fwrite(g_perf_buf, 1, g_perf_len, stderr); fflush(stderr); g_perf_len = 0; } }

/* GS_PERF also times every gs.* call (worst single call and total per second, shown for the three costliest). */
#define MAX_API 64
static const char *g_api_name[MAX_API]; static double g_api_sum[MAX_API], g_api_max[MAX_API]; static long g_api_n[MAX_API];
static int timed_call(lua_State *L) {
    lua_CFunction f = lua_tocfunction(L, lua_upvalueindex(1));
    const int idx = (int)lua_tointeger(L, lua_upvalueindex(2));
    const Uint64 t = ticks_ns();
    const int r = f(L);
    const double ms = (ticks_ns() - t) * 1e-6;
    g_api_sum[idx] += ms; g_api_n[idx]++; if (ms > g_api_max[idx]) g_api_max[idx] = ms;
    return r;
}
static void time_gs_api(lua_State *L) { /* the gs table is on top of the stack */
    for (int i = 0; gs_lib[i].name && i < MAX_API; i++) {
        g_api_name[i] = gs_lib[i].name;
        lua_getfield(L, -1, gs_lib[i].name); lua_pushinteger(L, i); lua_pushcclosure(L, timed_call, 2); lua_setfield(L, -2, gs_lib[i].name);
    }
}
static void api_report(void) {
    int top[3] = {-1, -1, -1};
    for (int i = 0; i < MAX_API && g_api_name[i]; i++) {
        for (int k = 0; k < 3; k++) if (top[k] < 0 || g_api_sum[i] > g_api_sum[top[k]]) { for (int j = 2; j > k; j--) top[j] = top[j - 1]; top[k] = i; break; }
    }
    char line[400]; size_t n = 0;
    for (int k = 0; k < 3; k++) if (top[k] >= 0 && g_api_n[top[k]]) n += (size_t)snprintf(line + n, sizeof line - n, " %s %.1f ms total/%.2f worst (%ld calls);", g_api_name[top[k]], g_api_sum[top[k]], g_api_max[top[k]], g_api_n[top[k]]);
    if (n) perf_log("  api:%s\n", line);
    memset(g_api_sum, 0, sizeof g_api_sum); memset(g_api_max, 0, sizeof g_api_max); memset(g_api_n, 0, sizeof g_api_n);
}

/* GS_PROF=1: a sampling profiler for the Lua code. Every 1000 VM instructions the current source line is counted; the busiest are printed when the game ends.
 * It counts Lua instructions, not time spent inside gs.* calls (see GS_PERF for those). */
#define PROF_SLOTS 4096
static struct { char key[96]; long n; } g_prof[PROF_SLOTS]; static long g_prof_total;
static void prof_hook(lua_State *L, lua_Debug *ar) {
    (void)ar; lua_Debug d;
    if (!lua_getstack(L, 0, &d) || !lua_getinfo(L, "Sl", &d)) return;
    char key[96];
    for (int pass = 0; pass < 2; pass++) { /* the line, and the function it is in (named by where it starts) */
        if (pass == 0) snprintf(key, sizeof key, "line %s:%d", d.short_src, d.currentline);
        else snprintf(key, sizeof key, "func %s:%d", d.short_src, d.linedefined);
        unsigned h = 2166136261u; for (const char *c = key; *c; c++) h = (h ^ (unsigned char)*c) * 16777619u;
        for (int i = 0; i < PROF_SLOTS; i++) {
            const int s = (int)((h + (unsigned)i) % PROF_SLOTS);
            if (!g_prof[s].n) { snprintf(g_prof[s].key, sizeof g_prof[s].key, "%s", key); g_prof[s].n = 1; break; }
            if (!strcmp(g_prof[s].key, key)) { g_prof[s].n++; break; }
        }
    }
    g_prof_total++;
}
static void prof_report(void) {
    if (!g_prof_total) return;
    fprintf(stderr, "profile: %ld samples (one per 1000 Lua instructions)\n", g_prof_total);
    for (int rank = 0; rank < 40; rank++) {
        int best = -1; for (int i = 0; i < PROF_SLOTS; i++) if (g_prof[i].n && (best < 0 || g_prof[i].n > g_prof[best].n)) best = i;
        if (best < 0) break;
        fprintf(stderr, "  %5.1f%%  %s\n", 100.0 * g_prof[best].n / g_prof_total, g_prof[best].key); g_prof[best].n = 0;
    }
}

#ifdef __linux__
/* GS_PERF: an integer from a sysfs file (the CPU clock in kHz, its temperature in thousandths of a degree), or -1. */
static long read_sysfs_long(const char *path) {
    FILE *f = fopen(path, "r"); if (!f) return -1;
    long v = -1; if (fscanf(f, "%ld", &v) != 1) v = -1;
    fclose(f); return v;
}
#endif

/* ---------- embedded preview (the studio shows the game inside its own window) ----------
 * GS_EMBED=<port> (and GS_EMBED_SIZE=<w>x<h>, the console's screen): no window. The game is drawn by the software renderer, the same one the handheld
 * uses, into a surface at the console's size, and every frame that changed is sent to the studio on 127.0.0.1:<port>. Sound plays from here as usual.
 *   to the studio:   'F' u16 width, u16 height, u32 length, then the pixels (RGBA bytes) as runs: u8 count-1, 4 bytes of colour
 *   from the studio: 'B' u16 the buttons held (bit i = btn_names[i]), 'Q' leave, 'S' save a state, 'L' load it (one state a run, kept in memory;
 *                    "state saved" / "state loaded" on stdout, what went wrong on stderr)
 * All numbers are little-endian. When the studio goes away the game ends. */
static embed_sock g_embed = EMBED_NONE;
static SDL_Surface *g_embed_surf;
static Uint32 *g_embed_prev; static size_t g_embed_prev_len; static int g_embed_prev_w, g_embed_prev_h;
static unsigned char *g_embed_out; static size_t g_embed_out_cap;
static unsigned char g_embed_in[64]; static int g_embed_in_len;
static char g_embed_state; /* 'S' or 'L' asked for by the studio, carried out before the next frame */

static void embed_close(void) {
    if (g_embed == EMBED_NONE) return;
#ifdef _WIN32
    closesocket(g_embed);
#else
    close(g_embed);
#endif
    g_embed = EMBED_NONE;
}

static bool embed_open(const char *port, const char *size) {
    int w = 256, h = 192;
    if (size) sscanf(size, "%dx%d", &w, &h);
    if (w < 64 || h < 64 || w > 2048 || h > 2048) { fprintf(stderr, "embed: bad size %s\n", size); return false; }
#ifdef _WIN32
    WSADATA wsa; if (WSAStartup(MAKEWORD(2, 2), &wsa)) { fprintf(stderr, "embed: no sockets\n"); return false; }
#endif
    g_embed = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (g_embed == EMBED_NONE) { fprintf(stderr, "embed: socket failed\n"); return false; }
    struct sockaddr_in a = { 0 };
    a.sin_family = AF_INET; a.sin_port = htons((unsigned short)atoi(port)); a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(g_embed, (struct sockaddr *)&a, sizeof a) != 0) { fprintf(stderr, "embed: could not reach the studio on port %s\n", port); embed_close(); return false; }
    int one = 1; setsockopt(g_embed, IPPROTO_TCP, TCP_NODELAY, (const char *)&one, sizeof one); /* a frame goes out at once, not with the next one */
#ifdef _WIN32
    u_long nb = 1; ioctlsocket(g_embed, FIONBIO, &nb);
#else
    fcntl(g_embed, F_SETFL, fcntl(g_embed, F_GETFL, 0) | O_NONBLOCK);
#endif
    g_embed_surf = SDL_CreateRGBSurfaceWithFormat(0, w, h, 32, SDL_PIXELFORMAT_ABGR8888); /* RGBA in memory: the bytes a canvas wants */
    if (!g_embed_surf) { fprintf(stderr, "embed surface: %s\n", SDL_GetError()); return false; }
    /* no window means no focus: a gamepad plugged into the computer must still count */
    SDL_SetHint(SDL_HINT_JOYSTICK_ALLOW_BACKGROUND_EVENTS, "1");
    return true;
}

/* Sends everything, waiting while the socket is full (the studio reads all the time, so it is short). False: the studio is gone. */
static bool embed_send(const unsigned char *p, size_t n) {
    while (n > 0) {
        const long k = (long)send(g_embed, (const char *)p, (int)SDL_min(n, (size_t)1 << 30), 0);
        if (k > 0) { p += k; n -= (size_t)k; continue; }
#ifdef _WIN32
        if (k < 0 && WSAGetLastError() == WSAEWOULDBLOCK) { delay_ns(200000); continue; }
#else
        if (k < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)) { delay_ns(200000); continue; }
#endif
        return false;
    }
    return true;
}

/* What the studio sent since the last frame: the buttons held, or that the game should end. */
static void embed_poll(void) {
    if (g_embed == EMBED_NONE) return;
    for (;;) {
        const long k = (long)recv(g_embed, (char *)g_embed_in + g_embed_in_len, (int)(sizeof g_embed_in - (size_t)g_embed_in_len), 0);
        if (k == 0) { g_quit = true; return; } /* the studio closed the connection */
        if (k < 0) break; /* nothing more for now */
        g_embed_in_len += (int)k;
        int i = 0;
        while (i < g_embed_in_len) {
            if (g_embed_in[i] == 'B') { if (g_embed_in_len - i < 3) break; g_embed_buttons = (Uint16)(g_embed_in[i + 1] | g_embed_in[i + 2] << 8); g_embed_tapped |= g_embed_buttons; i += 3; }
            else if (g_embed_in[i] == 'Q') { g_quit = true; i++; }
            else if (g_embed_in[i] == 'S' || g_embed_in[i] == 'L') g_embed_state = (char)g_embed_in[i++];
            else i++; /* not ours: skip it */
        }
        memmove(g_embed_in, g_embed_in + i, (size_t)(g_embed_in_len - i)); g_embed_in_len -= i;
    }
}

static void put_u16(unsigned char *p, unsigned v) { p[0] = (unsigned char)v; p[1] = (unsigned char)(v >> 8); }
static void put_u32(unsigned char *p, Uint32 v) { put_u16(p, v & 0xffff); put_u16(p + 2, v >> 16); }

/* The game's corner of the surface, sent when it changed. Pixel art is mostly runs of one colour, so a frame is usually a few tens of KB. */
static double g_embed_copy_last;
static void embed_present(void) {
    const Uint64 t0 = ticks_ns();
    const int w = SDL_min(g_screen_w, g_embed_surf->w), h = SDL_min(g_screen_h, g_embed_surf->h);
    const size_t npx = (size_t)w * h;
    if (g_embed_prev_len < npx) { g_embed_prev = SDL_realloc(g_embed_prev, npx * 4); g_embed_prev_len = npx; g_embed_prev_w = 0; }
    const unsigned char *base = g_embed_surf->pixels; const size_t pitch = (size_t)g_embed_surf->pitch;
    bool same = w == g_embed_prev_w && h == g_embed_prev_h;
    for (int y = 0; y < h && same; y++) same = !memcmp(g_embed_prev + (size_t)y * w, base + (size_t)y * pitch, (size_t)w * 4);
    if (same) { g_embed_copy_last = (ticks_ns() - t0) * 1e-6; return; }
    for (int y = 0; y < h; y++) memcpy(g_embed_prev + (size_t)y * w, base + (size_t)y * pitch, (size_t)w * 4);
    g_embed_prev_w = w; g_embed_prev_h = h;
    const size_t cap = 9 + npx * 5;
    if (g_embed_out_cap < cap) { g_embed_out = SDL_realloc(g_embed_out, cap); g_embed_out_cap = cap; }
    unsigned char *o = g_embed_out + 9;
    for (size_t i = 0; i < npx;) {
        const Uint32 c = g_embed_prev[i]; size_t n = 1;
        while (i + n < npx && n < 256 && g_embed_prev[i + n] == c) n++;
        *o++ = (unsigned char)(n - 1); memcpy(o, &c, 4); o += 4; i += n;
    }
    const size_t len = (size_t)(o - g_embed_out) - 9;
    g_embed_out[0] = 'F'; put_u16(g_embed_out + 1, (unsigned)w); put_u16(g_embed_out + 3, (unsigned)h); put_u32(g_embed_out + 5, (Uint32)len);
    if (!embed_send(g_embed_out, len + 9)) g_quit = true;
    g_embed_copy_last = (ticks_ns() - t0) * 1e-6;
}

/* On a window (a desktop, or a handheld whose SDL2 has a GPU driver) the game draws into a texture at its own size, which present_window
 * enlarges by a whole number onto the screen. Drawing straight at the screen's size would put a sprite at half pixels whenever the camera
 * moved by one, unlike the handheld's framebuffer output and the studio's preview, which draw at the console's size. Whatever the system draws
 * over the game when it presents (muOS's volume, brightness and battery overlays) goes over the enlarged picture. */
static SDL_Texture *g_target;
static void screen_logical(int w, int h) {
    if (g_embed_surf) { /* 1:1 into the corner of the surface; the studio enlarges it */
        SDL_Rect r = { 0, 0, SDL_min(w, g_embed_surf->w), SDL_min(h, g_embed_surf->h) };
        SDL_RenderSetViewport(g_ren, &r);
        return;
    }
#ifdef __linux__
    if (g_use_fb) {
        /* draw 1:1 into the corner of the framebuffer-sized surface; fb_present enlarges it */
        SDL_Rect r = { 0, 0, SDL_min(w, g_fb.surf->w), SDL_min(h, g_fb.surf->h) };
        SDL_RenderSetViewport(g_ren, &r);
        fb_clear_pages();
        return;
    }
#endif
    SDL_SetRenderTarget(g_ren, NULL);
    if (g_target) SDL_DestroyTexture(g_target);
    g_target = SDL_CreateTexture(g_ren, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_TARGET, w, h);
    if (g_target) {
        SDL_SetTextureBlendMode(g_target, SDL_BLENDMODE_NONE);
        SDL_SetTextureScaleMode(g_target, SDL_ScaleModeNearest);
        SDL_SetRenderTarget(g_ren, g_target);
    } else { /* a renderer without render targets: let SDL scale every draw instead */
        SDL_RenderSetLogicalSize(g_ren, w, h);
        SDL_RenderSetIntegerScale(g_ren, SDL_TRUE);
    }
}
/* The GBA's mosaic: after the frame is drawn, each block of n x n pixels takes one colour, the pixel at the block's middle (gs.raw.mosaic(n),
 * 1 is off). Scene changes dissolve with it. With a render target (a GPU) the frame is shrunk into a small texture and enlarged back with
 * nearest-neighbour scaling, so it never leaves the GPU: reading pixels back stalls a GPU, and badly on some handheld drivers. Without one (the
 * framebuffer and embedded paths, which draw in memory anyway) the pixels are read and filled by hand, picking the same pixel per block. */
static int g_mosaic = 1;
static void apply_mosaic_gpu(void) {
    static SDL_Texture *small; static int tw, th;
    const int w = g_screen_w, h = g_screen_h, n = g_mosaic;
    if (tw != w || th != h) {
        if (small) SDL_DestroyTexture(small);
        small = SDL_CreateTexture(g_ren, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_TARGET, w, h);
        tw = w; th = h;
        if (small) { SDL_SetTextureBlendMode(small, SDL_BLENDMODE_NONE); SDL_SetTextureScaleMode(small, SDL_ScaleModeNearest); }
    }
    if (!small) return;
    /* A shrink by n samples each block at (i + 0.5) * n. For an even n that is the edge between two pixels, which a GPU rounds either way
     * (in a pattern: on a 192-high screen every third block went black), so the small picture is moved half a pixel of the frame to sample
     * the centre of pixel i * n + n / 2, the one the drawing in memory picks. Only the corner of the small texture the frame needs is used. */
    const int sw = (w + n - 1) / n, sh = (h + n - 1) / n;
    const float nudge = n % 2 ? 0.0f : -0.5f / (float)n;
    SDL_SetRenderTarget(g_ren, small);
    SDL_RenderCopyF(g_ren, g_target, NULL, &(SDL_FRect){ nudge, nudge, (float)w / n, (float)h / n });
    SDL_SetRenderTarget(g_ren, g_target);
    SDL_RenderCopy(g_ren, small, &(SDL_Rect){ 0, 0, sw, sh }, &(SDL_Rect){ 0, 0, sw * n, sh * n });
}
static void apply_mosaic(void) {
    if (g_target && SDL_GetRenderTarget(g_ren) == g_target) { apply_mosaic_gpu(); return; }
    static SDL_Texture *tex; static int tw, th; static Uint32 *px;
    const int w = g_screen_w, h = g_screen_h, n = g_mosaic;
    if (tw != w || th != h) {
        if (tex) SDL_DestroyTexture(tex);
        free(px); px = malloc((size_t)w * h * 4);
        tex = SDL_CreateTexture(g_ren, SDL_PIXELFORMAT_ABGR8888, SDL_TEXTUREACCESS_STREAMING, w, h);
        tw = w; th = h;
        if (tex) SDL_SetTextureBlendMode(tex, SDL_BLENDMODE_NONE);
    }
    if (!tex || !px) return;
    const SDL_Rect r = { 0, 0, w, h };
    if (SDL_RenderReadPixels(g_ren, &r, SDL_PIXELFORMAT_ABGR8888, px, w * 4) != 0) return;
    for (int by = 0; by < h; by += n) for (int bx = 0; bx < w; bx += n) {
        const Uint32 c = px[SDL_min(by + n / 2, h - 1) * w + SDL_min(bx + n / 2, w - 1)];
        for (int y = by; y < by + n && y < h; y++) for (int x = bx; x < bx + n && x < w; x++) px[y * w + x] = c;
    }
    SDL_UpdateTexture(tex, NULL, px, w * 4);
    SDL_RenderCopy(g_ren, tex, NULL, &r);
}
static int l_mosaic(lua_State *L) { /* n: block size in pixels, 1 = off (the next frames, until changed) */
    const int n = (int)luaL_checkinteger(L, 1);
    g_mosaic = n < 1 ? 1 : n > 32 ? 32 : n; return 0;
}
static void present_window(void) {
    if (!g_target) { SDL_RenderPresent(g_ren); return; }
    SDL_SetRenderTarget(g_ren, NULL);
    SDL_SetRenderDrawColor(g_ren, 0, 0, 0, 255); SDL_RenderClear(g_ren);
    int ow = 0, oh = 0; SDL_GetRendererOutputSize(g_ren, &ow, &oh);
    const int k = SDL_min(ow / g_screen_w, oh / g_screen_h);
    SDL_Rect dst;
    if (k >= 1) dst = (SDL_Rect){ (ow - g_screen_w * k) / 2, (oh - g_screen_h * k) / 2, g_screen_w * k, g_screen_h * k };
    else { /* a window smaller than the screen: fit it, not pixel-exact */
        const float f = fminf((float)ow / g_screen_w, (float)oh / g_screen_h); const int dw = (int)(g_screen_w * f), dh = (int)(g_screen_h * f);
        dst = (SDL_Rect){ (ow - dw) / 2, (oh - dh) / 2, dw, dh };
    }
    SDL_RenderCopy(g_ren, g_target, NULL, &dst);
    SDL_RenderPresent(g_ren);
    SDL_SetRenderTarget(g_ren, g_target);
}

/* ---------- adaptive CPU floor ----------
 * On the handheld the governor (schedutil) can settle at a low clock while the game runs at 30 fps: a frame that misses the screen refresh leaves the
 * CPU idle half of the time, so the load looks light and the clock is never raised. While frames are late, the lowest clock the CPU may use is
 * raised (to about 1.2 GHz); it is put back when the work per frame has been comfortably small for a while. The original value is kept in a state
 * file, so a game that was killed while boosted cannot leave the floor up: the next start (and the launcher) puts it back. GS_NO_BOOST=1 switches it
 * off, GS_BOOST_KHZ chooses the floor. Only used with the framebuffer output (the handheld), where the files are writable. */
static struct {
    bool on, boosted;
    char min_path[200], state_path[200];
    long orig, boost;
    double hold, comfy, need_comfy, since_release;
} g_boost;

static long boost_read(const char *path) { FILE *f = fopen(path, "r"); if (!f) return -1; long v = -1; if (fscanf(f, "%ld", &v) != 1) v = -1; fclose(f); return v; }
static bool boost_write(const char *path, long v) { FILE *f = fopen(path, "w"); if (!f) return false; const bool ok = fprintf(f, "%ld\n", v) > 0; return fclose(f) == 0 && ok; }

static void boost_restore(void) {
    if (!g_boost.on) return;
    boost_write(g_boost.min_path, g_boost.orig);
    remove(g_boost.state_path);
    g_boost.on = g_boost.boosted = false;
}

static bool boost_init(const char *dir) {
    memset(&g_boost, 0, sizeof g_boost);
    char max_path[200], list_path[200];
    snprintf(g_boost.min_path, sizeof g_boost.min_path, "%s/scaling_min_freq", dir);
    snprintf(max_path, sizeof max_path, "%s/scaling_max_freq", dir);
    snprintf(list_path, sizeof list_path, "%s/scaling_available_frequencies", dir);
    const char *st = getenv("GS_BOOST_STATE");
    snprintf(g_boost.state_path, sizeof g_boost.state_path, "%s", st ? st : "/tmp/gs-cpu-min");
    const long stale = boost_read(g_boost.state_path); /* a game that was killed while boosted left its original value here */
    if (stale > 0) { boost_write(g_boost.min_path, stale); remove(g_boost.state_path); }
    const long cur = boost_read(g_boost.min_path), max = boost_read(max_path);
    if (cur <= 0 || max <= 0) return false;
    const char *want = getenv("GS_BOOST_KHZ");
    long target = want ? atol(want) : 1200000;
    if (target > max) target = max;
    FILE *f = fopen(list_path, "r"); /* the clocks the CPU offers: take the lowest one that is at least the target */
    if (f) { long v, best = -1; while (fscanf(f, "%ld", &v) == 1) if (v >= target && (best < 0 || v < best)) best = v; fclose(f); if (best > 0 && best <= max) target = best; }
    if (target <= cur) return false; /* the floor is already that high */
    if (!boost_write(g_boost.state_path, cur)) return false;
    if (!boost_write(g_boost.min_path, cur)) { remove(g_boost.state_path); return false; } /* not writable: leave the CPU alone */
    g_boost.orig = cur; g_boost.boost = target; g_boost.need_comfy = 5; g_boost.since_release = 1e9; g_boost.on = true;
    return true;
}

/* Once a second: seconds covered, late frames (over 20 ms), average frame ms, average ms of work per frame (not counting the wait for the screen). */
static void boost_tick(double secs, long late, double frame_ms, double work_ms) {
    if (!g_boost.on) return;
    g_boost.since_release += secs;
    if (!g_boost.boosted) {
        if (late >= 3 || frame_ms > 18.5) {
            /* soon after a release: the game needs the floor, so wait twice as long before the next release */
            g_boost.need_comfy = g_boost.since_release < 30 ? SDL_min(g_boost.need_comfy * 2, 60) : 5;
            boost_write(g_boost.min_path, g_boost.boost);
            g_boost.boosted = true; g_boost.hold = g_boost.comfy = 0;
            fprintf(stderr, "cpu floor raised to %ld MHz: %ld frames were late (average frame %.1f ms)\n", g_boost.boost / 1000, late, frame_ms);
        }
        return;
    }
    g_boost.hold += secs;
    if (late == 0 && work_ms < 9.0) g_boost.comfy += secs; else g_boost.comfy = 0;
    if (g_boost.hold >= 10 && g_boost.comfy >= g_boost.need_comfy) {
        boost_write(g_boost.min_path, g_boost.orig);
        g_boost.boosted = false; g_boost.since_release = 0;
        fprintf(stderr, "cpu floor back to %ld MHz: %.1f ms of work a frame\n", g_boost.orig / 1000, work_ms);
    }
}

/* gs boost-selftest <dir>: the controller on made-up files (the test script makes them), no CPU involved. */
static int boost_selftest(const char *dir) {
    char min_path[200], state[200]; snprintf(min_path, sizeof min_path, "%s/scaling_min_freq", dir); snprintf(state, sizeof state, "%s/state", dir);
    setenv("GS_BOOST_STATE", state, 1);
    int bad = 0;
#define CHECK(cond, what) do { if (!(cond)) { printf("FAIL: %s\n", what); bad++; } } while (0)
    CHECK(boost_init(dir), "init on good files");
    CHECK(boost_read(state) == 480000, "the original floor is kept in the state file");
    boost_tick(1, 0, 16.7, 5); CHECK(boost_read(min_path) == 480000, "no boost while frames are on time");
    boost_tick(1, 30, 34, 17); CHECK(boost_read(min_path) == 1200000, "boost when frames are late");
    for (int s = 0; s < 8; s++) boost_tick(1, 0, 16.7, 5);
    CHECK(boost_read(min_path) == 1200000, "still boosted before the hold time is over");
    boost_tick(1, 0, 16.7, 5); boost_tick(1, 0, 16.7, 5);
    CHECK(boost_read(min_path) == 480000, "released after the hold time and enough comfortable seconds");
    boost_tick(1, 30, 34, 17); CHECK(boost_read(min_path) == 1200000, "boosted again");
    for (int s = 0; s < 12; s++) boost_tick(1, 0, 16.7, 5); /* needed 10 comfortable seconds now (twice as long, it came back soon) */
    CHECK(boost_read(min_path) == 480000, "released again");
    boost_tick(1, 4, 20, 12); CHECK(boost_read(min_path) == 1200000, "boosted a third time");
    boost_restore();
    CHECK(boost_read(min_path) == 480000 && boost_read(state) < 0, "restore puts the floor back and removes the state file");
    boost_write(min_path, 1200000); boost_write(state, 480000); /* a killed game left this behind */
    CHECK(boost_init(dir), "init after a killed game");
    CHECK(boost_read(min_path) == 480000, "a stale floor is put back at the next start");
    boost_restore();
    printf(bad ? "BOOST SELFTEST FAIL\n" : "BOOST SELFTEST PASS\n");
    return bad ? 1 : 0;
}

/* The game's start, shared by the program and the libretro core: a Lua state with gs.*, the cart's module searcher and the framework,
 * game.lua loaded by gs.boot, and init() run. NULL (with the reason printed) when the cart cannot start. */
static lua_Alloc g_lua_alloc; static lua_CFunction g_lua_panic; /* the libretro core's: Lua's memory in the console's RAM (runtime/ram.c) */
static lua_State *game_start(void) {
    lua_State *L = g_lua_alloc ? lua_newstate(g_lua_alloc, NULL) : luaL_newstate();
    if (!L) { fprintf(stderr, "no memory for Lua\n"); return NULL; }
    if (g_lua_alloc) lua_atpanic(L, g_lua_panic);
    luaL_openlibs(L);
    luaL_newlib(L, gs_lib); if (g_perf_on) time_gs_api(L); lua_setglobal(L, "gs");
    if (getenv("GS_PROF")) lua_sethook(L, prof_hook, LUA_MASKCOUNT, 1000);
    lua_getglobal(L, "package"); lua_getfield(L, -1, "searchers");
    lua_pushcfunction(L, cart_searcher); lua_rawseti(L, -2, (lua_Integer)lua_rawlen(L, -2) + 1);
    lua_pop(L, 2);

    size_t n; unsigned char *src = vfs_read("game.lua", &n);
    if (!src) {
        unsigned char *raw = vfs_read("main.lua", &n);
        fprintf(stderr, raw ? "this game is a plain main.lua, which is no longer supported: it needs a game.lua (see README.md)\n" : "cartridge has no game.lua\n");
        free(raw);
        lua_close(L); return NULL;
    }
    free(src);
    /* register the framework's modules, then let gs.boot load game.lua and define init / update / draw */
    if (luaL_loadbuffer(L, (const char *)gs_framework_lua, gs_framework_lua_len, "=framework") || lua_pcall(L, 0, 0, 0)) {
        fprintf(stderr, "framework: %s\n", lua_tostring(L, -1)); lua_close(L); return NULL;
    }
    if (luaL_dostring(L, "require('gs.boot')")) { fprintf(stderr, "boot: %s\n", lua_tostring(L, -1)); lua_close(L); return NULL; }
    call_global(L, "init", 0, 0);
    return L;
}
/* One frame of the game, shared by the program and the libretro core: a step of dt seconds, then the frame drawn from a clean slate. */
static Uint64 g_t_updated; /* when the last frame's update ended, for GS_PERF's split of update and drawing */
static void game_frame(lua_State *L, double dt) {
    call_global(L, "update", 1, dt);
    g_t_updated = ticks_ns();
    SDL_SetRenderDrawColor(g_ren, 0, 0, 0, 255); SDL_RenderClear(g_ren);
    g_cam_x = g_cam_y = 0; g_zoom = 1; /* every frame starts with no scroll and no zoom */
    g_blend = SDL_BLENDMODE_BLEND; SDL_SetRenderDrawBlendMode(g_ren, g_blend); /* ... and normal blending */
    call_global(L, "draw", 0, 0);
    if (g_blend != SDL_BLENDMODE_BLEND) { g_blend = SDL_BLENDMODE_BLEND; SDL_SetRenderDrawBlendMode(g_ren, g_blend); } /* a draw left it set */
    if (g_mosaic > 1) apply_mosaic();
}

#if !defined(GS_LIBRETRO) && !defined(_WIN32)
#include <dlfcn.h>
#include "ram.c" /* the console's RAM and save states, as in the libretro core */

/* The studio's Save state / Load state: one state, kept in memory for this run (loading copies the RAM back, see runtime/ram.c). */
static unsigned char *g_state_buf; static size_t g_state_len;
static void embed_state(char what) {
    if (!g_ram) { fprintf(stderr, "save states need the console's RAM (GS_RAM=1)\n"); return; }
    if (what == 'S') {
        const size_t n = state_size();
        if (!g_state_buf || g_state_len != n) { free(g_state_buf); g_state_buf = malloc(n); g_state_len = g_state_buf ? n : 0; }
        if (g_state_buf && state_save(g_state_buf, g_state_len)) { printf("state saved\n"); fflush(stdout); }
        else { free(g_state_buf); g_state_buf = NULL; g_state_len = 0; fprintf(stderr, "the state could not be saved\n"); }
    } else if (!g_state_buf) fprintf(stderr, "no state saved yet: press Save state first\n");
    else if (state_load(g_state_buf, g_state_len)) { printf("state loaded\n"); fflush(stdout); }
    else fprintf(stderr, "the state could not be loaded\n");
}
#endif

#ifndef GS_LIBRETRO
int main(int argc, char **argv) {
    if (argc == 3 && !strcmp(argv[1], "boost-selftest")) return boost_selftest(argv[2]);
    if (argc == 4 && !strcmp(argv[1], "render-audio")) return render_audio(argv[2], argv[3]);
    if (argc == 4 && !strcmp(argv[1], "pack")) return pack(argv[2], argv[3]);
    if (argc != 2) { fprintf(stderr, "usage: gs <cart|dir>\n       gs pack <dir> <out.cart>\n"); return 2; }

    struct stat st;
    if (stat(argv[1], &st)) { perror(argv[1]); return 1; }
    if (S_ISDIR(st.st_mode)) g_dir = argv[1];
    else if (!load_cart(argv[1])) { fprintf(stderr, "%s: not a valid cartridge\n", argv[1]); return 1; }

    bool use_fb = false;
    bool win_vsync = false; /* the window's renderer waits for the screen; without it (the dummy driver of the tests) the game is held to 60 a second */
    SDL_SetMainReady();
    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_GAMECONTROLLER) != 0) {
        fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
#ifdef __linux__
        fprintf(stderr, "no video device: drawing to the framebuffer instead\n");
        if (SDL_Init(SDL_INIT_GAMECONTROLLER) != 0 || !fb_open()) { fprintf(stderr, "framebuffer output failed: %s\n", SDL_GetError()); return 1; }
        fb_thread_start();
        use_fb = true;
#else
        return 1;
#endif
    }
    g_debug_input = getenv("GS_DEBUG_INPUT") != NULL;
    g_perf_on = getenv("GS_PERF") != NULL;
    padmap_load();
    alias_load();
    open_controllers();
#ifdef __linux__
    if (g_debug_input) evdev_debug_open();
#endif
    init_savedir(argv[1]);
    init_audio();
    const char *embed_port = getenv("GS_EMBED");
    if (embed_port && !use_fb) {
        if (!embed_open(embed_port, getenv("GS_EMBED_SIZE"))) return 1;
        g_ren = SDL_CreateSoftwareRenderer(g_embed_surf);
        if (!g_ren) { fprintf(stderr, "software renderer: %s\n", SDL_GetError()); return 1; }
        screen_logical(g_screen_w, g_screen_h);
    } else
#ifdef __linux__
    if (use_fb) {
        g_ren = SDL_CreateSoftwareRenderer(g_fb.surf);
        if (!g_ren) { fprintf(stderr, "software renderer: %s\n", SDL_GetError()); return 1; }
        g_use_fb = true;
        screen_logical(g_screen_w, g_screen_h);
        if (!getenv("GS_NO_BOOST")) boost_init(getenv("GS_CPUFREQ_DIR") ? getenv("GS_CPUFREQ_DIR") : "/sys/devices/system/cpu/cpu0/cpufreq");
    } else
#endif
    {
        /* A desktop gets a window; on a handheld (SDL2 with the device's own GPU driver, such as muOS's "mali") the window is the whole screen. */
        const char *drv = SDL_GetCurrentVideoDriver();
        const bool desktop = drv && (!strcmp(drv, "cocoa") || !strcmp(drv, "windows") || !strcmp(drv, "x11") || !strcmp(drv, "wayland") || !strcmp(drv, "dummy") || !strcmp(drv, "offscreen"));
        SDL_Window *win = g_win = SDL_CreateWindow("gs", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, g_screen_w, g_screen_h, desktop ? SDL_WINDOW_RESIZABLE : SDL_WINDOW_FULLSCREEN);
        g_ren = win ? SDL_CreateRenderer(win, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC | SDL_RENDERER_TARGETTEXTURE) : NULL;
        if (!g_ren && win) g_ren = SDL_CreateRenderer(win, -1, 0); /* no GPU (tests run with the dummy driver): any renderer, unpaced */
        if (!g_ren) { fprintf(stderr, "window/renderer: %s\n", SDL_GetError()); return 1; }
        SDL_RendererInfo ri; SDL_GetRendererInfo(g_ren, &ri);
        /* the dummy driver (tests) reports vsync but has no screen to wait for */
        win_vsync = (ri.flags & SDL_RENDERER_PRESENTVSYNC) && strcmp(drv ? drv : "", "dummy") && strcmp(drv ? drv : "", "offscreen");
        if (g_debug_input || g_perf_on) fprintf(stderr, "video: %s, renderer %s%s\n", drv ? drv : "?", ri.name, win_vsync ? ", vsync" : "");
        screen_logical(g_screen_w, g_screen_h);
        SDL_ShowCursor(SDL_DISABLE);
    }
    /* gs.rect / gs.line / gs.print take an alpha: without this the renderer ignores it and every translucent rectangle comes out solid */
    if (g_ren) SDL_SetRenderDrawBlendMode(g_ren, SDL_BLENDMODE_BLEND);

#ifndef _WIN32
    /* GS_RAM=1: Lua gets the console's RAM, a fixed block, instead of the computer's memory (runtime/ram.c) */
    if (getenv("GS_RAM")) {
        if (!ram_open()) { fprintf(stderr, "gs: no memory for the console's RAM\n"); return 1; }
        g_lua_alloc = ram_alloc; g_lua_panic = ram_panic;
    }
#endif
    lua_State *L = game_start();
    if (!L) return 1;
#ifndef _WIN32
    g_core_L = L;
#endif

    Uint64 last = ticks_ns();
    /* GS_MAX_FRAMES=N exits after N frames: for automated tests */
    const char *mf = getenv("GS_MAX_FRAMES");
    long max_frames = mf ? atol(mf) : 0, frame = 0;
    /* GS_MAX_SECONDS=N leaves after N seconds: a way out for test launches on a device whose buttons are not working yet */
    const char *ms = getenv("GS_MAX_SECONDS");
    double max_seconds = ms ? atof(ms) : 0;
    /* GS_PERF=1 prints one line a second to stderr: frames, how long they took (average and worst) and where the time went. Times in ms. */
    const bool perf = getenv("GS_PERF") != NULL;
    struct PerfStat { double n, frame, frame_max, upd, upd_max, draw, draw_max, pres, pres_max, fb, fb_max, slow, snapped; } ps = {0};
    Uint64 perf_report = ticks_ns(), prev_end = perf_report; int slow_lines = 0;
    /* Always on: a game that cannot keep up says so once, with where the time goes (checked every 2 seconds, not during the first 4). */
    double wd_dt = 0, wd_upd = 0, wd_draw = 0, wd_pres = 0, wd_fb = 0; int wd_n = 0; long wd_frames = 0; bool wd_warned = false;
    Uint64 bw_t0 = ticks_ns(); long bw_n = 0, bw_late = 0; double bw_dt = 0, bw_work = 0; /* a one-second window for the CPU floor controller */
    double prev_upd = 0, prev_draw = 0, prev_pres = 0, prev_fb = 0, prev_wait = 0; /* the previous frame's phases: a frame's time (now minus the last now) is that frame's work */
    Uint32 *readback = getenv("GS_READBACK") ? malloc((size_t)2048 * 2048 * 4) : NULL;
    while (!g_quit) {
        if (max_frames && ++frame > max_frames) break;
        if (max_seconds > 0 && SDL_GetTicks() / 1000.0 > max_seconds) break;
#ifdef __linux__
        if (g_debug_input) evdev_debug_poll();
#endif
        const Uint64 t_loop = ticks_ns();
        SDL_Event e;
        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_QUIT) g_quit = true;
            if (e.type == SDL_CONTROLLERDEVICEADDED) open_controller(e.cdevice.which);
            if (e.type == SDL_CONTROLLERDEVICEREMOVED) close_controller(e.cdevice.which);
            if (e.type == SDL_JOYBUTTONDOWN) g_raw_last = e.jbutton.button;
            if (g_debug_input) {
                if (e.type == SDL_JOYBUTTONDOWN) fprintf(stderr, "joystick button %d down\n", e.jbutton.button);
                if (e.type == SDL_CONTROLLERBUTTONDOWN) fprintf(stderr, "gamepad button %s down\n", SDL_GameControllerGetStringForButton((SDL_GameControllerButton)e.cbutton.button));
                if (e.type == SDL_JOYHATMOTION) fprintf(stderr, "joystick hat %d value %d\n", e.jhat.hat, e.jhat.value);
                /* analog triggers and sticks: only when one crosses half way, so a resting stick does not fill the log */
                if (e.type == SDL_JOYAXISMOTION && e.jaxis.axis < 16) {
                    static signed char side[16];
                    const signed char now = e.jaxis.value > 16000 ? 1 : e.jaxis.value < -16000 ? -1 : 0;
                    if (now != side[e.jaxis.axis]) { side[e.jaxis.axis] = now; fprintf(stderr, "joystick axis %d value %d\n", e.jaxis.axis, e.jaxis.value); }
                }
                if (e.type == SDL_JOYBUTTONUP) fprintf(stderr, "joystick button %d up\n", e.jbutton.button);
#ifdef __linux__
                fsync(2); /* a hard reset must not lose the last presses: they are what we read afterwards */
#endif
            }
            if (e.type == SDL_KEYDOWN && e.key.keysym.sym == SDLK_ESCAPE) g_quit = true;
        }
        embed_poll();
#ifndef _WIN32
        if (g_embed_state) { embed_state(g_embed_state); g_embed_state = 0; L = g_core_L; }
#endif
        const Uint64 t_events = ticks_ns();
        poll_buttons();
        const Uint64 t_buttons = ticks_ns();
        /* HOTKEY + START leaves the game, as in every other app on the handheld. Holding START + SELECT for three seconds also does, a way out on a
         * device whose hotkey SDL cannot see (run pad setup to teach it); it is long so that games can use the two together. */
        if (g_hotkey && g_start_raw) g_quit = true;

        Uint64 now = ticks_ns();
        double dt = (now - last) / 1e9; last = now;
        if (dt > 0.1) dt = 0.1;
        const double raw_dt = dt;
        /* The engine runs whole steps from the elapsed time. A frame that lands a hair early or late (16.4 ms, 17.0 ms) would then be a frame
         * with no step followed by one with two, which looks like stutter on a 60 Hz screen. Near 1/60 s the frame time is taken as exactly 1/60. */
        if (dt > 1.0 / 60 - 0.003 && dt < 1.0 / 60 + 0.003) { dt = 1.0 / 60; ps.snapped++; }
        static double start_select_held;
        start_select_held = btn_now[B_START] && btn_now[B_SELECT] ? start_select_held + raw_dt : 0;
        if (start_select_held >= 3.0) g_quit = true;
        game_frame(L, dt);
        /* GS_READBACK=1 copies every finished frame from the GPU into memory, as a libretro core drawing on a GPU of its own would have to
         * (a measure of that cost on a device: it shows in GS_PERF's drawing time) */
        if (readback && g_target) SDL_RenderReadPixels(g_ren, NULL, SDL_PIXELFORMAT_ARGB8888, readback, g_screen_w * 4);
        const Uint64 t_upd = g_t_updated, t_draw = ticks_ns();
        g_px_last = g_px_frame; g_calls_last = g_calls_frame; g_px_frame = 0; g_calls_frame = 0;
        if (g_win) present_window(); else SDL_RenderPresent(g_ren);
        const Uint64 t_pres = ticks_ns();
        Uint64 t_fb = t_pres;
        if (g_win && !win_vsync) {
            t_fb = ticks_ns();
            Uint64 want = now + 16666667ULL;
            if (t_fb < want) delay_ns(want - t_fb);
        }
        if (g_embed_surf) { /* no window, so no vsync: hold the game to 60 frames a second ourselves, as on the handheld */
            embed_present();
            t_fb = ticks_ns();
            Uint64 want = now + 16666667ULL;
            if (t_fb < want) delay_ns(want - t_fb);
        }
#ifdef __linux__
        if (use_fb) { /* the screen's refresh paces the game when frames are flipped on their own thread; otherwise hold it to 60 a second */
            fb_present();
            t_fb = ticks_ns();
            Uint64 want = now + 16666667ULL;
            if (!g_fbt.th && t_fb < want) delay_ns(want - t_fb);
        }
#endif
        if (perf) {
            const double ms_ = 1e-6, pre = (now - prev_end) * ms_, wait = (ticks_ns() - t_fb) * ms_;
            /* one line per slow interval (up to 40 a run). An interval is the previous frame's work plus this frame's event polling, so both are shown. */
            if (raw_dt > 0.020 && slow_lines < 40) {
                slow_lines++;
                const double known = prev_upd + prev_draw + prev_pres + prev_fb + prev_wait + (now - t_loop) * ms_;
                perf_log("slow: %.1f ms = previous frame (update %.1f draw %.1f flush %.1f fb+vsync %.1f pacing %.1f) + events/buttons %.1f; unexplained %.1f  lua %d KB\n",
                        raw_dt * 1e3, prev_upd, prev_draw, prev_pres, prev_fb, prev_wait, (now - t_loop) * ms_, raw_dt * 1e3 - known, lua_gc(L, LUA_GCCOUNT, 0));
            }
            prev_upd = (t_upd - now) * ms_; prev_draw = (t_draw - t_upd) * ms_; prev_pres = (t_pres - t_draw) * ms_; prev_fb = (t_fb - t_pres) * ms_; prev_wait = wait;
            prev_end = ticks_ns();
        }
        if (perf) {
            const double ms_ = 1e-6, upd = (t_upd - now) * ms_, draw = (t_draw - t_upd) * ms_, pres = (t_pres - t_draw) * ms_, fb = (t_fb - t_pres) * ms_, fr = raw_dt * 1e3;
            ps.n++; ps.frame += fr; ps.upd += upd; ps.draw += draw; ps.pres += pres; ps.fb += fb;
            if (fr > ps.frame_max) ps.frame_max = fr;
            if (upd > ps.upd_max) ps.upd_max = upd;
            if (draw > ps.draw_max) ps.draw_max = draw;
            if (pres > ps.pres_max) ps.pres_max = pres;
            if (fb > ps.fb_max) ps.fb_max = fb;
            if (fr > 20.0) ps.slow++;
            if (t_fb - perf_report >= 1000000000ULL && ps.n > 0) {
                perf_log("perf: %.0f frames  frame %.1f/%.1f  update %.1f/%.1f  draw %.1f/%.1f  render-flush %.1f/%.1f  fb+vsync %.1f/%.1f  over 20ms: %.0f  snapped: %.0f   (avg/worst ms)  audio lock wait %.1f/%.1f (%.0f calls)  audio callback %.1f/%.1f (%.0f runs)  lua %d KB\n",
                        ps.n, ps.frame / ps.n, ps.frame_max, ps.upd / ps.n, ps.upd_max, ps.draw / ps.n, ps.draw_max, ps.pres / ps.n, ps.pres_max, ps.fb / ps.n, ps.fb_max, ps.slow, ps.snapped,
                        g_lock_count ? g_lock_wait_sum / g_lock_count : 0, g_lock_wait_max, g_lock_count, g_cb_count ? g_cb_sum / g_cb_count : 0, g_cb_max, g_cb_count, lua_gc(L, LUA_GCCOUNT, 0));
                g_lock_wait_max = g_lock_wait_sum = g_lock_count = g_cb_max = g_cb_sum = g_cb_count = 0;
#ifdef __linux__
                perf_log("  copy to the framebuffer %.1f/%.1f ms (%ld)  cpu %ld MHz, %ld C\n", g_fb_copy_n ? g_fb_copy_ms / g_fb_copy_n : 0, g_fb_copy_max, g_fb_copy_n,
                         read_sysfs_long("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq") / 1000, read_sysfs_long("/sys/class/thermal/thermal_zone0/temp") / 1000);
                g_fb_copy_ms = g_fb_copy_max = 0; g_fb_copy_n = 0;
#endif
                api_report();
                memset(&ps, 0, sizeof ps); perf_report = t_fb;
            }
        }
        if (g_boost.on) {
            bw_n++; bw_dt += raw_dt; bw_work += (t_pres - now) * 1e-6 + g_fb_copy_last; if (raw_dt > 0.020) bw_late++;
            if (t_fb - bw_t0 >= 1000000000ULL) {
                if (SDL_GetTicks() > 3000) boost_tick((t_fb - bw_t0) * 1e-9, bw_late, bw_dt / (double)bw_n * 1e3, bw_work / (double)bw_n); /* not while the game is starting */
                bw_t0 = t_fb; bw_n = bw_late = 0; bw_dt = bw_work = 0;
            }
        }
        wd_frames++; wd_n++; wd_dt += raw_dt; wd_upd += (t_upd - now) * 1e-6; wd_draw += (t_draw - t_upd) * 1e-6; wd_pres += (t_pres - t_draw) * 1e-6; wd_fb += (t_fb - t_pres) * 1e-6;
        if (wd_n >= 120) {
            const double avg = wd_dt / wd_n;
            if (!wd_warned && wd_frames > 240 && avg > 0.019) {
                wd_warned = true;
                fprintf(stderr, "warning: this game runs at %.0f frames a second here, not 60 (a frame takes %.1f ms: update %.1f, drawing %.1f, render %.1f, copy to the screen %.1f; 60 needs under 16.7). "
                        "Usual causes: many objects, many collision checks, or a lot of the screen covered by drawing (see the console's limits and budgets).\n",
                        1.0 / avg, avg * 1e3, wd_upd / wd_n, wd_draw / wd_n, wd_pres / wd_n, wd_fb / wd_n);
            }
            wd_dt = wd_upd = wd_draw = wd_pres = wd_fb = 0; wd_n = 0;
        }
    }
    { /* GS_DUMP_FRAME=file.bmp saves the last frame (the logical screen) so a test can compare two ways of drawing */
        const char *dump = getenv("GS_DUMP_FRAME");
        if (dump && g_ren) {
            /* the viewport: the game's corner of a surface, or the whole of the window's texture */
            SDL_Rect vp; SDL_RenderGetViewport(g_ren, &vp);
            SDL_Surface *shot = SDL_CreateRGBSurfaceWithFormat(0, vp.w, vp.h, 32, SDL_PIXELFORMAT_ARGB8888);
            if (shot && SDL_RenderReadPixels(g_ren, NULL, SDL_PIXELFORMAT_ARGB8888, shot->pixels, shot->pitch) == 0) SDL_SaveBMP(shot, dump);
            else fprintf(stderr, "frame dump: %s\n", SDL_GetError());
            SDL_FreeSurface(shot);
        }
    }
    embed_close();
#ifdef __linux__
    fb_thread_stop(); /* the last frame reaches the screen first */
#endif
    boost_restore(); /* the CPU's lowest clock goes back to what it was */
    if (g_perf_on) perf_log("sound commands carried out: %ld\n", g_sound_ran);
    perf_flush();
    prof_report();
    lua_close(L);
    SDL_Quit();
    return 0;
}
#endif
