# third_party/: vendored code. Don't read it, don't edit it.

| Folder | What | Notes |
| --- | --- | --- |
| `sdl3/` (52 MB) | SDL3, built statically by CMake | Never grep inside; it will flood your context |
| `lua/` | Lua 5.4 sources (no standalone interpreter) | |
| `stb/` | `stb_image.h` (PNG only) | |
| `tsf/` | `tsf.h`, TinySoundFont v0.9 (MIT): General MIDI playback from a SoundFont | `synth.c` defines `TSF_IMPLEMENTATION` |
| `luals/` (20 MB) | The Lua language server 3.19.2 (MIT) the studio's editor talks to | Downloaded by `scripts/fetch-luals.sh` (checksummed), gitignored, optional |
| `sysroot-aarch64/` | Debian headers/libs for the device build | Downloaded by `scripts/fetch-sysroot.sh`, gitignored, safe to delete |

To update a library, replace the folder wholesale and rebuild; record the version here. Licences are summarised in `../README.md`.
