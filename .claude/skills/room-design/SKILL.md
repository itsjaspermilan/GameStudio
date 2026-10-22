---
name: room-design
description: Designing levels (rooms) for GameStudio games, fitted to the kind of game: platformer stages, top-down maps, survivors arenas, shoot-'em-up stretches, puzzle boards. Use when making or changing rooms/<name>.lua, laying out tiles, placing enemies and pickups, drawing patrol paths, or when a level is too hard, too empty, confusing or slow on the handheld.
---

# Room design for GameStudio

A room is plain data in `rooms/<name>.lua` (size, background, tile layers, the entities placed in it, paths), built with
`gs.load_room("<name>")`. Use the `gamestudio` MCP tools: `overview` (what entities and tilesets exist), `room_write` (build or change a
room; a layer can be written as a text map), `room_view` (the room as a picture plus counts), `run` with `keys` to play a stretch, and
`inspect` for costs. The person can open the same room in the studio's room editor.

## Workflow

1. `overview` the game. Read the hero's entity file for its numbers (speed, jump, gravity, size, hitbox): the level is built around them.
2. Sketch the layout as a text map first (one character per tile; `#` solid, `.` empty, letters for other tiles) and write it with
   `room_write` `layers[].map`. Keep the legend in the conversation so later edits use the same characters.
3. Place the hero's start, then enemies, pickups and hazards with `entities.add` (pixels; a 16 px tile at column c, row r has its top
   left at `c*16, r*16`, its centre at `c*16+8, r*16+8`).
4. `room_view` it: look for unreachable spots, empty stretches, clutter. Then `run` the game with `keys` along the intended route
   (`right*60,a,right*30,...`) and look at the screenshot; `check` for errors.
5. Make the scene load it (`gs.load_room("<name>")` in the scene's `enter`) and the camera follow the hero
   (`gs.camera:follow(hero, { smooth = 0.1 })`); `gs.load_room` already limits the camera to the room.

## Numbers to design with

- The screen is 20x15 tiles of 16 px on Dot (20x11 on Dash). The dashed box in `room_view` is one screen.
- **Jumps** (platformers) from the hero's `jump` (upward speed, px/s), `gravity` (px/s²) and `speed` (px/s):
  height = jump² / (2 x gravity), time in the air = 2 x jump / gravity, reach = speed x time in the air.
  With the tutorial's hero (speed 110, jump 300, gravity 800): 56 px high (3.5 tiles), 0.75 s in the air, 82 px across (5 tiles).
  Design gaps at **at most 70%** of the reach and steps at most 70% of the height for ordinary jumps; the full distance only for a
  deliberate challenge, never over a pit early on.
- **How much at once:** the console allows 512 entities alive; a lively screen has 10-40 things. `room_view` reports things per screen.
  Every tile layer is one picture a frame: 2-3 layers are plenty.
- **Depth:** a bigger `depth` is further back. Backgrounds 100+, the solid layer around 50, decoration in front around 10 (keep it
  sparse: it can hide things).

## Principles

- **Teach, test, twist.** Introduce one idea where it is safe (a gap over solid ground), test it (the same gap over a pit), then twist
  it (a moving platform over the pit). One new idea per stretch of screens.
- **Readable routes.** The way on should be visible or hinted from where the player stands: an open edge, a pickup trail, a landmark.
- **Rests.** After a hard part, a quiet screen. Pace intensity up and down, ending each room on the hardest part followed by a reward.
- **Fair surprises.** Enemies appear on screen with time to react (not at the very edge where the camera reveals them on top of the
  hero); hazards look dangerous (red/orange, spiky) and are shown before they matter.
- **Landmarks.** In bigger rooms a distinctive shape or colour every couple of screens tells the player where they are.

## By kind of game

- **Platformer.** Long and low (several screens wide, 1-2 high). A solid layer (`solid = true`) the hero collides with by tag; ground
  at least 2 tiles thick at the bottom. Moving platforms and patrolling enemies walk paths (`paths = { lift = { {x,y}, {x,y}, loop = true } }`,
  entity: `self:follow_path("lift", 40)`). Checkpoints every 2-3 screens. Coins in arcs that show the jump.
- **Top-down adventure.** Rooms about one to four screens, joined by doors or edges; walls 1-2 tiles thick, corridors 3+ tiles wide
  (the hero needs room to dodge). A distinct floor per area. Place enemies away from doors.
- **Survivors arena.** Open, a few screens in each direction (or wrapping), sparse obstacles that make the player steer (not walls that
  trap). Enemies spawn off screen in a ring from code, not from the room; the room places only obstacles, pickups and decoration.
- **Shoot-'em-up stretch.** A tall or wide strip scrolled by the camera; enemy waves as entities with paths (`follow_path`) entering
  from the edges; leave the player's lane clear of scenery.
- **Puzzle board.** One screen, the board centred on a grid, with room for the score and next piece; no camera movement.

## Checks before calling a room done

`room_view` shows no thing outside the room and no layer with tiles beyond its tileset; every entity in the room has a file
(`room_write` notes it otherwise); `run` along the route reaches the end without errors; `inspect` while playing shows the busiest
kinds well under budget.

Further reading in the repo: `docs/help/80-rooms.html` (rooms, the camera, tile layers, paths), `docs/help/50-platformer.html`,
`docs/help/60-survivors.html`, `docs/help/90-limits.html`, `studio/src/room-core.js` (the room format).
