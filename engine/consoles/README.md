# Consoles

A console is a small JSON spec that says what a game made for it may use. A game names one in `game.lua` (`console = "glow43"`) and the framework reads the spec at start (`engine/gs/boot.lua`).
The studio reads these files too (new game, console editor, the Handheld panel).

Built in: **Glow43** (4:3, 256x192) and **Glow169** (16:9, 320x180). Both have the same features; only the screen differs.
A custom console is a copy of one of these with its own numbers (for example a 240x160 console). The studio keeps yours in `<workspace>/consoles/<id>.json`;
a game made for one carries a copy as `consoles/<id>.json` in its own folder (the studio writes and refreshes it), and that copy is what the runtime
reads, so the game runs the same on another computer and on the device.

## Fields

| Field | Meaning |
| --- | --- |
| `screen` | Logical resolution. `scale: "integer"` shows it at the largest whole-number scale that fits the real display, with bars around it. |
| `room_speed` | Game steps per second. |
| `palette` | `mode: "banks"` (Glow43, Glow169): GBA-style colour banks. `sprite_banks` and `tile_banks` (16 each) are how many banks a game's `palette.json` may hold, `bank_colors` (16) the places in a bank (place 0 is see-through), `color_bits` (15) the colour depth every bank colour is rounded to; `colors` are the 32 classic colours that games without a `palette.json` keep, and that palette numbers in code (`gs.draw.rect(..., 5)`) mean. Other modes: `fixed` (only `colors` exist), `limited` (at most `size` colours of your choice) and `free`. |
| `graphics.sprite_size` | Sprites are multiples of 8 pixels, up to 128x128 (raised from 64 on 2026-10-23: GBA proportions on the taller screen, see the Help page on sizes). |
| `graphics.tile_sizes` | Allowed tile sizes (Glow43 and Glow169: 8, 16 and 32). |
| `graphics.tileset_max` | Largest tileset sheet (Glow43 and Glow169: 512x512). |
| `rooms.max_width/height` | Largest room in pixels. Rooms bigger than the screen scroll. |
| `rooms.tile_layers` | Most tile layers in one room. |
| `rooms.parallax` | Tile layers may scroll at their own speed. |
| `audio` | `music_tracks` (how many of a song's eight tracks play; Glow43 and Glow169: 8, a typical GBA game's music) and `sfx_channels` (default 4) are separate voice pools; `style` is `clean` or `gba` (lo-fi output); `sample_rate` and `sample_max_seconds` limit imported samples (Glow43 and Glow169: 32000 and 8; the studio makes an imported WAV mono at that rate). |
| `input` | The buttons games can use. Glow43 and Glow169 list the RG35XX Pro's: d-pad, A B X Y, L R, L2 R2, Start, Select (no sticks, so no L3 R3). The handheld's HOTKEY is not a game button: HOTKEY + Start leaves the game. |
| `limits` | **Hard**: `instances_alive` (entities alive at once while the game runs; extra ones are ignored with one warning; enforced by the framework). `particles` caps `gs.burst` particles alive at once (extra ones are left out with one warning; they are not entities and do not count toward `instances_alive`). `instances_per_room` is in the spec as a ceiling but nothing enforces it yet. |
| `budgets` | **Soft**: the studio's Handheld tab shows a meter but still lets you build. `cart_kb` and `frames_per_sprite` are measured from the game's files. `visible_sprites` is a guideline. `collision_tests` (hitbox checks in one step: the collision pass and `touching()`) and `draw_screens` (pixels drawn in one frame, in screens, overlaps counted) come from tests on the device; the framework measures both while the game runs (`GS_STATS=1`: `checks` and `screens` in the `@@gs` line are the busiest step and frame of each second) and the Handheld tab shows them against the budget. |

A game that cannot keep 60 frames a second also warns once, whatever the console says (the runtime checks every 2 seconds), with where the time goes.
The numbers for Glow43 and Glow169 come from stress tests on an RG35XX Pro (normal CPU setting, with the runtime's adaptive CPU floor): 300 moving entities held 59 fps and 500 gave 49; 1,200 collision checks a step held 57 fps and 2,400 gave 34 (about 4 microseconds a check); six screens of see-through drawing still held 59 (render 5 ms); 300 particles, four wrapping tile layers and ten sound effects a second were all fine. So: `instances_alive` 512, `collision_tests` 1000, `draw_screens` 6, `particles` 300. Drawing is cheap, entities that think and collide are not. Void Swarm (100 to 200 entities alive) holds 60 fps on the device.

## Decisions to review

- **Hard limits** are the screen, the palette (and, in the studio, sprite sizes) and entities alive at once.
  Everything else is a soft budget. Say if anything should move between the two.
- **GBA-style rooms** means: rooms up to 1024x1024, one scrolling view, up to four tile layers with parallax,
  and a soft cap of 128 sprites visible at once (like the GBA's 128 hardware sprites).
- **Palette**: GBA-exact colour banks (decided 2026-10-23): 16 sprite banks and 16 tile banks of 16 places, 15-bit colour, one bank per sprite and
  one per tile, so up to 512 colours on screen. New games start with ready-made banks (`studio/src/palette-core.js`, `starterPalette`): three
  five-shade ramps each, shadows cool and highlights warm. The 32 classic colours (seven ramps of four plus four neutrals) stay for older games.
- **Not yet specified**: a code-size limit. `budgets.cart_kb` is 16384 (a typical GBA ROM).

## The limits are ceilings, not targets

| | A typical GBA-style game | Glow43 and Glow169 ceiling | Measured on an RG35XX Pro at 60 fps |
| --- | --- | --- | --- |
| Sprites on screen | tens (the GBA allowed 128) | 128 (budget) | |
| Entities alive | 20 to 100 | 512 (limit) | about 300 moving ones |
| Collision checks a step | tens to a few hundred | 1000 (budget) | 1,200 |
| Drawing, in screens | 1 to 2 | 6 (budget) | 6 |
| Particles | well under 100 | 300 (limit) | 300 |

The GBA numbers are general knowledge of the hardware (a 16.78 MHz ARM7, 128 hardware sprites, four tile layers composited for free), not measurements. The ceilings are what the handheld holds, so a game that
stays near the left column has plenty of room for modern touches (fades, see-through sprites, particles, more logic). The studio shows the typical figure next to each limit.
