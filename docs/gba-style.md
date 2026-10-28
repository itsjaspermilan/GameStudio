# What makes a game look, sound and play like a GBA game

Research notes from 2026-10-23, written to steer the overhaul of Panel Pop and Void Swarm and anything made after them. The point is
the difference between the GBA era and the NES and SNES eras before it, since that is where our games kept slipping. Sources are at the
end; the rest is from studying the games themselves (Minish Cap, Golden Sun, Advance Wars, Mother 3, Metroid Fusion and Zero Mission,
Sonic Advance, Kirby: Nightmare in Dream Land, Mario & Luigi, Pokémon Emerald and FireRed, Dr. Mario & Puzzle League, Gradius
Galaxies, Iridion II).

## The hardware, and what it pushed games towards

| | NES | SNES | GBA | Glow43 (ours) |
| --- | --- | --- | --- | --- |
| Screen | 256x240 | 256x224 | 240x160 | 256x192 (4x on the TrimUI Brick's 1024x768) |
| Colours | 54 fixed | 32,768, 256 on screen | 32,768, 512 on screen (16 banks of 16 for tiles, 16 for sprites) | the same banks (`palette.json`) |
| Sprites | 64, 8x8 or 8x16, 3 colours | 128, up to 64x64, 15 colours | 128, 12 shapes from 8x8 to 64x64, 15 colours, rotate and scale (32 at once) | entities, up to 128x128, any angle and scale |
| Effects | none | colour maths, mode 7 | alpha blending in 17 steps, fade to white or black, mosaic, two windows | blending (add, darken, alpha), fades, **mosaic and white fades: added in this overhaul** |
| Sound | 5 chip channels | 8 sampled voices, echo | 2 PCM channels mixed in software (usually 5 to 8 sampled voices) + the Game Boy's 4 chip channels | 8 music + 4 effect voices, samples, General MIDI, reverb |

Three facts shaped the look more than any other:

- **The screen was small and unlit.** Colours were pushed brighter and more saturated so they showed at all, backgrounds went light
  and busy shapes went simple. Our screen is backlit, so we want the GBA's *clarity* (light backgrounds, big readable shapes, strong
  value contrast) without its bleached extremes: one notch less saturation than a GBA rip, never pure white fields.
- **Sixteen colours a sprite, sixteen banks.** Every object gets a 4 to 6 step ramp per material with a coloured (never pure black)
  darkest step. That is the single biggest visible difference from the NES's three colours a sprite.
- **Rotation, scaling and blending were cheap.** GBA games are full of see-through windows, glowing additive sparks, bosses that turn
  and swell, mosaic dissolves between scenes and white flashes on hits. The SNES had some of this; the GBA used it everywhere,
  because it was cheap.

## Art

**Sprites.** Selective outlines: the outline is a dark shade of the colour beside it (dark green round a green slime, dark brown round
hair), lit edges drop the outline entirely, and only the lowest edge, against the ground, may be near-black. Light comes from the top
left; each material has highlight, base, one or two shades and the coloured outline. Proportions are chunky and friendly (big heads,
2 to 3 heads tall for heroes in Minish Cap, Golden Sun, Mother 3; Metroid and Sonic go taller). Eyes are big and readable at a glance.

