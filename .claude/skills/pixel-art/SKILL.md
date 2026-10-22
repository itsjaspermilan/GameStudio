---
name: pixel-art
description: Drawing sprites and tiles for GameStudio games (heroes, enemies, bullets, pickups, effects, tilesets, icons), fitted to the kind of game being made and to the handheld's 320x240 screen and palette. Use when creating, redrawing, resizing or animating any sprite or tileset, or when art looks too small, muddy, blotchy or hard to read.
---

# Pixel art for GameStudio

The art ends up on a 3.5" screen showing 320x240 (Dot) or 320x180 (Dash) pixels, scaled by whole numbers. Everything below serves one goal:
**the player reads the screen at a glance.** Use the `gamestudio` MCP tools for the work (`overview` first, then `sprite_view` /
`sprite_write`, then `run` to see it in the game) instead of writing PNGs by hand.

## Workflow

1. `overview` the game: its console, the existing sprites and their sizes, and what each entity uses. Match what is there.
2. Decide the size from the table below and from the hero (the hero is the yardstick: enemies and items are sized against it).
3. Draw with `sprite_write`. For anything round or shaded use ops (`sphere`, `disc`, `poly`, `outline`, `mirror` for symmetric things); for
   small exact details use letter rows. Draw **at the real size**: never draw small and enlarge (enlarged art looks blotchy, with uneven pixels).
4. Look at the returned picture. Then `sprite_view` next to the hero, and `run` the game to see it among everything else.
5. Animations: name clips in `animations` (`{ idle: {from:0,to:1,fps:3,loop:true}, walk: {from:2,to:7,fps:12,loop:true} }`); entities play
   them with `self:play("walk")`.

## Sizes (Dot, 320x240; on Dash keep the same sizes, the screen is just shorter)

| What | Size | Note |
| --- | --- | --- |
| Hero | 24x24 to 32x32 | 10-13% of the screen height: room for a face and a readable walk |
| Common enemy | 16x16 to 24x24 | smaller than the hero, readable in a crowd |
| Big enemy | 32x32 to 48x48 | clearly bigger than the crowd |
| Boss | 48x48 to 64x64 | 64 is the console's limit |
| Bullet, small pickup | 8x8 to 12x12 | 8x8 is easy to miss; pickups the player must notice want 12x12 |
| Particle | 2-4 px squares | use `gs.burst`, not sprites, unless it must be shaped |
| Tile | 16x16 (8x8 for very fine levels) | tiles are 8 or 16; a tileset sheet is at most 256x256 |
| Icon | 16x16 | |

Sprites are multiples of 8 in each side (the console wants it), frames side by side in one strip. Hit circles are usually about 0.6 of
the sprite (a 24 px hero: `hitbox = { r = 7 }`).

## The palette

Dot has 32 fixed colours: 8 hues with 4 shades each, dark to light. In `sprite_write` a colour is its place (number) or the letter
`sprite_view` lists:

| Hue | dark .. light |
| --- | --- |
| grey | 0 #000000, 1 #3b3f55, 2 #8a90a8, 3 #ffffff |
| red | 4, 5, 6, 7 |
| orange/brown | 8, 9, 10, 11 |
| yellow | 12, 13, 14, 15 |
| green | 16, 17, 18, 19 |
| teal | 20, 21, 22, 23 |
| blue | 24, 25, 26, 27 |
| purple | 28, 29, 30, 31 |

A material is a **ramp** from one hue: shade 1 for the base, 2 for the lit side, 0 for shadow and outline, 3 for highlights (a `sphere`
op takes the ramp `[0,1,2,3]` of a hue, e.g. `[24,25,26,27]`). Outline a sprite in its own darkest shade (`outline` op), not black,
unless it must pop off a busy background. Other consoles may have their own palette: `overview` says how many colours.

## Rules that make art readable

- **Silhouette first.** Fill the shape in one colour and check it reads (`sprite_view`); details come after. A character needs a head, a
  body and feet that are each at least 2-3 px.
- **Light from the top left**, the same on every sprite and tile. Lit edges top-left, shadow bottom-right.
- **Contrast by role.** The player's own things (hero, its shots) in cool or bright colours, enemies and their shots in warm reds and
  oranges, pickups bright and pulsing (2 frames), the background darker and lower in contrast than anything that moves.
- **Few colours per sprite** (3-6): more makes it noisy at this size.
- **Face the direction of travel.** Draw side and three-quarter sprites facing right; the game mirrors them (`self.flip`).
- **No single stray pixels** (noise) and no lines that zig-zag by one pixel; keep curves as clean steps (1-2-3, not 1-3-1).

## Animation frame counts

| Motion | Frames | Speed |
| --- | --- | --- |
| Idle (breathing, bob) | 2 | 2-4 fps |
| Walk / run | 4-6 (legs alternate, body bobs on the passing frames, arms swing against the legs) | 8-12 fps |
| Attack | 3: wind-up, strike, recover | 12-15 fps |
| Hit | 1-2 (flash white or shift back) | short |
| Pickup pulse, blinking light | 2 | 4-8 fps |
| Explosion / puff | 4-6, growing then fading | 12-15 fps |

## By kind of game

- **Platformer (side view).** 16x16 tiles; a 24x32 or 24x24 hero. Ground tiles need a clear top edge (a lighter row) so landing spots
  read. Background tiles in darker, bluer shades than the solid ones. Hazards (spikes, lava) in red/orange with sharp shapes.
- **Top-down adventure / RPG.** Three-quarter view (we see the top and the front). Characters 16x24 or 24x24 with 4 directions (down,
  up, right; left is mirrored), 2-4 walk frames each. Floor tiles low contrast, walls taller with a dark base line so depth reads.
- **Survivors / shoot-'em-up (crowds).** Enemies small and distinct by shape *and* colour per kind; enemy bullets bright red/pink 6-8 px
  with a light centre so they are seen first; the player's shots blue/white and smaller. Effects (sparks, puffs) short and see-through
  so they never hide a bullet. Keep backgrounds very dark and quiet.
- **Puzzle (grid pieces).** Big flat shapes, one hue per piece type, and a symbol on each (shape-coded, so colour-blind players can
  play). Pieces fill their cell minus a 1 px gap.
- **Racing / vehicles.** Seen from above or behind; draw 8 or 16 rotation frames only if it must turn smoothly, otherwise rotate with
  the sprite's `angle` (cheap shapes rotate fine; detailed pixel art blurs, so prefer frames for the hero vehicle).

## Tilesets

One sheet per theme (`tilesets/<name>.png` + `.json` with `tile_w`, `tile_h`), at most 256x256. Order the tiles so a level map can name
them simply: 0 empty-looking ground, then the top edge, corners, wall, decoration. Make edges tile seamlessly (the left column continues
the right). Draw it with `sprite_write` and `tileset: { cols: 8 }`: each frame is one tile, and it writes `tilesets/<name>.png` and
`.json` (tile numbers count from 0, left to right then down; `room_write` maps refer to them).

Further reading in the repo: `docs/help/91-sizes.html` (the size guide), `docs/help/70-sprites-sound.html`, `scripts/lib/canvas.mjs`
(the drawing ops), and `scripts/void-swarm/pilots.mjs` (a full set of animated characters drawn in code).
