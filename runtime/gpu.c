/* The libretro core's GPU drawing (included by runtime/libretro.c before main.c).
 *
 * The emulator owns the window and gives a core no GPU, so the core makes a GPU context of its own (EGL, an off-screen surface), draws the
 * frame there with OpenGL ES 2 and reads it back for the emulator. Measured on the Brick (tests/heavy) this is 5 to 8 times faster than
 * SDL's software renderer for big blended and turning sprites, read back included.
 *
 * main.c draws through about twenty SDL renderer calls. Each has a stand-in here with the same arguments, and the names are swapped in at
 * the end of this file, so main.c is unchanged. The stand-ins keep SDL's meaning: a texture's blend mode, colour and alpha apply when it is
 * copied; the draw colour and draw blend mode apply to rectangles and lines; a clear fills the whole target; the blend modes are SDL's own
 * formulas. Copies that share a texture and blend mode are drawn together in one call. Without a GPU (a Mac, the tests, a device where EGL
 * fails, GS_CORE_GPU=0) every stand-in passes straight to SDL and the software renderer draws as before.
 *
 * Frames are drawn with the screen's top row at the GPU's row 0 (upside down for OpenGL), so that reading back gives the rows in screen
 * order and a target used as a texture is the right way up like any picture. */
#include <SDL.h>
#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef __linux__
#include <dlfcn.h>
#endif

static bool g_gpu; /* drawing on the GPU; false: everything goes to SDL */

/* ---------- the few EGL and GL ES 2 names used, loaded at run time (the core links neither library) ---------- */
typedef unsigned int GLenum, GLuint, GLbitfield; typedef int GLint, GLsizei; typedef float GLfloat; typedef unsigned char GLboolean, GLubyte; typedef char GLchar;
enum {
    GL_TEXTURE_2D = 0x0DE1, GL_RGBA = 0x1908, GL_UNSIGNED_BYTE = 0x1401, GL_FLOAT = 0x1406, GL_TRIANGLES = 0x0004, GL_LINES = 0x0001,
    GL_TEXTURE_MIN_FILTER = 0x2801, GL_TEXTURE_MAG_FILTER = 0x2800, GL_NEAREST = 0x2600, GL_TEXTURE_WRAP_S = 0x2802, GL_TEXTURE_WRAP_T = 0x2803,
    GL_CLAMP_TO_EDGE = 0x812F, GL_FRAMEBUFFER = 0x8D40, GL_COLOR_ATTACHMENT0 = 0x8CE0, GL_FRAMEBUFFER_COMPLETE = 0x8CD5, GL_BLEND = 0x0BE2,
    GL_ZERO = 0, GL_ONE = 1, GL_SRC_COLOR = 0x0300, GL_SRC_ALPHA = 0x0302, GL_ONE_MINUS_SRC_ALPHA = 0x0303, GL_DST_COLOR = 0x0306,
    GL_COLOR_BUFFER_BIT = 0x4000, GL_VERTEX_SHADER = 0x8B31, GL_FRAGMENT_SHADER = 0x8B30, GL_COMPILE_STATUS = 0x8B81, GL_LINK_STATUS = 0x8B82,
    GL_UNPACK_ALIGNMENT = 0x0CF5, GL_PACK_ALIGNMENT = 0x0D05, GL_TEXTURE0 = 0x84C0, GL_SCISSOR_TEST = 0x0C11, GL_DITHER = 0x0BD0,
};
typedef void *EGLDisplay, *EGLConfig, *EGLSurface, *EGLContext; typedef int32_t EGLint; typedef unsigned EGLBoolean;
enum { EGL_SURFACE_TYPE = 0x3033, EGL_PBUFFER_BIT = 1, EGL_RENDERABLE_TYPE = 0x3040, EGL_OPENGL_ES2_BIT = 4, EGL_RED_SIZE = 0x3024,
       EGL_GREEN_SIZE = 0x3023, EGL_BLUE_SIZE = 0x3022, EGL_ALPHA_SIZE = 0x3021, EGL_NONE = 0x3038, EGL_WIDTH = 0x3057, EGL_HEIGHT = 0x3056,
       EGL_CONTEXT_CLIENT_VERSION = 0x3098, EGL_DRAW = 0x3059, EGL_READ = 0x305A };
