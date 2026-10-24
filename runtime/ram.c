/* The console's RAM and save states, for the libretro core (included by runtime/libretro.c after main.c).
 *
 * Lua's memory comes from one fixed block, as a console's RAM does: TLSF (third_party/tlsf) manages it and keeps its own bookkeeping
 * inside it, so a copy of the block is a copy of every table, closure and coroutine of the game, allocator included. A save state is that
 * copy plus the little the runtime keeps outside Lua: the synth's live state (voices, song position, reverb), the sound voices, the screen
 * settings, and a list of how every picture, sound and sample was made.
 *
 * Within one run, loading a state copies the block back and nothing else needs to change: pictures and sounds made since then are still
 * there, and the game simply no longer refers to them. A state from an earlier run (NextUI's Resume) also needs the pictures, sounds and
 * synth instruments made again in the same slots, and two things that differ from run to run fixed up: where the core's code was loaded
 * (Lua holds pointers to its C functions) and the C library's standard streams (io.stderr). The block is placed at the same address in
 * every run so that every other pointer inside it stays right; when that address is taken, states still work within a run. */
#include <sys/mman.h>
#include "tlsf.h"
#include "lstate.h"
#include "ltable.h"
#include "lfunc.h"
#include "lstring.h"
#ifdef __APPLE__
#include <mach-o/loader.h>
#include <mach/mach.h>
#include <mach/mach_vm.h>
#else
#include <link.h>
#endif

#define RAM_BYTES ((size_t)8 << 20)               /* 8 MB: Breakout's Lua peaks at about 1.1 MB */
#ifdef __APPLE__
#define RAM_ADDR ((uintptr_t)0x10000000000ULL)     /* macOS keeps everything below 0x7000000000 for itself */
#else
#define RAM_ADDR ((uintptr_t)0x3000000000ULL)      /* inside the Brick's 39-bit address space, far from where Linux puts libraries */
#endif
#define RAM_EDGE 256                               /* bytes kept past the last used block (the free block's header) and at the end (TLSF's sentinel) */
#define STATE_MAGIC 0x31535347u                    /* "GSS1" */
#define STATE_VERSION 1
#define STATE_HEADROOM ((size_t)4 << 20)           /* room for pictures and songs the game makes after the emulator first asks the size */

static unsigned char *g_ram; static tlsf_t g_tlsf; static bool g_ram_fixed;
static uint64_t g_session;      /* this run; a state from another run needs its assets made again */
static uintptr_t g_code_base; static size_t g_code_size;
static uint64_t g_build;        /* this exact core: a state holds pointers into its code, so another build of it cannot use the state */
static size_t g_state_bytes;    /* fixed once asked: the emulator's rewind compares states of one size */

static void *ram_alloc(void *ud, void *ptr, size_t osize, size_t nsize) {
    (void)ud; (void)osize;
    if (nsize == 0) { if (ptr) tlsf_free(g_tlsf, ptr); return NULL; }
    return tlsf_realloc(g_tlsf, ptr, nsize);
}
static int ram_panic(lua_State *L) {
    fprintf(stderr, "Lua: %s\n", lua_tostring(L, -1) ? lua_tostring(L, -1) : "unprotected error");
    abort();
}

