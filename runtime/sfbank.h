/* sfbank: a General MIDI SoundFont cut down to the instruments a game uses.
 *
 * A game plays a handful of the 128 General MIDI instruments and the drum kits, and a full bank is large (FluidR3 Mono is 119 MB as plain
 * samples), so the runtime and `gs pack` keep only the presets a game defines: the bank is opened once, and each subset is a new SF2 in
 * memory with just those presets, their instruments and their samples. Reads SF2 and SF3 (MuseScore's SoundFont with Ogg Vorbis samples,
 * decoded with stb_vorbis); always writes SF2 with 16-bit samples, which TinySoundFont loads without decoding.
 *
 * Pure C with no SDL, like synth.c. A bank can come from anywhere (a game may carry its own), so every count and offset is checked. */
#ifndef SFBANK_H
#define SFBANK_H
#include <stddef.h>

typedef struct SfBank SfBank;

/* A preset by its General MIDI number: bank 0 for instruments, 128 for drum kits. */
#define SFBANK_PRESET(bank, program) (((bank) << 8) | (program))

/* Opens a bank from memory (copied; the caller may free data). Samples recorded faster than max_rate (the console's sample rate; 0 keeps
 * them) are resampled down when used. NULL with the reason in err when it is not a SoundFont it can read. */
SfBank *sfbank_open(const void *data, size_t size, int max_rate, char *err, size_t errlen);
void sfbank_close(SfBank *b);
/* Whether the bank has this preset (SFBANK_PRESET). */
int sfbank_has(const SfBank *b, int preset);
/* An SF2 holding only these presets (missing ones are left out), malloc'd; NULL when none is there or memory ran out. keys, when not NULL,
 * has 16 bytes for each preset: a bit for each key (MIDI note 0..127) the game plays, and only the zones of those keys are kept (a drum
 * kit is one preset with a different sound on every key; a game plays a few). All bits set keeps every key. Decoded samples are kept in
 * the bank, so asking again for a few more presets only decodes the new ones. */
unsigned char *sfbank_subset(SfBank *b, const int *presets, const unsigned char (*keys)[16], int n, size_t *out_size);
/* The comment (ICMT) every subset carries in place of the source's own: the licence its samples come under, for one. NULL: the source's. */
void sfbank_set_comment(SfBank *b, const char *text);
/* The same SoundFont with its samples packed without loss (an "smpz" chunk in place of "smpl", about 60% of the size), for a cart;
 * sfbank_open reads it back exactly. malloc'd; NULL when sf2 is not a SoundFont with samples. */
unsigned char *sfbank_pack(const unsigned char *sf2, size_t size, size_t *out_size);
/* How many presets the bank has, and the i-th one's SFBANK_PRESET number (for tools that list them). */
int sfbank_count(const SfBank *b);
int sfbank_preset_at(const SfBank *b, int i);

#endif