#define GL_FUNCS(X) \
    X(void, glGenTextures, (GLsizei, GLuint *)) X(void, glDeleteTextures, (GLsizei, const GLuint *)) X(void, glBindTexture, (GLenum, GLuint)) \
    X(void, glTexImage2D, (GLenum, GLint, GLint, GLsizei, GLsizei, GLint, GLenum, GLenum, const void *)) \
    X(void, glTexSubImage2D, (GLenum, GLint, GLint, GLint, GLsizei, GLsizei, GLenum, GLenum, const void *)) \
    X(void, glTexParameteri, (GLenum, GLenum, GLint)) X(void, glPixelStorei, (GLenum, GLint)) X(void, glActiveTexture, (GLenum)) \
    X(void, glGenFramebuffers, (GLsizei, GLuint *)) X(void, glDeleteFramebuffers, (GLsizei, const GLuint *)) X(void, glBindFramebuffer, (GLenum, GLuint)) \
    X(void, glFramebufferTexture2D, (GLenum, GLenum, GLenum, GLuint, GLint)) X(GLenum, glCheckFramebufferStatus, (GLenum)) \
    X(void, glViewport, (GLint, GLint, GLsizei, GLsizei)) X(void, glClearColor, (GLfloat, GLfloat, GLfloat, GLfloat)) X(void, glClear, (GLbitfield)) \
    X(void, glEnable, (GLenum)) X(void, glDisable, (GLenum)) X(void, glBlendFuncSeparate, (GLenum, GLenum, GLenum, GLenum)) \
    X(GLuint, glCreateShader, (GLenum)) X(void, glShaderSource, (GLuint, GLsizei, const GLchar *const *, const GLint *)) X(void, glCompileShader, (GLuint)) \
    X(void, glGetShaderiv, (GLuint, GLenum, GLint *)) X(void, glGetShaderInfoLog, (GLuint, GLsizei, GLsizei *, GLchar *)) X(GLuint, glCreateProgram, (void)) \
    X(void, glAttachShader, (GLuint, GLuint)) X(void, glBindAttribLocation, (GLuint, GLuint, const GLchar *)) X(void, glLinkProgram, (GLuint)) \
    X(void, glGetProgramiv, (GLuint, GLenum, GLint *)) X(void, glUseProgram, (GLuint)) X(GLint, glGetUniformLocation, (GLuint, const GLchar *)) \
    X(void, glUniform2f, (GLint, GLfloat, GLfloat)) X(void, glUniform1i, (GLint, GLint)) \
    X(void, glVertexAttribPointer, (GLuint, GLint, GLenum, GLboolean, GLsizei, const void *)) X(void, glEnableVertexAttribArray, (GLuint)) \
    X(void, glDrawArrays, (GLenum, GLint, GLsizei)) X(void, glReadPixels, (GLint, GLint, GLsizei, GLsizei, GLenum, GLenum, void *))
#define EGL_FUNCS(X) \
    X(EGLDisplay, eglGetDisplay, (void *)) X(EGLBoolean, eglInitialize, (EGLDisplay, EGLint *, EGLint *)) \
    X(EGLBoolean, eglChooseConfig, (EGLDisplay, const EGLint *, EGLConfig *, EGLint, EGLint *)) \
    X(EGLSurface, eglCreatePbufferSurface, (EGLDisplay, EGLConfig, const EGLint *)) X(EGLContext, eglCreateContext, (EGLDisplay, EGLConfig, EGLContext, const EGLint *)) \
    X(EGLBoolean, eglMakeCurrent, (EGLDisplay, EGLSurface, EGLSurface, EGLContext)) X(EGLContext, eglGetCurrentContext, (void)) \
    X(EGLSurface, eglGetCurrentSurface, (EGLint)) X(EGLDisplay, eglGetCurrentDisplay, (void)) X(EGLBoolean, eglDestroyContext, (EGLDisplay, EGLContext)) \
    X(EGLBoolean, eglDestroySurface, (EGLDisplay, EGLSurface)) X(EGLBoolean, eglBindAPI, (unsigned))
#define DECLARE(ret, name, args) static ret (*p_##name) args;
GL_FUNCS(DECLARE) EGL_FUNCS(DECLARE)
#undef DECLARE

static EGLDisplay g_egl_dpy; static EGLSurface g_egl_surf; static EGLContext g_egl_ctx;
static EGLDisplay g_prev_dpy; static EGLSurface g_prev_draw, g_prev_read; static EGLContext g_prev_ctx; static int g_gpu_depth;
static GLuint g_prog, g_white; static GLint g_u_size, g_u_tex;

