# TODO

Open items, grouped by where they can be done. Cross things out (or delete them) when they are done and checked on the device.

The target handheld is the **TrimUI Brick** on muOS (1024x768, aarch64, PowerVR GPU), two of them. Glow43 became **256x192** on
2026-10-23 (was 320x240) so it fills the Brick at exactly 4x; Glow169 (320x180) shows with bars above and below. The Anbernic RG35XX Pro,
Knulli, and the removed games (Void Swarm, Panel Pop, Then & Now, Kitchen Rush) are no longer worked on: their notes, the RG35XX Pro
performance measurements and everything finished before this list was regrouped are in git history (`git log -- TODO.md`).

Consoles were renamed on 2026-10-23: Dot is **Glow43** (G43) and Dash is **Glow169** (G169). Games that still say `console = "dot"` or
`"dash"` keep working (engine, studio, push and MCP map the old ids).

## On the Brick, when it arrives

Setting up
- [ ] One device file per Brick (`scripts/device-<name>.env` from `device-muos.env.example`, a fixed IP in the router each), then
  `GS_DEVICE=<name> scripts/push.sh carts/breakout`. Check muOS's paths on the Brick match the example (`/mnt/mmc/gs`, `/mnt/mmc/ROMS`).

Seeing and playing
- [ ] Breakout and the tutorials fill the screen with no border; the built-in fonts (round, square, bold; small and tall) and their
  shadows read well at 4x.
- [ ] Play from the muOS menu (not over SSH): buttons in both the "modern" and "retro" layouts, HOTKEY + Start, Start + Select held 3 s,
  and muOS's volume, brightness and battery overlays.
- [ ] Mosaic transitions (`look = "mosaic"`) read the frame back from the GPU (`SDL_RenderReadPixels`); see whether they stutter on the
  PowerVR driver (only the few frames of a transition do it). The GPU-only mosaic below would remove the question.
- [ ] Covers and previews: `make-box-art.mjs` makes 240x300 covers and 640x480 previews for the RG35XX's 640x480 list; see how muOS lays
  them out at 1024x768 and resize if needed.
- [ ] A game on a custom console: `push.sh` names the muOS system after it; check one there.

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

- [ ] GPU-only mosaic: draw the frame into a small texture and scale it back up with nearest-neighbour, instead of reading pixels back.
  Faster everywhere and no readback on PowerVR.
- [ ] Try in the real app (only the browser mock was clicked through): Open folder…, New game asking where, Examples opening a copy of
  Breakout, Make this game asking where, the recent list (× forgets one), Show folder, reopening a game coming back to its tabs, the Play
  panel, and switching a scene between its Layout and Code.
- [ ] Try PNG import in the Game info dialog on a real PNG (the file picker could not be driven in testing).
- [ ] Help pages have no pictures yet; screenshots of the layout editor in "Make a game, step by step" would help beginners most.
- [ ] Layouts, next step: offer to turn a room into a scene's layout.
- [ ] Maybe: a game's own studio settings in `.gamestudio/` (its device, run in a window or the panel), and a `.gitignore` line for it in
  new games.
- [ ] Later, once the Brick is measured: simulate the console in the Play panel (slow the game by the measured device/desktop ratio; Lua
  memory against what the console has).
- [ ] Polish when wanted: hand-drawn square letters (now made from the round ones); window open/close animations; GBA-style button icons
  in hint rows instead of "A:" text.
- [ ] (paused) Signing and notarizing the app (and the bundled `lua-language-server` inside it) for other Macs; only needed to hand the
  studio to someone else. When picked up: create a Developer ID Application certificate (Xcode > Settings > Accounts > Manage
  Certificates) and an App Store Connect API key (.p8, kept private); the build reads `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`,
  `APPLE_API_KEY`, `APPLE_API_KEY_PATH` from your own shell, never from the repo. The bundled server binary must be signed too.
