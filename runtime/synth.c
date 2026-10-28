#include "synth.h"
#define TSF_IMPLEMENTATION
#include "tsf.h"   /* TinySoundFont (MIT): plays the General MIDI instruments from a SoundFont */
#include <math.h>
#include <stdlib.h>
#include <string.h>

#define MAX_SFX 256
#define MAX_MUSIC 64
#define MAX_SONGS 16
#define MAX_SAMPLES 64
#define TWO_PI 6.283185307179586
#define GM_BLOCK 64 /* frames the SoundFont player renders at a time */

static tsf *g_sf = NULL; /* the loaded SoundFont; each voice plays through its own copy that shares the sample data */

static int g_sr = 44100;
static int g_mch = 6, g_sch = 3; /* music tracks, sound effect channels */
#define SFX_BASE SYNTH_MAX_CHANNELS /* sound effect voices follow the music voices */
#define NVOICES (SYNTH_MAX_CHANNELS + SYNTH_MAX_SFX_CHANNELS)
static int g_lofi = 0;

static SynthInstrument g_inst[SYNTH_MAX_INSTRUMENTS];
static int g_ninst;
typedef struct { float *data; int frames, rate; } Sample;
static Sample g_samples[MAX_SAMPLES];
static int g_nsamples;
static long g_sample_bytes;
static SynthSfx g_sfx[MAX_SFX];
static int g_nsfx;
static SynthMusic g_music[MAX_MUSIC];
static int g_nmusic;
static SynthSong g_songs[MAX_SONGS];
static int g_nsongs;

/* ---------------------------------------------------------------- instruments */

void synth_default_instrument(SynthInstrument *i) {
    memset(i, 0, sizeof *i);
    i->volume = 1.0f; i->sustain = 1.0f; i->fixed_note = -1; i->loop_start = -1; i->loop_end = -1; i->duty = 2; i->root = 48;
    memset(i->wave, 8, sizeof i->wave);
}

static void builtin_instruments(void) {
    g_ninst = 0;
    for (int w = 0; w < SYNTH_BUILTIN_INSTRUMENTS; w++) {
        SynthInstrument in; synth_default_instrument(&in);
        in.type = INST_BASIC; in.basic = w;
        g_inst[g_ninst++] = in;
    }
}

int synth_add_instrument(const SynthInstrument *i) {
    if (g_ninst >= SYNTH_MAX_INSTRUMENTS) return -1;
    g_inst[g_ninst] = *i;
    return g_ninst++;
}

int synth_add_sample(const float *mono, int frames, int rate) {
    if (g_nsamples >= MAX_SAMPLES || frames < 1 || rate < 1000) return -1;
    long bytes = (long)frames * (long)sizeof(float);
    if (g_sample_bytes + bytes > SYNTH_MAX_SAMPLE_BYTES) return -1;
    float *copy = malloc((size_t)bytes);
    if (!copy) return -1;
    memcpy(copy, mono, (size_t)bytes);
    g_samples[g_nsamples].data = copy; g_samples[g_nsamples].frames = frames; g_samples[g_nsamples].rate = rate;
    g_sample_bytes += bytes;
    return g_nsamples++;
}

int synth_add_sfx(const SynthSfx *s) {
    if (g_nsfx >= MAX_SFX) return -1;
    g_sfx[g_nsfx] = *s;
    return g_nsfx++;
}
int synth_add_music(const SynthMusic *m) {
    if (g_nmusic >= MAX_MUSIC) return -1;
    g_music[g_nmusic] = *m;
    return g_nmusic++;
}
int synth_add_song(const SynthSong *s) {
    if (g_nsongs >= MAX_SONGS) return -1;
    g_songs[g_nsongs] = *s;
    return g_nsongs++;
}

/* ---------------------------------------------------------------- voices (one per channel) */

enum { ST_ATTACK, ST_DECAY, ST_SUSTAIN, ST_RELEASE };

typedef struct {
    int active, owner;           /* owner: 0 = a sound effect, 1 = music */
    int inst;
    double note;                 /* pitch in semitones from C0 */
    double phase;                /* 0..1 in the waveform; for samples, the position in frames */
    float vol;                   /* note volume 0..1 */
    float gain;                  /* smoothed output gain, so notes don't click */
    int stage; float env, rel_from;
    double nsamp;                /* samples since the note started */
    unsigned lfsr; double lfsr_phase; float noise;
    float pan;
    unsigned long age, group;     /* group: the sound effect start this voice belongs to */
    tsf *sf; float gmbuf[GM_BLOCK * 2]; int gm_pos, gm_n, gm_released, gm_done; /* General MIDI voices */
    /* tracker effect for the current row */
    int fx, fxp; double fx_samples; double slide;
    /* sound effect player */
    int seq, step; double pos; double prev_pitch; float seq_vol;
    int trk_step;                /* the track's volume: -3..3 steps of 1.25x */
    float send;                  /* how much of this voice goes into the reverb, 0..1 */
} Voice;

static Voice g_v[NVOICES];
static unsigned long g_age;
static float g_music_gain = 1.0f;
static int g_rev_kind = REVERB_ROOM;
static long g_reverb_tail = 0; /* samples left to run the reverb after the last sound fed it, so its tail can ring out */
static void reverb_kind(int kind);

static double ms_samples(int ms) { return ms * (double)g_sr / 1000.0; }

static void voice_release(Voice *v) {
    const SynthInstrument *in = &g_inst[v->inst];
    if (in->type == INST_GM) { if (v->sf) tsf_note_off_all(v->sf); v->gm_released = 1; v->stage = ST_RELEASE; return; } /* the SoundFont has its own release */
    if (in->release_ms <= 0) { v->active = 0; return; }
    v->stage = ST_RELEASE; v->rel_from = v->env;
}

