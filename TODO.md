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
- [ ] SSH: NextUI has none built in. Install an SSH server pak from NextUI's Pak Store (Tools), start it, note the Brick's IP (fixed in the
  router, one per Brick).
- [ ] Look at the card over SSH before writing anything: where `/mnt/SDCARD` keeps `Roms/`, `Emus/tg5040/`, `Tools/tg5040/`, `.media`
  folders and saves, which `libSDL2-2.0.so.0` a pak gets (the system's, or one NextUI ships) and its video driver, and what a pak's
  `launch.sh` is given (environment, `SDL_GAMECONTROLLERCONFIG`, the CPU governor).
- [ ] A NextUI mode in `push.sh` (`DEVICE_OS=nextui`, `scripts/device-<name>.env` per Brick), written from what the card shows. The likely
  shape, to confirm: each console a system of its own, `Roms/Glow43 (G43)/<cart>` launched by `Emus/tg5040/G43.pak/launch.sh`; carts with
  no console as `Tools/tg5040/<Cart>.pak`; covers in `Roms/<system>/.media/`.

Seeing and playing
- [ ] Breakout and the tutorials fill the screen with no border; the built-in fonts (round, square, bold; small and tall), the
  hand-drawn square letters, their shadows and the button icons ({a} in texts, each style) read well at 4x.
- [ ] Play from the NextUI menu (not over SSH): every button, a way back to the menu (the Brick's MENU button: does SDL see it as our
  HOTKEY? HOTKEY + Start, Start + Select held 3 s), volume and brightness keys while a game runs, the power button (sleep and wake, or at
  least not a broken game), and what happens to saves when the battery runs out.
- [ ] Mosaic transitions (`look = "mosaic"`) stay on the GPU now; check they look right on the PowerVR driver.
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
