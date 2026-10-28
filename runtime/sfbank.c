/* sfbank: a SoundFont cut down to some of its presets (see sfbank.h). The SoundFont 2 layout, briefly: a RIFF "sfbk" with an INFO list
 * (names, copyright), "sdta" (the samples, 16-bit; in an SF3 each sample is an Ogg Vorbis stream) and "pdta", nine tables that point into
 * each other by index: presets -> preset zones (bags) -> generators and modulators, one generator naming an instrument -> instrument
 * zones -> generators, one naming a sample -> sample headers. A subset copies the chosen presets' rows of every table, renumbering the
 * indices, and puts each sample it needs into a new sample chunk, decoded. Each table ends with a terminal row the format requires. */
#include "sfbank.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <math.h>

#define STB_VORBIS_NO_PUSHDATA_API
#define STB_VORBIS_NO_STDIO
#include "stb_vorbis.c"

enum { GEN_KEY_RANGE = 43, GEN_INSTRUMENT = 41, GEN_SAMPLE_ID = 53 };
enum { SAMPLE_GAP = 46 };                         /* zero samples after each sample, as the format asks (interpolation reads past the end) */
enum { ST_MONO = 1, ST_COMPRESSED = 0x10, ST_ROM = 0x8000 };

typedef struct { const unsigned char *p; uint32_t n; } Span;
typedef struct { short *pcm; int frames, rate; int tried; } Decoded;

struct SfBank {
    unsigned char *data; size_t size; int max_rate; char *comment;
    Span info, smpl;
    Span phdr, pbag, pmod, pgen, inst, ibag, imod, igen, shdr; /* the pdta tables, terminal rows included */
    uint32_t nphdr, npbag, npmod, npgen, ninst, nibag, nimod, nigen, nshdr;
    Decoded *dec;                                             /* by sample, decoded on first use */
};