/* Strike one key of a General MIDI instrument on the voice's own SoundFont player. */
static void gm_note(Voice *v, const SynthInstrument *in, int key) {
    int idx = tsf_get_presetindex(v->sf, in->gm_drum ? 128 : 0, in->gm_program);
    if (idx < 0) idx = tsf_get_presetindex(v->sf, 0, in->gm_program);
    if (idx < 0) idx = 0;
    tsf_note_on(v->sf, idx, key < 0 ? 0 : key > 127 ? 127 : key, 0.9f);
}

/* Start a note on a voice. A fresh voice starts silent; one already playing glides its gain, so there is no click. */
static void voice_note_on(Voice *v, int inst, double note, float vol, int owner) {
    const SynthInstrument *in = &g_inst[inst];
    int fresh = !v->active;
    int keep_phase = !fresh && in->type == INST_BASIC && v->inst == inst; /* the original waves keep their phase between steps */
    unsigned lfsr = fresh || v->lfsr == 0 ? 2463534242u : v->lfsr;
    float gain = fresh ? 0.0f : v->gain;
    double phase = keep_phase ? v->phase : 0.0;
    float noise = keep_phase ? v->noise : 0.0f;
    unsigned long age = fresh ? ++g_age : v->age, group = v->group;
    int seq = v->seq, step = v->step, trk = v->trk_step; double pos = v->pos, prev = v->prev_pitch; float seq_vol = v->seq_vol;
    tsf *sf = v->sf; /* kept across notes: it is the voice's own SoundFont player */
    memset(v, 0, sizeof *v);
    v->sf = sf;
    v->active = 1; v->owner = owner; v->inst = inst; v->note = note; v->vol = vol; v->gain = gain; v->phase = phase;
    v->noise = noise; v->lfsr = lfsr; v->age = age; v->group = group; v->pan = in->pan;
    v->seq = seq; v->step = step; v->pos = pos; v->prev_pitch = prev; v->seq_vol = seq_vol; v->trk_step = trk;
    if (in->type == INST_GM) { /* a SoundFont note: its own envelope does the rest */
        if (!g_sf) { v->active = 0; return; }
        if (!v->sf) {
            v->sf = tsf_copy(g_sf);
            if (!v->sf) { v->active = 0; return; }
            tsf_set_output(v->sf, TSF_STEREO_INTERLEAVED, g_sr, 0.0f);
            tsf_set_max_voices(v->sf, 12);
        } else tsf_note_off_all(v->sf);
        gm_note(v, in, in->fixed_note >= 0 ? in->fixed_note : (int)floor(note + 0.5));
        v->stage = ST_SUSTAIN; v->env = 1.0f;
        return;
    }
    if (in->attack_ms > 0) { v->stage = ST_ATTACK; v->env = 0; }
    else if (in->decay_ms > 0 && in->sustain < 1.0f) { v->stage = ST_DECAY; v->env = 1; }
    else { v->stage = ST_SUSTAIN; v->env = in->sustain; }
}

static void voice_envelope(Voice *v, const SynthInstrument *in) {
    if (in->type == INST_GM) return;
    switch (v->stage) {
    case ST_ATTACK:
        v->env += (float)(1.0 / ms_samples(in->attack_ms));
        if (v->env >= 1.0f) {
            v->env = 1.0f;
            if (in->decay_ms > 0 && in->sustain < 1.0f) v->stage = ST_DECAY;
            else { v->stage = ST_SUSTAIN; v->env = in->sustain; }
        }
        break;
    case ST_DECAY:
        v->env -= (float)((1.0 - in->sustain) / ms_samples(in->decay_ms));
        if (v->env <= in->sustain) { v->env = in->sustain; v->stage = ST_SUSTAIN; }
        break;
    case ST_SUSTAIN: break;
    default: /* release */
        v->env -= (float)(v->rel_from / ms_samples(in->release_ms));
        if (v->env <= 0) { v->env = 0; v->active = 0; }
    }
}

static const int ARP_SHAPES[8][3] = { {0, 4, 7}, {0, 3, 7}, {0, 12, 0}, {0, 5, 7}, {0, 7, 12}, {0, 4, 11}, {0, 3, 10}, {0, 12, 24} };

