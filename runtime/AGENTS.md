# runtime/: the `gs` player (C, SDL2, Lua 5.4)

`main.c` (~2200 lines) is the player and CLI, `libretro.c` + `ram.c` + `gpu.c` the libretro core built from it (see "The libretro core" below), `synth.c`/`synth.h` (~700/100) is the sound engine, `fonts.h` the glyphs of `gs.print` (written by `scripts/make-fonts.mjs` from `engine/fonts/*.txt`; don't edit it). SDL2 (2.28.5,
the oldest a handheld ships: call nothing newer), Lua, stb_image, TinySoundFont, TLSF and libretro.h are vendored in `../third_party` and built by `../CMakeLists.txt`. The
desktop build links SDL2 in; the handheld build (`GS_SYSTEM_SDL2`) uses the system's `libSDL2-2.0.so.0`, which has the device's GPU driver, reads
the frontend's controller mapping as written, and is what muOS's overlays hook (see "Video output" below). After any change here: `./scripts/build.sh`, `./tests/run.sh`,
`cd studio && npm test` (the synth tests render through the real binary), and `./scripts/build-aarch64.sh` before telling the user it works on the device.

## main.c

Order of sections: virtual file system (a directory, or a packed `GSC1` cart; `vfs_read`) → drawing (rect, line, circle, built-in fonts with shadows, images,
tiles, camera, resolution) → input (keyboard, gamepad; 12 named buttons) → audio device and the SDL callback (takes `synth_lock()`) → Lua
bindings (`static int l_*`, registered in the `gs_lib` table near line 620) → `render_audio` (CLI) → `main` (boot, cartridge
detection: `game.lua` boots the embedded `gs` framework (`require('gs.boot')`); a cart without one is refused; frame loop).

