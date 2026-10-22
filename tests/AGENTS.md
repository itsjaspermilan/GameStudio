# tests/: headless fixtures

Each folder is a tiny cart run by the real runtime with dummy video/audio, driven by `run.sh` (build `build/gs` first). A fixture prints a PASS line that `run.sh` greps for.

| Folder | What it checks |
| --- | --- |
| `framework` | The Lua framework from inside (`game.lua` + `scenes/tests.lua`, one `check()` per feature): spawning and queries, `gs.pause`, `gs.defaults`, `collide_every`, inheritance and flattening, grid collisions, motion, animation clips, timers/tweens/coroutines, camera, saves and slots, input simulation, sound errors, entity limit, **live reload** (writes and removes `entities/hot.lua`; needs `GS_DEV=1`), scene arguments. Ends with `FRAMEWORK TEST PASS`. Add a check here for every new framework feature |
| `audiotest` | A sound effect and a song load and play; unknown names are rejected |
| `songtest` | Pulse, wavetable, noise and sample instruments, a tracker song and an effect naming an instrument |
| `bandtest` | Ready-made instruments, multi-track effects (and the older one-row form), songs with an instrument per track |
| `customconsole` | A game carrying its own console (`consoles/tiny.json`, 240x160); prints `CUSTOM CONSOLE Tiny 240x160` |
| `song-bad`, `band-bad` | An unknown instrument name stops loading with a readable message |
| `keys-bot.lua` | A `GS_BOT_LUA` script that presses keys on a schedule (for driving menus in a cart) |
| `random-bot.lua` | A `GS_BOT_LUA` script that plays any game at random (`GS_SEED`); the studio's Help tests use it on every tutorial |

`run.sh` also runs the sample carts and the button test / pad setup carts (no error or warning), checks that a plain `main.lua` game is refused with a clear message, drives the inspector (`GS_INSPECT`: pause, report, watch) on Breakout, drives Panel Pop's menus into a one-board game and a Vs game and through every screen, the Void Swarm bot (two runs), its text audit (`GS_TEXTAUDIT=1`) and scripted menus, the stats line (`GS_STATS=1`), Panel Pop's self-test, the CPU-floor selftest, the `meta/` packing rule, layer-picture equality on Breakout, and the sound-queue check.