/* One sample from a voice, advancing it. Returns the sample; the pan is in v->pan. */
static float voice_sample(Voice *v) {
    const SynthInstrument *in = &g_inst[v->inst];
    double note = v->note + v->slide, fmul = 1.0;
    float vmul = 1.0f, base = v->vol;
    const SynthSfx *sfx = v->seq >= 0 ? &g_sfx[v->seq] : NULL;
    const SynthStep *st = sfx ? &sfx->steps[v->step] : NULL;
    double sp = sfx ? sfx->speed * (double)g_sr / 60.0 : 1.0;

    if (st) { /* a sound effect step: its effect shapes the note */
        double t = v->pos / sp, semis = st->pitch;
        note = semis + 12;
        base = st->vol / 7.0f * v->seq_vol;
        switch (st->fx) {
        case FX_SLIDE: note = v->prev_pitch + 12 + (st->pitch - v->prev_pitch) * t; break;
        case FX_VIBRATO: note += 0.5 * sin(TWO_PI * 7.0 * (v->pos / g_sr)); break;
        case FX_DROP: fmul = fmax(0.02, 1.0 - t); break;
        case FX_FADE_IN: vmul = (float)t; break;
        case FX_FADE_OUT: vmul = (float)(1.0 - t); break;
        case FX_ARP: { static const int off[3] = {0, 4, 7}; note += off[((int)(v->pos / (g_sr / 20.0))) % 3]; } break;
        }
    } else if (v->fx) { /* a tracker effect for this row */
        double t = v->fx_samples / g_sr;
        switch (v->fx) {
        case TFX_SLIDE_UP: v->slide += (v->fxp * 3.0) / g_sr; break;
        case TFX_SLIDE_DOWN: v->slide -= (v->fxp * 3.0) / g_sr; break;
        case TFX_VIBRATO: note += (v->fxp / 8.0) * sin(TWO_PI * 6.0 * t); break;
        case TFX_ARP: note += ARP_SHAPES[v->fxp & 7][((int)(t * 24.0)) % 3]; break;
        case TFX_VOLSLIDE: {
            float d = (float)(((v->fxp & 7) * 0.25) / g_sr);
            v->vol += v->fxp < 8 ? -d : d;
            v->vol = v->vol < 0 ? 0 : v->vol > 1 ? 1 : v->vol; base = v->vol;
        } break;
        case TFX_CUT:
            if (v->fx_samples >= v->fxp * (g_sr / 30.0)) { voice_release(v); v->fx = 0; }
            break;
        default: break;
        }
        v->fx_samples += 1.0;
    }
    if (in->fixed_note >= 0) note = in->fixed_note + (note - (st ? st->pitch + 12.0 : v->note)); /* drums keep their pitch, effects still bend it */
    if (in->vib_depth > 0 && v->nsamp >= ms_samples(in->vib_delay_ms))
        note += in->vib_depth * sin(TWO_PI * in->vib_rate * ((v->nsamp - ms_samples(in->vib_delay_ms)) / g_sr));

    if (in->sweep_ms > 0 && in->sweep != 0) { /* the pitch starts off and settles quickly, like a drum head */
        double t = v->nsamp / ms_samples(in->sweep_ms);
        if (t < 1.0) note += in->sweep * (1.0 - t) * (1.0 - t);
    }
    double freq = 440.0 * pow(2.0, (note - 57.0) / 12.0) * fmul;
    float w = 0;
    switch (in->type) {
    case INST_BASIC: {
        v->phase += freq / g_sr;
        int wrapped = 0;
        if (v->phase >= 1.0) { v->phase -= floor(v->phase); wrapped = 1; }
        switch (in->basic) {
        case WAVE_TRIANGLE: w = (float)(1.0 - 4.0 * fabs(v->phase - 0.5)); break;
        case WAVE_SAW: w = (float)(2.0 * v->phase - 1.0); break;
        case WAVE_SQUARE: w = v->phase < 0.5 ? 1.0f : -1.0f; break;
        case WAVE_PULSE: w = v->phase < 0.25 ? 1.0f : -1.0f; break;
        case WAVE_SINE: w = (float)sin(TWO_PI * v->phase); break;
        default:
            if (wrapped) {
                v->lfsr ^= v->lfsr << 13; v->lfsr ^= v->lfsr >> 17; v->lfsr ^= v->lfsr << 5;
                v->noise = (float)(v->lfsr & 0xFFFF) / 32768.0f - 1.0f;
            }
            w = v->noise;
        }
    } break;
    case INST_PULSE: {
        static const double duty[4] = {0.125, 0.25, 0.5, 0.75};
        v->phase += freq / g_sr;
        if (v->phase >= 1.0) v->phase -= floor(v->phase);
        w = v->phase < duty[in->duty & 3] ? 1.0f : -1.0f;
    } break;
    case INST_WAVE: {
        v->phase += freq / g_sr;
        if (v->phase >= 1.0) v->phase -= floor(v->phase);
        w = ((float)in->wave[(int)(v->phase * 32.0) & 31] - 7.5f) / 7.5f;
    } break;
    case INST_NOISE: { /* a shift register, clocked faster than the pitch: 15 bits sounds like hiss, 7 bits like metal */
        v->lfsr_phase += freq * 16.0 / g_sr;
        while (v->lfsr_phase >= 1.0) {
            v->lfsr_phase -= 1.0;
            unsigned bit = ((v->lfsr >> 0) ^ (v->lfsr >> 1)) & 1u;
            v->lfsr = (v->lfsr >> 1) | (bit << (in->noise_short ? 6 : 14));
            if (v->lfsr == 0) v->lfsr = 1;
            v->noise = (v->lfsr & 1u) ? 1.0f : -1.0f;
        }
        w = v->noise;
    } break;
    case INST_GM: { /* rendered a block at a time by the SoundFont player; its two channels are mixed down, the instrument's pan places it */
        if (!v->sf) { v->active = 0; return 0; }
        if (v->gm_pos >= v->gm_n) {
            if (v->gm_done) { v->active = 0; return 0; }
            tsf_render_float(v->sf, v->gmbuf, GM_BLOCK, 0);
            v->gm_n = GM_BLOCK; v->gm_pos = 0;
            if (v->gm_released && tsf_active_voice_count(v->sf) == 0) v->gm_done = 1; /* the release has finished: stop after this block */
        }
        w = (v->gmbuf[2 * v->gm_pos] + v->gmbuf[2 * v->gm_pos + 1]) * 0.5f;
        v->gm_pos++;
    } break;
    default: { /* INST_SAMPLE: play the recording faster or slower to change its pitch */
        const Sample *sm = in->sample >= 0 && in->sample < g_nsamples ? &g_samples[in->sample] : NULL;
        if (!sm) { v->active = 0; return 0; }
        double inc = ((double)sm->rate / g_sr) * pow(2.0, (note - in->root) / 12.0) * fmul;
        int i0 = (int)v->phase;
        int end = in->loop_start >= 0 ? (in->loop_end > in->loop_start && in->loop_end < sm->frames ? in->loop_end : sm->frames - 1) : sm->frames - 1;
        if (i0 > end) {
            if (in->loop_start >= 0) { v->phase = in->loop_start + (v->phase - (end + 1)); i0 = (int)v->phase; if (i0 < 0 || i0 > end) i0 = in->loop_start; }
            else { v->active = 0; return 0; }
        }
        if (g_lofi) w = sm->data[i0]; /* nearest sample, crunchy like the real hardware */
        else { int i1 = i0 + 1 > end ? (in->loop_start >= 0 ? in->loop_start : i0) : i0 + 1; float f = (float)(v->phase - i0); w = sm->data[i0] * (1 - f) + sm->data[i1] * f; }
        v->phase += inc;
    }
    }

    voice_envelope(v, in);
    /* about 1 ms of smoothing on the gain avoids clicks at note edges */
    float target = base * vmul * v->env * in->volume * (in->type == INST_GM ? 0.35f : 0.22f) * powf(1.25f, (float)v->trk_step);
    v->gain += (target - v->gain) * 0.02f;
    v->nsamp += 1.0;

    if (st) { /* on to the next step of the sound effect */
        v->pos += 1.0;
        if (v->pos >= sp) {
            v->pos -= sp;
            v->prev_pitch = st->pitch;
            v->step++;
            if (sfx->loop_start >= 0) {
                int end = (sfx->loop_end >= 0 && sfx->loop_end < sfx->n) ? sfx->loop_end : sfx->n - 1;
                if (v->step > end) v->step = sfx->loop_start < sfx->n ? sfx->loop_start : 0;
            } else if (v->step >= sfx->n) {
                v->vol = st->vol / 7.0f * v->seq_vol; /* the tail keeps the last step's volume while the release plays out */
                v->seq = -1; voice_release(v); return w * v->gain;
            }
            const SynthStep *ns = &sfx->steps[v->step]; /* each step is a new note for the instrument, unless it holds the one before */
            if (ns->fx != FX_TIE && ns->inst < g_ninst) {
                int seq = v->seq, step = v->step; double p = v->pos, pp = v->prev_pitch; float sv = v->seq_vol;
                voice_note_on(v, ns->inst, ns->pitch + 12.0, 1.0f, v->owner);
                v->seq = seq; v->step = step; v->pos = p; v->prev_pitch = pp; v->seq_vol = sv;
            }
        }
    }
    return w * v->gain;
}

