# runtime/: the `gs` player (C, SDL3, Lua 5.4)

Three files. `main.c` (~920 lines) is the player and CLI, `synth.c`/`synth.h` (~650/100) is the sound engine. SDL3, Lua, stb_image and
TinySoundFont are vendored in `../third_party` and built by `../CMakeLists.txt`. After any change here: `./scripts/build.sh`, `./tests/run.sh`,
`cd studio && npm test` (the synth tests render through the real binary), and `./scripts/build-aarch64.sh` before telling the user it works on the device.

## main.c

Order of sections: virtual file system (a directory, or a packed `GSC1` cart; `vfs_read`) → drawing (rect, line, circle, 8x8 font, images,
tiles, camera, resolution) → input (keyboard, gamepad; 12 named buttons) → audio device and the SDL callback (takes `synth_lock()`) → Lua
bindings (`static int l_*`, registered in the `gs_lib` table near line 620) → `render_audio` (CLI) → `main` (boot, cartridge
detection: `game.lua` boots the embedded `gs` framework (`require('gs.boot')`); a cart without one is refused; frame loop).

- **Add a Lua function:** write `l_name`, add `{"name", l_name}` to `gs_lib`, document it in the README table. Lua errors print once to stderr and the game keeps running.
- **CLI:** `gs <cart|dir>`, `gs pack <dir> <out.cart>`, `gs render-audio <desc.txt> <out.wav>`. The render-audio description grammar is documented
  in the comment above `safe_sound_path` / `render_audio`; the studio builds those descriptions in `studio/src/audio-core.js` (`AudioDesc`).
  If you change one side, change the other and the tests in `studio/test/synth*.test.mjs`, `audio-tracker.test.mjs`.
- **Environment:** `GS_MAX_FRAMES=N` exits after N frames (tests), `GS_SAVE_DIR` moves per-game saves (ALWAYS set it in tests), `GS_SOUNDFONT`
  overrides the SoundFont path, `SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy` for headless runs. The framework's own switches (`GS_DEV`, `GS_STATS`, `GS_FF`, `GS_BOT_LUA`, ...) are read by `engine/gs/boot.lua`, see `engine/AGENTS.md`.
- **SoundFont lookup** (`ensure_soundfont`): `$GS_SOUNDFONT`, `<exe dir>/TimGM6mb.sf2`, `<exe dir>/soundfonts/`, `<exe dir>/../assets/soundfonts/`. It is loaded lazily the first
  time a General MIDI instrument is defined; a missing file is a clear error, not a crash.
- Every cart has a `game.lua` (a plain `main.lua` is refused with a message); it takes its screen size from its console (`boot.lua` calls `gs.set_resolution`).

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

## Framebuffer output and measuring (devices with no display server)

When SDL finds no video device (Knulli on the RG35XX Pro: no `/dev/dri`), `main` falls back to `fb_open` / `fb_present`: the software renderer draws at the **console's own size** into
the top-left corner of a surface (viewport, no logical presentation), and `fb_present` enlarges it by a whole number into `/dev/fb0` (double buffered when the driver has two pages, centred, black bars).
Drawing at 640x480 instead cost about 19 ms a frame; this costs about 2.6 ms. Environment switches (all optional):

| Variable | Does |
| --- | --- |
| `GS_PERF=1` | One line a second (frames, average/worst ms for update, draw, render flush, copy + vsync, slow frames, audio lock wait, audio callback, Lua memory, the three costliest `gs.*` calls) and a line per slow frame. Kept in memory and written when the game ends: writing to an SD card while measuring made frames slow |
| `GS_PROF=1` | Sampling profiler for Lua (every 1000 instructions), the 25 busiest lines at exit |
| `GS_DEBUG_INPUT=1` | Prints joysticks, raw evdev key codes and presses (flushed with `fsync`) |
| `GS_MAX_SECONDS=N`, `GS_MAX_FRAMES=N` | Leave after N seconds / frames |
| `GS_DUMP_FRAME=file.bmp` | Saves the last frame (tests compare drawing paths with it) |
| `GS_EMBED=port`, `GS_EMBED_SIZE=WxH` | No window: draw with the software renderer at the console's size and send changed frames to the studio's Play panel on 127.0.0.1:port; take its buttons back (protocol in the "embedded preview" comment in `main.c`; `studio/src/play-core.js` reads it) |
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
