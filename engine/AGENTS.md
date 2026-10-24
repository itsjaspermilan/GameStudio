# engine/: the Lua framework (`gs`)

Everything here is **embedded into `gs` at build time** (`CMakeLists.txt` bundles `engine/gs/*.lua`, `instruments.json` and `consoles/*.json` into
`build/gs_framework.lua` as `package.preload` modules). After editing any of them run `./scripts/build.sh`.
Design and rationale: `docs/lua-engine-design.md`. Every cart has a `game.lua` and boots the framework (`gs/boot.lua`); the runtime no longer runs a plain
`main.lua`. The runtime's own calls stay on `gs` (and in `gs.raw`) for scenes that want them.

## engine/gs/ (one module per concern)

| File | What |
| --- | --- |
| `boot.lua` | `gs.game{}`, the public API table, init/update/draw, the fixed 60 Hz step, the error overlay (GS_DEV) |
| `entity.lua` | `gs.entity` / `gs.scene` classes, inheritance + flattening, `on_collide_<tag>` discovery, the `require` wrapper that names classes |
| `world.lua` | spawn/destroy, tag lists, spatial grids, collisions, depth buckets, scenes and fades, scene layouts (`scenes/<name>.layout.lua`: built before `enter`, named things become scene fields, `code = "other"` runs another scene's code; texts and pictures are the built-in kinds `gs.world.Text` / `gs.world.Picture`), rooms, tile layers. Live reload restarts the scene when its layout changes |
| `timers.lua` | after / every / tween / coroutines (`gs.go`, `gs.wait`), owned by an entity or scene so they die with it |
| `camera.lua`, `input.lua`, `draw.lua`, `ui.lua`, `save.lua`, `sound.lua`, `assets.lua`, `json.lua` | what the names say |
| `reload.lua` | live reload (GS_DEV=1): polls file mtimes, re-requires changed files into the same class tables, rolls back on error |
| `inspect.lua` | the studio's Inspector (GS_INSPECT=<file>): reads pause / step / speed / what to look at from the file, answers with `@@gsi {json}` (kinds with update/draw/collision time, a kind's entities, one entity's values, watch expressions); `world.profile` turns the timing on only while it is open |
| `particles.lua` | `gs.burst`: particles as plain arrays (not entities), capped by the console's `particles` limit, drawn at a depth |

Colour banks: `assets.lua` reads `palette.json` (`all_banks`, `bank`) and makes palette swaps (`swapped`, through the runtime's `gs.recolor`) for an
entity's `bank` field and `gs.draw.sprite`'s `bank` option; `draw.lua` reads `"bank:place"` colours; live reload forgets both when palette.json changes.
`tests/banks` checks it (and that a swap looks exactly like rectangles in the new colours).

Blending: the runtime's `gs.blend(mode)` ("normal", "add", "darken", SDL's BLEND, ADD and MUL) applies to everything drawn after it; `draw.lua`'s
`blend` keeps the mode in Lua (`draw.mode`); the world sets an item's or layer's `blend` around its draw and puts "normal" back, so a
`draw()` that forgets cannot spill. Alpha (entities, layers, layout items) is the strength. `tests/blend` checks the colours against plain
rectangles (`tests/same-frames.mjs`, 2 levels of rounding allowed).

Added while porting Void Swarm (the old stress-test sample, now only in git history): `gs.pause()` (freeze the world, only the scene updates: pause menus, level-up choices), `gs.defaults(name)` (an entity's starting values without making one),
`collide_every = { tag = n }` in an entity spec (check that handler every nth step, staggered), `gs.goto_scene(name, nil, args...)` (nil options), and a faster collision candidate merge (no sorting).
After it: `gs.in_radius` / `gs.in_rect` take an optional list to refill (no garbage), `Entity:hit_radius()` (a round hitbox's radius with scale), and `"#rrggbbaa"` colors.
Entities are classes keyed by module name; reloading a file fills the same table, so living instances keep their state and get the new methods.
Public names are documented at the top of each module. The runtime's own low-level calls stay in `gs.raw`.

## Other files

- `api/gs.d.lua`: the API as annotations (hover text, completion, the Help page and the language server all read it). **Add every new `gs.*` function or Entity method here**; `studio/test/lua-intel-core.test.mjs` fails if one is missing. Not embedded, not packed.

- `instruments.json`: ready-made instruments for the synth (type `gm` uses the SoundFont).
- `fonts/round-*.txt`, `fonts/square-*.txt`: the built-in letters, drawn as text. They reach `gs` through `runtime/fonts.h`, which
  `scripts/make-fonts.mjs` writes (with the bold style made from round), not through CMake: run it, then `build.sh`.
- `gs/buttons.lua` draws the button icons in texts (`{a}`); their art, `gs/buttons_art.lua`, is written by `scripts/make-buttons.mjs` (do
  not edit it by hand): run it, then `build.sh`.
- `consoles/*.json`: console specs (screen, palette, limits, budgets, audio). See `consoles/README.md`. A cart names its console in `game.lua`.

## Testing

`tests/framework` is a cart that checks the framework from inside (prints `FRAMEWORK TEST PASS`); `tests/run.sh` runs it. New framework features get
a check there. Test hooks: `GS_DEV=1` (live reload, error overlay), `GS_STATS=1` (one `@@gs {json}` line a second on stderr for the studio's Handheld tab), `GS_FF=n` (fast-forward), `GS_BOT_LUA=file` (script run at boot), `GS_KEYS`.