double synth_sfx_seconds(int h) { return h >= 0 && h < g_nsfx ? g_sfx[h].n * g_sfx[h].speed / 60.0 : 0; }

double synth_song_seconds(int h) {
    if (h < 0 || h >= g_nsongs) return 0;
    const SynthSong *s = &g_songs[h];
    double rows = 0;
    for (int i = 0; i < s->norder; i++) rows += s->pat[s->order[i]].rows;
    return rows * 60.0 / (s->bpm * (double)s->rows_per_beat);
}

/* ---------------------------------------------------------------- playing sound effects */

static void sfx_start_on(int c, int h, float volume) {
    const SynthSfx *s = &g_sfx[h];
    Voice *v = &g_v[c];
    int fresh = !v->active;
    if (fresh) memset(v, 0, sizeof *v);
    if (s->steps[0].inst >= g_ninst) return;
    voice_note_on(v, s->steps[0].inst, s->steps[0].pitch + 12.0, 1.0f, 0);
    v->seq = h; v->step = 0; v->pos = 0; v->prev_pitch = s->steps[0].pitch; v->seq_vol = volume; v->trk_step = s->vol_step;
    v->send = s->reverb / 100.0f;
    v->phase = 0; v->noise = 0; v->lfsr = 2463534242u; v->gain = 0; /* a new sound effect always starts from the top */
}

static unsigned long g_group;

/* Play the tracks of one sound effect together, each on its own sound effect channel. If the channels are busy, the oldest
 * sound effect is replaced whole. Music has its own voices, so it is never touched. */
void synth_play_sfx_group(const int *hs, int n, float volume) {
    if (n > g_sch) n = g_sch;
    int pick[SYNTH_MAX_SFX_CHANNELS], got = 0;
    if (n < 1) return;
    volume = volume < 0 ? 0 : volume > 1 ? 1 : volume;
    for (int i = 0; i < g_sch && got < n; i++) if (!g_v[SFX_BASE + i].active) pick[got++] = SFX_BASE + i;
    while (got < n) {
        int oldest = -1;
        for (int i = 0; i < g_sch; i++) {
            Voice *v = &g_v[SFX_BASE + i]; int taken = 0;
            for (int k = 0; k < got; k++) if (pick[k] == SFX_BASE + i) taken = 1;
            if (v->active && !taken && (oldest < 0 || v->age < g_v[oldest].age)) oldest = SFX_BASE + i;
        }
        if (oldest < 0) break;
        unsigned long grp = g_v[oldest].group;
        for (int i = 0; i < g_sch; i++) {
            Voice *v = &g_v[SFX_BASE + i]; int taken = 0;
            for (int k = 0; k < got; k++) if (pick[k] == SFX_BASE + i) taken = 1;
            if (v->active && !taken && v->group == grp) {
                if (got < n) pick[got++] = SFX_BASE + i;
                else { v->seq = -1; voice_release(v); }
            }
        }
    }
    unsigned long grp = ++g_group;
    for (int k = 0; k < got; k++) {
        if (hs[k] < 0 || hs[k] >= g_nsfx) continue;
        sfx_start_on(pick[k], hs[k], volume);
        g_v[pick[k]].group = grp; g_v[pick[k]].age = ++g_age;
    }
}
void synth_play_sfx(int h, float volume) { synth_play_sfx_group(&h, 1, volume); }

void synth_stop_sfx(void) {
    for (int c = SFX_BASE; c < SFX_BASE + g_sch; c++) if (g_v[c].active) { g_v[c].seq = -1; voice_release(&g_v[c]); }
}

/* ---------------------------------------------------------------- music: older patterns of sound effects */

