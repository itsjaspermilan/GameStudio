# TODO

Open items, newest thinking first. Cross things out (or delete them) when they are done and checked on the device.

## Lua engine and studio (design in `docs/lua-engine-design.md`)

Housekeeping
- [x] `main` (one fresh commit) is pushed to `git@github.com:itsjaspermilan/GameStudio.git`.
- [ ] Void Swarm, Breakout, Panel Pop, Button test and Pad setup were pushed again on 2026-10-22 (plain launchers, new runtime with HOTKEY + Start, `.keys` files beside each launcher). Look at Void Swarm's new art and walk on the device. The old `stress.cart` test is deleted from the console.
- [ ] Void Swarm was only measured on the device in short early sectors. Play a late sector (7+, past 5 minutes) with `GS_PERF=1` and read `last-run-void-swarm.log`.

Games
- [x] Panel Pop and Doc Capsule are modules (`lib/`) and scenes; the generators write `lib/art.lua`. Seeded bot games give the same results as before.
- [x] `gs.legacy` and plain `main.lua` carts are removed (the button test, pad setup and the art tools' picture carts are framework carts now).

Studio
- [x] Room editor for `rooms/<name>.lua` (tile layers, entities, room size = camera bounds, paths; rooms with code open as text) and paths as plain data (`paths = { name = { {x, y}, ..., loop = true } }`, `Entity:follow_path`).
- [x] The app bundle carries the Lua language server (Tauri resources; the build fetches it for the target processor, arm64 or x64).
- [ ] Signing and notarizing the app (and the bundled `lua-language-server` binary inside it) for other Macs: needs your Apple developer certificate.
- [x] Editor extras: Tidy (our own Lua re-indenter; every Lua file in the repo already passes it), Go to symbol, Find in game with replace, LuaLS rename (F2) and references (Shift+F12) with fallbacks, tabs of recent files, a light theme.
- [x] Split view: a second Lua file beside the first (its own completion and save; the same file is never open on both sides).
- [x] Inspector tab: pause / step / slow motion, every kind with its count and update/draw/collision time, a kind's entities and one entity's values, watch expressions (engine/gs/inspect.lua over GS_INSPECT). Per Lua function stays with `GS_PROF=1`.
- [x] Sprite editor: a new sprite asks what it is (sizes from the guide), and "On the screen" shows it at real scale on the console's screen beside 16/24/32/48 squares.
- [x] Custom consoles can be named from `game.lua`: the game carries the spec as `consoles/<id>.json` (the studio writes it; new game and Change console list your consoles). On the device, `push.sh` names the system after it; check one there.
- [x] Help: `open:<game>` links ("Open Breakout" on the Welcome page), a First steps checklist on the welcome screen in place of the old tour, "More in Help" in the editor's hover tips.
- [x] "Make this game" has a console picker (Dot by default; the tutorials are laid out for 320x240).
- [ ] Studio's Handheld tab: the 3 ms-per-frame guide (computer time) is a guess; calibrate it against device measurements.

Framework (`engine/gs/`)
- [x] `collision_tests` and `draw_screens` are measured while a game runs (`GS_STATS`: busiest step and frame each second) and shown in the Handheld tab.
- [x] Particles: `gs.burst` (a pool capped by the console's `particles` limit, not entities).
- [x] `gs.camera.zoom` (the runtime's `gs.zoom` scales world drawing; UI stays 1x).
- [x] Small API gaps found while porting Void Swarm: `gs.in_radius` / `gs.in_rect` refill an optional list, `Entity:hit_radius()` (Void Swarm's enemies no longer copy `r`), `"#rrggbbaa"` colors. Fixed in passing: Void Swarm's comet kept its direction in `sx`/`sy` (the scale), so it flew down-right, stretched; check a comet sector on the device.
- [ ] Live reload is desktop-only on purpose; decide if a device build should ever reload.
- [ ] Collision broad phase is Lua (grid per tag, merged candidate lists): about 1.3x the cost of Void Swarm's hand-tuned tables on a desktop. Profile on the device if a game needs more.

## Performance (measured on the RG35XX Pro, Breakout, `GS_PERF=1 scripts/push.sh`)

Done, in order of effect (frame times: 34 ms at the start, 16.9 ms now; slow frames in a 40 s run: 40 or more, now 5; 34 of 38 seconds with none):
- Drawing at the console's own size and enlarging by a whole number while copying to `/dev/fb0` (render 19 ms -> 2.6 ms).
- Frame times near 1/60 s snapped to exactly 1/60 (no alternating 0 and 2 engine steps per frame).
- Tile layers drawn from one cached picture each (`gs.compose`): about 350 `gs.tile` calls a frame -> about 50.
- Starting and stopping sounds goes through a queue the audio thread empties; `gs.sfx_play` used to wait for the mixer (3 to 10 ms a call).
- The timing log itself had been slowing frames (writing to the SD card); it now stays in memory until the game ends.
- Measured and not the cause: event polling, Lua garbage collection, the CPU governor as such (full speed hides the problem; making the game cheaper fixes it without the battery cost; `GS_GOVERNOR=performance` remains an opt-in test switch).

Still open:
- [ ] Measured on the device so far: Breakout, and Void Swarm in early sectors. Run a real Dash game, a late Void Swarm sector, and a game with many fades, big alpha sprites and General MIDI instruments: the software renderer costs by pixels drawn and the audio thread by voices.
- [ ] The copy to the screen takes 3.1 ms; a copy thread would give that back at the price of one frame (17 ms) more input delay. Not done, not needed so far.
- [x] Collisions: the new framework uses a spatial grid per tag (see Lua engine and studio above for what is still open).
- [x] Limits and budgets tuned on the console (see `engine/consoles/README.md`): `instances_alive` 512, `particles` 300, `collision_tests` 1000, `draw_screens` 6. Not measured yet: scaled and rotated sprites (the software renderer's slow path), General MIDI voices, and a game with all of it at once.
- [x] **Clock lock-in at 30 fps** (a heavy scene made the CPU sit at about 790 MHz and the game at 30 fps, console cool): fixed by the adaptive CPU floor (`runtime/AGENTS.md`). On the console: 500 moving objects 29.6 -> 58.1 fps, 1,200 collision checks 34 -> 54 fps, light scenes stay at 480 to 640 MHz, floor restored to 480 MHz after the run. It takes about a second to notice lateness, so a heavy scene starts with a second at 30 fps. Possible later: a second step up to the maximum clock if frames are still late after a few seconds (2,400 checks stays at 28 fps at 1.2 to 1.3 GHz; it is over the 1,000-check budget anyway).
- [x] The studio shows what a typical GBA-style game uses next to each limit (tooltips in the console editor, a note in a busy room's status line); table in `engine/consoles/README.md`.
- [x] The `breakout-dash` speed-test cart is no longer on the console (only its old log in `/userdata/gs`).

## Knulli

- [ ] (paused) A Dash game end to end (e.g. Breakout on `console = "dash"`), seen on the console: Dash on the home screen, its list entry, playing it. The Dash system definition, logo and `knulli.conf` lines are on the console (an empty system stays hidden).
- [x] Custom system logos and carousel art, checked on the console: `assets/console-logos/dot.svg` (plain white "DOT", the O a solid circle) and `assets/console-art/dot.png` (the dotted panel) are installed by `push.sh`; the theme's "System logos" and "System view artwork" are Custom and stayed Custom after a restart. **Set them in the menu (UI settings > theme configuration):** editing `themesettings/*.cfg` with `scripts/knulli-theme.sh on` did not make EmulationStation use them at start-up (the menu still said Default); choosing Custom in the menu did. The script is kept for `off` and for reference.
- [ ] A steadier shared SSH connection. It drops when the console sleeps. Ideas: a launch agent on the Mac that reopens it, or a key that survives reboots (Knulli only keeps `/userdata`).
- [x] Debug launchers are off for Breakout, the button test and pad setup (checked on the console; `GS_DEBUG=1 scripts/push.sh` turns them on). The stress test's launcher has timing on until it has been run once; push it again without `GS_PERF` afterwards.

## Game info and the studio

- [x] Game info has Box art / Screenshot / Logo slots (sprite, PNG import, remove each), and "Take a screenshot" (runs the game headless for N seconds and keeps its frame).

- [ ] Try PNG import in the Game info dialog on a real PNG (the file picker could not be driven in testing).
- [ ] Check what the Knulli list shows for box art vs thumbnail on other themes (`<image>` and `<thumbnail>` are both written).
- [x] "Send to device" says plainly when `node` is missing and when the device connection was closed (studio and `push.sh`).

## muOS (parked)

- [ ] The device went back to Knulli after muOS gave a blank screen. `scripts/muos-deploy.sh` and the muOS notes are untested beyond the first launch. Remove them if muOS is not coming back.

## Decisions waiting on you

- [x] Console specs list L2 and R2 as well (the RG35XX Pro has A B X Y, L1 L2 R1 R2; no sticks).
- [ ] HOTKEY + Start quits (runtime: padmap `hotkey=` or the gamepad's guide button; `push.sh` also writes a `<launcher>.keys` file for Knulli's evmapy). Start + Select now only quits when held 3 s. Check on the device: push a game, press HOTKEY + Start; if the runtime cannot see the hotkey, run Pad setup (it now asks for it).
