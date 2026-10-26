# GameStudio, rethought: a Lua game engine with an editor around it

Status: **mostly built**. What is built and what is open is in section 8 and in `TODO.md`; section 13 records what the Void Swarm port taught us.

## The idea in one paragraph

A game is a folder of **Lua files and assets**. Every entity, scene and system is a Lua file you can read, diff and review. The studio is
a very good editor for that folder: an excellent Lua code editor, the sprite / tile / sound / music / level editors we already have,
live reload, a profiler, and a permanent view of what the target console can and cannot do. No generated code, no second language to learn.

## 1. Entities are Lua files (recommended)

Yes: one entity = one Lua file. It is the best practice most engines converge on (Godot scripts, Love2D classes, Defold scripts) and it
keeps everything about a thing in one reviewable place.

```lua
-- entities/grub.lua
local Enemy = require "entities.enemy"            -- inherit: a file can build on another file

local Grub = gs.entity(Enemy, {
  sprite = "spr_grub", hitbox = { 3, 3, 10, 10 },  -- declared data, readable by the editor and the profiler
  tags   = { "enemy" }, depth = 0,
  hp = 10, speed = 38, damage = 5,                 -- plain defaults, overridable per instance
})

function Grub:update(dt)
  self:move_toward(gs.first("player"), self.speed * dt)
  self:face_motion()
end

function Grub:on_hit(shot) self:hurt(shot.damage) end   -- collision / message handlers are just methods
function Grub:on_die()     gs.spawn("gem", self.x, self.y) end

return Grub
```

- **Declared data at the top, behaviour below.** The studio reads the declaration (sprite, hitbox, tags) for previews, the sprite
  picker and budget estimates, without running code.
- **Lifecycle:** `create`, `update(dt)`, `draw`, `destroy`, plus `on_<event>` handlers (collision by tag, animation end, custom messages).
- **Composition over deep inheritance:** `gs.entity(Parent, {...})` for "is a" and small **behaviours** (`gs.behavior`) for reusable
  pieces (health, knockback, flash, magnet) that an entity lists in `use = {...}`.
- **Levels and screens are data files**: a scene's layout, `scenes/arena.layout.lua`, returns a plain table (size, tile layers, placed
  instances with overrides, texts, pictures, tile panels, paths); the layout editor writes it in a stable, diff-friendly format and hand
  edits are fine. Its logic lives beside it in `scenes/arena.lua` (`Scene:enter()`, `update`, `leave`). Data and logic stay in separate
  files, so the visual editor never has to round-trip code; what connects them is names (a thing named `door` is `self.door` in the code,
  and renaming it in the layout renames it there). The older `rooms/arena.lua` is the same data built from code with `gs.load_room`.
- **No hidden global state**: entities talk through `gs.send(target, "msg", ...)`, tags and the world, not through magic globals.

## 2. Project layout

```
mygame/
  game.lua            -- gs.game{ title, console = "glow43", start = "scenes.title" }
  entities/           -- one file per kind of thing
  scenes/             -- screens and level logic
  scenes/*.layout.lua -- what each scene places (edited visually); rooms/ is the older form
  lib/                -- your own modules, plus vendored libraries
  sprites/ tilesets/  -- png + small json (frames, animations, origin, hitbox)
  audio/  sfx/ music/ instruments/
  tests/              -- gs.test files, run from the studio or the command line
```

Standard `require`, no magic loading. Asset names are plain strings (`"spr_grub"`), checked by the editor (a typo is a red squiggle,
not a runtime surprise).

## 3. The Lua API: small core, powerful layers

Principle: **the common thing is one line; the powerful thing is possible.** Layered, all documented with type annotations so the
editor can complete and explain every call.