static struct { int active, handle, pat; double elapsed, len; double fade_step; int fading; } g_m;
/* ---------------------------------------------------------------- music: tracker songs */
static struct { int active, handle, ord, row; double row_pos, row_len; double fade_step; int fading; } g_s;

static void music_halt(void) {
    for (int c = 0; c < SYNTH_MAX_CHANNELS; c++) if (g_v[c].active) { g_v[c].seq = -1; voice_release(&g_v[c]); }
    g_m.active = 0; g_m.fading = 0; g_s.active = 0; g_s.fading = 0;
    g_music_gain = 1.0f;
}

static void music_start_pattern(int p) {
    const SynthMusic *m = &g_music[g_m.handle];
    g_m.pat = p;
    double len = 0, fallback = 0;
    int any = 0;
    for (int c = 0; c < SYNTH_LEGACY_SLOTS && c < g_mch; c++) {
        int h = m->pat[p].sfx[c];
        if (h < 0 || h >= g_nsfx) continue;
        const SynthSfx *s = &g_sfx[h];
        double step = s->speed * (double)g_sr / 60.0;
        if (s->loop_start < 0) { double d = s->n * step; if (d > len) len = d; any = 1; }
        else if (fallback == 0) fallback = SYNTH_STEPS * step;
    }
    if (!any) len = fallback > 0 ? fallback : 2.0 * g_sr; /* only looping (or no) sounds: a full 32 steps */
    g_m.len = len; g_m.elapsed = 0;
    for (int c = 0; c < SYNTH_LEGACY_SLOTS && c < g_mch; c++) {
        int h = m->pat[p].sfx[c];
        if (h >= 0 && h < g_nsfx) {
            sfx_start_on(c, h, 1.0f); g_v[c].owner = 1;
        } else if (g_v[c].active) {
            g_v[c].seq = -1; voice_release(&g_v[c]);
        }
    }
}

static void music_next(void) {
    const SynthMusic *m = &g_music[g_m.handle];
    int next = g_m.pat + 1;
    if (m->loop_from >= 0 && m->loop_to >= 0 && g_m.pat >= m->loop_to) next = m->loop_from;
    if (next >= m->n) { music_halt(); return; }
    music_start_pattern(next);
}

void synth_play_music(int h) {
    if (h < 0 || h >= g_nmusic || g_music[h].n < 1) return;
    music_halt();
    g_m.active = 1; g_m.handle = h;
    music_start_pattern(0);
}

/* ---- songs ---- */


static void song_row(void) {
    const SynthSong *s = &g_songs[g_s.handle];
    const SongPattern *p = &s->pat[s->order[g_s.ord]];
    for (int c = 0; c < s->tracks; c++) {
        if (c % SONG_TRACKS >= g_mch) continue; /* a track past what the console plays (a chord's later voices still belong to the early tracks) */
        Voice *v = &g_v[c];
        const SynthCell *cell = &p->cell[c][g_s.row];
        v->fx = 0; v->fxp = 0; v->fx_samples = 0;
        if (cell->note >= 0) {
            int slot = cell->inst < SONG_SLOTS ? s->slots[cell->inst] : -1;
            if (slot >= 0 && slot < g_ninst) {
                float vol = cell->vol == NO_VOLUME ? (v->vol > 0 ? v->vol : 1.0f) : cell->vol / 15.0f;
                voice_note_on(v, slot, cell->note, vol, 1);
                v->seq = -1; /* a music note is not a sound effect step */
                v->trk_step = s->tvol[c % SONG_TRACKS];
                v->send = s->reverb / 100.0f;
                if (g_inst[slot].type == INST_GM && v->sf) for (int e = 0; e < 3; e++) if (cell->extra[e] >= 0) gm_note(v, &g_inst[slot], cell->extra[e]); /* drum hits struck together */
            }
        } else if (cell->note == NOTE_OFF) {
            if (v->active) voice_release(v);
        } else if (cell->vol != NO_VOLUME && v->active) {
            v->vol = cell->vol / 15.0f;
        }
        if (cell->fx && v->active) { v->fx = cell->fx; v->fxp = cell->fxp; if (cell->fx == TFX_PAN) v->pan = (cell->fxp - 8) / 8.0f; }
    }
}

static void song_begin_row(void) {
    const SynthSong *s = &g_songs[g_s.handle];
    g_s.row_len = g_sr * 60.0 / (s->bpm * (double)s->rows_per_beat);
    g_s.row_pos = 0;
    song_row();
}

static void song_next_row(void) {
    const SynthSong *s = &g_songs[g_s.handle];
    g_s.row++;
    if (g_s.row >= s->pat[s->order[g_s.ord]].rows) {
        g_s.row = 0; g_s.ord++;
        if (g_s.ord >= s->norder) {
            if (s->loop_to >= 0 && s->loop_to < s->norder) g_s.ord = s->loop_to;
            else { music_halt(); return; }
        }
    }
    song_begin_row();
}

void synth_play_song(int h) {
    if (h < 0 || h >= g_nsongs || g_songs[h].norder < 1) return;
    music_halt();
    g_s.active = 1; g_s.handle = h; g_s.ord = 0; g_s.row = 0;
    reverb_kind(g_songs[h].reverb_kind);
    for (int c = 0; c < SYNTH_MAX_CHANNELS; c++) g_v[c].active = 0;
    song_begin_row();
}

void synth_stop_music(int fade_ms) {
    if (!g_m.active && !g_s.active) return;
    if (fade_ms <= 0) { music_halt(); return; }
    g_m.fading = g_s.fading = 1;
    g_m.fade_step = g_s.fade_step = g_music_gain / (fade_ms * (double)g_sr / 1000.0);
}

int synth_music_playing(void) { return g_m.active || g_s.active; }

/* ---------------------------------------------------------------- the output stage: reverb and a lo-fi sound */

