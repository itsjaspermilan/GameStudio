# TODO

Open items, grouped by where they can be done. Cross things out (or delete them) when they are done and checked on the device.

The target handheld is the **TrimUI Brick** on **NextUI** (1024x768, aarch64, PowerVR GPU; NextUI's platform name for it is `tg5040`), two of
them. NextUI replaced muOS on 2026-10-24: `push.sh` still has its Knulli and muOS modes, but they are no longer worked on. Glow43 became
**256x192** on 2026-10-23 (was 320x240) so it fills the Brick at exactly 4x; Glow169 (320x180) shows with bars above and below. The Anbernic
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
- [ ] Drawing in the core is on the CPU (minarch gives cores no GPU). Measured 2026-10-24 on the Brick (`tests/heavy`: full-screen
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
- [ ] Calibrate the studio Handheld tab's 3 ms-per-frame guide (computer time) against the Brick's numbers.

## Studio and engine (no device needed)

- [ ] Try in the real app (only the browser mock was clicked through): Open folder…, New game asking where, Examples opening a copy of
  Breakout, Make this game asking where, the recent list (× forgets one), Show folder, reopening a game coming back to its tabs, the Play
  panel, switching a scene between its Layout and Code, Game info's button icon picker (writes `buttons = ...` into game.lua), the
  pictures in Help, and a `.gamestudio/.gitignore` appearing in a game kept in git.
- [ ] Try PNG import in the Game info dialog on a real PNG (the file picker could not be driven in testing).
- [ ] Help pages can show pictures now (`docs/help/img/`, two in "Make a game, step by step"); add more where a beginner would look for one
  (the sprite editor with colour banks, the Play panel, Send to device).
- [ ] Layouts, next step: offer to turn a room into a scene's layout.
- [ ] Later, once the Brick is measured: simulate the console in the Play panel (slow the game by the measured device/desktop ratio; Lua
  memory against what the console has).
- [ ] (paused) Signing and notarizing the app (and the bundled `lua-language-server` inside it) for other Macs; only needed to hand the
  studio to someone else. When picked up: create a Developer ID Application certificate (Xcode > Settings > Accounts > Manage
  Certificates) and an App Store Connect API key (.p8, kept private); the build reads `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`,
  `APPLE_API_KEY`, `APPLE_API_KEY_PATH` from your own shell, never from the repo. The bundled server binary must be signed too.
