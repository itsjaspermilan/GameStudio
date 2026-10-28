# tests/: headless fixtures

Each folder is a tiny cart run by the real runtime with dummy video/audio, driven by `run.sh` (build `build/gs` first). A fixture prints a PASS line that `run.sh` greps for.

| Folder | What it checks |
| --- | --- |
| `framework` | The Lua framework from inside (`game.lua` + `scenes/tests.lua`, one `check()` per feature): spawning and queries, `gs.pause`, `gs.defaults`, `collide_every`, inheritance and flattening, grid collisions, motion, animation clips, timers/tweens/coroutines, camera, saves and slots, input simulation, sound errors, entity limit, **live reload** (writes and removes `entities/hot.lua`; needs `GS_DEV=1`), scene arguments. Ends with `FRAMEWORK TEST PASS`. Add a check here for every new framework feature |
| `audiotest` | A sound effect and a song load and play; unknown names are rejected |
| `songtest` | Pulse, wavetable, noise and sample instruments, a tracker song and an effect naming an instrument |
| `bandtest` | Ready-made instruments, multi-track effects (and the older one-row form), songs with an instrument per track |
| `customconsole` | A game carrying its own console (`consoles/tiny.json`, 240x160); prints `CUSTOM CONSOLE Tiny 240x160` |
| `blend` | Blend modes on an entity, a tile layer and `gs.draw.sprite`, with alpha; prints `BLEND TEST PASS`, and with `GS_BLEND_PLAIN=1` draws the colours they should make as rectangles, for `run.sh` to compare with `tests/same-frames.mjs` |
| `mosaic` | The mosaic (`gs.raw.mosaic`) on the GPU path: a dot of its own colour in the middle of every 4x4 block, and with `GS_MOSAIC_PLAIN=1` the whole blocks in those colours; `run.sh` compares the two frames |
| `ramhog` | Keeps a new 32 KB string every step until the console's RAM is full: `run.sh` checks that the program with `GS_RAM=1` (the studio's Play panel) and the libretro core run out at the same step (or one apart: 32 KB), near 8 MB, and that `gs.raw.ram()` reports it |
| `banks` | Colour banks (`palette.json`): bank lookups, `"bank:place"` colours, a palette swap; prints `BANKS TEST PASS`, and with `GS_BANKS_PLAIN=1` draws the same frame with rectangles for `run.sh` to compare |
| `song-bad`, `band-bad` | An unknown instrument name stops loading with a readable message |
| `keys-bot.lua` | A `GS_BOT_LUA` script that presses keys on a schedule (for driving menus in a cart): `a`, `right*30`, `right+a*20` (together), `wait*60`, `quit` |
| `bake` | `gs.draw.bake`: a backdrop baked once must look exactly like drawing it every frame (`GS_BAKE_PLAIN=1`), on the program, in the core and after resuming from a save state |
| `random-bot.lua` | A `GS_BOT_LUA` script that plays any game at random (`GS_SEED`); the studio's Help tests use it on every tutorial |
| `heavy` | Not a pass/fail test: a heavy screen for measuring drawing on a device (full-screen glows and fades, `GS_HEAVY_STARS` big turning sprites, default 200; `GS_HEAVY_THINGS=N` adds N small moving, colliding entities for the Lua side). The studio's Brick estimate (`studio/src/brick-core.js`) was fitted to it. Art from `make-art.mjs`. `retro-run` prints the core's frame times; the program's come from `GS_PERF=1` (`GS_READBACK=1` adds copying each frame back from the GPU) |
| `survivors` | Not a pass/fail test: a survivors-style screen for the Lua side (a hero on a 1024x1024 field, `GS_SV_BATS` bats, default 300, chasing it and pushing each other apart, bolts, gems, sparks). `GS_SV_STILL=1` freezes the bats in a dense crowd so collision code can be compared step for step. Art from `make-art.mjs` |
| `retro-run.c` | A tiny libretro frontend (built as `build/retro-run`): loads `build/gs_libretro` as minarch would, runs a cart, holds buttons (`RETRO_HOLD`), saves and loads states (`RETRO_SAVE`, `RETRO_LOAD`), saves frames (`RETRO_DUMP`). `run.sh` checks that the core draws what the program draws, its sound timing, quit and saves, and that a game loaded from a state or resumed in a new run replays to the same frame |

`run.sh` also runs the example `carts/breakout` (the fixture for the inspector, layer-picture, sound-queue and stats checks, and a bot playthrough) and the button test / pad setup carts (no error or warning), checks that a plain `main.lua` game is refused with a clear message, drives the inspector (`GS_INSPECT`: pause, report, watch) on Breakout, the stats line (`GS_STATS=1`), the CPU-floor selftest, the `meta/` packing rule, layer-picture equality on Breakout, and the sound-queue check.