/* A texture: pixels on the GPU, and SDL's per-texture settings, used when it is copied. A target has a framebuffer to draw into. */
typedef struct { GLuint id, fbo; int w, h, access; Uint32 format; SDL_BlendMode blend; Uint8 r, g, b, a; } GpuTex;

/* The renderer's state: what is drawn into, the draw colour and blend mode, and the batch of vertices waiting to be drawn. */
static struct {
    GpuTex *target; int tw, th; GLuint screen_fbo;
    Uint8 r, g, b, a; SDL_BlendMode draw_blend;
    GLuint bound_tex; SDL_BlendMode batch_blend; GLenum batch_prim; int n;
    float v[6 * 1024 * 8]; /* x, y, u, v, r, g, b, a: room for 1024 quads */
} G;

/* The GPU's context is made current for the core's work and the emulator's is put back afterwards (both draw on one thread). */
static void gpu_begin(void) {
    if (!g_gpu || g_gpu_depth++) return;
    g_prev_dpy = p_eglGetCurrentDisplay(); g_prev_ctx = p_eglGetCurrentContext();
    g_prev_draw = p_eglGetCurrentSurface(EGL_DRAW); g_prev_read = p_eglGetCurrentSurface(EGL_READ);
    p_eglMakeCurrent(g_egl_dpy, g_egl_surf, g_egl_surf, g_egl_ctx);
}
static void gpu_flush(void);
static void gpu_end(void) {
    if (!g_gpu || --g_gpu_depth) return;
    gpu_flush();
    if (g_prev_ctx) p_eglMakeCurrent(g_prev_dpy, g_prev_draw, g_prev_read, g_prev_ctx);
    else p_eglMakeCurrent(g_egl_dpy, NULL, NULL, NULL);
}

static GLuint gpu_shader(GLenum kind, const char *src) {
    GLuint s = p_glCreateShader(kind); p_glShaderSource(s, 1, &src, NULL); p_glCompileShader(s);
    GLint ok = 0; p_glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
    if (!ok) { char log[512]; p_glGetShaderInfoLog(s, sizeof log, NULL, log); fprintf(stderr, "gs gpu: shader: %s\n", log); return 0; }
    return s;
}

