# TODO

Open items, grouped by where they can be done. Cross things out (or delete them) when they are done and checked on the device.

The target handheld is the **TrimUI Brick** on **NextUI** (1024x768, aarch64, PowerVR GPU; NextUI's platform name for it is `tg5040`), two of
them. NextUI replaced muOS on 2026-10-24: `push.sh` still has its Knulli and muOS modes, but they are no longer worked on. Glow43 became
**256x192** on 2026-10-23 (was 320x240) so it fills the Brick at exactly 4x; it was 320x240 again for one day (2026-10-26, for the
Anbernic RG35XX Pro's 640x480) and is back to 256x192 for the Brick. Glow169 (320x180) shows with bars above and below. The Anbernic
RG35XX Pro, Knulli, and the removed games (Void Swarm, Panel Pop, Then & Now, Kitchen Rush) are no longer worked on: their notes, the RG35XX
Pro performance measurements and everything finished before this list was regrouped are in git history (`git log -- TODO.md`).

Consoles were renamed on 2026-10-23: Dot is **Glow43** (G43) and Dash is **Glow169** (G169). Games that still say `console = "dot"` or
`"dash"` keep working (engine, studio, push and MCP map the old ids).

## On the Brick (NextUI)

Setting up
- [x] SSH (Native SSH from the Pak Store, after updating TrimUI's firmware to 1.1.1; the update made the NextUI card lose its `trimui/`
  folder, put back from the release) and the NextUI mode in `push.sh` (`scripts/device-brick.env`). Breakout pushed and runs.
- [x] Glow consoles run in NextUI's own emulator (minarch) with gs as a libretro core: NextUI's menu, buttons by label, L3/R3 as
  Select/Start, sleep, save and load state, Resume. Checked on the Brick 2026-10-24 with Breakout.
- [ ] Rewind (NextUI option, off by default) and a state of a bigger game: states are 13.9 MB (8 MB of RAM, the rest headroom); time
  saving one on the Brick, and the rewind with its compression.
- [x] The core draws on a GPU context of its own (runtime/gpu.c): heavy screen 3.9 / 4.9 / 6.8 ms for 100 / 200 / 400 stars, frames
  matching the CPU's, save states and Resume unchanged. Checked inside NextUI on the Brick 2026-10-24: Heavy (bench) smooth, menu,
  sleep, save/load state and Resume all work with minarch and the core sharing the GPU.
- [ ] (measurements that decided it) Drawing in the core on the CPU. Measured 2026-10-24 on the Brick (`tests/heavy`: full-screen
  background, three full-screen glows, N big scaled and turning stars, four full-screen fades; CPU at full speed), ms per frame:
  CPU core 21.0 (100 stars), 34.1 (200), 60.4 (400); glows and fades alone 7.8; Breakout 5.1. The program on the GPU (mali), update +
  drawing: 1.6 (100) and 4.2 (400), and with the frame copied back into memory each frame (`GS_READBACK=1`, what a GPU core pays)
  4.3 and 7.9, worst 12.2. Decide how the core gets a GPU (see the conversation of 2026-10-24).
- [ ] Glow43's RAM is fixed at 8 MB in `runtime/ram.c`; make it a console spec field once games show what they need.
- [ ] The second Brick: its own `scripts/device-<name>.env` and a fixed IP.

Seeing and playing
- [ ] Breakout and the tutorials fill the screen with no border; the built-in fonts (round, square, bold; small and tall), the
  hand-drawn square letters, their shadows and the button icons ({a} in texts, each style) read well at 4x.
- [ ] Play from the NextUI menu (not over SSH): every button, a way back to the menu (the Brick's MENU button: does SDL see it as our
  HOTKEY? HOTKEY + Start, Start + Select held 3 s), volume and brightness keys while a game runs, the power button (sleep and wake, or at
  least not a broken game), and what happens to saves when the battery runs out.
- [ ] Mosaic transitions (`look = "mosaic"`): in the core they are drawn on the CPU like everything else; check they look right.
- [ ] Covers and previews: `make-cart-art.mjs` makes 240x300 covers (sized for muOS) and 640x480 previews; see how NextUI lays box art out
  at 1024x768 and resize if needed.
- [ ] A game on a custom console: it should become its own system in the NextUI menu; check one.

Measuring (`GS_PERF=1`)
- [ ] Frame pacing on the GPU path: the RG35XX Pro showed a few more single late frames there than on the framebuffer path (the wait for
  the screen ran to 22 ms). See whether the Brick does too, and whether it is the overlay library, the CPU clock or the driver.
- [ ] A heavy screen: big glowing layers (blend "add" and "darken"), scaled and rotated sprites, many fades, and an 8-track General MIDI
  song with reverb (the audio callback time). Then everything at once.
- [ ] The console limits (`instances_alive` 512, `particles` 300, `collision_tests` 1000, `draw_screens` 6) were tuned on the RG35XX Pro;
  re-tune them on the Brick (`engine/consoles/README.md`).
- [ ] The adaptive CPU floor (`runtime/AGENTS.md`) was built for the RG35XX's cpufreq and only runs on the framebuffer path; check what the
  Brick's clock does under load and whether it needs the same help.
- [x] The studio's frame guide calibrated against the Brick (2026-10-24, GPU core, `retro-run` on the device): Breakout 2.1 ms; heavy
  screen 3.1 (no stars) / 4.2 / 4.9 / 6.9 (100 / 200 / 400 stars); 100 / 200 / 300 moving, colliding things (`GS_HEAVY_THINGS`) 6.6 /
  13.1 / 20.3. All eight fit, within about 0.3 ms, 0.34 ms per screen drawn + 10.6 x the update time on an M4
  (`studio/src/brick-core.js`): the Handheld tab and the Play panel show "Time per frame on the Brick" instead of the 3 ms guide.
- [ ] The Brick estimate's Lua ratio (10.6) is for the M4 the studio runs on; on another computer it is off by that computer's speed. If
  the studio goes to other machines, time a fixed Lua loop at start-up and scale by it. Worst frames: heavy Lua runs on the Brick had
  single frames of 106-124 ms (garbage collection?); see whether a game hits them. Not garbage collection in a survivors game: on the RG35XX
  Pro, 300 bats and an 8-track General MIDI song in the core ran 3,480 frames with the worst at 17-18 ms, and Lua's generational
  collector changed nothing (11.1 ms average either way; 2026-10-27).

## Measured 2026-10-27 (Anbernic RG35XX Pro on Knulli: the Brick's CPU class, Cortex-A53 at 1.5 GHz against the Brick's 1.8)

`tests/survivors` (hero, N bats chasing and pushing apart, bolts, gems, sparks), Lua ms a frame. The collision grid was rewritten (one cell
per box, boxes in flat arrays, exact test in the query, only hits sorted): 300 bats moving 19.6 -> 11.3, 500 moving 42 -> 20.8, 500 in a
still crowd 133 -> 29.5, tests/heavy's 300 movers 8.8 -> 6.0. A frame of 300 bats is now: entity code 1.4, movement + animation 0.65,
collisions 8.5, drawing (CPU) 5.9. The core's GPU path works on Knulli's Mali too (heavy 0/100/400 stars: 4.5/6.8/12.1 ms GPU against
9.3/25.7/74 CPU). 512x384 instead of 256x192 doubled the GPU frame (8.1 -> 15.6 ms with nothing drawn, 15.1 -> 26.8 with 400 stars) and
quadrupled the CPU one, so Glow43 stays 256x192 (4x on the Brick). Music in the core runs on the game's thread: 8 General MIDI tracks
with reverb 2.6 ms a frame, 8 chip tracks 1.7.
- [x] Collision broad phase in C (`gs.raw.grid_build` / `grid_query`, 2026-10-27). RG35XX Pro, Lua update a frame: 300 bats moving
  11.3 -> 8.4 ms, 500 moving 20.8 -> 11.4, 500 in a still crowd 29.5 -> 11.0, tests/heavy's 300 movers 6.0 -> 4.2; the collision pass of
  300 bats 8.5 -> 4.8. Measuring each box once a step (a query reuses its grid's) took 3-4% more off on the RG35XX Pro (5.5 -> 5.3 ms
  for 300 bats in a still crowd); what is left is mostly the calls into the game's own on_collide handlers, one per touching pair.
- [x] The core mixes sound on a thread of its own while the frame runs (2026-10-27; runtime/AGENTS.md). RG35XX Pro, 300 bats and an
  8-track General MIDI song: 13.2 -> 10.1 ms a frame (95%: 16.6 -> 12.4). A nearly empty game gains less (3.5 -> 2.75): its frame waits
  for the mix.
- [ ] The studio's Brick estimate (`brick-core.js`, 10.6 x update time) was fitted before the C grid: Lua that now runs in C makes the M4's
  update shorter by about the same share as the Brick's, so it should still hold; refit with the Brick.
- [ ] Re-run `tests/survivors` on the Brick when it is on the network (CPU at full speed, `GS_PERF=1`), and check the studio's estimate.

## Found by the four GlowGames (2026-10-28)

Four games were built in `~/Developer/GlowGames` to test the engine: `chess` (Pocket Chess), `quest` (Lampwick, a text RPG), `party`
(Lantern Isles, a party board game) and `platformer` (Lantern Leap). Each agent reported what it ran into; this is the whole list.
Items several games hit (and solved for themselves, each its own way) are marked (xN).

Done (2026-10-28, not yet committed)
- [x] `gs.volume(music, sfx)` for settings menus (x4: every game could only turn music on and off).
- [x] `gs.now()`: game time that follows steps, `gs.time_scale`, fast-forward and the studio's Pause; `gs.time()` (the computer's clock)
  documented as such (x4: menus timed with it dropped bot presses under fast-forward).
- [x] Saves are written at the end of the frame, not mid-step (0.4 ms on the Mac, about 4 ms estimated on the Brick); `gs.save.delete`
  (x2); `gs.quit()` writes pending saves and flushes printed output (a bot's prints were lost).
- [x] `gs.background(color)` from code (x2).
- [x] A Lua error stops the game on the error screen even without `GS_DEV` (it went on stepping half-finished, 6000+ errors).
- [x] `GS_FIXED_STEP=1`: one step a frame, no waiting, so headless runs repeat exactly and `GS_MAX_FRAMES` is step N (x3); the MCP `run`
  tool uses it and passes a game's own `GS_*` switches (`env`); the false "runs at 51-52 frames a second" warning on light headless runs
  is gone (x4).
- [x] `GS_DUMP_FRAME` writes a plain 24-bit BMP that macOS can open (x3).
- [x] Curly quotes, dashes and Latin-1 accents draw as their ASCII look-alikes, in the runtime and the studio's text measure.
- [x] Camera `smooth` documented the right way round (bigger is quicker); scene hook names (`enter`, `leave`, ...) documented as reserved.
- [x] The Mac runtime runs at interactive QoS (the same Lua timed up to 3x apart, which made the Brick estimate noisy).
- [x] MCP: `song_write` fills in defaults for everything but the key (x3); `sprite_write` no longer cycles the frames of a sheet unless
  asked (`fps`).
- [x] Checker: no "no file called" for names joined with `..` (x2), no "new table every step" inside `if <button press> then`.
- [x] The GBA output stage: 10-bit steps with dither instead of 8-bit (quiet music crackled; heard in chess).

Done the same day, after the four games (not yet committed)
- [x] Tile collisions: a layer's `solid` now means something. `self:slide(dx, dy)` moves a hitbox through the solid layers and stops at
  their tiles (every cell on the way is checked, so nothing tunnels); a tileset's `kinds` name tiles `oneway` (landed on from above,
  `self.drop_through` falls through) or anything else the game asks about (`self:touching_tile("spike", inset)`, `gs.tile_kind`). The
  tileset editor has a Kind tool and the layout editor a Solid switch. No slopes (a game that wants them reads the tiles).
- [x] `gs.ui.menu`: disabled rows (skipped, dim), left/right values with `on_change`, `hint`s, held up/down repeats, B returns
  `"back"`, Start no longer picks (`opts.start = true` for the old way), `opts.width` right-aligns values.
- [x] `gs.say` / `gs.ask`: holding A or B types four times as fast, `gs.ui.style.text_speed` and `on_letter` (a blip), `{ auto = s }`
  goes on by itself (CPU turns), answers can be `{ "SELL", enabled = false }`, `{ back = n }` lets B answer.
- [x] `gs.draw.panel` is a GBA window: rounded light border, an inner line, a dark blue fill (`inner = false` for none).
- [x] `gs.draw.bake(name, w, h, fn)` draws once into a picture (a render target read back into an ordinary picture, so save states
  rebuild it from its pixels) and `gs.draw.picture` shows it. The same on the program, in the core and after a resume (tests/bake).
  Also found: circles were drawn with thin lines that the window and software renderers rasterised differently (a one-pixel nub at
  top and bottom on one only); now whole-pixel rows, the same everywhere.
- [x] Drawing without garbage: `gs.draw.text`'s options can be just a font's name; the engine's own menu and layout text no longer make
  an options table per call; the checker's hint says to make options once at the top of the file.
- [x] Rooms up to 4096x1024 on Glow43 and Glow169 (a 4096x1024 room with four full layers: 5.6 ms a frame, 345 ms to build, 29 MB more
  memory on the RG35XX Pro's GPU path).
- [x] `gs.scene_name()`; scenes have `self:after` / `every` / `go` / `tween`; `gs.remove_layer`, `gs.set_tileset`; an entity's own
  hitbox (`self:set_hitbox`, or `hitbox` given to `gs.spawn`); the update order documented (Entity:update, the platformer help).
- [x] Tracebacks name a shared method after the class that defines it ("Entity:play", not "entities.stagectl.play"); an error inside a
  `gs.go` script shows where in the script.
- [x] Layout preview and `room_view`: a layer's x/y and wrap; kinds made with `gs.entity(Base, { ... })` show their (or their parent's)
  sprite; `room_view` found no sprite for kinds in folders (`enemies.beetle`).
- [x] Test bots: `bot_load("other.lua")` beside the bot, `GS_START_SCENE`, `GS_DUMP_EVERY=n` (every nth frame, not only the last),
  keys-bot holds several buttons (`right+a*20`) and has `quit`; the MCP `run` tool takes `scene`, `bot_lua` and `shots`. Also fixed:
  the run tool's `env` schema broke the whole MCP tool list under zod 4.
- [x] `song_write` says why when `inst` is not 4 or 8; a mode is saved as the major key with the same notes (D phrygian as Bb major).
- [x] Checker: Tidy put `end },` and a `for ... do` split over lines at the wrong indent (the "indentation is off" the games saw); no
  "new table every step" for tables handed to one-off calls (burst, goto_scene, spawn, tween, save, ...); a hint for letters the fonts
  cannot draw (an ellipsis).
- [x] Docs: sound effect pitch numbers (0 = C1, 48 = C5), what a pause and gs.say stop, the camera following any table with x and y.

Still open
- [ ] Check `gs.draw.bake` on the handheld's GPU (EGL): the build is ready, the Anbernic went to sleep before the run. Compare
  tests/bake with and without GS_BAKE_PLAIN in retro-run on the device.
- [ ] The Brick estimate leaves out the Lua of drawing (a text-and-rectangle UI spends its Lua time there): refit with the Brick.
- [ ] Slopes, if a game wants them in the engine rather than its own code.

The games themselves
- [ ] Lantern Leap's final boss (the Gloom Regent) was never beaten by the autopilot, even made easier: play it by hand.
- [x] The four games moved onto `gs.ui.menu`, `Entity:slide` and `gs.draw.panel` (2026-10-28). What they needed went into the engine:
  `solid_kinds` in a tileset (ice and crates still stop things; studio: "Stops like a wall"); menu options `font`, `shadow`, `indent`,
  `cursor` as a function, `skip = false` (the cursor stops on greyed rows to read why, A is refused with `style.on_refuse`), `cycle`
  (A steps a setting), `roll = false` (for a menu the game draws itself, as Lampwick's lists shared with its text box); `style.value`;
  no arrows on a value that cannot change; and the panel's bevel (`light`, `shade`, `fill2`, `round = 2`), the window all four games had
  drawn by hand. Found on the way: a menu row given as a plain string drew "false" after its label. On the new physics Lantern Leap's autopilot
  plays 13 of 15 stages and bosses exactly as on the game's own (times, deaths, pickups; the final boss was left out); in w3_3 and w4_2 it now loses no lives,
  because the old code shrank the box by half a pixel when looking for floors and slide uses the exact box, so a jump that grazes a
  ledge's corner lands on it.
- [ ] Lampwick's text box and Lantern Party's messages are still their own (speaker tabs and colours, a font setting, CPU messages
  that hold): gs.say cannot do those yet. Worth a look when gs.say gets a speaker style.

## Studio and engine (no device needed)

- [x] FluidR3 Mono GM (MIT) replaced TimGM6mb (GPL-2), 2026-10-27, cut down per game (`runtime/sfbank.c`, `runtime/AGENTS.md`):
  Breakout carries 230 KB of it; a test song with seven General MIDI instruments over 2.5 octaves and drums 6.1 MB (the grand piano alone
  is 3.9 MB for the whole keyboard). The whole bank as plain samples would be 119 MB; decoding all of it took 13.4 s on the RG35XX Pro,
  so carts carry plain 16-bit samples and the handheld never decodes. The 16 built-in instruments louder than the rest by over 4 dB were
  turned down to match (`engine/instruments.json` volume).
  The Handheld tab's game size counts the bank (`gs soundfont-size`). On the RG35XX Pro a cart with the 6.1 MB bank starts in 846 ms
  cold / 549 warm, Breakout's (230 KB) in 701 / 283: the bank adds about 0.15-0.27 s.
- [x] The 16 MB breach (2026-10-28): Lantern Leap was 25.1 MB, Lantern Isles 23.6, Lampwick 19.8, all but 0.5 MB of it General MIDI
  samples (15-30 instruments a game; strings, brass and the drum kit 2.5-4.7 MB each), and nothing outside the studio's Handheld tab
  compared a game with its budget. Cutting inaudible tails or notes held past their length saved under 10% (the samples are short
  loops after a real attack), so the cart now packs the samples without loss (`sfbank_pack`): 14.5 / 11.6 / 10.6 MB, Pocket Chess 10.1 to
  4.4, the sound identical to the bit (tests/run.sh compares the WAV). The MCP `check` prints the game size against the budget and
  `push.sh` warns when a game is over.
- [x] Unpacking on the Brick Pro (2026-10-28): Lantern Leap (13 MB of packed samples) starts in 2.0 s instead of 1.65 s (0.21 s
  instead of 0.17 s on the Mac). If that 0.35 s ever matters, unpack on a thread while the title screen runs.

- [x] On the Anbernic (Knulli's RetroArch), 2026-10-28: Glow43 showed in the top-left corner (RetroArch's integer scaling used Knulli's
  custom viewport at 0,0; `push.sh` now writes a centred viewport at the largest whole scale, 512x384 on 640x480) and quiet music
  crackled (the GBA output stage rounded to 8 bits without dither: 15 levels under an eighth of full scale; now 10-bit steps with
  dither, 63 levels; the core's own sound had no clicks, checked with `RETRO_WAV` in tests/retro-run). The crackle stayed: the panel
  runs at 59.033 Hz (fbset) and RetroArch, not told, ran the game 1.6% slow against a speaker it took for 60 Hz, past its 0.5%
  correction; `push.sh` now writes the measured video_refresh_rate. Both confirmed on the device.
- [ ] Chess (`~/Developer/GlowGames/chess`) two-device mode once `gs.net` exists (docs/netplay-design.md, still unbuilt): decided
  2026-10-27 to ship single player, learn mode and settings first.

- [ ] Our own General MIDI bank, generated with ChucK (MIT/GPL, Stanford CCRMA; a tool on the Mac only, never on the handheld): ChucK
  scripts in `tools/soundbank/` render each instrument at a few pitches (its Synthesis ToolKit has plucked strings, mallets, flutes,
  reeds, electric pianos, organ, FM and Moog voices, shakers), find loop points after the attack, and build an SF2 (reuse sfbank.c's
  writer). Synthesized notes loop cleanly, so an instrument needs well under a second of sound: a whole bank could be a few MB, where
  FluidR3 cut down for one 7-instrument song is 6.1 MB, and it would be ours (FluidR3's INFO still says "do not redistribute", left from
  before its MIT release). Pilot: about 12 instruments synthesis does well (chip and square leads, synth basses, pads, bells and mallets,
  plucks, an 808/909-style kit), compared with FluidR3 by size, loudness (the 50 ms window measure) and by ear; keep FluidR3 for
  acoustic instruments (piano, strings, choir, brass) unless the generated ones hold up.

- [ ] Try in the real app (only the browser mock was clicked through): Open folder…, New game asking where, Examples opening a copy of
  Breakout, Make this game asking where, the recent list (× forgets one), Show folder, reopening a game coming back to its tabs, the Play
  panel, switching a scene between its Layout and Code, Game info's button icon picker (writes `buttons = ...` into game.lua), the
  pictures in Help, and a `.gamestudio/.gitignore` appearing in a game kept in git.
- [ ] Try in the real app what the one-way cleanup added (2026-10-24, branch one-way-cleanup; only the browser mock was clicked): a new
  game opening on its main scene with the player in the layout, the sprite editor's Make an entity with it, a room's Make it a scene
  layout (on an older game with rooms/), Game info changing the title in game.lua, and the console-change report listing levels.
- [ ] `docs/help/img/step-layout.png` still shows the layout editor's old "Things" tool and "Layout" side tab (now Entities and Details):
  take the picture again.
- [ ] The collision grid now sizes its cells to the things in it (about a third faster on the M4); see whether the Brick's frame for
  `GS_HEAVY_THINGS=300` drops from 20.3 ms as the estimate expects.
- [ ] Try PNG import in the Game info dialog on a real PNG (the file picker could not be driven in testing).
- [ ] Help pages can show pictures now (`docs/help/img/`, two in "Make a game, step by step"); add more where a beginner would look for one
  (the sprite editor with colour banks, the Play panel, Send to device).
- [x] The Play panel plays like the Brick (2026-10-24): Lua in the core's fixed 8 MB RAM (`GS_RAM=1`, runs out at the same step:
  `tests/ramhog`), RAM in use and the estimated Brick frame under the screen and in the Handheld tab, Save state / Load state. It still
  runs the program, not the core: sound, live reload and the Inspector stay as they are, and the core's frames match the program's.
- [ ] Maybe: slow the Play panel down to the Brick's speed (hold each frame to the estimate) so a too-slow game also *feels* too slow.
- [ ] (paused) Signing and notarizing the app (and the bundled `lua-language-server` inside it) for other Macs; only needed to hand the
  studio to someone else. When picked up: create a Developer ID Application certificate (Xcode > Settings > Accounts > Manage
  Certificates) and an App Store Connect API key (.p8, kept private); the build reads `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`,
  `APPLE_API_KEY`, `APPLE_API_KEY_PATH` from your own shell, never from the repo. The bundled server binary must be signed too.