/* A small Schroeder reverb (four damped feedback echoes and two diffusers a side, as in Freeverb), in three spaces. The GBA's own sound
 * driver had a simple reverb that gave its music much of its warmth; this is the same idea with more depth. The music feeds it at
 * the song's amount, a sound effect only at its own (dry by default). */
#define REV_MAX 4096
#define COMBS 4
#define ALLPASSES 2
static const int COMB_L[COMBS] = {1116, 1188, 1277, 1356}, COMB_R[COMBS] = {1139, 1211, 1300, 1379};
static const int AP_L[ALLPASSES] = {556, 441}, AP_R[ALLPASSES] = {579, 464};
/* size: how far apart the walls are (echo times), feedback: how long it rings, damp: how fast the highs die (a cave is dark and long) */
static const struct { float size, feedback, damp; } REVERBS[REVERB_KINDS] = {
    {0.65f, 0.70f, 0.45f}, /* room: short and warm */
    {1.00f, 0.84f, 0.25f}, /* hall: long and bright */
    {1.40f, 0.89f, 0.60f}, /* cave: very long, the highs soaked up */
};
static float rev_buf[2][COMBS][REV_MAX], ap_buf[2][ALLPASSES][REV_MAX];
static float rev_lp[2][COMBS];
static int rev_pos[2][COMBS], rev_len[2][COMBS], ap_pos[2][ALLPASSES], ap_len[2][ALLPASSES];

static int scaled_len(int n, float size) {
    int k = (int)(n * size * (g_sr / 44100.0));
    return k < 1 ? 1 : k > REV_MAX ? REV_MAX : k;
}
static void reverb_reset(void) {
    memset(rev_buf, 0, sizeof rev_buf); memset(ap_buf, 0, sizeof ap_buf); memset(rev_lp, 0, sizeof rev_lp);
    memset(rev_pos, 0, sizeof rev_pos); memset(ap_pos, 0, sizeof ap_pos);
    const float size = REVERBS[g_rev_kind].size;
    for (int k = 0; k < COMBS; k++) { rev_len[0][k] = scaled_len(COMB_L[k], size); rev_len[1][k] = scaled_len(COMB_R[k], size); }
    for (int k = 0; k < ALLPASSES; k++) { ap_len[0][k] = scaled_len(AP_L[k], 1.0f); ap_len[1][k] = scaled_len(AP_R[k], 1.0f); }
}
/* A new space empties the old one (a different song); the same space keeps ringing. */
static void reverb_kind(int kind) {
    kind = kind < 0 || kind >= REVERB_KINDS ? REVERB_ROOM : kind;
    if (kind != g_rev_kind) { g_rev_kind = kind; reverb_reset(); }
}

/* in_l, in_r: what is sent to the reverb; the echoes are added to *l, *r. The input is scaled by (1 - feedback), so every space comes
 * out about as loud for the same amount: only its length and colour differ. */
static void reverb_process(float in_l, float in_r, float *l, float *r) {
    const float fb = REVERBS[g_rev_kind].feedback, damp = REVERBS[g_rev_kind].damp, gain = (1.0f - fb) * 0.5f;
    const float in[2] = {in_l * gain, in_r * gain};
    float out[2] = {0, 0};
    for (int ch = 0; ch < 2; ch++) {
        for (int k = 0; k < COMBS; k++) {
            float y = rev_buf[ch][k][rev_pos[ch][k]];
            rev_lp[ch][k] = y * (1.0f - damp) + rev_lp[ch][k] * damp; /* the echoes get duller as they fade */
            rev_buf[ch][k][rev_pos[ch][k]] = in[ch] + rev_lp[ch][k] * fb;
            if (++rev_pos[ch][k] >= rev_len[ch][k]) rev_pos[ch][k] = 0;
            out[ch] += y;
        }
        for (int k = 0; k < ALLPASSES; k++) { /* diffusers: smear the echoes into a smooth wash */
            float b = ap_buf[ch][k][ap_pos[ch][k]];
            ap_buf[ch][k][ap_pos[ch][k]] = out[ch] + b * 0.5f;
            out[ch] = b - out[ch];
            if (++ap_pos[ch][k] >= ap_len[ch][k]) ap_pos[ch][k] = 0;
        }
    }
    *l += out[0]; *r += out[1];
}

static double lo_hold = 0; static float lo_l, lo_r, lp_l, lp_r;
/* The GBA mixed at about 32 kHz with 8-bit output: soften the top end (so the held samples don't alias), then hold samples
 * at that rate and round them to 8 bits. The result is grainy in just the way the old hardware was. */
static void lofi_process(float *l, float *r) {
    lp_l += (*l - lp_l) * 0.7f; lp_r += (*r - lp_r) * 0.7f;
    lo_hold += 32768.0 / g_sr;
    if (lo_hold >= 1.0) {
        lo_hold -= 1.0;
        lo_l = roundf(lp_l * 127.0f) / 127.0f; lo_r = roundf(lp_r * 127.0f) / 127.0f;
    }
    *l = lo_l; *r = lo_r;
}

/* ---------------------------------------------------------------- control and mixing */

void synth_reset(int sample_rate) {
    g_sr = sample_rate > 0 ? sample_rate : 44100;
    for (int i = 0; i < g_nsamples; i++) { free(g_samples[i].data); g_samples[i].data = NULL; }
    g_nsamples = 0; g_sample_bytes = 0;
    g_nsfx = g_nmusic = g_nsongs = 0;
    for (int c = 0; c < NVOICES; c++) if (g_v[c].sf) tsf_close(g_v[c].sf);
    if (g_sf) { tsf_close(g_sf); g_sf = NULL; }
    memset(g_v, 0, sizeof g_v);
    for (int c = 0; c < NVOICES; c++) g_v[c].seq = -1;
    memset(&g_m, 0, sizeof g_m); memset(&g_s, 0, sizeof g_s);
    g_age = 0; g_music_gain = 1.0f; g_rev_kind = REVERB_ROOM; g_reverb_tail = 0; g_mch = 6; g_sch = 3; g_lofi = 0; g_group = 0;
    lo_hold = 0; lo_l = lo_r = lp_l = lp_r = 0;
    builtin_instruments();
    reverb_reset();
}