/* Opens the GPU, or leaves g_gpu false and says why: the core then draws with SDL's software renderer. */
static bool gpu_open(void) {
#ifdef __linux__
    if (getenv("GS_CORE_GPU") && !strcmp(getenv("GS_CORE_GPU"), "0")) return false;
    void *egl = dlopen("libEGL.so.1", RTLD_NOW | RTLD_LOCAL), *gl = dlopen("libGLESv2.so.2", RTLD_NOW | RTLD_LOCAL);
    if (!egl || !gl) return false;
#define LOAD_GL(ret, name, args) p_##name = (ret (*) args)dlsym(gl, #name); if (!p_##name) { fprintf(stderr, "gs gpu: no %s\n", #name); return false; }
#define LOAD_EGL(ret, name, args) p_##name = (ret (*) args)dlsym(egl, #name); if (!p_##name) { fprintf(stderr, "gs gpu: no %s\n", #name); return false; }
    GL_FUNCS(LOAD_GL) EGL_FUNCS(LOAD_EGL)
#undef LOAD_GL
#undef LOAD_EGL
    g_egl_dpy = p_eglGetDisplay(NULL);
    EGLint ma, mi;
    if (!g_egl_dpy || !p_eglInitialize(g_egl_dpy, &ma, &mi)) return false;
    const EGLint attr[] = { EGL_SURFACE_TYPE, EGL_PBUFFER_BIT, EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT, EGL_RED_SIZE, 8, EGL_GREEN_SIZE, 8,
                            EGL_BLUE_SIZE, 8, EGL_ALPHA_SIZE, 8, EGL_NONE };
    EGLConfig cfg; EGLint n = 0;
    if (!p_eglChooseConfig(g_egl_dpy, attr, &cfg, 1, &n) || n < 1) return false;
    const EGLint pb[] = { EGL_WIDTH, 1, EGL_HEIGHT, 1, EGL_NONE }, ca[] = { EGL_CONTEXT_CLIENT_VERSION, 2, EGL_NONE };
    g_egl_surf = p_eglCreatePbufferSurface(g_egl_dpy, cfg, pb);
    g_egl_ctx = g_egl_surf ? p_eglCreateContext(g_egl_dpy, cfg, NULL, ca) : NULL;
    if (!g_egl_ctx) return false;
    g_gpu = true;
    gpu_begin();
    const char *vs = "attribute vec2 a_pos; attribute vec2 a_uv; attribute vec4 a_col; uniform vec2 u_size; varying vec2 v_uv; varying vec4 v_col;\n"
                     "void main() { v_uv = a_uv; v_col = a_col; gl_Position = vec4(a_pos / u_size * 2.0 - 1.0, 0.0, 1.0); }\n";
    /* high precision where the GPU has it: in 16-bit floats a texture coordinate that falls on the edge between two pixels (the mosaic
     * samples each block exactly there) lands on the wrong side in a repeating pattern */
    const char *fs = "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n"
                     "uniform sampler2D u_tex; varying vec2 v_uv; varying vec4 v_col;\n"
                     "void main() { gl_FragColor = texture2D(u_tex, v_uv) * v_col; }\n";
    GLuint v = gpu_shader(GL_VERTEX_SHADER, vs), f = gpu_shader(GL_FRAGMENT_SHADER, fs);
    if (v && f) {
        g_prog = p_glCreateProgram(); p_glAttachShader(g_prog, v); p_glAttachShader(g_prog, f);
        p_glBindAttribLocation(g_prog, 0, "a_pos"); p_glBindAttribLocation(g_prog, 1, "a_uv"); p_glBindAttribLocation(g_prog, 2, "a_col");
        p_glLinkProgram(g_prog);
        GLint ok = 0; p_glGetProgramiv(g_prog, GL_LINK_STATUS, &ok);
        if (!ok) g_prog = 0;
    }
    if (!g_prog) { gpu_end(); g_gpu = false; return false; }
    p_glUseProgram(g_prog);
    g_u_size = p_glGetUniformLocation(g_prog, "u_size"); g_u_tex = p_glGetUniformLocation(g_prog, "u_tex");
    p_glUniform1i(g_u_tex, 0); p_glActiveTexture(GL_TEXTURE0);
    p_glEnableVertexAttribArray(0); p_glEnableVertexAttribArray(1); p_glEnableVertexAttribArray(2);
    p_glDisable(GL_SCISSOR_TEST); p_glDisable(GL_DITHER);
    p_glPixelStorei(GL_UNPACK_ALIGNMENT, 1); p_glPixelStorei(GL_PACK_ALIGNMENT, 1);
    const Uint8 white[4] = { 255, 255, 255, 255 }; /* rectangles and lines are drawn with this picture of one white pixel */
    p_glGenTextures(1, &g_white); p_glBindTexture(GL_TEXTURE_2D, g_white);
    p_glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, 1, 1, 0, GL_RGBA, GL_UNSIGNED_BYTE, white);
    p_glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST); p_glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    G.r = G.g = G.b = G.a = 255; G.draw_blend = SDL_BLENDMODE_NONE; G.batch_blend = (SDL_BlendMode)-1;
    gpu_end();
    fprintf(stderr, "gs: drawing on the GPU (EGL %d.%d)\n", ma, mi);
    return true;
#else
    return false;
#endif
}
static void gpu_close(void) {
    if (!g_gpu) return;
    if (g_egl_ctx) p_eglDestroyContext(g_egl_dpy, g_egl_ctx);
    if (g_egl_surf) p_eglDestroySurface(g_egl_dpy, g_egl_surf);
    g_egl_ctx = NULL; g_egl_surf = NULL; g_gpu = false;
}

