# GameStudio: agent guide

A cheap Linux handheld (Anbernic RG35XX Pro, aarch64, Knulli) becomes a "Playdate-like" console for small 2D games, plus a
desktop **Studio** (Tauri 2 + Rust + plain JS) in the spirit of Game Maker 7 for making them. Two audiences matter when you change
anything: **beginners** (the studio must stay simple: plain words, few choices, good defaults) and **the handheld** (small, fast,
GBA-like limits). This file is the map; each folder has its own `AGENTS.md` with the details. Read only the one for the area you touch.

## Layout

| Path | What | Guide |
| --- | --- | --- |
| `runtime/` | C: SDL3 + Lua 5.4 player (`gs`), the synth (`synth.c`), TinySoundFont for General MIDI | `runtime/AGENTS.md` |
| `engine/` | The `gs` Lua framework (`engine/gs/`), built-in instruments, console specs. Embedded into `gs` | `engine/AGENTS.md` |
| `studio/` | The app: Vite + vanilla JS front end, Rust (Tauri) back end | `studio/AGENTS.md` |
| `tests/` | Headless engine fixtures and `run.sh` | `tests/AGENTS.md` |
| `scripts/` | Desktop/aarch64 builds, push to the device | `scripts/AGENTS.md` |
| `carts/` | Sample games (and the user's own projects live here too) | `carts/AGENTS.md` |
| `third_party/`, `assets/` | Vendored libraries, the General MIDI SoundFont | `third_party/AGENTS.md`, `assets/AGENTS.md` |
| `docs/` | `lua-engine-design.md` (why the engine and studio look the way they do) and `help/` (the in-app Help pages, tested) | `studio/AGENTS.md` |
| `README.md` | User-facing docs: games, console limits, the low-level runtime calls, sound system, tests, licences | |

There is a git repository: one branch, `main`, whose history starts with the Lua engine (the old card engine is gone, history included); it tracks `origin/main` on GitHub. `build/` and `build-aarch64/` are build outputs (gitignored); don't read them. Open work is in `TODO.md`.

## Commands (all from the repo root unless noted)

```sh
./scripts/build.sh                 # desktop runtime -> build/gs   (rerun after ANY change in runtime/ or engine/)
./tests/run.sh                     # headless engine tests (needs build/gs)
cd studio && npm test              # studio logic + the synth rendered through build/gs (node --test, ~165 tests, about 40 s: the Help tests play every tutorial)
cd studio && npm run tauri dev     # the app (the user usually has this running on port 1420)
cd studio/src-tauri && cargo check # Rust compile check
./scripts/build-aarch64.sh         # device runtime (zig cc) -> build-aarch64/gs
```

Run all of the first four after touching shared code. Tests that need `build/gs` skip themselves if it is missing, so a green
run without a build proves less than it looks: build first.

## Things that bite

- **Embedded engine files.** `engine/gs/*.lua`, `instruments.json` and `consoles/*.json` are compiled into `gs` by CMake. Editing them
  does nothing for `build/gs` until you run `scripts/build.sh`. The studio imports `instruments.json` directly (Vite), so the studio sees
  edits at once but the runtime does not: a stale build gives "unknown instrument" style errors.
- **The studio** is a file-tree project (see `studio/AGENTS.md`): sprite, tileset, sound, music and instrument editors, a Lua code editor with
  project-aware completion and an optional language server, the Handheld tab and the Help window. A room editor (tiles, entities, paths) opens data-file rooms; the Inspector tab looks inside a running game. Open work is in `TODO.md`.
- **Python for patching.** If you edit files with a Python script, run `ASDF_PYTHON_VERSION=3.11.0 python3 -I - <<'EOF'` (plain `python3`
  has no version set here). Match literal characters in files exactly (×, ●, ♪ appear in UI strings).
- **Port 1420** belongs to the user's `tauri dev`. To check UI in the built-in browser pane, navigate to `http://localhost:1420` (a mock
  backend takes over when there is no Tauri). Only start `studio-dev` (`.claude/launch.json`) if nothing is listening, and stop it when
  done. Page state resets on every hot reload; navigate and redo the clicks.
- **Tests must not touch real saves.** Anything that runs the runtime sets `GS_SAVE_DIR` to a temp folder.
- **Project files are the contract.** Everything a project holds is plain JSON; formats are described in `README.md` (sound) and in the
  header comments of `engine/gs/sound.lua` and `studio/src/audio-core.js`. Old formats must keep loading (the sound code converts three
  older generations). Don't break reading; add converters.
- **A game names its console** in `game.lua` (`console = "dot"`); the spec comes from `engine/consoles/*.json` at build time.
- **SoundFont licence.** `assets/soundfonts/TimGM6mb.sf2` is GPL-2.0 (documented in `README.md` → Licences). Keep that note when moving files.

## Conventions

- Match the surrounding code. Comments say *why*, in plain sentences, not what the next line does. No emoji in code except the few
  existing UI glyphs.
- UI text is for beginners: "Drag an instrument onto a lane", not "assign instrument to channel". Put limits and hints in tooltips.
- Pure logic goes in `studio/src/*-core.js` (no DOM) with a test in `studio/test/`; editors are thin DOM layers over it.
- Hardware-style limits come from the console spec (`audio.music_tracks`, `audio.sfx_channels`, `budgets.cart_kb` = 16 MB, a typical
  GBA ROM). Don't hard-code a limit in an editor if a console field already says it.
- Prefer targeted reads. Big files and what to grep for are listed in each folder guide; never read `third_party/` or `*.lock`.

## Context-saving map of the biggest files

`studio/src/main.js` (~1000 lines, section markers `// ---------- name ----------`), `studio/src/audio-core.js` (~870, same markers),
`studio/src/lua-intel-core.js` (~350), `engine/gs/world.lua` (largest framework module), `runtime/main.c` (~920),
`runtime/synth.c` (~650). Grep the marker, read that section only.
