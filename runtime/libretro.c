/* gs as a libretro core (gs_libretro.so): a cart is a "rom", and the emulator that loads the core (NextUI's minarch, RetroArch) owns the
 * window, the sound device, the buttons and its menu. The core is the runtime itself, built from main.c without its main(): the game draws
 * on a GPU context of its own (runtime/gpu.c) and the frame is read back, or, without a GPU, into a surface in memory with SDL's software
 * renderer (as for the studio's Play panel); either way the finished frame is handed over as it is. The mixer
 * is called once a frame for that frame's samples instead of from an audio thread.
 *
 * The emulator links SDL2 too, and on the handheld it is the same library: the core never initialises or quits SDL's video, audio or
 * controller parts, and never opens a controller, or it would read the pad behind the emulator's back. */
#define _GNU_SOURCE /* dladdr, on glibc */
#define GS_LIBRETRO 1
#include "gpu.c" /* before main.c: its drawing calls go to the GPU when there is one */
#include "main.c"
#include <dlfcn.h>
#include "libretro.h"

/* The largest screen a game can switch to while it runs (gs.set_resolution): the surface is made once, since the renderer's textures
 * belong to it. Glow43 (256x192) and Glow169 (320x180) are far below it. */
#define CORE_MAX_W 640
#define CORE_MAX_H 480
#define CORE_FPS 60.0

static retro_environment_t env_cb;
static retro_video_refresh_t video_cb;
static retro_audio_sample_batch_t audio_batch_cb;
static retro_input_poll_t input_poll_cb;
static retro_input_state_t input_state_cb;
static retro_log_printf_t log_cb;

static int g_core_w, g_core_h; /* the size last told to the emulator */
static double g_audio_due;      /* samples owed to the emulator, with the fraction of a sample a frame leaves over */
static float g_mix[2 * 2048];
static int16_t g_mix16[2 * 2048];

/* A frame's sound is mixed on a thread of its own while the game runs its update and drawing, and handed to the emulator at the end of
 * the frame: in retro_run on the game's thread it cost 2.6 ms of every frame on the RG35XX Pro with an 8-track General MIDI song (1.7
 * with chip instruments; 300 bats and that song went from 13.2 to 10.1 ms a frame). Sound calls the game makes during a frame are heard from the next one (16.7 ms; the program's own sound device
 * runs about 11 ms behind). Loading calls take the thread's lock (synth_lock); save states happen between frames, when it is idle.
 * GS_CORE_MIX_THREAD=0 mixes on the game's thread as before. */
static SDL_Thread *g_mix_thread; static SDL_sem *g_mix_go, *g_mix_done; static int g_mix_n; static bool g_mix_quit;
static void core_mix(int frames, bool send) { /* frames <= 2048 */
    mix_cb(NULL, (Uint8 *)g_mix, frames * 2 * (int)sizeof(float));
    for (int i = 0; i < frames * 2; i++) g_mix16[i] = (int16_t)lrintf(g_mix[i] * 32767.0f);
    if (send) audio_batch_cb(g_mix16, (size_t)frames);
}
static int SDLCALL mix_thread_main(void *ud) {
    (void)ud;
    for (;;) {
        SDL_SemWait(g_mix_go);
        if (g_mix_quit) return 0;
        SDL_LockMutex(g_core_mix_lock); core_mix(g_mix_n, false); SDL_UnlockMutex(g_core_mix_lock);
        SDL_SemPost(g_mix_done);
    }
}
static void mix_thread_start(void) {
    const char *e = getenv("GS_CORE_MIX_THREAD");
    if (e && !strcmp(e, "0")) return;
    g_core_mix_lock = SDL_CreateMutex(); g_mix_go = SDL_CreateSemaphore(0); g_mix_done = SDL_CreateSemaphore(0); g_mix_quit = false;
    if (g_core_mix_lock && g_mix_go && g_mix_done) g_mix_thread = SDL_CreateThread(mix_thread_main, "gs-mix", NULL);
    if (!g_mix_thread) { /* no thread: mix on the game's thread */
        if (g_core_mix_lock) SDL_DestroyMutex(g_core_mix_lock);
        if (g_mix_go) SDL_DestroySemaphore(g_mix_go);
        if (g_mix_done) SDL_DestroySemaphore(g_mix_done);
        g_core_mix_lock = NULL; g_mix_go = g_mix_done = NULL;
    }
}
static void mix_thread_stop(void) {
    if (!g_mix_thread) return;
    g_mix_quit = true; SDL_SemPost(g_mix_go); SDL_WaitThread(g_mix_thread, NULL); g_mix_thread = NULL;
    SDL_DestroyMutex(g_core_mix_lock); SDL_DestroySemaphore(g_mix_go); SDL_DestroySemaphore(g_mix_done);
    g_core_mix_lock = NULL; g_mix_go = g_mix_done = NULL;
}
static Uint32 g_frame[CORE_MAX_W * CORE_MAX_H]; /* the frame read back from the GPU */