/* SDL's blend modes as GL blend functions (SDL2's own definitions of each). */
static void gpu_set_blend(SDL_BlendMode m) {
    switch (m) {
    case SDL_BLENDMODE_NONE: p_glDisable(GL_BLEND); return;
    case SDL_BLENDMODE_ADD: p_glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE, GL_ZERO, GL_ONE); break;
    case SDL_BLENDMODE_MOD: p_glBlendFuncSeparate(GL_ZERO, GL_SRC_COLOR, GL_ZERO, GL_ONE); break;
    case SDL_BLENDMODE_MUL: p_glBlendFuncSeparate(GL_DST_COLOR, GL_ONE_MINUS_SRC_ALPHA, GL_ZERO, GL_ONE); break;
    default: p_glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA); break;
    }
    p_glEnable(GL_BLEND);
}
static void gpu_flush(void) {
    if (!G.n) return;
    p_glVertexAttribPointer(0, 2, GL_FLOAT, 0, 8 * sizeof(float), G.v);
    p_glVertexAttribPointer(1, 2, GL_FLOAT, 0, 8 * sizeof(float), G.v + 2);
    p_glVertexAttribPointer(2, 4, GL_FLOAT, 0, 8 * sizeof(float), G.v + 4);
    p_glDrawArrays(G.batch_prim, 0, G.n);
    G.n = 0;
}
/* Makes room for n more vertices drawn with this texture, blend mode and kind of primitive, drawing what was waiting if any of them change. */
static float *gpu_vertices(GLuint tex, SDL_BlendMode blend, GLenum prim, int n) {
    if (tex != G.bound_tex || blend != G.batch_blend || prim != G.batch_prim || G.n + n > 6 * 1024) {
        gpu_flush();
        if (tex != G.bound_tex) { p_glBindTexture(GL_TEXTURE_2D, tex); G.bound_tex = tex; }
        if (blend != G.batch_blend) { gpu_set_blend(blend); G.batch_blend = blend; }
        G.batch_prim = prim;
    }
    float *v = G.v + G.n * 8; G.n += n; return v;
}
static void put_vertex(float *v, float x, float y, float u, float t, float r, float g, float b, float a) {
    v[0] = x; v[1] = y; v[2] = u; v[3] = t; v[4] = r; v[5] = g; v[6] = b; v[7] = a;
}

/* ---------- the stand-ins, one per SDL call main.c makes ---------- */

static void gpu_bind_target(GpuTex *t) {
    gpu_flush();
    G.target = t;
    if (t) { p_glBindFramebuffer(GL_FRAMEBUFFER, t->fbo); G.tw = t->w; G.th = t->h; }
    else { p_glBindFramebuffer(GL_FRAMEBUFFER, 0); G.tw = G.th = 1; } /* no target: the 1x1 off-screen surface, never shown */
    p_glViewport(0, 0, G.tw, G.th);
    p_glUniform2f(g_u_size, (float)G.tw, (float)G.th);
}

static SDL_Texture *gpu_CreateTexture(SDL_Renderer *r, Uint32 format, int access, int w, int h) {
    if (!g_gpu) return SDL_CreateTexture(r, format, access, w, h);
    GpuTex *t = calloc(1, sizeof *t);
    if (!t) return NULL;
    t->w = w; t->h = h; t->access = access; t->format = format; t->blend = SDL_BLENDMODE_NONE; t->r = t->g = t->b = t->a = 255;
    gpu_flush();
    p_glGenTextures(1, &t->id); p_glBindTexture(GL_TEXTURE_2D, t->id); G.bound_tex = t->id;
    p_glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    p_glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST); p_glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    p_glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE); p_glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    if (access == SDL_TEXTUREACCESS_TARGET) {
        GpuTex *keep = G.target;
        p_glGenFramebuffers(1, &t->fbo); p_glBindFramebuffer(GL_FRAMEBUFFER, t->fbo);
        p_glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, t->id, 0);
        const bool ok = p_glCheckFramebufferStatus(GL_FRAMEBUFFER) == GL_FRAMEBUFFER_COMPLETE;
        p_glBindFramebuffer(GL_FRAMEBUFFER, keep ? keep->fbo : 0);
        if (!ok) { p_glDeleteFramebuffers(1, &t->fbo); p_glDeleteTextures(1, &t->id); free(t); return NULL; }
    }
    return (SDL_Texture *)t;
}
static int gpu_UpdateTexture(SDL_Texture *tex, const SDL_Rect *rect, const void *pixels, int pitch) {
    if (!g_gpu) return SDL_UpdateTexture(tex, rect, pixels, pitch);
    GpuTex *t = (GpuTex *)tex;
    const int x = rect ? rect->x : 0, y = rect ? rect->y : 0, w = rect ? rect->w : t->w, h = rect ? rect->h : t->h;
    gpu_flush();
    p_glBindTexture(GL_TEXTURE_2D, t->id); G.bound_tex = t->id;
    /* both formats main.c uploads (RGBA32 and ABGR8888) are R, G, B, A bytes in memory on these little-endian machines */
    if (pitch == w * 4) p_glTexSubImage2D(GL_TEXTURE_2D, 0, x, y, w, h, GL_RGBA, GL_UNSIGNED_BYTE, pixels);
    else for (int row = 0; row < h; row++) p_glTexSubImage2D(GL_TEXTURE_2D, 0, x, y + row, w, 1, GL_RGBA, GL_UNSIGNED_BYTE, (const Uint8 *)pixels + (size_t)row * pitch);
    return 0;
}
static void gpu_DestroyTexture(SDL_Texture *tex) {
    if (!g_gpu) { SDL_DestroyTexture(tex); return; }
    GpuTex *t = (GpuTex *)tex;
    if (!t) return;
    gpu_flush();
    if (G.target == t) gpu_bind_target(NULL);
    if (G.bound_tex == t->id) G.bound_tex = 0;
    if (t->fbo) p_glDeleteFramebuffers(1, &t->fbo);
    p_glDeleteTextures(1, &t->id);
    free(t);
}
static int gpu_QueryTexture(SDL_Texture *tex, Uint32 *format, int *access, int *w, int *h) {
    if (!g_gpu) return SDL_QueryTexture(tex, format, access, w, h);
    GpuTex *t = (GpuTex *)tex;
    if (format) *format = t->format;
    if (access) *access = t->access;
    if (w) *w = t->w;
    if (h) *h = t->h;
    return 0;
}
static int gpu_SetTextureBlendMode(SDL_Texture *tex, SDL_BlendMode m) { if (!g_gpu) return SDL_SetTextureBlendMode(tex, m); ((GpuTex *)tex)->blend = m; return 0; }
static int gpu_GetTextureBlendMode(SDL_Texture *tex, SDL_BlendMode *m) { if (!g_gpu) return SDL_GetTextureBlendMode(tex, m); *m = ((GpuTex *)tex)->blend; return 0; }
static int gpu_SetTextureScaleMode(SDL_Texture *tex, SDL_ScaleMode m) { if (!g_gpu) return SDL_SetTextureScaleMode(tex, m); return 0; } /* always nearest */
static int gpu_SetTextureColorMod(SDL_Texture *tex, Uint8 r, Uint8 g, Uint8 b) {
    if (!g_gpu) return SDL_SetTextureColorMod(tex, r, g, b);
    GpuTex *t = (GpuTex *)tex; t->r = r; t->g = g; t->b = b; return 0;
}
static int gpu_SetTextureAlphaMod(SDL_Texture *tex, Uint8 a) { if (!g_gpu) return SDL_SetTextureAlphaMod(tex, a); ((GpuTex *)tex)->a = a; return 0; }

