/* A chiptune synth in the spirit of the Game Boy Advance: a few channels, each playing an INSTRUMENT.
 *
 * Instruments are pulse waves (four duty cycles), a drawable 4-bit wavetable, short or long noise, or sampled sounds
 * pitched across the keyboard, each with an ADSR envelope, vibrato and pan. Sound effects are rows of steps played on one
 * channel; songs are tracker patterns played on all channels. An optional output stage adds reverb and a lo-fi sound
 * (32 kHz, 8-bit). Pure C with no SDL dependency, so the device and the studio's previews (gs render-audio) run the very
 * same code and sound the same.
 *
 * Pitch is counted in semitones from C0 (note 0): C4 is 48, A4 is 57 (440 Hz). A sound effect's step pitch 0..63 is the
 * same scale starting at C1 (so step pitch p is note p + 12). */
#ifndef SYNTH_H
#define SYNTH_H

#define SYNTH_MAX_CHANNELS 16         /* music voices: SONG_TRACKS tracks of up to four voices each (a chord is more voices on the track's own instrument) */
#define SONG_TRACKS 4                 /* a song's tracks: voice v belongs to track v % SONG_TRACKS */
#define SYNTH_MAX_SFX_CHANNELS 4      /* sound effect channels: a separate pool, so effects never cut into the music */
#define SYNTH_LEGACY_SLOTS 4          /* channels used by the older "patterns of sound effects" music */
#define SYNTH_STEPS 32
#define SYNTH_MAX_PATTERNS 64         /* older music: patterns of sound effects */
#define SYNTH_MAX_INSTRUMENTS 64
#define SYNTH_BUILTIN_INSTRUMENTS 6   /* ids 0..5: triangle, saw, square, pulse, sine, noise (the original waves) */
#define SONG_MAX_ROWS 64
#define SONG_MAX_PATTERNS 32
#define SONG_MAX_ORDER 64
#define SONG_SLOTS 16
#define SYNTH_MAX_SAMPLE_BYTES (16 * 1024 * 1024)

enum { WAVE_TRIANGLE, WAVE_SAW, WAVE_SQUARE, WAVE_PULSE, WAVE_SINE, WAVE_NOISE, WAVE_COUNT };
enum { FX_NONE, FX_SLIDE, FX_VIBRATO, FX_DROP, FX_FADE_IN, FX_FADE_OUT, FX_ARP, FX_TIE, FX_COUNT };   /* sound effect steps; FX_TIE holds the note from the step before (no new note) */
enum { TFX_NONE, TFX_SLIDE_UP, TFX_SLIDE_DOWN, TFX_VIBRATO, TFX_ARP, TFX_VOLSLIDE, TFX_PAN, TFX_CUT, TFX_COUNT }; /* tracker cells */
enum { INST_BASIC, INST_PULSE, INST_WAVE, INST_NOISE, INST_SAMPLE, INST_GM };

typedef struct {
    int type;
    int basic;                      /* INST_BASIC: which WAVE_* */
    int duty;                       /* INST_PULSE: 0..3 = 12.5%, 25%, 50%, 75% */
    unsigned char wave[32];         /* INST_WAVE: 32 steps of 0..15 */
    int noise_short;                /* INST_NOISE: 0 = hiss (15-bit), 1 = metallic (7-bit) */
    int sample, root;               /* INST_SAMPLE: sample handle, and the note it plays at its original speed */
    int loop_start, loop_end;       /* INST_SAMPLE: loop between these frames; loop_start < 0 = play once */
    float volume, pan, sustain;     /* volume 0..1, pan -1..1, sustain 0..1 */
    int attack_ms, decay_ms, release_ms;
    float vib_depth, vib_rate;      /* semitones, Hz */
    int vib_delay_ms;
    int gm_program, gm_drum;        /* INST_GM: General MIDI program 0..127 from the SoundFont (gm_drum: from its drum kit, where the key picks the drum) */
    int fixed_note;                 /* >= 0: always plays this pitch whatever note is asked for (drums) */
    float sweep; int sweep_ms;      /* a pitch sweep at the start of each note: begins `sweep` semitones off and glides to the pitch (drums, zaps) */
} SynthInstrument;

typedef struct { unsigned char pitch, inst, vol, fx; } SynthStep;
typedef struct {
    int speed;                      /* ticks of 1/60 s per step, 1..64 */
    int vol_step;                   /* the track's volume: -3..3 steps of 1.25x */
    int n;                          /* steps used, 1..SYNTH_STEPS */
    int loop_start, loop_end;       /* loop these steps (inclusive); loop_start -1 = play once */
    SynthStep steps[SYNTH_STEPS];
} SynthSfx;

/* Older music: a list of patterns, each naming one sound effect per channel (or -1). */
typedef struct { int sfx[SYNTH_LEGACY_SLOTS]; } SynthPattern;
typedef struct {
    int n;
    int loop_from, loop_to;
    SynthPattern pat[SYNTH_MAX_PATTERNS];
} SynthMusic;

/* Tracker songs. A cell is empty (note NOTE_EMPTY, keep playing), a note-off (NOTE_OFF) or a note 0..95. */
#define NOTE_EMPTY (-2)
#define NOTE_OFF (-1)
#define NO_VOLUME 255
typedef struct { signed char note; unsigned char inst, vol, fx, fxp; signed char extra[3]; /* more notes struck together (General MIDI voices only), -1 = none */ } SynthCell;
typedef struct { int rows; SynthCell cell[SYNTH_MAX_CHANNELS][SONG_MAX_ROWS]; } SongPattern;
typedef struct {
    int bpm, rows_per_beat;
    int tracks;                     /* how many channels the song uses */
    int norder, order[SONG_MAX_ORDER];
    int loop_to;                    /* order position to jump back to after the last, or -1 to play once */
    int reverb;                     /* 0..100 */
    int tvol[SONG_TRACKS];          /* each track's volume: -3..3 steps of 1.25x */
    int slots[SONG_SLOTS];          /* song instrument number -> synth instrument handle (-1 = none) */
    int npatterns;
    SongPattern pat[SONG_MAX_PATTERNS];
} SynthSong;

int synth_load_soundfont(const void *data, int size); /* a SoundFont (.sf2) for the General MIDI instruments; 1 on success */
int synth_have_soundfont(void);
void synth_reset(int sample_rate);              /* forget everything and set the output sample rate */
void synth_config(int music_tracks, int sfx_channels, int lofi); /* music tracks 1..16, sound effect channels 1..4; lofi = the GBA-style output stage */
int synth_add_sample(const float *mono, int frames, int rate); /* copies the data; returns a handle or -1 */
int synth_add_instrument(const SynthInstrument *i);
void synth_default_instrument(SynthInstrument *i); /* sensible defaults (volume 1, sustain 1, no envelope) */
int synth_add_sfx(const SynthSfx *s);
int synth_add_music(const SynthMusic *m);
int synth_add_song(const SynthSong *s);
void synth_play_sfx(int handle, float volume);
void synth_play_sfx_group(const int *handles, int n, float volume); /* the tracks of one sound effect: each takes a channel, together */
void synth_stop_sfx(void);
void synth_play_music(int handle);
void synth_play_song(int handle);
void synth_stop_music(int fade_ms);             /* stops whichever of music or a song is playing */
int synth_music_playing(void);
void synth_mix(float *stereo, int frames);      /* adds `frames` interleaved stereo frames into the buffer */
double synth_sfx_seconds(int handle);           /* length of one pass through the sound effect */
double synth_song_seconds(int handle);          /* one pass through the whole order (ignoring the loop) */

#endif
