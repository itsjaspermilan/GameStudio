/* A tiny libretro frontend for tests: loads a core as NextUI's minarch and RetroArch do, runs a cart for some frames and reports what the
 * core handed over (picture size, samples, loudest sample). The last frame can be saved as a BMP for tests/same-frames.mjs.
 *   retro-run <core> <cart> <frames> [frame.bmp]
 * RETRO_HOLD=start@60-70,a@100 holds buttons by name on those frames (from-to, or one frame), as a player would press them.
 * Save states: RETRO_SAVE=N:file writes one after game frame N; RETRO_LOAD=C:file loads one before call C (0: right after loading the game,
 * as NextUI's Resume does), and the game's frame count goes back to the state's, so held buttons replay; RETRO_DUMP=N:file.bmp saves the
 * picture of game frame N (and of its replay, to <file>.again.bmp). A frame replayed after a load must come out the same as the first time.
 * RETRO_WAV=file.wav writes all the sound the core handed over (16-bit stereo, the core's rate), to listen to or look for clicks. */
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "libretro.h"

static unsigned v_w, v_h; static size_t v_pitch; static unsigned char *v_copy; static long v_frames;
static long a_samples; static int a_peak; static long frame_no; static int shut_down;
static unsigned fmt_ok;
/* how long the core takes for a frame (retro_run), after the first 60 frames of loading: average, 95th percentile and worst, in ms */
static double run_ms[100000]; static long run_n;
static double now_ms(void) { struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts); return ts.tv_sec * 1e3 + ts.tv_nsec / 1e6; }
static int cmp_d(const void *a, const void *b) { const double x = *(const double *)a, y = *(const double *)b; return x < y ? -1 : x > y; }

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
static FILE *wav_out; /* RETRO_WAV */
static size_t audio(const int16_t *d, size_t frames) {
    for (size_t i = 0; i < frames * 2; i++) { int v = abs(d[i]); if (v > a_peak) a_peak = v; }
    if (wav_out) fwrite(d, sizeof *d * 2, frames, wav_out);
    a_samples += (long)frames; return frames;
}
static void wav_header(FILE *f, long frames, unsigned rate) { /* 44-byte RIFF header for 16-bit stereo */
    const unsigned data = (unsigned)frames * 4, riff = 36 + data, byterate = rate * 4, fmtlen = 16; const unsigned short pcm = 1, ch = 2, align = 4, bits = 16;
    fwrite("RIFF", 1, 4, f); fwrite(&riff, 4, 1, f); fwrite("WAVEfmt ", 1, 8, f); fwrite(&fmtlen, 4, 1, f); fwrite(&pcm, 2, 1, f); fwrite(&ch, 2, 1, f);
    fwrite(&rate, 4, 1, f); fwrite(&byterate, 4, 1, f); fwrite(&align, 2, 1, f); fwrite(&bits, 2, 1, f); fwrite("data", 1, 4, f); fwrite(&data, 4, 1, f);
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
    if (getenv("RETRO_WAV")) { wav_out = fopen(getenv("RETRO_WAV"), "wb"); if (wav_out) wav_header(wav_out, 0, 44100); }
    void *core = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
    if (!core) { fprintf(stderr, "%s\n", dlerror()); return 1; }
    /* the header declares the core's functions; each is looked up under its own name and called through a pointer of the same type */
    #define SYM(n) __typeof__(&n) p_##n = (__typeof__(&n))dlsym(core, #n); if (!p_##n) { fprintf(stderr, "missing %s\n", #n); return 1; }
    SYM(retro_set_environment) SYM(retro_set_video_refresh) SYM(retro_set_audio_sample) SYM(retro_set_audio_sample_batch)
    SYM(retro_set_input_poll) SYM(retro_set_input_state) SYM(retro_init) SYM(retro_load_game) SYM(retro_run)
    SYM(retro_get_system_av_info) SYM(retro_unload_game) SYM(retro_deinit)
    SYM(retro_serialize_size) SYM(retro_serialize) SYM(retro_unserialize)
    p_retro_set_environment(env); p_retro_set_video_refresh(video); p_retro_set_audio_sample(audio1); p_retro_set_audio_sample_batch(audio);
    p_retro_set_input_poll(poll); p_retro_set_input_state(input);
    p_retro_init();
    struct retro_game_info gi = { argv[2], NULL, 0, NULL };
    if (!p_retro_load_game(&gi)) { fprintf(stderr, "load failed\n"); return 1; }
    struct retro_system_av_info av; p_retro_get_system_av_info(&av);
    const long frames = atol(argv[3]);
    long save_at = 0, load_at = -1, dump_at = 0; char save_f[512] = "", load_f[512] = "", dump_f[512] = "";
    if (getenv("RETRO_SAVE")) sscanf(getenv("RETRO_SAVE"), "%ld:%511s", &save_at, save_f);
    if (getenv("RETRO_LOAD")) sscanf(getenv("RETRO_LOAD"), "%ld:%511s", &load_at, load_f);
    if (getenv("RETRO_DUMP")) sscanf(getenv("RETRO_DUMP"), "%ld:%511s", &dump_at, dump_f);
    const size_t ssize = p_retro_serialize_size();
    printf("RETRO state size %zu\n", ssize);
    frame_no = 0;
    for (long call = 0; call <= frames && !shut_down; call++) {
        if (call == load_at) {
            FILE *f = fopen(load_f, "rb"); unsigned char *buf = malloc(ssize + 8); long t = 0;
            const bool ok = f && fread(&t, sizeof t, 1, f) == 1 && fread(buf, 1, ssize, f) == ssize && p_retro_unserialize(buf, ssize);
            if (f) fclose(f);
            free(buf);
            printf("RETRO load %s at call %ld (frame %ld)\n", ok ? "ok" : "FAILED", call, t);
            if (!ok) return 1;
            frame_no = t;
        }
        if (call == 0) continue;
        frame_no++;
        const double t0 = now_ms();
        p_retro_run();
        if (call > 60 && run_n < 100000) run_ms[run_n++] = now_ms() - t0;
        if (frame_no == dump_at && v_copy) { /* the first time to the file named, a replay after a load to <file>.again.bmp */
            static int dumps; char path[600]; snprintf(path, sizeof path, dumps++ ? "%s.again.bmp" : "%s", dump_f); save_bmp(path);
        }
        if (frame_no == save_at && save_f[0]) {
            unsigned char *buf = malloc(ssize); const bool ok = buf && p_retro_serialize(buf, ssize);
            FILE *f = ok ? fopen(save_f, "wb") : NULL;
            if (f) { fwrite(&frame_no, sizeof frame_no, 1, f); fwrite(buf, 1, ssize, f); fclose(f); }
            free(buf);
            printf("RETRO save %s at frame %ld\n", f ? "ok" : "FAILED", frame_no);
            save_at = 0;
        }
    }
    if (argc > 4 && v_copy) save_bmp(argv[4]);
    if (wav_out) { fseek(wav_out, 0, SEEK_SET); wav_header(wav_out, a_samples, (unsigned)av.timing.sample_rate); fclose(wav_out); wav_out = NULL; }
    printf("RETRO frames=%ld size=%ux%u base=%ux%u fps=%.0f rate=%.0f samples=%ld peak=%d xrgb=%u shutdown=%d\n", v_frames, v_w, v_h,
           av.geometry.base_width, av.geometry.base_height, av.timing.fps, av.timing.sample_rate, a_samples, a_peak, fmt_ok, shut_down);
    if (run_n) {
        double sum = 0; for (long i = 0; i < run_n; i++) sum += run_ms[i];
        qsort(run_ms, (size_t)run_n, sizeof run_ms[0], cmp_d);
        printf("RETRO frame ms: average %.2f, 95%% %.2f, worst %.2f over %ld frames\n", sum / run_n, run_ms[run_n * 95 / 100], run_ms[run_n - 1], run_n);
    }
    p_retro_unload_game(); p_retro_deinit();
    return 0;
}