#include "ram.c" /* the console's RAM and save states */

void retro_set_environment(retro_environment_t cb) {
    env_cb = cb;
    bool no_game = false; cb(RETRO_ENVIRONMENT_SET_SUPPORT_NO_GAME, &no_game);
    struct retro_log_callback log;
    if (cb(RETRO_ENVIRONMENT_GET_LOG_INTERFACE, &log)) log_cb = log.log;
}
void retro_set_video_refresh(retro_video_refresh_t cb) { video_cb = cb; }
void retro_set_audio_sample(retro_audio_sample_t cb) { (void)cb; }
void retro_set_audio_sample_batch(retro_audio_sample_batch_t cb) { audio_batch_cb = cb; }
void retro_set_input_poll(retro_input_poll_t cb) { input_poll_cb = cb; }
void retro_set_input_state(retro_input_state_t cb) { input_state_cb = cb; }
unsigned retro_api_version(void) { return RETRO_API_VERSION; }
void retro_set_controller_port_device(unsigned port, unsigned device) { (void)port; (void)device; }

void retro_get_system_info(struct retro_system_info *info) {
    memset(info, 0, sizeof *info);
    info->library_name = "GameStudio";
    info->library_version = "1";
    info->valid_extensions = "g43|g169|cart"; /* one cart format; the name says the console (custom consoles: .cart) */
    info->need_fullpath = true; /* the cart is read from its file, and its name keys the saves */
    info->block_extract = true;
}

void retro_get_system_av_info(struct retro_system_av_info *info) {
    memset(info, 0, sizeof *info);
    info->geometry.base_width = (unsigned)g_screen_w; info->geometry.base_height = (unsigned)g_screen_h;
    info->geometry.max_width = CORE_MAX_W; info->geometry.max_height = CORE_MAX_H;
    info->geometry.aspect_ratio = (float)g_screen_w / (float)g_screen_h; /* square pixels */
    info->timing.fps = CORE_FPS;
    info->timing.sample_rate = MIX_FREQ;
}

void retro_init(void) {
    /* the SoundFont and pad map are looked for beside the core, not beside the emulator */
    Dl_info dl;
    if (dladdr((void *)retro_init, &dl) && dl.dli_fname) {
        const char *slash = strrchr(dl.dli_fname, '/');
        const size_t n = slash ? (size_t)(slash - dl.dli_fname) + 1 : 0;
        g_base_override = malloc(n + 1);
        if (g_base_override) { memcpy(g_base_override, dl.dli_fname, n); g_base_override[n] = 0; }
    }
}
void retro_deinit(void) { free(g_base_override); g_base_override = NULL; }

/* The emulator's joypad, by label: RETRO_DEVICE_ID_JOYPAD_A is the button marked A, whatever its position. */
static const unsigned core_pad[B_COUNT] = {
    RETRO_DEVICE_ID_JOYPAD_UP, RETRO_DEVICE_ID_JOYPAD_DOWN, RETRO_DEVICE_ID_JOYPAD_LEFT, RETRO_DEVICE_ID_JOYPAD_RIGHT,
    RETRO_DEVICE_ID_JOYPAD_A, RETRO_DEVICE_ID_JOYPAD_B, RETRO_DEVICE_ID_JOYPAD_X, RETRO_DEVICE_ID_JOYPAD_Y,
    RETRO_DEVICE_ID_JOYPAD_L, RETRO_DEVICE_ID_JOYPAD_R, RETRO_DEVICE_ID_JOYPAD_START, RETRO_DEVICE_ID_JOYPAD_SELECT,
    RETRO_DEVICE_ID_JOYPAD_L2, RETRO_DEVICE_ID_JOYPAD_R2, RETRO_DEVICE_ID_JOYPAD_L3, RETRO_DEVICE_ID_JOYPAD_R3 };

