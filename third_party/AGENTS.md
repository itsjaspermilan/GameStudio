# third_party/: vendored code. Don't read it, don't edit it.

| Folder | What | Notes |
| --- | --- | --- |
| `sdl2/` (22 MB) | SDL2 2.28.5 (zlib; the release tarball, sha256 332cb37d...6666e4, without its tests and IDE projects). Built statically for the desktop; for the handheld only to link against (the system's copy is used) | Never grep inside; it will flood your context. Stay at the oldest SDL2 the handhelds ship |
| `lua/` | Lua 5.4 sources (no standalone interpreter) | |
| `stb/` | `stb_image.h` (PNG only) | |
| `tlsf/` | TLSF 3.1 (BSD-3-Clause, mattconte/tlsf at deff9ab): the allocator inside the libretro core's fixed Lua RAM (`runtime/ram.c`) | Keeps its bookkeeping in the block it manages, which save states rely on |
| `libretro/` | `libretro.h` (MIT, libretro-common master, 2024 header): the API of the libretro core (`runtime/libretro.c`) | |
| `tsf/` | `tsf.h`, TinySoundFont v0.9 (MIT): General MIDI playback from a SoundFont | `synth.c` defines `TSF_IMPLEMENTATION` |
| `luals/` (20 MB) | The Lua language server 3.19.2 (MIT) the studio's editor talks to | Downloaded by `scripts/fetch-luals.sh` (checksummed), gitignored, optional |
| `sysroot-aarch64/` | Debian headers/libs for the device build | Downloaded by `scripts/fetch-sysroot.sh`, gitignored, safe to delete |

To update a library, replace the folder wholesale and rebuild; record the version here. Licences are summarised in `../README.md`.