| Layer | What | Examples |
| --- | --- | --- |
| World | entities, tags, scenes, a built-in **spatial index** | `gs.spawn("grub", x, y)`, `gs.each("enemy", fn)`, `gs.nearest(self, "enemy", 200)`, `gs.in_radius(x, y, r, "enemy")`, `gs.first("player")` |
| Collision | rectangles/circles, tag-to-tag, tilemap | `gs.collide("shot", "enemy")`, `self:overlaps(other)`, `gs.tile_at(layer, x, y)`, `self:move_and_slide(dx, dy)` |
| Time | timers, tweens, coroutines | `self:after(1.5, fn)`, `self:every(2, fn)`, `gs.tween(self, {x = 100}, 0.4, "out_quad")`, `gs.wait(0.5)` inside `gs.go(function() ... end)` |
| Drawing | sprites, text, shapes, camera, layers, shake | `self:draw_sprite()`, `gs.text("hi", x, y, {color = ...})`, `gs.camera:follow(player)`, `gs.camera:shake(4, 0.2)` |
| Input | buttons, pressed/released, axes, rebinding | `gs.input.held("left")`, `gs.input.pressed("a")`, `gs.input.axis("move")` |
| Audio | sfx and music by name, volume, fades | `gs.sfx("hit")`, `gs.music("stage_a", {fade = 0.5})` |
| UI | text boxes, menus, panels, wrapped text, lists | `gs.ui.menu({ "PLAY", "OPTIONS" }, { at = self.menu_text })`, `gs.say("OLD MAN", "...")`, `gs.ask("Take it?", { "YES", "NO" })`; panels are tiles (a 3x3 block stretched) and fonts are sprites, placed in a layout |
| Data | save slots, settings, seeded random, math helpers, vectors | `gs.save.set("credits", 10)`, `gs.rng(seed)`, `gs.vec(x, y)`, `gs.lerp`, `gs.angle_to` |
| Escape hatch | the raw low-level calls stay available | `gs.raw.tile(...)`, `gs.raw.sfx_play(...)` |

Performance is the default, not a chore: the spatial index, draw culling (nothing off screen is drawn), batched sprite draws,
fixed-step update, entity **pools** (`gs.pool("shot", 64)`) and per-frame allocation warnings are built in. A survivors-style game
with 100+ enemies should not need hand-written spatial hashing (we wrote it by hand twice already).

## 4. Console limits are part of the tool, not a footnote

The console spec (screen, palette, sprite sizes, entity and draw budgets) stays as a small JSON file, and it is **visible all the time**:

- A **Budgets panel** in the studio: cart size, entities alive, sprites on screen, draw cost, update ms, with the handheld's numbers next to
  each (measured on the RG35XX Pro).
- **Run on a "handheld" profile** on the desktop: the same game with the device's speed ratio applied, so slowness shows up while you
  work, not after you push.
- **Linting for limits:** palette check on import, sprite size check, "this entity allocates a table every frame", "more than N
  entities alive".
- **Runtime warnings in plain words** with the file and line (the engine already warns once about frame rate; it will point at the entity
  responsible).
- `gs.limits` exposes the numbers to code (`gs.limits.entities`, `gs.limits.screen`) so games can adapt.

## 5. The code editor: make it the best part of the studio

CodeMirror 6 stays (we already ship it). Around it:

1. **Language intelligence from LuaLS** (lua-language-server) as a bundled sidecar, fed our API annotations (`gs.d.lua`) and the
   project's own files: completion, signature help, hover docs, go to definition, find references, rename, diagnostics, and type
   checking from `---@class` / `---@param` comments. This is the single biggest quality jump.
2. **Project-aware helpers:** complete asset names inside strings with a small preview (hover a sprite name to see it; ctrl-click opens the
   sprite editor), click an entity name to open its file, "new entity / scene / behavior" templates.
3. **Formatting and linting on save** (StyLua + luacheck-style rules plus our own: allocation in `update`, missing `return`, unknown
   tags/assets, budget warnings).
4. **Live reload:** save a file and the running game picks it up, keeping state where it can; errors show as an overlay with a
   clickable stack trace instead of killing the run.
5. **Debug without breakpoints:** a live inspector (entities, fields, tags), pause / step one frame / slow motion, and a profiler
   (time per entity kind and per function). Watch expressions and a console to poke at the running game.
6. **Everyday editor features:** tabs, split view, project-wide search and replace, symbol outline, minimap, multiple cursors, bracket
   and `end` matching, code folding, snippets, vim keys as an option, themes.