/* Where the core's own code lies, so that only pointers into it are moved when it is loaded elsewhere. */
#ifndef __APPLE__
static int code_span_cb(struct dl_phdr_info *info, size_t size, void *data) {
    (void)size; (void)data;
    if ((uintptr_t)info->dlpi_addr != g_code_base) return 0;
    uintptr_t hi = 0;
    for (int i = 0; i < info->dlpi_phnum; i++)
        if (info->dlpi_phdr[i].p_type == PT_LOAD) {
            const uintptr_t end = info->dlpi_phdr[i].p_vaddr + info->dlpi_phdr[i].p_memsz;
            if (end > hi) hi = end;
        }
    g_code_size = (size_t)hi;
    return 1;
}
#endif
static void code_span(void) {
    Dl_info dl;
    if (!dladdr((void *)ram_alloc, &dl)) return;
    g_code_base = (uintptr_t)dl.dli_fbase;
    /* the build: a hash of the core's file (FNV-1a), read once; any rebuild changes it */
    FILE *f = dl.dli_fname ? fopen(dl.dli_fname, "rb") : NULL;
    if (f) {
        uint64_t hsh = 1469598103934665603ULL; unsigned char buf[65536]; size_t n;
        while ((n = fread(buf, 1, sizeof buf, f)) > 0) for (size_t i = 0; i < n; i++) hsh = (hsh ^ buf[i]) * 1099511628211ULL;
        fclose(f); g_build = hsh;
    }
#ifdef __APPLE__
    const struct mach_header_64 *h = (const struct mach_header_64 *)dl.dli_fbase;
    const struct load_command *lc = (const struct load_command *)(h + 1);
    uint64_t lo = UINT64_MAX, hi = 0;
    for (uint32_t i = 0; i < h->ncmds; i++, lc = (const struct load_command *)((const char *)lc + lc->cmdsize))
        if (lc->cmd == LC_SEGMENT_64) {
            const struct segment_command_64 *sg = (const struct segment_command_64 *)lc;
            if (!strcmp(sg->segname, "__PAGEZERO")) continue;
            if (sg->vmaddr < lo) lo = sg->vmaddr;
            if (sg->vmaddr + sg->vmsize > hi) hi = sg->vmaddr + sg->vmsize;
        }
    if (hi > lo) g_code_size = (size_t)(hi - lo);
#else
    dl_iterate_phdr(code_span_cb, NULL);
    /* the main program reports a base of 0 on some systems: then dli_fbase is the load address and the span is measured from it */
    if (!g_code_size) g_code_size = (size_t)64 << 20;
#endif
}