static int gpu_SetRenderTarget(SDL_Renderer *r, SDL_Texture *tex) { if (!g_gpu) return SDL_SetRenderTarget(r, tex); gpu_bind_target((GpuTex *)tex); return 0; }
static SDL_Texture *gpu_GetRenderTarget(SDL_Renderer *r) { if (!g_gpu) return SDL_GetRenderTarget(r); return (SDL_Texture *)G.target; }
static int gpu_SetRenderDrawColor(SDL_Renderer *r, Uint8 cr, Uint8 cg, Uint8 cb, Uint8 ca) {
    if (!g_gpu) return SDL_SetRenderDrawColor(r, cr, cg, cb, ca);
    G.r = cr; G.g = cg; G.b = cb; G.a = ca; return 0;
}
static int gpu_SetRenderDrawBlendMode(SDL_Renderer *r, SDL_BlendMode m) { if (!g_gpu) return SDL_SetRenderDrawBlendMode(r, m); G.draw_blend = m; return 0; }
static int gpu_RenderClear(SDL_Renderer *r) {
    if (!g_gpu) return SDL_RenderClear(r);
    gpu_flush();
    p_glClearColor(G.r / 255.0f, G.g / 255.0f, G.b / 255.0f, G.a / 255.0f); p_glClear(GL_COLOR_BUFFER_BIT);
    return 0;
}
/* A quad of the given corners (top-left, top-right, bottom-right, bottom-left), its texture coordinates and colour. */
static void gpu_quad(GLuint tex, SDL_BlendMode blend, const float x[4], const float y[4], float u0, float t0, float u1, float t1, float r, float g, float b, float a) {
    float *v = gpu_vertices(tex, blend, GL_TRIANGLES, 6);
    put_vertex(v + 0, x[0], y[0], u0, t0, r, g, b, a); put_vertex(v + 8, x[1], y[1], u1, t0, r, g, b, a); put_vertex(v + 16, x[2], y[2], u1, t1, r, g, b, a);
    put_vertex(v + 24, x[0], y[0], u0, t0, r, g, b, a); put_vertex(v + 32, x[2], y[2], u1, t1, r, g, b, a); put_vertex(v + 40, x[3], y[3], u0, t1, r, g, b, a);
}
static int gpu_RenderFillRectF(SDL_Renderer *r, const SDL_FRect *rc) {
    if (!g_gpu) return SDL_RenderFillRectF(r, rc);
    const float x[4] = { rc->x, rc->x + rc->w, rc->x + rc->w, rc->x }, y[4] = { rc->y, rc->y, rc->y + rc->h, rc->y + rc->h };
    gpu_quad(g_white, G.draw_blend, x, y, 0, 0, 1, 1, G.r / 255.0f, G.g / 255.0f, G.b / 255.0f, G.a / 255.0f);
    return 0;
}
static int gpu_RenderDrawLineF(SDL_Renderer *r, float x1, float y1, float x2, float y2) {
    if (!g_gpu) return SDL_RenderDrawLineF(r, x1, y1, x2, y2);
    const float cr = G.r / 255.0f, cg = G.g / 255.0f, cb = G.b / 255.0f, ca = G.a / 255.0f;
    if (y1 == y2) { /* a row of pixels, end points included (the filled circle is made of these): a rectangle one pixel high */
        const float x0 = floorf(fminf(x1, x2)), xe = floorf(fmaxf(x1, x2)) + 1, y0 = floorf(y1);
        const float x[4] = { x0, xe, xe, x0 }, y[4] = { y0, y0, y0 + 1, y0 + 1 };
        gpu_quad(g_white, G.draw_blend, x, y, 0, 0, 1, 1, cr, cg, cb, ca);
        return 0;
    }
    float *v = gpu_vertices(g_white, G.draw_blend, GL_LINES, 2); /* through the pixel centres */
    put_vertex(v, floorf(x1) + 0.5f, floorf(y1) + 0.5f, 0, 0, cr, cg, cb, ca); put_vertex(v + 8, floorf(x2) + 0.5f, floorf(y2) + 0.5f, 0, 0, cr, cg, cb, ca);
    return 0;
}
static int gpu_copy(GpuTex *t, const SDL_Rect *src, const SDL_FRect *dst, double angle, const SDL_FPoint *center, SDL_RendererFlip flip) {
    const SDL_Rect s = src ? *src : (SDL_Rect){ 0, 0, t->w, t->h };
    const SDL_FRect d = dst ? *dst : (SDL_FRect){ 0, 0, (float)G.tw, (float)G.th };
    float u0 = (float)s.x / t->w, u1 = (float)(s.x + s.w) / t->w, t0 = (float)s.y / t->h, t1 = (float)(s.y + s.h) / t->h;
    if (flip & SDL_FLIP_HORIZONTAL) { const float k = u0; u0 = u1; u1 = k; }
    if (flip & SDL_FLIP_VERTICAL) { const float k = t0; t0 = t1; t1 = k; }
    float x[4] = { d.x, d.x + d.w, d.x + d.w, d.x }, y[4] = { d.y, d.y, d.y + d.h, d.y + d.h };
    if (angle != 0) { /* clockwise on the screen, about the centre given (relative to dst), as SDL does */
        const float cx = d.x + (center ? center->x : d.w / 2), cy = d.y + (center ? center->y : d.h / 2);
        const float rad = (float)(angle * M_PI / 180.0), cs = cosf(rad), sn = sinf(rad);
        for (int i = 0; i < 4; i++) {
            const float dx = x[i] - cx, dy = y[i] - cy;
            x[i] = cx + dx * cs - dy * sn; y[i] = cy + dx * sn + dy * cs;
        }
    }
    gpu_quad(t->id, t->blend, x, y, u0, t0, u1, t1, t->r / 255.0f, t->g / 255.0f, t->b / 255.0f, t->a / 255.0f);
    return 0;
}
static int gpu_RenderCopyExF(SDL_Renderer *r, SDL_Texture *tex, const SDL_Rect *src, const SDL_FRect *dst, double angle, const SDL_FPoint *center, SDL_RendererFlip flip) {
    if (!g_gpu) return SDL_RenderCopyExF(r, tex, src, dst, angle, center, flip);
    return gpu_copy((GpuTex *)tex, src, dst, angle, center, flip);
}
static int gpu_RenderCopyF(SDL_Renderer *r, SDL_Texture *tex, const SDL_Rect *src, const SDL_FRect *dst) {
    if (!g_gpu) return SDL_RenderCopyF(r, tex, src, dst);
    return gpu_copy((GpuTex *)tex, src, dst, 0, NULL, SDL_FLIP_NONE);
}
static int gpu_RenderCopy(SDL_Renderer *r, SDL_Texture *tex, const SDL_Rect *src, const SDL_Rect *dst) {
    if (!g_gpu) return SDL_RenderCopy(r, tex, src, dst);
    if (!dst) return gpu_copy((GpuTex *)tex, src, NULL, 0, NULL, SDL_FLIP_NONE);
    const SDL_FRect f = { (float)dst->x, (float)dst->y, (float)dst->w, (float)dst->h };
    return gpu_copy((GpuTex *)tex, src, &f, 0, NULL, SDL_FLIP_NONE);
}
/* Reads the target back. ARGB8888 is B, G, R, A in memory (what libretro's XRGB8888 wants); ABGR8888 is R, G, B, A as GL gives it. */
static int gpu_RenderReadPixels(SDL_Renderer *r, const SDL_Rect *rect, Uint32 format, void *pixels, int pitch) {
    if (!g_gpu) return SDL_RenderReadPixels(r, rect, format, pixels, pitch);
    gpu_flush();
    const SDL_Rect a = rect ? *rect : (SDL_Rect){ 0, 0, G.tw, G.th };
    /* one read for the whole rectangle: every read waits for the GPU to finish, so reading row by row waited 192 times a frame */
    static Uint8 *buf; static size_t cap;
    const size_t need = (size_t)a.w * a.h * 4;
    Uint8 *dst = pitch == a.w * 4 ? pixels : NULL;
    if (!dst) { if (need > cap) { free(buf); buf = malloc(need); cap = buf ? need : 0; } if (!buf) return -1; dst = buf; }
    p_glReadPixels(a.x, a.y, a.w, a.h, GL_RGBA, GL_UNSIGNED_BYTE, dst);
    for (int row = 0; row < a.h; row++) {
        Uint8 *out = (Uint8 *)pixels + (size_t)row * pitch;
        if (dst != pixels) memcpy(out, dst + (size_t)row * a.w * 4, (size_t)a.w * 4);
        if (format == SDL_PIXELFORMAT_ARGB8888) for (int i = 0; i < a.w; i++) { const Uint8 k = out[i * 4]; out[i * 4] = out[i * 4 + 2]; out[i * 4 + 2] = k; }
    }
    return 0;
}
static int gpu_RenderSetViewport(SDL_Renderer *r, const SDL_Rect *rc) { if (!g_gpu) return SDL_RenderSetViewport(r, rc); return 0; } /* the GPU path draws the whole target */
static void gpu_RenderGetViewport(SDL_Renderer *r, SDL_Rect *rc) { if (!g_gpu) { SDL_RenderGetViewport(r, rc); return; } *rc = (SDL_Rect){ 0, 0, G.tw, G.th }; }