**Sizes, by kind of game** (GBA pixels, then the same share of Glow43's taller screen; `docs/help/91-sizes.html` has the table):

| Game | Hero on GBA | On Glow43 | Note |
| --- | --- | --- | --- |
| Top-down adventure (Minish Cap, Golden Sun field) | 16x24 to 16x32 | 24x32 to 32x32 | tiles 16x16, rooms one to three screens |
| Platformer (Sonic Advance, Kirby, Zero Mission) | 24x32 to 32x40 | 32x48 | the camera leads in the running direction |
| Shoot-'em-up (Gradius Galaxies, Iridion II) | 24x16 to 32x24 ship | 32x24 ship | bullets 4 to 8 px with a bright core and a coloured rim; never the same colour as the background |
| Strategy, puzzle (Advance Wars, Puzzle League) | units and panels 16x16 | 16x16 to 20x20 | the board is the game: give it the middle of the screen and the most contrast |
| Survivors-style (crowds) | — | hero 24 to 32, crowd 16 to 24 | the crowd is darker and less saturated than the hero and the pickups |
| Bosses | 64x64 and up, built from several sprites | 64 to 128 | they turn and scale (affine); the hit flash is white |

**Backgrounds.** Up to four layers: a far layer that barely moves (sky, stars, a gradient made of tiles), a middle layer with
silhouettes, the play layer, and sometimes a near layer of leaves, mist or glass blended over everything. Far layers are lower in
contrast and cooler; the play layer has the hardest edges. Tiles are 8x8 hardware cells drawn as 16x16 metatiles, with two or three
variants of each common tile so floors do not show a grid.

**Animation.** Many more frames than the NES: idle loops that breathe (2 to 4 frames), walk cycles of 6 to 8, anticipation and
squash on jumps, a 2 to 4 frame hit pose with a white flash, death that bursts into particles. Pickups bob and twinkle. UI moves too:
cursors bounce, windows slide or grow open over 4 to 8 frames, numbers count up.

## Colour and palettes

- Banks of 16, one bank per object or material family; enemies of one family share a bank and differ by palette swap (red, blue and
  gold versions of one sprite are the GBA's oldest trick).
- Ramps shift in hue: shadows lean towards blue or purple, highlights towards yellow. A ramp that only darkens looks NES-flat.
- The HUD and windows have their own bank: one dark frame colour, one light inner edge, a two-tone or gradient fill, in colours that
  belong to this game (see "Every game has its own interface" below).
- Blending is part of the palette: a window at 70% over the scene, additive glows on fire, shots and pickups, a darken layer for
  shade under trees.

## UI and text

This is where our games looked most NES and SNES.

- **Text is proportional, mixed case, with a drop shadow** (Pokémon, Golden Sun, Advance Wars, Mother 3). All capitals in square 8x8
  letters is NES. Headings may be bold or bigger; body text is sentence case. Built-in fonts: `round_tall` for talk and menus,
  `round_small` for labels and numbers, `bold_*` for headings.
- **Windows are rounded or bevelled frames** with a light inner edge and a soft or two-tone fill, often see-through. Thin one-pixel
  rectangles are NES; heavy black boxes with white borders are early SNES.
- **Every game has its own interface, made of its own world.** That bevel is a starting point, not the look of every game: GBA games
  framed their menus in parchment and wood (Golden Sun), bright plastic (Advance Wars), notebook paper and stamps (Mother 3), metal
  plates (Metroid Fusion). Pick a material from the game's world (case files, seed packets, stained glass, riveted iron, folded paper,
  neon tubes), draw the frame as a sprite or tile panel when gs.draw.panel cannot make it, and give the cursor, the fonts and the HUD's
  layout the same idea. A dark navy see-through box is gs.draw.panel's default and the look of the first example games; a new game
  should be told apart from them by a single screenshot.
- **The HUD sits in the corners and stays small**: a portrait or icon, a bar, a number. Each piece has its own small framed plate (or
  is drawn with a shadow straight on the scene). No full-width bars over the playfield unless the game is a board game with a fixed
  frame, and then the frame is part of the art.
- **Menus** are a short list with a moving cursor (a hand, an arrow, a bouncing gem), a description box that updates as the cursor
  moves, and a button hint row in small text: "A Choose  B Back".
- **Nothing overlaps.** Every piece of text lives inside its own window with at least 4 px of padding; numbers are right-aligned in
  columns; long names shrink or scroll, they never run under another window.
- Transitions: mosaic dissolves, fades to white for big moments (a level-up, a boss down), fades to black between areas.

## Sound and music

- Sampled instruments mixed in software, usually 5 to 8 voices plus a drum kit: strings, piano, flute, brass, slap bass, and a
  sampled kit. The four chip channels add a square lead or noise hats on top. So a GBA song is a small band, not a chip trio.
- The sound is warm and a little lo-fi (low sample rates), almost always with some reverb or echo built into the mix.
- Songs loop in 30 to 90 seconds, with an intro bar. Each area has its own key and tempo; the pause or menu theme is softer.
- Effects are short and pitched: menu ticks, a rising arpeggio for good things, a falling one for bad, a crunchy noise burst for hits.
  A sound never masks the music's melody for more than a beat.

## Controls

- A confirms or does the main action, B cancels or does the second one, Start pauses, Select opens a map or options.
- L and R are for secondary actions that need no thinking: switching weapons, raising the stack, cycling targets, a dash.
- Holding a button for a stronger version (charge shots, a raised stack) is common; double-taps are not.
- Menus wrap round, repeat while the D-pad is held (after about a quarter of a second), and remember the last choice.

## Level design and gameplay

- Short sessions: a stage or a run takes 3 to 10 minutes, and the game saves often. A handheld game is played on a bus.
- One new idea per stage, taught safely, then tested, then twisted (`docs/help/94-levels.html`).
- Difficulty ramps gently, with optional challenge on top (Time Attack, hard modes, unlockables). Records and unlocks give reasons to
  replay.

## What this means for our two games

**Panel Pop** (puzzle): the board is already the centre and the pastel sky is right. It reads SNES because of the all-capital 8x8
sprite fonts and flat window panels. So: built-in proportional fonts with shadows in sentence case; GBA windows (rounded bevel, light
inner edge, slightly see-through); a board frame with depth; mosaic transitions between screens; text that never overflows.

**Void Swarm** (survivors): the art was redrawn to the new standard. It reads NES or SNES because of the all-capital labels, one-pixel
rectangle windows and the HUD strip across the top. So: proportional fonts in sentence case; GBA windows and HUD plates in the
corners; a level-up screen that dims and blurs the field (mosaic) and fades in white; a white flash on hits; no text under any window.

**Box art** for muOS: muOS draws box art at its own size over the right of the game list, which runs the full width. A 480x640
picture covers the list and both bars. Box art is now 256x320, with the art in a frame with soft edges, so it sits beside the
names; the preview is 640x480 (the screen at twice size).

## Sources

- Hardware: [Tonc, sprites](https://www.coranac.com/tonc/text/regobj.htm) and [Tonc, graphics effects](https://www.coranac.com/tonc/text/gfx.htm).
- Unlit screen and brightened palettes: [libretro forum on real GBA colours](https://forums.libretro.com/t/real-gba-and-ds-phat-colors/1540?page=9), [TV Tropes, Back That Light Up](https://www.tvtropes.org/pmwiki/pmwiki.php/Main/BackThatLightUp).
- Sound: [Battle of the Bits, Game Boy Advance](https://battleofthebits.com/lyceum/View/GameBoy%20Advance), [Audio programming on the GBA](https://archive.gamedev.net/archive/reference/articles/article1823.html).
- Sprites shared by faction palettes: [Fire Emblem Universe, GBA FE sprites](https://feuniverse.us/t/gba-fe-sprites/8379).
- Puzzle League on the GBA: [Super Mario Wiki](https://www.mariowiki.com/Dr._Mario_&_Puzzle_League), [Nintendo World Report review](https://nintendoworldreport.com/review/4479).
- muOS box art: [muOS artwork docs](https://muos.dev/installation/artwork), [muOS box art packs](https://community.muos.dev/t/game-systems-entertainment-folder-box-art-rg35xxsp/407).
