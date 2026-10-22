# TODO

Open items, newest thinking first. Cross things out (or delete them) when they are done and checked on the device.

## Lua engine and studio (design in `docs/lua-engine-design.md`)

Housekeeping
- [x] `main` (one fresh commit) is pushed to `git@github.com:itsjaspermilan/GameStudio.git`.
- [x] Void Swarm, Breakout, Panel Pop, Button test and Pad setup were pushed again on 2026-10-22 (plain launchers, new runtime with HOTKEY + Start, `.keys` files beside each launcher). Void Swarm's new art and walk look good on the device; HOTKEY + Start works. The old `stress.cart` test is deleted from the console.
- [ ] Void Swarm, from the first look on the device: the orbit blades have a 16x16 sprite of their own and the pickups are 12x12 (hit circles grown to match); the music uses General MIDI bands instead of chip leads (kalimba, vibraphone, sax over electric piano, steel drums, koto, French horn, rock guitar, ...), one octave lower, loudness evened out. Listen on the device, and check the audio thread there with `GS_PERF=1` (on this Mac a callback takes about 0.2 ms).
- [ ] Void Swarm was only measured on the device in short early sectors. Play a late sector (7+, past 5 minutes) with `GS_PERF=1` and read `last-run-void-swarm.log`.

Games
- [x] Panel Pop and Doc Capsule are modules (`lib/`) and scenes; the generators write `lib/art.lua`. Seeded bot games give the same results as before.
- [x] Panel Pop on its own (Doc Capsule removed): a scene with a layout for every screen (`versus` runs `play`'s code), a light 16-bit look (pastel tile skies, window panels from a tileset, sprite fonts, outlines in each colour's own dark shade, a logo of letter panels) and General MIDI songs.
- [ ] Panel Pop's new look and songs on the device: the fonts and the sky layer, the see-through board wells, and the General MIDI music while panels pop.
- [x] `gs.legacy` and plain `main.lua` carts are removed (the button test, pad setup and the art tools' picture carts are framework carts now).

Studio
- [x] Room editor for `rooms/<name>.lua` (tile layers, entities, room size = camera bounds, paths; rooms with code open as text) and paths as plain data (`paths = { name = { {x, y}, ..., loop = true } }`, `Entity:follow_path`).
- [x] The app bundle carries the Lua language server (Tauri resources; the build fetches it for the target processor, arm64 or x64).
- [ ] (paused) Signing and notarizing the app (and the bundled `lua-language-server` inside it) for other Macs. When picked up: create a Developer ID Application certificate (Xcode > Settings > Accounts > Manage Certificates) and an App Store Connect API key (.p8, kept private); the build reads `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH` from your own shell, never from the repo. The bundled server binary must be signed too.
- [x] Editor extras: Tidy (our own Lua re-indenter; every Lua file in the repo already passes it), Go to symbol, Find in game with replace, LuaLS rename (F2) and references (Shift+F12) with fallbacks, tabs of recent files, a light theme.
- [x] Split view: a second Lua file beside the first (its own completion and save; the same file is never open on both sides).
- [x] Inspector tab: pause / step / slow motion, every kind with its count and update/draw/collision time, a kind's entities and one entity's values, watch expressions (engine/gs/inspect.lua over GS_INSPECT). Per Lua function stays with `GS_PROF=1`.
- [x] Sprite editor: a new sprite asks what it is (sizes from the guide), and "On the screen" shows it at real scale on the console's screen beside 16/24/32/48 squares.
- [x] Custom consoles can be named from `game.lua`: the game carries the spec as `consoles/<id>.json` (the studio writes it; new game and Change console list your consoles). On the device, `push.sh` names the system after it; check one there.
- [x] Help: `open:<game>` links ("Open Breakout" on the Welcome page), a First steps checklist on the welcome screen in place of the old tour, "More in Help" in the editor's hover tips.
- [x] "Make this game" has a console picker (Dot by default; the tutorials are laid out for 320x240).
- [ ] Studio's Handheld tab: the 3 ms-per-frame guide (computer time) is a guess; calibrate it against device measurements.
- [x] Folders in the side tree (code groups): they fold, have their own + and "new folder", and files drag between them. They are real folders (decided 2026-10-22): a move is a rename, and the plain places code names the file (module strings, `gs.spawn`, `gs.goto_scene`, `gs.load_room`, room entity lists) are rewritten; other mentions are reported. An empty folder made in the tree lasts until the game closes.
- [x] Panels resize: the side bar, the output and the split view (drag the line, double-click for the usual size, remembered). The editors' own side panels (sprite, room) are still fixed.
- [x] Embedded live preview: Run shows the game in a Play panel beside the code (Settings > Run games can keep the old window). The runtime runs without a window (`GS_EMBED`), draws with the software renderer the handheld uses at the console's size, and sends changed frames as colour runs over a local socket; keys go back the same way, sound plays from the runtime. Check it in the real app (only the mock and the runtime's side were tested here).
- [x] Scenes and rooms are one idea: a scene has a layout (`scenes/<name>.layout.lua`, the layout editor: tiles, entities, texts, pictures, paths) and code, switched in the editor bar. Named things are fields of the code (`self.logo`): completion, hover and typo warnings know them, and renaming one in the layout renames it in the code (and in other layouts that run the same code) on save. A layout can run another scene's code (`code = "level"`). New scenes get both halves. Help page "Layouts". Checked in the browser pane with the mock; try it in the app.
- [x] Void Swarm's title screen is a layout (two drifting background layers, planets, texts; the code moves them and marches the pilots): its frames are pixel for pixel what they were. Layers got `x, y` to slide them.
- [x] Void Swarm's other menus (hub, pilots, ship, weapons, sectors, results) have layouts for their fixed frame (background, bars, title, panels, labels); lists and numbers stay in code. All 24 test frames are pixel for pixel the same; the text audit still finds no overflow. Layouts gained tile panels (`panels = { { x, y, w, h, tileset, tile } }`, a 3x3 block of tiles stretched; the Panels tool) and sprite fonts for texts (`font = "spr_font"`, `gs.draw.font_text`); Void Swarm's panels are tiles now (`tilesets/ts_panel.png`), still pixel for pixel the same. Found in passing: Bulwark's three-line blurb runs into "STARTS WITH" on the pilots screen (kept as it was).
- [x] Conversations: `gs.say(name, text)` and `gs.ask(question, answers)` in a gs.go script (the world stands still, words type out and wrap onto pages, answers with a cursor); the box's look is the layout's `dialogue_box` panel, `dialogue_text` / `dialogue_name` texts and `dialogue_cursor` picture, a plain box without them. `gs.ui.menu(items, { at = text, cursor = picture })` takes its look from a layout the same way. Help page "Talking". Not done: dialogue files with branches and flags, and an editor for them (only if games need more than gs.say / gs.ask).
- [x] Folders in every group of the side tree (sprites, tilesets, sound effects, music, instruments, samples too): a folder is part of the name (`ui/logo`), the engine finds things in folders, and moving one rewrites what names it (code, layouts and rooms as data, sound files).
- [ ] Layouts, next steps: the MCP server's `room_view` / `room_write` only know `rooms/` (teach them scene layouts); offer to turn a room into a scene's layout; the layout editor's entity look ignores frames and scale.
- [ ] Simulating the console further in the Play panel: handheld speed (the computer is many times faster; slow the game by the measured device/desktop ratio, see the Handheld tab's 3 ms guess) and memory (Lua memory against what the console has). Not started.
- [x] Long lines wrap in the code editor (both sides of a split); Tidy wraps whole-line comments at 100 characters (the sample games and tutorials pass it).
- [x] On macOS the editor tabs have their close button on the left, shown on hover.

Framework (`engine/gs/`)
- [x] `collision_tests` and `draw_screens` are measured while a game runs (`GS_STATS`: busiest step and frame each second) and shown in the Handheld tab.
- [x] Particles: `gs.burst` (a pool capped by the console's `particles` limit, not entities).
- [x] `gs.camera.zoom` (the runtime's `gs.zoom` scales world drawing; UI stays 1x).
- [x] Small API gaps found while porting Void Swarm: `gs.in_radius` / `gs.in_rect` refill an optional list, `Entity:hit_radius()` (Void Swarm's enemies no longer copy `r`), `"#rrggbbaa"` colors. Fixed in passing: Void Swarm's comet kept its direction in `sx`/`sy` (the scale), so it flew down-right, stretched; check a comet sector on the device.
- [x] Live reload stays desktop-only (decided 2026-10-22).
- [x] Collision broad phase stays in Lua (grid per tag, about 1.3x hand-tuned tables on a desktop); closed 2026-10-22, reopen if a game gets slow.

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
- [x] A copy thread for the 3.1 ms screen copy: won't do (it would add a frame of input delay).
- [x] Collisions: the new framework uses a spatial grid per tag (see Lua engine and studio above for what is still open).
- [x] Limits and budgets tuned on the console (see `engine/consoles/README.md`): `instances_alive` 512, `particles` 300, `collision_tests` 1000, `draw_screens` 6. Not measured yet: scaled and rotated sprites (the software renderer's slow path), General MIDI voices, and a game with all of it at once.
- [x] **Clock lock-in at 30 fps** (a heavy scene made the CPU sit at about 790 MHz and the game at 30 fps, console cool): fixed by the adaptive CPU floor (`runtime/AGENTS.md`). On the console: 500 moving objects 29.6 -> 58.1 fps, 1,200 collision checks 34 -> 54 fps, light scenes stay at 480 to 640 MHz, floor restored to 480 MHz after the run. It takes about a second to notice lateness, so a heavy scene starts with a second at 30 fps. Possible later: a second step up to the maximum clock if frames are still late after a few seconds (2,400 checks stays at 28 fps at 1.2 to 1.3 GHz; it is over the 1,000-check budget anyway).
- [x] The studio shows what a typical GBA-style game uses next to each limit (tooltips in the console editor, a note in a busy room's status line); table in `engine/consoles/README.md`.
- [x] The `breakout-dash` speed-test cart is no longer on the console (only its old log in `/userdata/gs`).

## Knulli

- [ ] (paused) A Dash game end to end (e.g. Breakout on `console = "dash"`), seen on the console: Dash on the home screen, its list entry, playing it. The Dash system definition, logo and `knulli.conf` lines are on the console (an empty system stays hidden).
- [x] Custom system logos and carousel art, checked on the console: `assets/console-logos/dot.svg` (plain white "DOT", the O a solid circle) and `assets/console-art/dot.png` (the dotted panel) are installed by `push.sh`; the theme's "System logos" and "System view artwork" are Custom and stayed Custom after a restart. **Set them in the menu (UI settings > theme configuration):** editing `themesettings/*.cfg` with `scripts/knulli-theme.sh on` did not make EmulationStation use them at start-up (the menu still said Default); choosing Custom in the menu did. The script is kept for `off` and for reference.
- [ ] A steadier shared SSH connection. Key login cannot work on Knulli: root's home is `/userdata/system` on a FAT-style partition where every file is world-writable and cannot be chmod-ed, and dropbear refuses keys kept like that. Options: reopen the password connection from the Mac with the password in the Keychain (a script reading it needs your go-ahead), or set up the key on the console's own filesystem at boot (riskier).
- [x] Debug launchers are off for Breakout, the button test and pad setup (checked on the console; `GS_DEBUG=1 scripts/push.sh` turns them on). The stress test's launcher has timing on until it has been run once; push it again without `GS_PERF` afterwards.

## Game info and the studio

- [x] Game info has Box art / Screenshot / Logo slots (sprite, PNG import, remove each), and "Take a screenshot" (runs the game headless for N seconds and keeps its frame).

- [ ] Try PNG import in the Game info dialog on a real PNG (the file picker could not be driven in testing).
- [ ] Check what the Knulli list shows for box art vs thumbnail on other themes (`<image>` and `<thumbnail>` are both written).
- [x] "Send to device" says plainly when `node` is missing and when the device connection was closed (studio and `push.sh`).

## Decisions waiting on you

- [x] Console specs list L2 and R2 as well (the RG35XX Pro has A B X Y, L1 L2 R1 R2; no sticks).
- [x] HOTKEY + Start quits, checked on the device; game buttons are hidden while HOTKEY is held (runtime: padmap `hotkey=` or the gamepad's guide button; `push.sh` also writes a `<launcher>.keys` file for Knulli's evmapy). Start + Select now only quits when held 3 s. Check on the device: push a game, press HOTKEY + Start; if the runtime cannot see the hotkey, run Pad setup (it now asks for it).