#define SDL_CreateTexture gpu_CreateTexture
#define SDL_UpdateTexture gpu_UpdateTexture
#define SDL_DestroyTexture gpu_DestroyTexture
#define SDL_QueryTexture gpu_QueryTexture
#define SDL_SetTextureBlendMode gpu_SetTextureBlendMode
#define SDL_GetTextureBlendMode gpu_GetTextureBlendMode
#define SDL_SetTextureScaleMode gpu_SetTextureScaleMode
#define SDL_SetTextureColorMod gpu_SetTextureColorMod
#define SDL_SetTextureAlphaMod gpu_SetTextureAlphaMod
#define SDL_SetRenderTarget gpu_SetRenderTarget
#define SDL_GetRenderTarget gpu_GetRenderTarget
#define SDL_SetRenderDrawColor gpu_SetRenderDrawColor
#define SDL_SetRenderDrawBlendMode gpu_SetRenderDrawBlendMode
#define SDL_RenderClear gpu_RenderClear
#define SDL_RenderFillRectF gpu_RenderFillRectF
#define SDL_RenderDrawLineF gpu_RenderDrawLineF
#define SDL_RenderCopyExF gpu_RenderCopyExF
#define SDL_RenderCopyF gpu_RenderCopyF
#define SDL_RenderCopy gpu_RenderCopy
#define SDL_RenderReadPixels gpu_RenderReadPixels
#define SDL_RenderSetViewport gpu_RenderSetViewport
#define SDL_RenderGetViewport gpu_RenderGetViewport
