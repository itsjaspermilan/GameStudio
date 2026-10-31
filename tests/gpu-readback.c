#include "../runtime/gpu.c"

#define CHECK(condition) do { if (!(condition)) { fprintf(stderr, "FAIL GPU readback: %s\n", #condition); exit(1); } } while (0)
static unsigned char transfer[1024];
static unsigned bound, reads, maps, deletes, waits, allocations;
static int fail_fence, fail_wait, fail_map, fail_unmap, fail_alloc, fail_read, fail_timeout;
static GLenum error;
static bool ready;
static GLenum get_error(void) { const GLenum value = error; error = 0; return value; }
static void buffers(GLsizei n, GLuint *ids) { CHECK(n == 1); *ids = 7; }
static void bind_buffer(GLenum target, GLuint id) { CHECK(target == GL_PIXEL_PACK_BUFFER); bound = id; }
static void buffer_data(GLenum target, GLsizeiptr size, const void *data, GLenum usage) {
    CHECK(target == GL_PIXEL_PACK_BUFFER && bound == 7 && data == NULL && usage == GL_STREAM_READ);
    CHECK(size <= sizeof transfer); allocations++;
    if (fail_alloc) error = 0x0505;
}
static void read_pixels(GLint x, GLint y, GLsizei w, GLsizei h, GLenum format, GLenum type, void *data) {
    CHECK(x >= 0 && y >= 0 && format == GL_RGBA && type == GL_UNSIGNED_BYTE);
    CHECK((bound == 7 && data == NULL) || (bound == 0 && data != NULL));
    unsigned char *dst = bound ? transfer : data;
    reads++; ready = false;
    if (fail_read) error = 0x0502;
    for (int i = 0; i < w * h; i++) {
        dst[i * 4] = (unsigned char)reads; dst[i * 4 + 1] = 20; dst[i * 4 + 2] = 30; dst[i * 4 + 3] = 255;
    }
}
static GLsync fence_sync(GLenum condition, GLbitfield flags) {
    CHECK(condition == GL_SYNC_GPU_COMMANDS_COMPLETE && flags == 0); waits = 0;
    return fail_fence ? NULL : (GLsync)(uintptr_t)1;
}
static GLenum wait_sync(GLsync fence, GLbitfield flags, uint64_t timeout) {
    CHECK(fence && flags == GL_SYNC_FLUSH_COMMANDS_BIT && timeout == 0);
    if (fail_wait) return 0x911D;
    if (fail_timeout || waits++ == 0) return GL_TIMEOUT_EXPIRED;
    ready = true; return GL_CONDITION_SATISFIED;
}
static void delete_sync(GLsync fence) { CHECK(fence); deletes++; }
static void *map_buffer(GLenum target, GLsizeiptr offset, GLsizeiptr size, GLbitfield access) {
    CHECK(target == GL_PIXEL_PACK_BUFFER && bound == 7 && offset == 0 && access == GL_MAP_READ_BIT);
    CHECK(size <= sizeof transfer && ready); maps++;
    return fail_map ? NULL : transfer;
}
static GLboolean unmap_buffer(GLenum target) { CHECK(target == GL_PIXEL_PACK_BUFFER && bound == 7); return !fail_unmap; }

int main(void) {
    g_gpu = true; g_gpu_pack = true;
    G.tw = G.th = 2;
    p_glGenBuffers = buffers; p_glBindBuffer = bind_buffer; p_glBufferData = buffer_data;
    p_glReadPixels = read_pixels; p_glFenceSync = fence_sync; p_glClientWaitSync = wait_sync; p_glDeleteSync = delete_sync;
    p_glMapBufferRange = map_buffer; p_glUnmapBuffer = unmap_buffer; p_glGetError = get_error;
    unsigned char pixels[64];
    for (int i = 0; i < 3; i++) {
        CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) == 0);
        CHECK(pixels[0] == 30 && pixels[1] == 20 && pixels[2] == reads && pixels[3] == 255);
        CHECK(bound == 0 && deletes == reads && maps == reads);
    }
    CHECK(allocations == 1);
    memset(pixels, 0xA5, sizeof pixels);
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ABGR8888, pixels, 12) == 0);
    CHECK(pixels[0] == reads && pixels[2] == 30 && pixels[12] == reads && pixels[8] == 0xA5 && pixels[20] == 0xA5);
    CHECK(gpu_RenderReadPixels(NULL, &(SDL_Rect){0, 0, 4, 4}, SDL_PIXELFORMAT_ARGB8888, pixels, 16) == 0);
    CHECK(allocations == 2 && bound == 0);
    g_gpu_pack = false;
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) == 0);
    CHECK(pixels[2] == reads && bound == 0);
    g_gpu_pack = true;
    fail_fence = 1;
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) < 0 && bound == 0);
    fail_fence = 0; fail_wait = 1;
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) < 0 && bound == 0);
    fail_wait = 0; fail_map = 1;
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) < 0 && bound == 0);
    fail_map = 0; fail_unmap = 1;
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) < 0 && bound == 0);
    fail_unmap = 0; fail_timeout = 1;
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) < 0 && bound == 0);
    fail_timeout = 0; fail_alloc = 1; g_pack_capacity = 0;
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) < 0 && bound == 0 && g_pack_capacity == 0);
    fail_alloc = 0; fail_read = 1;
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) < 0 && bound == 0);
    fail_read = 0; error = 0x0502;
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) < 0 && bound == 0);
    CHECK(gpu_RenderReadPixels(NULL, NULL, SDL_PIXELFORMAT_ARGB8888, pixels, 8) == 0 && bound == 0);
    CHECK(pixels[2] == reads);
    puts("PASS same-frame GPU readback, reuse, formats and failures");
    return 0;
}
