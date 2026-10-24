/* A tiny libretro frontend for tests: loads a core as NextUI's minarch and RetroArch do, runs a cart for some frames and reports what the
 * core handed over (picture size, samples, loudest sample). The last frame can be saved as a BMP for tests/same-frames.mjs.
 *   retro-run <core> <cart> <frames> [frame.bmp]
 * RETRO_HOLD=start@60-70,a@100 holds buttons by name on those frames (from-to, or one frame), as a player would press them. */
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "libretro.h"

static unsigned v_w, v_h; static size_t v_pitch; static unsigned char *v_copy; static long v_frames;
static long a_samples; static int a_peak; static long frame_no; static int shut_down;
static unsigned fmt_ok;

static bool env(unsigned cmd, void *data) {
    switch (cmd) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT: fmt_ok = *(enum retro_pixel_format *)data == RETRO_PIXEL_FORMAT_XRGB8888; return true;
    case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY: *(const char **)data = getenv("RETRO_SAVE_DIR"); return getenv("RETRO_SAVE_DIR") != NULL;
    case RETRO_ENVIRONMENT_SHUTDOWN: shut_down = 1; return true;
    case RETRO_ENVIRONMENT_SET_INPUT_DESCRIPTORS: case RETRO_ENVIRONMENT_SET_GEOMETRY: case RETRO_ENVIRONMENT_SET_SUPPORT_NO_GAME: return true;
    default: return false;
    }
}
static void video(const void *data, unsigned w, unsigned h, size_t pitch) {
    if (!data) return;
    v_w = w; v_h = h; v_pitch = pitch; v_frames++;
    free(v_copy); v_copy = malloc(pitch * h); memcpy(v_copy, data, pitch * h);
}
static void audio1(int16_t l, int16_t r) { (void)l; (void)r; }
static size_t audio(const int16_t *d, size_t frames) {
    for (size_t i = 0; i < frames * 2; i++) { int v = abs(d[i]); if (v > a_peak) a_peak = v; }
    a_samples += (long)frames; return frames;
}
static void poll(void) {}
static const char *names[] = { "b", "y", "select", "start", "up", "down", "left", "right", "a", "x", "l", "r", "l2", "r2", "l3", "r3" };
static int16_t input(unsigned port, unsigned device, unsigned index, unsigned id) {
    (void)index;
    const char *hold = getenv("RETRO_HOLD");
    if (port || device != RETRO_DEVICE_JOYPAD || !hold || id >= 16) return 0;
    char buf[512]; snprintf(buf, sizeof buf, "%s", hold);
    for (char *tok = strtok(buf, ","); tok; tok = strtok(NULL, ",")) {
        char *at = strchr(tok, '@'); if (!at) continue; *at = 0;
        long from = atol(at + 1), to = from; char *dash = strchr(at + 1, '-'); if (dash) to = atol(dash + 1);
        if (!strcmp(tok, names[id]) && frame_no >= from && frame_no <= to) return 1;
    }
    return 0;
}

static void save_bmp(const char *path) {
    FILE *f = fopen(path, "wb"); if (!f) return;
    const unsigned size = 54 + v_w * v_h * 4;
    unsigned char h[54] = { 'B', 'M' };
    #define PUT32(o, v) (h[o] = (unsigned char)(v), h[o + 1] = (unsigned char)((v) >> 8), h[o + 2] = (unsigned char)((v) >> 16), h[o + 3] = (unsigned char)((v) >> 24))
    PUT32(2, size); PUT32(10, 54); PUT32(14, 40); PUT32(18, v_w); PUT32(22, -(int)v_h); h[26] = 1; h[28] = 32;
    fwrite(h, 1, 54, f);
    for (unsigned y = 0; y < v_h; y++) { /* XRGB8888 is BGRX in memory, as a BMP wants; the unused byte becomes opaque alpha */
        const unsigned char *row = v_copy + y * v_pitch;
        for (unsigned x = 0; x < v_w; x++) { unsigned char px[4] = { row[x * 4], row[x * 4 + 1], row[x * 4 + 2], 255 }; fwrite(px, 1, 4, f); }
    }
    fclose(f);
}

int main(int argc, char **argv) {
    if (argc < 4) { fprintf(stderr, "usage: retro-run <core> <cart> <frames> [frame.bmp]\n"); return 2; }
    void *core = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
    if (!core) { fprintf(stderr, "%s\n", dlerror()); return 1; }
    /* the header declares the core's functions; each is looked up under its own name and called through a pointer of the same type */
    #define SYM(n) __typeof__(&n) p_##n = (__typeof__(&n))dlsym(core, #n); if (!p_##n) { fprintf(stderr, "missing %s\n", #n); return 1; }
    SYM(retro_set_environment) SYM(retro_set_video_refresh) SYM(retro_set_audio_sample) SYM(retro_set_audio_sample_batch)
    SYM(retro_set_input_poll) SYM(retro_set_input_state) SYM(retro_init) SYM(retro_load_game) SYM(retro_run)
    SYM(retro_get_system_av_info) SYM(retro_unload_game) SYM(retro_deinit)
    p_retro_set_environment(env); p_retro_set_video_refresh(video); p_retro_set_audio_sample(audio1); p_retro_set_audio_sample_batch(audio);
    p_retro_set_input_poll(poll); p_retro_set_input_state(input);
    p_retro_init();
    struct retro_game_info gi = { argv[2], NULL, 0, NULL };
    if (!p_retro_load_game(&gi)) { fprintf(stderr, "load failed\n"); return 1; }
    struct retro_system_av_info av; p_retro_get_system_av_info(&av);
    const long frames = atol(argv[3]);
    for (frame_no = 1; frame_no <= frames && !shut_down; frame_no++) p_retro_run();
    if (argc > 4 && v_copy) save_bmp(argv[4]);
    printf("RETRO frames=%ld size=%ux%u base=%ux%u fps=%.0f rate=%.0f samples=%ld peak=%d xrgb=%u shutdown=%d\n", v_frames, v_w, v_h,
           av.geometry.base_width, av.geometry.base_height, av.timing.fps, av.timing.sample_rate, a_samples, a_peak, fmt_ok, shut_down);
    p_retro_unload_game(); p_retro_deinit();
    return 0;
}