- **Add a Lua function:** write `l_name`, add `{"name", l_name}` to `gs_lib`, document it in the README table. Lua errors print once to stderr and the game keeps running.
- **CLI:** `gs <cart|dir>`, `gs pack <dir> <out.g43>` (a cart's name says its console, `cart_extension` in the spec: `.g43`, `.g169`, `.cart` for custom consoles; the format is the same and nothing reads the name except to key the saves), `gs render-audio <desc.txt> <out.wav>`. The render-audio description grammar is documented
  in the comment above `safe_sound_path` / `render_audio`; the studio builds those descriptions in `studio/src/audio-core.js` (`AudioDesc`).
  If you change one side, change the other and the tests in `studio/test/synth*.test.mjs`, `audio-tracker.test.mjs`.
- **Environment:** `GS_MAX_FRAMES=N` exits after N frames (tests), `GS_SAVE_DIR` moves per-game saves (ALWAYS set it in tests), `GS_SOUNDFONT`
  overrides the SoundFont path, `SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy` for headless runs. The framework's own switches (`GS_DEV`, `GS_STATS`, `GS_FF`, `GS_BOT_LUA`, ...) are read by `engine/gs/boot.lua`, see `engine/AGENTS.md`.
- **SoundFont** (`soundfont_commit`, `sfbank.c`): each game plays from its own bank, cut down to the presets it defines and the notes its songs and effects play (drum kits: the keys struck; melodic instruments: an octave around each note), samples at 32 kHz at most. The source is the game's own `soundfont.sf2` (a packed cart's, already cut down), else `$GS_SOUNDFONT`, `<exe dir>/FluidR3Mono_GM.sf3`, `<exe dir>/soundfonts/`, `<exe dir>/../assets/soundfonts/`. `engine/gs/sound.lua` defines every instrument, then calls `gs.soundfont_load()` once; loading more sounds later marks the bank dirty and the next play makes it again. `gs pack` loads the game's sounds the same way (`pack_soundfont`) and writes the bank into the cart with its samples packed without loss (`sfbank_pack`: an `smpz` chunk in place of `smpl`, FLAC's idea of order 0-3 prediction plus Rice codes in 4096-frame blocks, about 55% of the size; `sfbank_open` unpacks it, and a broken one is an error, not noise), and `gs soundfont-size` reports that packed size; `gs soundfont <bank>` lists a bank's presets with their sizes. `render-audio` reads a `soundfont.sf2` in its working folder (the studio runs it in the game's), so previews play the game's own bank. A missing bank is a clear error, not a crash.
- **Collision grids** (`l_grid_build` / `l_grid_query`, before `gs_lib`): the broad phase of `engine/gs/world.lua`. Lua passes each tag's boxes once a step; C buckets them by centre (counting sort, so slots stay in order inside a cell) and answers queries with the touching slots sorted. Keep the order: handlers run in the order things were made.
- **Games are sandboxed** (`engine/gs/boot.lua`, checked in `tests/framework`): no `os.execute`/`io.open`/`loadfile`/`debug.*`, `load` takes text only, `os.getenv` sees only `GS_*`, and `require` finds only the cart's files (`game_start` keeps Lua's preload searcher and `cart_searcher`). Framework modules that need a host call take it before boot strips it (`inspect.lua`'s `io_open`). `GS_TEST_HOST=1` (tests only) hands the framework test `gs.test_host`.
- Every cart has a `game.lua` (a plain `main.lua` is refused with a message); it takes its screen size from its console (`boot.lua` calls `gs.set_resolution`).
- Lua is compiled with `lua-seed.h` force-included (both program and core), fixing its string-hash seed for cross-process replay.
  `game_start` preloads `gs.random_source` with `luaopen_math`, giving the framework a second native Lua RNG; both streams live in Lua's
  RAM and survive save/load and Resume without extra external state.
- `net.c` / `net.h`: private `gs.transport` module, one nonblocking IPv4 UDP socket, bounded 1200-byte datagrams and local broadcast.
  The Lua framework owns protocol/session rules; `session_transport` adds the host's bounded save snapshot. No socket until requested.
  Program exit and core unload close it. `ram.c` refuses save/load and libretro reports zero serialize size while it is open (including
  discovery/lobbies), because native sockets cannot be restored by a Lua RAM snapshot. Real handheld/LAN play is not verified yet.

## Sound calls from the game: a queue, not the audio lock

`gs.sfx_play`, `sfx_stop`, `music_play`, `song_play`, `music_stop` post a `SoundCmd` (small critical section, its own mutex) and the audio thread carries the commands out at the start of its next
callback (`sound_run_commands`, called from `mix_cb`, and from `synth_lock` so anything that takes the audio lock first finishes the waiting ones: call order is kept). Taking the audio lock directly
made the game wait for the end of a mix: 3 to 10 ms per `gs.sfx_play` on the RG35XX Pro, every brick hit a late frame. Loading calls (`sfx_load`, `inst_load`, `song_load`, ...) still lock; they happen at start-up.

## synth.c / synth.h

Pure C with **no SDL dependency**, so the device and the studio's previews (`render-audio`) run identical code. Keep it that way.

- **Voices:** `g_v[20]`: music voices `0..15` (`SYNTH_MAX_CHANNELS`: 4 tracks x up to 4 voices, voice `v` plays track `v % SONG_TRACKS`'s instrument; `synth_config` limits the tracks), sound effect voices from `SFX_BASE` (`SYNTH_MAX_SFX_CHANNELS` = 4).
  The two pools never share voices: effects never cut music. A multi-track sound effect starts together with `synth_play_sfx_group`; if channels are
  busy the oldest effect (by `group`) is replaced whole.
- **Instruments** (`SynthInstrument`): `INST_BASIC` (the six original waves, handles 0-5), `PULSE`, `WAVE` (32x4-bit), `NOISE`, `SAMPLE`, `GM` (TinySoundFont: each voice owns a
  `tsf` copy sharing sample data, rendered in 64-frame blocks, mono mix + pan). Extras: `fixed_note` (drums), pitch `sweep`, vibrato, ADSR.
- **Sound effect steps** are `{pitch, inst, vol, fx}`; `FX_TIE` means "hold the note from the step before" (no new note). **Songs** are tracker patterns:
  `SynthCell` has note/inst/vol/fx/fxp plus `extra[3]` (more notes struck together, GM drum kits only). Songs and effects use song *slots* = track number.
- **Output stage:** optional reverb comb bank and a lo-fi stage (low-pass, 32 kHz hold, 8-bit rounding) when the console's `audio.style` is `gba`.
- Pitch numbering: note 0 = C0, C4 = 48, A4 = 57. A sound effect pitch `p` is note `p + 12`.
- Don't allocate in the mix path except `tsf_copy` on a voice's first GM note. All shared state is guarded by `synth_lock()` in `main.c`.

## Drawing API note

`gs.tile(img, sx, sy, sw, sh, x, y, scale, flipx, angle, yscale, alpha, pivotx, pivoty)`: `x, y` is where the unscaled sprite's top-left would go; scaling and rotation (degrees clockwise, SDL's
convention; the engine passes the negative of `image_angle`) happen around the pivot, which stays put. A negative scale mirrors. Alpha 0-255 is applied with `SDL_SetTextureAlphaMod` for this draw only.

## Controllers on handheld frontends

Knulli and muOS hand games a mapping in `SDL_GAMECONTROLLERCONFIG`, written for their SDL2, which gs uses on the handheld, so SDL reads it
as it is (muOS picks it from the player's "modern" or "retro" layout). `open_controllers` opens every controller and joystick; `GS_DEBUG_INPUT=1`
prints them and every press. A `padmap.txt` from the Pad setup cart still wins over the mapping.

NextUI (the TrimUI Brick) hands games no mapping, and the Brick's SDL2 takes its pad for an Xbox 360 controller (buttons by position,
so B came out as A). `scripts/push.sh` writes the Brick's mapping into the NextUI launcher (`SDL_GAMECONTROLLERCONFIG`, face buttons by
label; `GS_DEBUG_INPUT` prints the mapping SDL uses and trigger/stick axes crossing half way). That launcher is now only the fallback
(`GS_NEXTUI_PROGRAM=1`): consoles run in minarch with the libretro core, which gets buttons by label. `GS_BUTTON_ALIAS="l3=select,r3=start"`
makes one button stand in for another (both launchers set it for consoles without L3/R3); SDL's and minarch's mappings cannot, since they
take one input per button.