static uint16_t rd16(const unsigned char *p) { return (uint16_t)(p[0] | p[1] << 8); }
static uint32_t rd32(const unsigned char *p) { return (uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24; }

/* ---------------------------------------------------------------- reading */
static int fail(char *err, size_t errlen, const char *why) { if (err && errlen) snprintf(err, errlen, "SoundFont: %s", why); return 0; }

/* The chunks of a RIFF list body: calls fn for each (id, body); returns 0 if a chunk runs past the end. */
typedef void (*ChunkFn)(SfBank *b, const char *id, Span body, int *ok);
static int walk_chunks(SfBank *b, const unsigned char *p, uint32_t n, ChunkFn fn) {
    uint32_t at = 0; int ok = 1;
    while (ok && at + 8 <= n) {
        const uint32_t len = rd32(p + at + 4);
        if (len > n - at - 8) return 0;
        char id[5]; memcpy(id, p + at, 4); id[4] = 0;
        fn(b, id, (Span){ p + at + 8, len }, &ok);
        at += 8 + len + (len & 1);
    }
    return ok;
}
static void pdta_chunk(SfBank *b, const char *id, Span s, int *ok) {
    static const struct { const char *id; uint32_t size; size_t span, count; } T[] = {
        { "phdr", 38, offsetof(SfBank, phdr), offsetof(SfBank, nphdr) }, { "pbag", 4, offsetof(SfBank, pbag), offsetof(SfBank, npbag) },
        { "pmod", 10, offsetof(SfBank, pmod), offsetof(SfBank, npmod) }, { "pgen", 4, offsetof(SfBank, pgen), offsetof(SfBank, npgen) },
        { "inst", 22, offsetof(SfBank, inst), offsetof(SfBank, ninst) }, { "ibag", 4, offsetof(SfBank, ibag), offsetof(SfBank, nibag) },
        { "imod", 10, offsetof(SfBank, imod), offsetof(SfBank, nimod) }, { "igen", 4, offsetof(SfBank, igen), offsetof(SfBank, nigen) },
        { "shdr", 46, offsetof(SfBank, shdr), offsetof(SfBank, nshdr) },
    };
    for (size_t i = 0; i < sizeof T / sizeof T[0]; i++)
        if (!strcmp(id, T[i].id)) {
            if (s.n % T[i].size) { *ok = 0; return; }
            *(Span *)((char *)b + T[i].span) = s;
            *(uint32_t *)((char *)b + T[i].count) = s.n / T[i].size;
        }
}
static void sdta_chunk(SfBank *b, const char *id, Span s, int *ok) { (void)ok; if (!strcmp(id, "smpl")) b->smpl = s; }
static void top_chunk(SfBank *b, const char *id, Span s, int *ok) {
    if (strcmp(id, "LIST") || s.n < 4) return;
    if (!memcmp(s.p, "INFO", 4)) b->info = (Span){ s.p + 4, s.n - 4 };
    else if (!memcmp(s.p, "sdta", 4)) *ok = walk_chunks(b, s.p + 4, s.n - 4, sdta_chunk);
    else if (!memcmp(s.p, "pdta", 4)) *ok = walk_chunks(b, s.p + 4, s.n - 4, pdta_chunk);
}

SfBank *sfbank_open(const void *data, size_t size, int max_rate, char *err, size_t errlen) {
    if (size < 12 || size > 0x7fffffff || memcmp(data, "RIFF", 4) || memcmp((const char *)data + 8, "sfbk", 4)) { fail(err, errlen, "not a SoundFont file"); return NULL; }
    SfBank *b = calloc(1, sizeof *b);
    if (!b || !(b->data = malloc(size))) { free(b); fail(err, errlen, "out of memory"); return NULL; }
    memcpy(b->data, data, size); b->size = size; b->max_rate = max_rate;
    const uint32_t body = rd32(b->data + 4);
    if (!walk_chunks(b, b->data + 12, (uint32_t)(body - 4 < size - 12 ? body - 4 : size - 12), top_chunk)) { sfbank_close(b); fail(err, errlen, "a chunk is broken"); return NULL; }
    /* every table needs its terminal row, and the zone tables one more than the rows pointing into them */
    if (b->nphdr < 2 || b->npbag < 1 || b->npmod < 1 || b->npgen < 1 || b->ninst < 2 || b->nibag < 1 || b->nimod < 1 || b->nigen < 1 || b->nshdr < 2 || !b->smpl.p) {
        sfbank_close(b); fail(err, errlen, "a table is missing"); return NULL;
    }
    if (!(b->dec = calloc(b->nshdr, sizeof *b->dec))) { sfbank_close(b); fail(err, errlen, "out of memory"); return NULL; }
    return b;
}

void sfbank_close(SfBank *b) {
    if (!b) return;
    if (b->dec) for (uint32_t i = 0; i < b->nshdr; i++) free(b->dec[i].pcm);
    free(b->dec); free(b->data); free(b->comment); free(b);
}
void sfbank_set_comment(SfBank *b, const char *text) { free(b->comment); b->comment = text ? strdup(text) : NULL; }

int sfbank_count(const SfBank *b) { return (int)b->nphdr - 1; }
int sfbank_preset_at(const SfBank *b, int i) {
    if (i < 0 || (uint32_t)i >= b->nphdr - 1) return -1;
    const unsigned char *h = b->phdr.p + (size_t)i * 38;
    return SFBANK_PRESET(rd16(h + 22) & 0xff, rd16(h + 20) & 0xff);
}
static int find_preset(const SfBank *b, int preset) {
    for (uint32_t i = 0; i + 1 < b->nphdr; i++) if (sfbank_preset_at(b, (int)i) == preset) return (int)i;
    return -1;
}
int sfbank_has(const SfBank *b, int preset) { return find_preset(b, preset) >= 0; }

/* A sample recorded at `from` frames a second, at `to` instead (to < from): low-passed below the new rate's half (a windowed sinc, so
 * nothing above it folds back as a whistle), then read at the new spacing. Returns the new length; *out is malloc'd. */
static int resample(const short *in, int n, int from, int to, short **out) {
    enum { TAPS = 32 };
    const double fc = 0.45 * to / from; /* the cut-off, in cycles per input frame: a little under the new rate's half */
    double w[2 * TAPS + 1], sum = 0;
    for (int k = -TAPS; k <= TAPS; k++) {
        const double x = k ? sin(2 * M_PI * fc * k) / (M_PI * k) : 2 * fc;
        const double win = 0.42 + 0.5 * cos(M_PI * k / TAPS) + 0.08 * cos(2 * M_PI * k / TAPS); /* Blackman */
        w[k + TAPS] = x * win; sum += w[k + TAPS];
    }
    const int m = (int)((double)(n - 1) * to / from) + 1;
    float *lp = malloc(sizeof(float) * (size_t)n); short *o = malloc(sizeof(short) * (size_t)m);
    if (!lp || !o) { free(lp); free(o); return 0; }
    for (int i = 0; i < n; i++) {
        double acc = 0;
        for (int k = -TAPS; k <= TAPS; k++) { const int j = i + k; if (j >= 0 && j < n) acc += w[k + TAPS] * in[j]; }
        lp[i] = (float)(acc / sum);
    }
    for (int j = 0; j < m; j++) {
        const double pos = (double)j * from / to; const int i = (int)pos; const double f = pos - i;
        const double v = i + 1 < n ? lp[i] * (1 - f) + lp[i + 1] * f : lp[n - 1];
        o[j] = (short)(v > 32767 ? 32767 : v < -32768 ? -32768 : lrint(v));
    }
    free(lp);
    *out = o; return m;
}

/* A sample's frames as 16-bit mono at no more than the bank's max_rate, decoding an SF3 sample the first time it is asked for. NULL
 * (frames 0) for one that cannot be read. */
static const short *sample_pcm(SfBank *b, uint32_t s, int *frames, int *rate) {
    Decoded *d = &b->dec[s];
    if (!d->tried) {
        d->tried = 1;
        const unsigned char *h = b->shdr.p + (size_t)s * 46;
        const uint32_t start = rd32(h + 20), end = rd32(h + 24); const uint16_t type = rd16(h + 44);
        if (type & ST_ROM) { /* samples in a sound card's ROM: not in the file */ }
        else if (type & ST_COMPRESSED) {
            if (start < end && end <= b->smpl.n) {
                int ch = 0, rate = 0; short *out = NULL;
                const int n = stb_vorbis_decode_memory(b->smpl.p + start, (int)(end - start), &ch, &rate, &out);
                if (n > 0 && ch >= 1) {
                    if (ch > 1) for (int i = 0; i < n; i++) out[i] = out[i * ch]; /* the first channel: TinySoundFont plays each sample as mono */
                    d->pcm = out; d->frames = n;
                } else free(out);
            }
        } else if (start < end && (uint64_t)end * 2 <= b->smpl.n) {
            const int n = (int)(end - start);
            if ((d->pcm = malloc(sizeof(short) * (size_t)n))) { for (int i = 0; i < n; i++) d->pcm[i] = (short)rd16(b->smpl.p + ((size_t)start + (size_t)i) * 2); d->frames = n; }
        }
        d->rate = (int)rd32(h + 36);
        if (d->pcm && b->max_rate > 0 && d->rate > b->max_rate) {
            short *r = NULL; const int m = resample(d->pcm, d->frames, d->rate, b->max_rate, &r);
            if (m > 0) { free(d->pcm); d->pcm = r; d->frames = m; d->rate = b->max_rate; }
        }
    }
    *frames = d->frames; *rate = d->rate;
    return d->pcm;
}

/* ---------------------------------------------------------------- writing */
typedef struct { unsigned char *p; size_t n, cap; int bad; } Buf;
static void put(Buf *o, const void *src, size_t n) {
    if (o->bad) return;
    if (o->n + n > o->cap) {
        size_t c = o->cap ? o->cap : 4096; while (c < o->n + n) c *= 2;
        unsigned char *q = realloc(o->p, c); if (!q) { o->bad = 1; return; }
        o->p = q; o->cap = c;
    }
    if (src) memcpy(o->p + o->n, src, n); else memset(o->p + o->n, 0, n);
    o->n += n;
}
static void put16(Buf *o, uint32_t v) { unsigned char t[2] = { (unsigned char)v, (unsigned char)(v >> 8) }; put(o, t, 2); }
static void put32(Buf *o, uint32_t v) { unsigned char t[4] = { (unsigned char)v, (unsigned char)(v >> 8), (unsigned char)(v >> 16), (unsigned char)(v >> 24) }; put(o, t, 4); }
static void put_chunk(Buf *o, const char *id, const Buf *body) {
    put(o, id, 4); put32(o, (uint32_t)body->n); put(o, body->p, body->n);
    if (body->n & 1) put(o, NULL, 1);
}

/* indices from the old tables to the new: -1 not taken yet */
typedef struct { int *to; int *order; int n, cap; } Map;
static int map_take(Map *m, int old, int limit) {
    if (old < 0 || old >= limit) return -1;
    if (m->to[old] >= 0) return m->to[old];
    m->order[m->n] = old; m->to[old] = m->n;
    return m->n++;
}

/* Copy zones [bag0, bag1) of one table into out_bag/out_gen/out_mod, renumbering the generator `link` through `map` (instruments for
 * presets, samples for instruments). Zones whose link points nowhere lose that generator, which leaves them global or empty. */
/* With a key mask, a zone whose key range holds none of its keys is left out (zones without a range, global ones included, stay), and
 * each link target that stays gets the mask added to link_masks (an instrument then keeps the keys of every preset that plays it).
 * Returns the number of zones written, or -1 when the tables point outside themselves. */
static int copy_zones(Buf *out_bag, Buf *out_gen, Buf *out_mod, uint32_t *ngen, uint32_t *nmod,
                      Span bag, uint32_t nbag, Span gen, uint32_t ngen_old, Span mod, uint32_t nmod_old,
                      uint32_t bag0, uint32_t bag1, int link, Map *map, int link_limit,
                      const unsigned char *mask, unsigned char (*link_masks)[16]) {
    if (bag0 > bag1 || bag1 >= nbag) return -1;
    int zones = 0;
    for (uint32_t z = bag0; z < bag1; z++) {
        const uint32_t g0 = rd16(bag.p + z * 4), g1 = rd16(bag.p + (z + 1) * 4), m0 = rd16(bag.p + z * 4 + 2), m1 = rd16(bag.p + (z + 1) * 4 + 2);
        if (g0 > g1 || g1 >= ngen_old || m0 > m1 || m1 >= nmod_old) return -1;
        if (mask) {
            int keep = 1;
            for (uint32_t g = g0; g < g1; g++)
                if (rd16(gen.p + g * 4) == GEN_KEY_RANGE) {
                    const int lo = gen.p[g * 4 + 2], hi = gen.p[g * 4 + 3];
                    keep = 0;
                    for (int k = lo; k <= hi && k < 128 && !keep; k++) keep = mask[k >> 3] >> (k & 7) & 1;
                }
            if (!keep) continue;
            if (link_masks)
                for (uint32_t g = g0; g < g1; g++)
                    if (rd16(gen.p + g * 4) == link) { const int t = rd16(gen.p + g * 4 + 2); if (t < link_limit) for (int i = 0; i < 16; i++) link_masks[t][i] |= mask[i]; }
        }
        zones++;
        put16(out_bag, *ngen); put16(out_bag, *nmod);
        for (uint32_t m = m0; m < m1; m++) { put(out_mod, mod.p + m * 10, 10); (*nmod)++; }
        for (uint32_t g = g0; g < g1; g++) {
            const uint16_t op = rd16(gen.p + g * 4), amount = rd16(gen.p + g * 4 + 2);
            if (op == link) {
                const int to = map_take(map, amount, link_limit);
                if (to < 0) continue;
                put16(out_gen, op); put16(out_gen, (uint32_t)to);
            } else put(out_gen, gen.p + g * 4, 4);
            (*ngen)++;
        }
    }
    return zones;
}

unsigned char *sfbank_subset(SfBank *b, const int *presets, const unsigned char (*keys)[16], int n, size_t *out_size) {
    Buf phdr = {0}, pbag = {0}, pmod = {0}, pgen = {0}, inst = {0}, ibag = {0}, imod = {0}, igen = {0}, shdr = {0}, smpl = {0}, info = {0}, sdta = {0}, pdta = {0}, out = {0}, riff = {0};
    Map insts = { calloc(b->ninst, sizeof(int)), calloc(b->ninst, sizeof(int)), 0, 0 }, samples = { calloc(b->nshdr, sizeof(int)), calloc(b->nshdr, sizeof(int)), 0, 0 };
    unsigned char (*inst_keys)[16] = calloc(b->ninst, 16); /* the keys each instrument is played with (key masks only) */
    unsigned char *result = NULL; int ok = insts.to && insts.order && samples.to && samples.order && inst_keys, taken = 0;
    if (ok) { for (uint32_t i = 0; i < b->ninst; i++) insts.to[i] = -1; for (uint32_t i = 0; i < b->nshdr; i++) samples.to[i] = -1; }
    uint32_t nb = 0, ng = 0, nm = 0;

    /* presets, in the order asked; each once */
    for (int k = 0; ok && k < n; k++) {
        int dup = 0; for (int j = 0; j < k; j++) dup |= presets[j] == presets[k];
        const int p = dup ? -1 : find_preset(b, presets[k]);
        if (p < 0) continue;
        const unsigned char *h = b->phdr.p + (size_t)p * 38;
        put(&phdr, h, 24); put16(&phdr, nb); put(&phdr, h + 26, 12); /* name, preset, bank; the new first zone; library, genre, morphology */
        const uint32_t z0 = rd16(h + 24), z1 = rd16(h + 38 + 24);
        static const unsigned char all[16] = { 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255 };
        const int zones = copy_zones(&pbag, &pgen, &pmod, &ng, &nm, b->pbag, b->npbag, b->pgen, b->npgen, b->pmod, b->npmod, z0, z1, GEN_INSTRUMENT, &insts,
                                     (int)b->ninst - 1, keys ? keys[k] : all, inst_keys);
        if (zones < 0) ok = 0; else nb += (uint32_t)zones;
        taken++;
    }
    if (!taken) ok = 0;
    put(&phdr, "EOP", 3); put(&phdr, NULL, 21); put16(&phdr, nb); put(&phdr, NULL, 12);
    put16(&pbag, ng); put16(&pbag, nm);
    put(&pmod, NULL, 10); put(&pgen, NULL, 4);

    /* the instruments those presets play (the list grows only while presets are read, so this walks it once) */
    nb = ng = nm = 0;
    for (int k = 0; ok && k < insts.n; k++) {
        const int i = insts.order[k];
        const unsigned char *h = b->inst.p + (size_t)i * 22;
        put(&inst, h, 20); put16(&inst, nb);
        const uint32_t z0 = rd16(h + 20), z1 = rd16(h + 22 + 20);
        const int zones = copy_zones(&ibag, &igen, &imod, &ng, &nm, b->ibag, b->nibag, b->igen, b->nigen, b->imod, b->nimod, z0, z1, GEN_SAMPLE_ID, &samples,
                                     (int)b->nshdr - 1, inst_keys[i], NULL);
        if (zones < 0) ok = 0; else nb += (uint32_t)zones;
    }
    put(&inst, "EOI", 3); put(&inst, NULL, 17); put16(&inst, nb);
    put16(&ibag, ng); put16(&ibag, nm);
    put(&imod, NULL, 10); put(&igen, NULL, 4);

    /* their samples, decoded, each followed by the gap of silence */
    uint32_t at = 0;
    for (int k = 0; ok && k < samples.n; k++) {
        const int s = samples.order[k];
        const unsigned char *h = b->shdr.p + (size_t)s * 46;
        int frames = 0, rate = 0; const short *pcm = sample_pcm(b, (uint32_t)s, &frames, &rate);
        const uint16_t type = rd16(h + 44);
        uint32_t ls = rd32(h + 28), le = rd32(h + 32);
        if (!(type & ST_COMPRESSED)) { const uint32_t st = rd32(h + 20); ls = ls >= st ? ls - st : 0; le = le >= st ? le - st : 0; } /* SF2 loops are absolute, SF3 ones are from the sample's start */
        const uint32_t orig = rd32(h + 36);
        if (rate > 0 && orig > (uint32_t)rate) { ls = (uint32_t)((double)ls * rate / orig + 0.5); le = (uint32_t)((double)le * rate / orig + 0.5); } /* resampled */
        if (le > (uint32_t)frames) le = (uint32_t)frames;
        if (ls > le) ls = le;
        for (int i = 0; i < frames; i++) put16(&smpl, (uint16_t)pcm[i]);
        put(&smpl, NULL, SAMPLE_GAP * 2);
        put(&shdr, h, 20); put32(&shdr, at); put32(&shdr, at + (uint32_t)frames); put32(&shdr, at + ls); put32(&shdr, at + le);
        put32(&shdr, rate > 0 ? (uint32_t)rate : orig); put(&shdr, h + 40, 2); /* sample rate, original pitch, pitch correction */
        put16(&shdr, 0); put16(&shdr, ST_MONO);     /* no stereo partner: TinySoundFont plays each sample on its own anyway */
        at += (uint32_t)frames + SAMPLE_GAP;
    }
    put(&shdr, "EOS", 3); put(&shdr, NULL, 43);

    if (ok) {
        /* INFO: version 2.1 (an SF3 says 3), then the source's own lines (name, copyright, comments) as they were */
        put(&info, "INFO", 4);
        put(&info, "ifil", 4); put32(&info, 4); put16(&info, 2); put16(&info, 1);
        for (uint32_t p = 0; p + 8 <= b->info.n;) {
            const uint32_t len = rd32(b->info.p + p + 4);
            if (len > b->info.n - p - 8) break;
            if (memcmp(b->info.p + p, "ifil", 4) && !(b->comment && !memcmp(b->info.p + p, "ICMT", 4))) { put(&info, b->info.p + p, 8 + len); if (len & 1) put(&info, NULL, 1); }
            p += 8 + len + (len & 1);
        }
        if (b->comment) { /* zero-terminated, padded to an even length as INFO strings are */
            const size_t len = strlen(b->comment) + 1, padded = len + (len & 1);
            put(&info, "ICMT", 4); put32(&info, (uint32_t)padded); put(&info, b->comment, len - 1); put(&info, NULL, padded - len + 1);
        }
        put(&sdta, "sdta", 4); put_chunk(&sdta, "smpl", &smpl);
        put(&pdta, "pdta", 4);
        put_chunk(&pdta, "phdr", &phdr); put_chunk(&pdta, "pbag", &pbag); put_chunk(&pdta, "pmod", &pmod); put_chunk(&pdta, "pgen", &pgen);
        put_chunk(&pdta, "inst", &inst); put_chunk(&pdta, "ibag", &ibag); put_chunk(&pdta, "imod", &imod); put_chunk(&pdta, "igen", &igen);
        put_chunk(&pdta, "shdr", &shdr);
        put(&riff, "sfbk", 4); put_chunk(&riff, "LIST", &info); put_chunk(&riff, "LIST", &sdta); put_chunk(&riff, "LIST", &pdta);
        put_chunk(&out, "RIFF", &riff);
        if (!out.bad && !phdr.bad && !pbag.bad && !pmod.bad && !pgen.bad && !inst.bad && !ibag.bad && !imod.bad && !igen.bad && !shdr.bad && !smpl.bad && !info.bad && !sdta.bad && !pdta.bad && !riff.bad) {
            result = out.p; out.p = NULL; *out_size = out.n;
        }
    }
    Buf *all[] = { &phdr, &pbag, &pmod, &pgen, &inst, &ibag, &imod, &igen, &shdr, &smpl, &info, &sdta, &pdta, &out, &riff };
    for (size_t i = 0; i < sizeof all / sizeof all[0]; i++) free(all[i]->p);
    free(insts.to); free(insts.order); free(samples.to); free(samples.order); free(inst_keys);
    return result;
}