static void core_input_descriptors(void) {
    static const struct retro_input_descriptor d[] = {
        { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_UP, "Up" }, { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_DOWN, "Down" },
        { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_LEFT, "Left" }, { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_RIGHT, "Right" },
        { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_A, "A" }, { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_B, "B" },
        { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_X, "X" }, { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_Y, "Y" },
        { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_L, "L" }, { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_R, "R" },
        { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_L2, "L2" }, { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_R2, "R2" },
        { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_L3, "L3" }, { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_R3, "R3" },
        { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_SELECT, "Select" }, { 0, RETRO_DEVICE_JOYPAD, 0, RETRO_DEVICE_ID_JOYPAD_START, "Start" },
        { 0, 0, 0, 0, NULL } };
    env_cb(RETRO_ENVIRONMENT_SET_INPUT_DESCRIPTORS, (void *)d);
}

bool retro_load_game(const struct retro_game_info *game) {
    if (!game || !game->path) return false;
    enum retro_pixel_format fmt = RETRO_PIXEL_FORMAT_XRGB8888;
    if (!env_cb(RETRO_ENVIRONMENT_SET_PIXEL_FORMAT, &fmt)) { if (log_cb) log_cb(RETRO_LOG_ERROR, "gs: XRGB8888 is not supported\n"); return false; }
    struct stat st;
    if (stat(game->path, &st)) return false;
    if (S_ISDIR(st.st_mode)) g_dir = game->path;
    else if (!load_cart(game->path)) { fprintf(stderr, "%s: not a valid cartridge\n", game->path); return false; }
    core_input_descriptors();

    g_debug_input = getenv("GS_DEBUG_INPUT") != NULL;
    g_perf_on = getenv("GS_PERF") != NULL;
    alias_load();
    /* saves: the emulator's save folder, one folder per cart (GS_SAVE_DIR still wins, as for the program) */
    const char *dir = NULL;
    if (!getenv("GS_SAVE_DIR") && env_cb(RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY, &dir) && dir && *dir) {
        char name[256]; const char *base = strrchr(game->path, '/'); snprintf(name, sizeof name, "%s", base ? base + 1 : game->path);
        char *dot = strrchr(name, '.'); if (dot && dot != name) *dot = 0;
        mkdir(dir, 0755); /* init_savedir makes only the last folder */
        char path[1024]; snprintf(path, sizeof path, "%s/%s", dir, name);
        setenv("GS_SAVE_DIR", path, 1);
    }
    init_savedir(game->path);

    /* sound without a device: the mixer runs in retro_run, on this thread, so the locks around the voices have nothing to wait for */
    synth_reset(MIX_FREQ);
    g_sound_mutex = SDL_CreateMutex();
    g_audio_ok = true;

    if (gpu_open()) {
        g_ren = (SDL_Renderer *)&G; /* never given to SDL: every drawing call goes to gpu.c */
        gpu_begin();
    } else {
        g_embed_surf = SDL_CreateRGBSurfaceWithFormat(0, CORE_MAX_W, CORE_MAX_H, 32, SDL_PIXELFORMAT_ARGB8888); /* XRGB8888 in memory */
        g_ren = g_embed_surf ? SDL_CreateSoftwareRenderer(g_embed_surf) : NULL;
        if (!g_ren) { fprintf(stderr, "software renderer: %s\n", SDL_GetError()); return false; }
    }
    screen_logical(g_screen_w, g_screen_h);
    SDL_SetRenderDrawBlendMode(g_ren, SDL_BLENDMODE_BLEND);

    if (!ram_open()) { gpu_end(); fprintf(stderr, "gs: no memory for the console's RAM\n"); return false; }
    g_lua_alloc = ram_alloc; g_lua_panic = ram_panic;
    g_core_L = game_start();
    gpu_end();
    if (!g_core_L) return false;
    g_core_w = g_screen_w; g_core_h = g_screen_h;
    mix_thread_start(); /* after the game has loaded its sounds, so a failed load leaves no thread behind */
    return true;
}