## The libretro core (gs_libretro.so)

`libretro.c` includes `main.c` with `GS_LIBRETRO` (no `main()`) and builds `gs_libretro` (`.so`/`.dylib`): a cart is a "rom" for NextUI's
minarch or RetroArch, which own the window, sound device, buttons (by label: `RETRO_DEVICE_ID_JOYPAD_A` is the button marked A) and their
menu. The program and the core share `game_start` / `game_frame`. **Drawing** (`gpu.c`): the core opens a GPU context of its own (EGL,
an off-screen surface; `libEGL`/`libGLESv2` loaded at run time), draws the frame into a target texture with GL ES 2 and reads it back
(one `glReadPixels` a frame: reading row by row waited for the GPU 192 times). `gpu.c` has a stand-in for each of the ~20 SDL renderer
calls `main.c` makes, swapped in by name, keeping SDL's meaning (texture blend/colour/alpha, draw colour, SDL's blend formulas); copies
with the same texture and blend mode are batched. Rows are drawn top row first at GL row 0, so readback and targets used as textures need
no flipping. The fragment shader asks for high precision. Without EGL (a Mac, the tests, `GS_CORE_GPU=0`) every stand-in passes to SDL's
software renderer into a 640x480 XRGB8888 surface. `GS_CORE_BUFFERED_READBACK=1` opts into an ES 3 pixel-pack buffer and a polled fence,
with direct ES 2 fallback if unavailable. It reads the current frame (no extra frame of latency), avoiding the Brick Pro driver's intermittent
~100 ms blocking waits, but adds about 2 ms per Glow43 frame copying mapped GPU memory. Direct readback remains the faster default.
Failures are reported and request frontend shutdown instead of showing stale pixels. Measured on the Brick (`tests/heavy`): GPU 3.9/4.9/6.8 ms for 100/200/400 stars
against 21/34/60 on the CPU; frames match the CPU's (Breakout, blend, banks, mosaic exactly; turning sprites differ only at edges). Any
new SDL renderer call in `main.c` needs a stand-in in `gpu.c`, or it reaches SDL with a GPU texture. `mix_cb` is called once a frame for
735 samples at 44.1 kHz, on a thread of its own (`mix_thread_main`) while the game's frame runs, handed over at the end of `retro_run`
(`GS_CORE_MIX_THREAD=0`: on the game's thread). While that thread exists `synth_lock` takes its mutex (`g_core_mix_lock`). The emulator links SDL2 too (on
the handheld the same library): the core never initialises or quits SDL's video/audio/controller parts and never opens a controller.
Saves go to the emulator's save folder, one folder per cart; the SoundFont is looked for beside the core (`dladdr`).