7. **Tests:** `tests/*.lua` with `gs.test`, run from a panel with pass/fail inline.

## 6. What the studio is

| Editors (kept from before) | The project | The code editor and tools |
| --- | --- | --- |
| Sprite editor, tileset editor | A real file tree (the folder *is* the project) | Lua editor with completion, hover help and warnings; the Lua language server (optional) |
| SFX, music and instrument editors, previews | `game.lua`, `entities/`, `scenes/`, `rooms/`, `lib/` | Live reload while a game runs |
| Console spec + budgets | `meta/info.json` for the device's game list | Handheld tab (budgets and live numbers), Help window with tutorials and the API reference |
| Run / pack / push to the device | | |

Still to build: the level (room) editor for the data-file rooms, a path editor, the inspector and profiler (see `TODO.md`). The text, menu and dialog helpers live in the Lua `gs.ui` module.

## 7. The runtime

The C player (`runtime/`: SDL2, drawing, input, the synth, TinySoundFont, saves, framebuffer path) is a thin layer; the embedded Lua part is a small, readable
framework (`engine/gs/*.lua`: `entity`, `world`, `scene`, `timers`, `ui`, `camera`, ...) that is itself good example Lua.

## 8. Build order and status

1. **Done:** the framework (`engine/gs/`), with a test cart that checks it from inside (`tests/framework`).
2. **Done:** Breakout as the first small sample, to settle the API's rough edges.
3. **Done:** the studio as a plain folder project; run, pack and push.
4. **Done:** the code editor (CodeMirror, project-aware completion and warnings, an optional language server), live reload and the error overlay.
5. **Partly done:** the Handheld tab (budgets and live numbers). Open: the inspector and profiler.
6. **Done:** Void Swarm as the first large sample. Panel Pop & Doc Capsule ported to modules and scenes; `gs.legacy` and plain `main.lua` carts are gone.
7. **Done:** the Help window with tested tutorials and the API reference.

## 9. Decisions (round one)

1. **Entities: methods on a class table** (`function Grub:update(dt)`). They read best and give the editor something to complete.
   Performance is the same as plain function tables: a method call is one table lookup. The only trap is a long inheritance chain, because
   every level adds a lookup. `gs.entity` therefore **flattens** a parent's methods into the child's table when the file loads, so any call is
   one lookup however deep the family tree is. Per-instance closures are avoided on purpose (they allocate); methods are shared by all instances.
2. **Layouts are files.** Plain Lua data files (`scenes/arena.layout.lua`, and the older `rooms/arena.lua`), editable by the layout editor or by hand.
3. **Language server: bundle LuaLS, keep our own helpers independent of it** (details below).
4. **Live reload (proposal):** code changes apply instantly; changes to starting values apply to new things; `R` restarts the scene.
   Because instances keep their state in fields and look methods up in the class table, swapping a method body can be done while the game
   runs without losing anything. Edits to `create()` or to declared data (sprite, hitbox) only affect things created afterwards, and the editor
   offers "respawn every <kind>". That is easy to explain and easy to build.
5. **Both audiences.** Plain-language docs and in-app tutorials for newcomers; a full typed reference and a performance guide for experienced developers.

### Language server: the trade-off

| | LuaLS (bundled sidecar) | Our own lightweight analyser |
| --- | --- | --- |
| Accuracy | Real type inference, find references, rename, diagnostics: what VS Code gives Lua developers | Good for our API and asset names, weak for general Lua |
| Effort | Plumbing (start it, talk LSP to CodeMirror, ship annotations) | Large: we would be writing a type checker |
| Cost | A binary per platform (about 10-30 MB), signing/notarising, 100-300 MB of memory on big projects, a second or two to start | None at run time, instant |
| Risk | Version drift, glue code | We will never match it |

Recommendation: **bundle LuaLS (macOS first, as that is where the studio runs today) and build our project-aware features
separately in the editor**: asset-name completion and previews, the budget and performance lints, entity templates, click-through to
files and sprites. If LuaLS fails to start the editor still completes `gs.*` and asset names from our own annotations, so it degrades
instead of breaking.