void retro_unload_game(void) {
    gs_net_close();
    mix_thread_stop();
    gpu_begin();
    if (g_core_L) { lua_close(g_core_L); g_core_L = NULL; }
    ram_close();
    for (int i = 0; i < g_nimages; i++) if (g_images[i].tex) { SDL_DestroyTexture(g_images[i].tex); g_images[i].tex = NULL; }
    for (int f = 0; f < GS_FONTS; f++) if (g_font_tex[f]) { SDL_DestroyTexture(g_font_tex[f]); g_font_tex[f] = NULL; }
    if (g_target) { SDL_DestroyTexture(g_target); g_target = NULL; }
    gpu_end();
    if (g_gpu) { gpu_close(); g_ren = NULL; }
    if (g_ren) { SDL_DestroyRenderer(g_ren); g_ren = NULL; }
    if (g_embed_surf) { SDL_FreeSurface(g_embed_surf); g_embed_surf = NULL; }
}
bool retro_load_game_special(unsigned type, const struct retro_game_info *info, size_t num) { (void)type; (void)info; (void)num; return false; }
void retro_reset(void) {} /* a game restarts itself (gs.scene); a reset from the emulator's menu is not offered */

void retro_run(void) {
    if (!g_core_L) return;
    input_poll_cb();
    Uint16 held = 0;
    for (int i = 0; i < B_COUNT; i++) if (input_state_cb(0, RETRO_DEVICE_JOYPAD, 0, core_pad[i])) held |= (Uint16)(1u << i);
    if (g_debug_input) for (int i = 0; i < B_COUNT; i++) if ((held >> i & 1) && !btn_now[i]) fprintf(stderr, "core button %s down\n", btn_names[i]);
    g_embed_buttons = held; /* poll_buttons reads them as it reads the studio's */
    poll_buttons();

    /* this frame's sound: 735 samples at 44.1 kHz, with the leftover fraction carried so none drift; mixed while the game runs */
    g_audio_due += MIX_FREQ / CORE_FPS;
    int frames = (int)g_audio_due; g_audio_due -= frames;
    if (g_mix_thread) { g_mix_n = SDL_min(frames, 2048); SDL_SemPost(g_mix_go); }

    gpu_begin();
    game_frame(g_core_L, 1.0 / CORE_FPS);
    if (g_quit) { env_cb(RETRO_ENVIRONMENT_SHUTDOWN, NULL); g_quit = false; } /* gs.quit(): back to the emulator's menu */

    if (g_screen_w != g_core_w || g_screen_h != g_core_h) { /* gs.set_resolution while running */
        g_core_w = SDL_min(g_screen_w, CORE_MAX_W); g_core_h = SDL_min(g_screen_h, CORE_MAX_H);
        struct retro_game_geometry geo = { (unsigned)g_core_w, (unsigned)g_core_h, CORE_MAX_W, CORE_MAX_H, (float)g_core_w / (float)g_core_h };
        env_cb(RETRO_ENVIRONMENT_SET_GEOMETRY, &geo);
    }
    if (g_gpu) {
        SDL_RenderReadPixels(g_ren, &(SDL_Rect){ 0, 0, g_core_w, g_core_h }, SDL_PIXELFORMAT_ARGB8888, g_frame, g_core_w * 4);
        gpu_end();
        video_cb(g_frame, (unsigned)g_core_w, (unsigned)g_core_h, (size_t)g_core_w * 4);
    } else video_cb(g_embed_surf->pixels, (unsigned)g_core_w, (unsigned)g_core_h, (size_t)g_embed_surf->pitch);

    if (g_mix_thread) { SDL_SemWait(g_mix_done); audio_batch_cb(g_mix16, (size_t)g_mix_n); return; }
    while (frames > 0) {
        const int n = SDL_min(frames, 2048);
        core_mix(n, true);
        frames -= n;
    }
}

/* Save states (and NextUI's Resume and rewind): the console's RAM and the runtime's state, see runtime/ram.c. One size for the whole run. */
size_t retro_serialize_size(void) { return g_core_L && !gs_net_active() ? state_size() : 0; }
bool retro_serialize(void *data, size_t size) { return state_save(data, size); }
bool retro_unserialize(const void *data, size_t size) { gpu_begin(); const bool ok = state_load(data, size); gpu_end(); return ok; }
void retro_cheat_reset(void) {}
void retro_cheat_set(unsigned index, bool enabled, const char *code) { (void)index; (void)enabled; (void)code; }
unsigned retro_get_region(void) { return RETRO_REGION_NTSC; }
void *retro_get_memory_data(unsigned id) { (void)id; return NULL; }
size_t retro_get_memory_size(unsigned id) { (void)id; return 0; }