static bool ram_open(void) {
#ifdef __APPLE__
    /* macOS takes an address given to mmap as no more than a suggestion and ignores it; asking the kernel for that exact range does work */
    mach_vm_address_t want = RAM_ADDR;
    void *p = mach_vm_allocate(mach_task_self(), &want, RAM_BYTES, VM_FLAGS_FIXED) == KERN_SUCCESS ? (void *)(uintptr_t)want : MAP_FAILED;
#else
    int flags = MAP_PRIVATE | MAP_ANONYMOUS;
#ifdef MAP_FIXED_NOREPLACE
    flags |= MAP_FIXED_NOREPLACE; /* the address or nothing; an older kernel takes it as a hint, which the check below sees */
#endif
    void *p = mmap((void *)RAM_ADDR, RAM_BYTES, PROT_READ | PROT_WRITE, flags, -1, 0);
    if (p != MAP_FAILED && p != (void *)RAM_ADDR) { munmap(p, RAM_BYTES); p = MAP_FAILED; }
#endif
    g_ram_fixed = p != MAP_FAILED;
    if (!g_ram_fixed) {
        p = mmap(NULL, RAM_BYTES, PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
        if (p == MAP_FAILED) return false;
        fprintf(stderr, "gs: the RAM's usual address is taken; save states work, but not across runs (Resume)\n");
    }
    g_ram = p;
    g_tlsf = tlsf_create_with_pool(g_ram, RAM_BYTES);
    if (!g_tlsf) return false;
    g_session = ((uint64_t)SDL_GetPerformanceCounter() << 16) ^ (uint64_t)getpid() ^ ((uint64_t)time(NULL) << 32);
    code_span();
    return true;
}
static void ram_close(void) { if (g_ram) munmap(g_ram, RAM_BYTES); g_ram = NULL; g_tlsf = NULL; }

/* The end of the last block in use: everything past it (and before the sentinel at the very end) is free space, not worth saving. */
static void used_walker(void *ptr, size_t size, int used, void *user) {
    size_t *end = user;
    if (used) { const size_t e = (size_t)((unsigned char *)ptr - g_ram) + size; if (e > *end) *end = e; }
}
static size_t ram_used_end(void) {
    size_t end = 0;
    tlsf_walk_pool(tlsf_get_pool(g_tlsf), used_walker, &end);
    end += RAM_EDGE;
    return end < RAM_BYTES - RAM_EDGE ? end : RAM_BYTES - RAM_EDGE;
}

/* ---------- moving pointers into the core when it was loaded elsewhere: its C functions, and Lua's constant empty hash part ---------- */

static intptr_t g_shift; static uintptr_t g_old_base;
static bool g_rehash_tables;
#define SHIFT_FN(T, p) do { if ((p) && (uintptr_t)(p) >= g_old_base && (uintptr_t)(p) < g_old_base + g_code_size) (p) = (T)((uintptr_t)(p) + g_shift); } while (0)
static void shift_value(TValue *v) { if (ttislcf(v)) SHIFT_FN(lua_CFunction, v->value_.f); }

static void shift_object(GCObject *o, Table *file_mt, FILE *const old_std[3], Table **rehash, int *nrehash) {
    switch (o->tt) {
    case LUA_VTABLE: {
        Table *t = gco2t(o);
        const unsigned asize = luaH_realasize(t);
        for (unsigned i = 0; i < asize; i++) shift_value(&t->array[i]);
        if (isdummy(t)) SHIFT_FN(Node *, t->node); /* an empty hash part is Lua's one shared constant, inside the core's data */
        else {
            bool lcf_key = false;
            for (int i = 0; i < sizenode(t); i++) {
                Node *n = gnode(t, i);
                shift_value(gval(n));
                if (keytt(n) == LUA_VLCF) { SHIFT_FN(lua_CFunction, n->u.key_val.f); lcf_key = true; }
            }
            /* a C function as a key is found by its address: such a table is put in order again once everything has moved */
            if (lcf_key && *nrehash < 256) rehash[(*nrehash)++] = t;
        }
        break;
    }
    case LUA_VCCL: {
        CClosure *c = gco2ccl(o);
        SHIFT_FN(lua_CFunction, c->f);
        for (int i = 0; i < c->nupvalues; i++) shift_value(&c->upvalue[i]);
        break;
    }
    case LUA_VUPVAL: {
        UpVal *uv = gco2upv(o);
        if (!upisopen(uv)) shift_value(&uv->u.value);
        break;
    }
    case LUA_VUSERDATA: {
        Udata *u = gco2u(o);
        for (int i = 0; i < u->nuvalue; i++) shift_value(&u->uv[i].uv);
        if (file_mt && u->metatable == file_mt && u->len == sizeof(luaL_Stream)) {
            /* io's files: the standard streams become this run's; any other file the game had open is closed */
            luaL_Stream *s = (luaL_Stream *)getudatamem(u);
            SHIFT_FN(lua_CFunction, s->closef);
            if (s->f == old_std[0]) s->f = stdin;
            else if (s->f == old_std[1]) s->f = stdout;
            else if (s->f == old_std[2]) s->f = stderr;
            else if (s->closef) { s->f = NULL; s->closef = NULL; }
        }
        break;
    }
    case LUA_VTHREAD: {
        lua_State *th = gco2th(o);
        for (StkId p = th->stack.p; p < th->top.p; p++) shift_value(s2v(p));
        for (CallInfo *ci = &th->base_ci; ci; ci = ci->next) if (!isLua(ci)) SHIFT_FN(lua_KFunction, ci->u.c.k);
        SHIFT_FN(lua_Hook, th->hook);
        break;
    }
    default: break; /* strings, prototypes and Lua closures hold no pointers to C code */
    }
}
static void shift_all(lua_State *L, FILE *const old_std[3]) {
    global_State *g = G(L);
    SHIFT_FN(lua_Alloc, g->frealloc); SHIFT_FN(lua_CFunction, g->panic); SHIFT_FN(lua_WarnFunction, g->warnf);
    Table *file_mt = NULL;
    const TValue *reg = &g->l_registry;
    if (ttistable(reg)) {
        TString *key = luaS_new(L, LUA_FILEHANDLE);
        const TValue *mt = luaH_getshortstr(hvalue(reg), key);
        if (ttistable(mt)) file_mt = hvalue(mt);
    }
    Table *rehash[256]; int nrehash = 0;
    GCObject *lists[4] = { g->allgc, g->finobj, g->tobefnz, g->fixedgc };
    for (int l = 0; l < 4; l++) for (GCObject *o = lists[l]; o; o = o->next) shift_object(o, file_mt, old_std, rehash, &nrehash);
    for (int i = 0; i < nrehash; i++) luaH_resize(L, rehash[i], luaH_realasize(rehash[i]), allocsizenode(rehash[i]));
}

/* ---------- the state ---------- */

typedef struct {
    uint32_t magic, version;
    uint64_t session, build, ram_base, ram_bytes, code_base, main_L;
    uint64_t std[3];
    uint64_t used_end, runtime_len, synth_len, assets_len;
} StateHeader;

/* The runtime's own few settings that live outside Lua. */
typedef struct {
    int screen_w, screen_h, mosaic, nimages, nsounds;
    bool now[B_COUNT], prev[B_COUNT];
    struct { bool active, loop; int snd; Uint32 pos; float gain; } voices[MAX_VOICES];
} RuntimeState;

/* How every picture, sound and sample was made, written as: count, then per item a length and the bytes. */
static unsigned char *st_buf; static size_t st_cap, st_len;
static void buf_put(const void *p, size_t n) { if (st_buf && st_len + n <= st_cap) memcpy(st_buf + st_len, p, n); st_len += n; }
static void buf_str(const char *s) { const uint32_t n = s ? (uint32_t)strlen(s) + 1 : 0; buf_put(&n, sizeof n); if (n) buf_put(s, n); }
static void assets_write(void) {
    const int32_t ni = g_nimages; buf_put(&ni, sizeof ni);
    for (int i = 0; i < g_nimages; i++) {
        const uint32_t seq = g_images[i].seq, len = (uint32_t)g_images[i].recipe_len;
        buf_put(&seq, sizeof seq); buf_put(&len, sizeof len); if (len) buf_put(g_images[i].recipe, len);
    }
    const int32_t ns = g_nsounds; buf_put(&ns, sizeof ns);
    for (int i = 0; i < g_nsounds; i++) buf_str(g_sounds[i].name);
    const int32_t nm = g_nsample_names; buf_put(&nm, sizeof nm);
    for (int i = 0; i < g_nsample_names; i++) buf_str(g_sample_names[i]);
}
static size_t assets_size(void) { st_buf = NULL; st_len = 0; assets_write(); return st_len; }

static size_t state_needed(void) {
    return sizeof(StateHeader) + sizeof(RuntimeState) + synth_state_size(1) + assets_size() + ram_used_end() + RAM_EDGE;
}
static size_t state_size(void) {
    if (!g_state_bytes) g_state_bytes = sizeof(StateHeader) + sizeof(RuntimeState) + synth_state_size(1) + assets_size() + RAM_BYTES + STATE_HEADROOM;
    return g_state_bytes;
}

static bool state_save(unsigned char *out, size_t size) {
    if (!g_core_L || !g_ram) return false;
    if (state_needed() > size) { fprintf(stderr, "gs: this game no longer fits in a save state of %zu bytes\n", size); return false; }
    memset(out, 0, size); /* the unused rest compresses to nothing (state files, rewind) */
    StateHeader h = { STATE_MAGIC, STATE_VERSION, g_session, g_build, (uintptr_t)g_ram, RAM_BYTES, g_code_base, (uintptr_t)g_core_L,
                      { (uintptr_t)stdin, (uintptr_t)stdout, (uintptr_t)stderr }, ram_used_end(), sizeof(RuntimeState), 0, 0 };
    unsigned char *p = out + sizeof h;
    RuntimeState rs; memset(&rs, 0, sizeof rs);
    rs.screen_w = g_screen_w; rs.screen_h = g_screen_h; rs.mosaic = g_mosaic; rs.nimages = g_nimages; rs.nsounds = g_nsounds;
    memcpy(rs.now, btn_now, sizeof rs.now); memcpy(rs.prev, btn_prev, sizeof rs.prev);
    for (int i = 0; i < MAX_VOICES; i++) {
        rs.voices[i].active = g_voices[i].active; rs.voices[i].loop = g_voices[i].loop; rs.voices[i].snd = g_voices[i].snd;
        rs.voices[i].pos = g_voices[i].pos; rs.voices[i].gain = g_voices[i].gain;
    }
    memcpy(p, &rs, sizeof rs); p += sizeof rs;
    h.synth_len = synth_state_save(p, 1); p += h.synth_len;
    st_buf = p; st_cap = size - (size_t)(p - out); st_len = 0; assets_write(); h.assets_len = st_len; p += st_len; st_buf = NULL;
    memcpy(p, g_ram, h.used_end); p += h.used_end;
    memcpy(p, g_ram + RAM_BYTES - RAM_EDGE, RAM_EDGE);
    memcpy(out, &h, sizeof h);
    return true;
}

/* A state from another run: make every picture, sound and sample again in the slot it had, in the order they were first made. */
static const unsigned char *rd_p, *rd_end;
static bool rd(void *dst, size_t n) { if (rd_p + n > rd_end) return false; memcpy(dst, rd_p, n); rd_p += n; return true; }
static bool rd_str(char *dst, size_t cap) {
    uint32_t n; if (!rd(&n, sizeof n)) return false;
    if (n == 0) { dst[0] = 0; return true; }
    if (n > cap || rd_p + n > rd_end) return false;
    memcpy(dst, rd_p, n); dst[n - 1] = 0; rd_p += n; return true;
}
static bool assets_remake(const unsigned char *a, size_t len) {
    rd_p = a; rd_end = a + len;
    int32_t ni; if (!rd(&ni, sizeof ni) || ni < 0 || ni > MAX_IMAGES) return false;
    struct { uint32_t seq, len; const unsigned char *r; } it[MAX_IMAGES];
    for (int i = 0; i < ni; i++) {
        if (!rd(&it[i].seq, 4) || !rd(&it[i].len, 4) || rd_p + it[i].len > rd_end) return false;
        it[i].r = rd_p; rd_p += it[i].len;
    }
    /* this run's pictures go; the slots are made again from the recipes, oldest first so a source is there before what is made from it */
    for (int i = 0; i < g_nimages; i++) {
        if (g_images[i].tex) SDL_DestroyTexture(g_images[i].tex);
        free(g_images[i].px); g_images[i].tex = NULL; g_images[i].px = NULL;
    }
    g_nimages = ni;
    bool done[MAX_IMAGES] = { false };
    for (int k = 0; k < ni; k++) {
        int best = -1;
        for (int i = 0; i < ni; i++) if (!done[i] && (best < 0 || it[i].seq < it[best].seq)) best = i;
        done[best] = true;
        const unsigned char *r = it[best].r; const size_t n = it[best].len;
        const char *err = "empty slot";
        if (n >= 2 && r[0] == 'F') err = image_load_file(best, (const char *)r + 1);
        else if (n >= 1 + 2 * sizeof(int) && r[0] == 'P') { int wh[2]; memcpy(wh, r + 1, sizeof wh); err = pixels_into(best, wh[0], wh[1], r + 1 + sizeof wh); }
        else if (n == 1 + sizeof(RecolorArgs) && r[0] == 'R') { RecolorArgs ra; memcpy(&ra, r + 1, sizeof ra); err = recolor_into(best, &ra); }
        else if (n >= 1 + sizeof(ComposeArgs) && r[0] == 'C') {
            ComposeArgs ca; memcpy(&ca, r + 1, sizeof ca);
            int *cells = malloc(n - 1 - sizeof ca);
            if (cells) { memcpy(cells, r + 1 + sizeof ca, n - 1 - sizeof ca); err = compose_into(best, &ca, cells); free(cells); }
        }
        if (err) { fprintf(stderr, "gs: resume: picture %d: %s\n", best, err); return false; }
        g_images[best].seq = it[best].seq;
    }
    g_image_seq = 0; for (int i = 0; i < ni; i++) if (g_images[i].seq > g_image_seq) g_image_seq = g_images[i].seq;

    int32_t ns; if (!rd(&ns, sizeof ns) || ns < 0 || ns > MAX_SOUNDS) return false;
    for (int i = 0; i < g_nsounds; i++) { free(g_sounds[i].name); SDL_free(g_sounds[i].pcm); g_sounds[i].name = NULL; g_sounds[i].pcm = NULL; }
    g_nsounds = 0;
    for (int i = 0; i < ns; i++) {
        char name[512]; if (!rd_str(name, sizeof name)) return false;
        const char *err = sound_load_file(name);
        if (err) { fprintf(stderr, "gs: resume: %s\n", err); return false; }
    }
    int32_t nm; if (!rd(&nm, sizeof nm) || nm < 0 || nm > 256) return false;
    synth_drop_samples();
    for (int i = 0; i < nm; i++) {
        char name[512]; if (!rd_str(name, sizeof name)) return false;
        size_t n = 0; unsigned char *buf = name[0] ? vfs_read(name, &n) : NULL;
        const int h = buf ? sample_from_wav(buf, n) : -1; free(buf);
        if (h != i) { fprintf(stderr, "gs: resume: sample %s\n", name); return false; }
    }
    return true;
}

static bool state_load(const unsigned char *in, size_t size) {
    StateHeader h;
    if (!g_core_L || !g_ram || size < sizeof h) return false;
    memcpy(&h, in, sizeof h);
    if (h.magic != STATE_MAGIC || h.version != STATE_VERSION || h.ram_bytes != RAM_BYTES || h.runtime_len != sizeof(RuntimeState)) return false;
    if (h.used_end > RAM_BYTES - RAM_EDGE || sizeof h + h.runtime_len + h.synth_len + h.assets_len + h.used_end + RAM_EDGE > size) return false;
    const bool same_run = h.session == g_session;
    /* everything inside the RAM points into it: a state from another run can only be used where the RAM sits at the same address */
    if (h.ram_base != (uintptr_t)g_ram) return false;
    if (h.build != g_build || !g_build) { fprintf(stderr, "gs: this state was saved by another version of the core\n"); return false; }
    const unsigned char *p = in + sizeof h;
    RuntimeState rs; memcpy(&rs, p, sizeof rs); p += sizeof rs;
    const unsigned char *synth = p; p += h.synth_len;
    const unsigned char *assets = p; p += h.assets_len;
    if (!same_run && !assets_remake(assets, h.assets_len)) return false;
    synth_lock();
    const bool synth_ok = synth_state_load(synth, h.synth_len, !same_run);
    synth_unlock();
    if (!synth_ok) return false;

    memcpy(g_ram, p, h.used_end); p += h.used_end;
    memcpy(g_ram + RAM_BYTES - RAM_EDGE, p, RAM_EDGE);
    g_core_L = (lua_State *)(uintptr_t)h.main_L;
    if (!same_run) {
        g_old_base = (uintptr_t)h.code_base; g_shift = (intptr_t)(g_code_base - g_old_base);
        FILE *const old_std[3] = { (FILE *)(uintptr_t)h.std[0], (FILE *)(uintptr_t)h.std[1], (FILE *)(uintptr_t)h.std[2] };
            shift_all(g_core_L, old_std);
    }
    g_screen_w = rs.screen_w; g_screen_h = rs.screen_h; screen_logical(g_screen_w, g_screen_h); g_mosaic = rs.mosaic;
    memcpy(btn_now, rs.now, sizeof rs.now); memcpy(btn_prev, rs.prev, sizeof rs.prev);
    for (int i = 0; i < MAX_VOICES; i++) {
        const bool ok = rs.voices[i].snd >= 0 && rs.voices[i].snd < g_nsounds;
        g_voices[i].active = rs.voices[i].active && ok; g_voices[i].loop = rs.voices[i].loop; g_voices[i].snd = ok ? rs.voices[i].snd : 0;
        g_voices[i].pos = rs.voices[i].pos; g_voices[i].gain = rs.voices[i].gain;
    }
    return true;
}