## 10. Sprite and tile sizes: what feels right on a 320x240 screen

Dot is 320x240, twice the pixels of a GBA (240x160) in each direction that matters, so GBA-sized art looks small on it. Void Swarm's
16 px pilots are about 7% of the screen height; a GBA hero (16 px on 160) is 10%. That is the "a bit small" feeling. Text at 8x8 reads
fine because text wants to be small.

Proposed **size guide**, shown in the sprite editor's new-sprite dialog and as a reference ruler beside the canvas:

| Role | Suggested size on Dot (320x240) | Notes |
| --- | --- | --- |
| Hero / character | 24x24 or 32x32 | 10-13% of the screen height; room for a face and animation |
| Common enemy | 16x16 to 24x24 | Readable in a crowd |
| Big enemy / mini-boss | 32x32 to 48x48 | |
| Boss | 48x48 to 64x64 | The limit is 64 |
| Projectile / pickup / particle | 8x8 (up to 16x16) | |
| Tile | 16x16 (32x32 for a chunky look) | Multiples of 8 |
| Icons | 16x16 | |

The sprite editor will show the sprite **at real scale next to a mock Dot screen** and next to a few reference silhouettes (16 / 24 / 32 /
48 px), so you judge size by eye instead of by number. Games can also zoom the camera (`gs.camera.zoom`) for a bigger look with the
same art. A smaller logical screen (for example 240x180) is not recommended: 640x480 is not an integer multiple of it, and uneven pixels
look worse than slightly small sprites.

## 11. In-app help and tutorials (the GM7 help page, in HTML)

A **Help** window inside the studio shows local HTML pages (`docs/help/`), with a table of contents, search, and "Open this example"
buttons that copy a starter or finished project into the workspace. Planned tutorials, each with a starter and a finished project:

1. Your first game (a ball and paddle: entities, input, collisions, sound)
2. A platformer (tilemaps, gravity, camera)
3. A top-down shooter / survivors game (spawning, pools, many enemies, the budgets panel)
4. A puzzle game on a grid (state, undo, saving)
5. Menus, scenes, saving and settings
6. Sound and music
7. Working inside the console's limits (palette, sprite sizes, budgets, the handheld profile)
8. Best practices (project layout, state machines, composition, testing, performance)

The **API reference** is generated from the same type annotations the code editor uses, so the editor hover and the help page never disagree.

## 12. Still open

- Confirm the live-reload model in section 9.4.
- Confirm the size guide, or change the numbers.

## 13. What porting Void Swarm taught us

Void Swarm began as 2,200 lines of hand-optimized table code (no engine entities, because "instances cost too much"). Porting it to entities and scenes (about 90 files) was the test of
the claim that the entity API is both easy and fast enough. Findings:

- **It is expressive.** 24 enemies are 24 small files, most of them five lines on top of `entities/enemy.lua`; the weapons, pickups and bullets are entities with `on_collide_<tag>` handlers; the whole game flow is scenes. The
  old 1,400-line `game.lua` became files of 20 to 120 lines, each about one thing.
- **It needed four additions**, all general: `gs.pause()` (a pause menu and level-up choices without every entity checking a flag), `gs.defaults(name)` (read a kind's numbers, e.g. its cap, without making one), `collide_every`
  (staggered collision checks for crowds) and nil options in `gs.goto_scene`. A fifth change was internal: the collision grid now merges its sorted cell lists instead of sorting candidates.
- **Cost.** On a desktop, a busy sector took about 0.30 ms a step against 0.23 ms for the hand-tuned original (1.3x), with 100 to 200 entities alive. Before `collide_every` the crowd's pushing-apart handler was the whole difference (2.2x).
  Entity limits had to be planned: the old game could hold 600 things; Dot allows 512 entities, so each kind has a cap (enemies 100, bullets 100, pickups 120, shots 60, effects 50).
- **Behavior parity.** The bot wins and loses the same sectors as before and takes damage from the same things; numbers (enemy stats, weapons, sectors) are unchanged.