int synth_load_soundfont(const void *data, int size) {
    if (g_sf) return 1;
    g_sf = tsf_load_memory(data, size);
    return g_sf != NULL;
}
int synth_have_soundfont(void) { return g_sf != NULL; }
int synth_replace_soundfont(const void *data, int size) {
    tsf *sf = tsf_load_memory(data, size);
    if (!sf) return 0;
    for (int c = 0; c < NVOICES; c++) { /* each General MIDI voice plays through a copy of the old one */
        if (g_v[c].sf) { tsf_close(g_v[c].sf); g_v[c].sf = NULL; }
        if (g_v[c].active && g_v[c].inst >= 0 && g_v[c].inst < g_ninst && g_inst[g_v[c].inst].type == INST_GM) g_v[c].active = 0;
    }
    if (g_sf) tsf_close(g_sf);
    g_sf = sf;
    return 1;
}

static void gm_key(unsigned char *keys, int k) { if (k >= 0 && k < 128) keys[k >> 3] |= (unsigned char)(1 << (k & 7)); }
/* A note played on a General MIDI instrument: a drum kit needs that key's sound only; a melodic instrument the recordings near it, an
 * octave either way, since slides, vibrato and arpeggios move a note after it starts. */
static void gm_played(unsigned char *keys, const SynthInstrument *in, int note) {
    if (in->gm_drum) { gm_key(keys, note); return; }
    for (int k = note - 12; k <= note + 12; k++) gm_key(keys, k);
}
int synth_gm_presets(int *presets, unsigned char (*keys)[16], int max) {
    int at[SYNTH_MAX_INSTRUMENTS], n = 0; /* instrument -> its row in presets, or -1 */
    for (int i = 0; i < g_ninst; i++) {
        at[i] = -1;
        const SynthInstrument *in = &g_inst[i];
        if (in->type != INST_GM) continue;
        const int p = (in->gm_drum ? 128 : 0) << 8 | in->gm_program;
        int j = 0; while (j < n && presets[j] != p) j++;
        if (j == n) { if (n == max) continue; presets[n] = p; memset(keys[n], 0, 16); n++; }
        at[i] = j;
        if (in->fixed_note >= 0) gm_played(keys[j], in, in->fixed_note); /* plays that note whatever the music asks for */
    }
    /* the keys are the notes the songs and sound effects play on each instrument */
    #define GM_AT(inst) ((inst) >= 0 && (inst) < g_ninst && at[inst] >= 0 && g_inst[inst].fixed_note < 0)
    for (int s = 0; s < g_nsongs; s++) {
        const SynthSong *song = &g_songs[s];
        for (int p = 0; p < song->npatterns && p < SONG_MAX_PATTERNS; p++)
            for (int c = 0; c < SYNTH_MAX_CHANNELS; c++)
                for (int r = 0; r < song->pat[p].rows && r < SONG_MAX_ROWS; r++) {
                    const SynthCell *cell = &song->pat[p].cell[c][r];
                    const int inst = cell->note >= 0 && cell->inst < SONG_SLOTS ? song->slots[cell->inst] : -1;
                    if (!GM_AT(inst)) continue;
                    gm_played(keys[at[inst]], &g_inst[inst], cell->note);
                    for (int e = 0; e < 3; e++) if (cell->extra[e] >= 0) gm_played(keys[at[inst]], &g_inst[inst], cell->extra[e]);
                }
    }
    for (int x = 0; x < g_nsfx; x++)
        for (int i = 0; i < g_sfx[x].n && i < SYNTH_STEPS; i++) {
            const SynthStep *st = &g_sfx[x].steps[i];
            if (GM_AT(st->inst) && st->fx != FX_TIE) gm_played(keys[at[st->inst]], &g_inst[st->inst], st->pitch + 12);
        }
    #undef GM_AT
    return n;
}

void synth_config(int music_tracks, int sfx_channels, int lofi) {
    g_mch = music_tracks < 1 ? 1 : music_tracks > SONG_TRACKS ? SONG_TRACKS : music_tracks;
    g_sch = sfx_channels < 1 ? 1 : sfx_channels > SYNTH_MAX_SFX_CHANNELS ? SYNTH_MAX_SFX_CHANNELS : sfx_channels;
    g_lofi = lofi ? 1 : 0;
}

