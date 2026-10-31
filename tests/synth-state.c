#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "sfbank.h"

typedef union { max_align_t align; size_t size; } Allocation;
static size_t live_bytes, live_blocks;
static void *tracked_malloc(size_t size) {
    Allocation *a = malloc(sizeof *a + size);
    if (!a) return NULL;
    a->size = size; live_bytes += size; live_blocks++;
    return a + 1;
}
static void tracked_free(void *ptr) {
    if (!ptr) return;
    Allocation *a = (Allocation *)ptr - 1;
    live_bytes -= a->size; live_blocks--; free(a);
}
static void *tracked_realloc(void *ptr, size_t size) {
    if (!ptr) return tracked_malloc(size);
    if (!size) { tracked_free(ptr); return NULL; }
    Allocation *a = (Allocation *)ptr - 1;
    const size_t old = a->size;
    Allocation *next = realloc(a, sizeof *a + size);
    if (!next) return NULL;
    next->size = size; live_bytes = live_bytes - old + size;
    return next + 1;
}
#define TSF_MALLOC tracked_malloc
#define TSF_REALLOC tracked_realloc
#define TSF_FREE tracked_free
#include "../runtime/synth.c"

#define CHECK(condition, message) do { if (!(condition)) { fprintf(stderr, "FAIL: %s\n", message); return 1; } } while (0)
int main(int argc, char **argv) {
    CHECK(argc == 2, "synth-state needs a SoundFont filename");
    for (int step = -3; step <= 3; step++)
        CHECK(fabsf(TRACK_GAIN[step + 3] - powf(1.25f, step)) < 0.000001f, "track volume gain changed");
    FILE *f = fopen(argv[1], "rb");
    CHECK(f, "cannot open SoundFont");
    CHECK(!fseek(f, 0, SEEK_END), "cannot seek SoundFont");
    const long length = ftell(f); rewind(f);
    CHECK(length > 0, "empty SoundFont");
    unsigned char *data = malloc((size_t)length);
    CHECK(data && fread(data, 1, (size_t)length, f) == (size_t)length, "cannot read SoundFont");
    fclose(f);
    char err[256];
    SfBank *bank = sfbank_open(data, (size_t)length, 32000, err, sizeof err);
    free(data);
    CHECK(bank, err);
    const int preset = 0;
    unsigned char keys[1][16] = {{0}};
    keys[0][60 / 8] |= 1u << (60 % 8);
    size_t size;
    unsigned char *subset = sfbank_subset(bank, &preset, keys, 1, &size);
    sfbank_close(bank);
    synth_reset(44100);
    CHECK(subset && synth_load_soundfont(subset, (int)size), "cannot load subset bank");
    free(subset);
    synth_config(8, 1, 1);
    SynthInstrument instrument;
    synth_default_instrument(&instrument);
    instrument.type = INST_GM;
    instrument.gm_program = 0;
    const int inst = synth_add_instrument(&instrument);
    CHECK(inst >= 0, "cannot add instrument");
    SynthSfx sfx = { .speed = 1, .n = 1, .loop_start = -1, .loop_end = -1 };
    sfx.steps[0] = (SynthStep){ .pitch = 48, .inst = inst, .vol = 7 };
    const int handle = synth_add_sfx(&sfx);
    CHECK(handle >= 0, "cannot add effect");
    size_t warm_bytes = 0, warm_blocks = 0;
    float out[1024];
    for (int i = 0; i < 100; i++) {
        synth_play_sfx(handle, 1);
        for (int block = 0; block < 1000 && g_v[SFX_BASE].active; block++) {
            memset(out, 0, sizeof out); synth_mix(out, 512);
        }
        CHECK(!g_v[SFX_BASE].active, "effect did not end naturally");
        if (!i) { warm_bytes = live_bytes; warm_blocks = live_blocks; }
        CHECK(live_bytes == warm_bytes && live_blocks == warm_blocks, "completed GM effect leaked its player");
    }
    synth_reset(44100);
    CHECK(live_bytes == 0 && live_blocks == 0, "reset leaked SoundFont allocations");
    puts("PASS synth player reuse and gain table");
    return 0;
}