**Save states** (`ram.c`): Lua allocates from one 8 MB block (the console's RAM, TLSF inside it) mapped at a fixed address
(`0x3000000000` on Linux, `0x10000000000` on macOS, which reserves everything below `0x7000000000`). A state is a fixed size (rewind
needs that): header, the runtime's settings and sound voices, `synth_state_save` (live state and definitions), how every picture, sound and
sample was made (`g_images[].recipe`: 'F' file, 'P' pixels, 'R' recolour, 'C' composed grid; sounds and samples by name), then the used part
of the block. Loading in the same run copies the block back. A state from another run (Resume) remakes the assets in their slots (oldest
recipe first), then moves Lua's pointers into the core by the change in load address: C functions (light ones, C closures, continuations,
hooks, the allocator and panic function), empty tables' shared `dummynode`, and io's standard streams; tables keyed by a C function are
rehashed. A state carries a hash of the core file and is refused by any other build (function offsets inside the core change). Anything
new that stores a pointer into the core or outside the block inside a Lua object must be added to `shift_object`.
The allocator counts the bytes in use (`g_ram_used`, `gs.raw.ram()`). The program includes `ram.c` too (not on Windows): with `GS_RAM=1` its Lua uses the same block, and the studio's Save state / Load state use `state_save` / `state_load` within the run. `tests/retro-run.c` is a small frontend for tests (`RETRO_HOLD`, `RETRO_SAVE`, `RETRO_LOAD`, `RETRO_DUMP`; see its header).

## Video output

Three ways a frame reaches the screen, chosen in `main`:

- **Window** (a desktop, or a handheld whose SDL2 has a GPU driver: muOS's `mali` on the RG35XX Pro). The game draws into a texture at the
  console's size (`g_target`, made by `screen_logical`); `present_window` enlarges it by a whole number and presents. Drawing at the console's
  size keeps sprites on the same pixel grid as the other two outputs. On a handheld the window is fullscreen and SDL2's GLES2 renderer draws
  every sprite on the GPU (about 1.5 ms of CPU a frame for Then & Now's title, against 9.6 ms in software). **muOS's overlays** (volume,
  brightness, battery: `libmustage.so`) are preloaded by the launcher (`scripts/push.sh` calls muOS's own `SETUP_STAGE_OVERLAY`) and hook
  `SDL_RenderPresent`: they draw over the enlarged picture, so `present_window` must leave the screen, not the texture, as the target.
  Without real vsync (the dummy driver of the tests) the loop holds itself to 60 frames a second.
- **Embedded** (`GS_EMBED`, the studio's Play panel): software renderer, see the table below.
- **Framebuffer** (SDL finds no video device, or `SDL_VIDEODRIVER=none` to force it): below.

## Framebuffer output and measuring (devices with no display server)

When SDL finds no video device (a system SDL2 without the device's GPU driver; no `/dev/dri` on the RG35XX Pro), `main` falls back to `fb_open` / `fb_present`: the software renderer draws at the **console's own size** into
the top-left corner of a surface (viewport, no logical presentation), and `fb_present` enlarges it by a whole number into `/dev/fb0` (double buffered when the driver has two pages, centred, black bars).
Drawing at 640x480 instead cost about 19 ms a frame; this costs about 2.6 ms. The copy and the flip run on a thread of their own
(`fb_thread_main`): on this panel the flip must come several ms before the refresh, which left a game waiting for it only about 11 ms a
frame. With the thread a frame shows one refresh later and the game gets nearly all 16.7 ms (`GS_FB_THREAD=0` turns it off, `GS_FB_WAIT=0`
skips the extra wait after the flip). Opaque composed pictures are copied without blending (`SDL_BLENDMODE_NONE`). Environment switches (all optional):

| Variable | Does |
| --- | --- |
| `GS_PERF=1` | One line a second, plus the costliest `gs.*` calls. The program logs slow frames; the core counts frames over 16.67 ms and logs individual frames over 33.33 ms. The program separates update, draw, render flush, copy + vsync, and audio waits; the core separates update, draw, readback + frontend video callback, and audio wait + frontend submission. Severe GPU frames split submission, readback wait, conversion, context restoration and the video callback; buffered summaries split GPU transfer, mapping, copying and unmapping. Core timings exclude presentation work outside those callbacks. Kept in memory and written at exit/core unload: writing to an SD card while measuring made frames slow |
| `GS_CORE_BUFFERED_READBACK=1` | Opt-in core readback with fewer driver hitches but higher typical frame cost; requires ES 3 and preserves current-frame delivery. Direct readback is the default |
| `GS_PROF=1` | Sampling profiler for Lua (every 1000 instructions), busiest lines/functions at exit or core unload |
| `GS_DEBUG_INPUT=1` | Prints joysticks, raw evdev key codes and presses (flushed with `fsync`) |
| `GS_MAX_SECONDS=N`, `GS_MAX_FRAMES=N` | Leave after N seconds / frames |
| `GS_DUMP_FRAME=file.bmp` | Saves the last frame (tests compare drawing paths with it) |
| `GS_READBACK=1` | Copies every finished frame from the GPU into memory (what a libretro core drawing on a GPU of its own would pay); shows in `GS_PERF`'s drawing time |
| `GS_EMBED=port`, `GS_EMBED_SIZE=WxH` | No window: draw with the software renderer at the console's size and send changed frames to the studio's Play panel on 127.0.0.1:port; take its buttons back, and its Save state / Load state (protocol in the "embedded preview" comment in `main.c`; `studio/src/play-core.js` reads it) |
| `GS_RAM=1` | Lua gets the console's RAM, the libretro core's fixed 8 MB block (`ram.c` is built into the program too), so the game runs out of memory where it does on the Brick and can save states; `gs.raw.ram()` gives the bytes in use, the most so far and the size. The studio sets it for every run |
| `GS_FBDEV=path`, `GS_AUDIO_FRAMES=N` | Another framebuffer device; a device audio buffer of N frames (default: SDL's) |

Frame times within 3 ms of 1/60 s are taken as exactly 1/60 so the engine's fixed steps do not alternate between zero and two a frame. `scripts/push.sh` can generate test launchers: `GS_PERF=1`, `GS_DEBUG=1`, `GS_GOVERNOR=performance` (see its header comments).

## Adaptive CPU floor (framebuffer output only)

On the RG35XX Pro the governor (schedutil) can settle at about 790 MHz while a heavy game runs at 30 fps: a late frame waits for the next screen refresh, the CPU idles half the time, the load looks light, the clock
never rises. `boost_init` / `boost_tick` raise `scaling_min_freq` to about 1.2 GHz while at least 3 frames a second are late (or the average frame is over 18.5 ms), keep it for 10 s, and put it back after
`need_comfy` seconds (5, doubled up to 60 when the game needed the floor again within 30 s) in which no frame was late and the work per frame (update, draw, render, copy, not the wait) stayed under 9 ms.
The original value is in `/tmp/gs-cpu-min` while the floor is up; the runtime restores it on exit, the next start restores a stale one, and the launcher `scripts/push.sh` writes does too. `GS_NO_BOOST=1` turns
it off, `GS_BOOST_KHZ` picks the floor, `GS_CPUFREQ_DIR` points at another cpufreq folder. `gs boost-selftest <dir>` tests the controller on made-up files (see `tests/run.sh`).

## gs.tile and the screen edge

SDL's software renderer (also what the framebuffer path uses) draws a see-through picture that is only partly on screen with a black box where it is transparent. `l_tile` therefore cuts an unrotated draw to the screen itself (adjusting source and destination) and skips draws wholly off screen; rotated draws still go straight to SDL. `gs.sprite` (the whole-image call, `l_sprite`) does not do this yet.