void synth_mix(float *out, int frames) {
    while (frames > 0) {
        int n = frames;
        if (g_m.active) { /* never run past the end of the current pattern */
            int left = (int)ceil(g_m.len - g_m.elapsed);
            if (left < 1) left = 1;
            if (left < n) n = left;
        }
        if (g_s.active) { /* nor past the end of the current row */
            int left = (int)ceil(g_s.row_len - g_s.row_pos);
            if (left < 1) left = 1;
            if (left < n) n = left;
        }
        for (int i = 0; i < n; i++) {
            float l = 0, r = 0, sl = 0, sr = 0; /* sl, sr: what goes into the reverb */
            for (int c = 0; c < NVOICES; c++) {
                Voice *v = &g_v[c];
                if (!v->active) continue;
                float s = voice_sample(v);
                if (v->owner == 1) s *= g_music_gain;
                float pan = v->pan;
                const float vl = s * (pan > 0 ? 1.0f - pan : 1.0f), vr = s * (pan < 0 ? 1.0f + pan : 1.0f);
                l += vl; r += vr;
                if (v->send > 0) { sl += vl * v->send; sr += vr * v->send; }
            }
            /* the reverb runs while something feeds it and for five seconds after, long enough for a cave to die away */
            if (sl != 0 || sr != 0) g_reverb_tail = (long)(5.0 * g_sr);
            if (g_reverb_tail > 0) { reverb_process(sl, sr, &l, &r); g_reverb_tail--; }
            if (g_lofi) lofi_process(&l, &r);
            out[2 * i] += l; out[2 * i + 1] += r;
            if ((g_m.active && g_m.fading) || (g_s.active && g_s.fading)) {
                g_music_gain -= (float)(g_m.active ? g_m.fade_step : g_s.fade_step);
                if (g_music_gain <= 0) music_halt();
            }
        }
        out += 2 * n; frames -= n;
        if (g_m.active) {
            g_m.elapsed += n;
            if (g_m.elapsed + 0.5 >= g_m.len) music_next();
        }
        if (g_s.active) {
            g_s.row_pos += n;
            if (g_s.row_pos + 0.5 >= g_s.row_len) song_next_row();
        }
    }
}

/* ---------------------------------------------------------------- save states (the libretro core) */

/* Everything the synth holds is plain data in fixed arrays, so a state is those arrays written out: the live part (voices, the music and song
 * players, the reverb's delay lines, the output stage) and, with defs, what the game loaded (instruments, effects, music, songs). Sample data
 * is not written: the runtime loads the same files again by name. The SoundFont and each voice's copy of it belong to the running program and
 * stay as they are; a General MIDI note that was sounding is cut, the next note on its track plays as usual. */
static unsigned char *st_out; static const unsigned char *st_in; static size_t st_pos, st_len; static int st_bad;
static void st_put(const void *p, size_t n) { if (st_out) memcpy(st_out + st_pos, p, n); st_pos += n; }
static void st_get(void *p, size_t n) { if (st_pos + n > st_len) { st_bad = 1; return; } memcpy(p, st_in + st_pos, n); st_pos += n; }
#define ST_ALL(X) X(g_mch) X(g_sch) X(g_lofi) X(g_age) X(g_music_gain) X(g_rev_kind) X(g_reverb_tail) X(g_group) X(g_m) X(g_s) \
    X(rev_buf) X(ap_buf) X(rev_lp) X(rev_pos) X(rev_len) X(ap_pos) X(ap_len) X(lo_hold) X(lo_l) X(lo_r) X(lp_l) X(lp_r)
static void st_write(int defs) {
#define PUT(v) st_put(&(v), sizeof(v));
    ST_ALL(PUT)
#undef PUT
    st_put(g_v, sizeof g_v);
    st_put(&defs, sizeof defs);
    if (!defs) return;
    st_put(&g_ninst, sizeof g_ninst); st_put(g_inst, sizeof g_inst[0] * (size_t)g_ninst);
    st_put(&g_nsfx, sizeof g_nsfx); st_put(g_sfx, sizeof g_sfx[0] * (size_t)g_nsfx);
    st_put(&g_nmusic, sizeof g_nmusic); st_put(g_music, sizeof g_music[0] * (size_t)g_nmusic);
    st_put(&g_nsongs, sizeof g_nsongs); st_put(g_songs, sizeof g_songs[0] * (size_t)g_nsongs);
    st_put(&g_nsamples, sizeof g_nsamples);
}
size_t synth_state_size(int defs) { st_out = NULL; st_pos = 0; st_write(defs); return st_pos; }
size_t synth_state_save(unsigned char *out, int defs) { st_out = out; st_pos = 0; st_write(defs); st_out = NULL; return st_pos; }
int synth_state_load(const unsigned char *in, size_t len, int defs) {
    st_in = in; st_len = len; st_pos = 0; st_bad = 0;
    tsf *keep[NVOICES];
    for (int c = 0; c < NVOICES; c++) keep[c] = g_v[c].sf;
#define GET(v) st_get(&(v), sizeof(v));
    ST_ALL(GET)
#undef GET
    st_get(g_v, sizeof g_v);
    for (int c = 0; c < NVOICES; c++) {
        g_v[c].sf = keep[c];
        if (keep[c]) tsf_note_off_all(keep[c]);
        if (g_v[c].active && g_v[c].inst >= 0 && g_v[c].inst < SYNTH_MAX_INSTRUMENTS && g_inst[g_v[c].inst].type == INST_GM) g_v[c].active = 0;
    }
    int had = 0; st_get(&had, sizeof had);
    if (defs && had) {
        int n = 0;
        st_get(&n, sizeof n); if (n < 0 || n > SYNTH_MAX_INSTRUMENTS) return 0; g_ninst = n; st_get(g_inst, sizeof g_inst[0] * (size_t)n);
        st_get(&n, sizeof n); if (n < 0 || n > MAX_SFX) return 0; g_nsfx = n; st_get(g_sfx, sizeof g_sfx[0] * (size_t)n);
        st_get(&n, sizeof n); if (n < 0 || n > MAX_MUSIC) return 0; g_nmusic = n; st_get(g_music, sizeof g_music[0] * (size_t)n);
        st_get(&n, sizeof n); if (n < 0 || n > MAX_SONGS) return 0; g_nsongs = n; st_get(g_songs, sizeof g_songs[0] * (size_t)n);
        st_get(&n, sizeof n); if (n != g_nsamples) return 0; /* the runtime loaded the samples again first, in the same order */
    }
    return !st_bad;
}
void synth_drop_samples(void) {
    for (int i = 0; i < g_nsamples; i++) { free(g_samples[i].data); g_samples[i].data = NULL; }
    g_nsamples = 0; g_sample_bytes = 0;
}
