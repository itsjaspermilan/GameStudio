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
| `world.lua` | spawn/destroy, tag lists, spatial grids, collisions, depth buckets, scenes and fades, scene layouts (`scenes/<name>.layout.lua`: built before `enter`, named things become scene fields, `code = "other"` runs another scene's code; texts and pictures are the built-in kinds `gs.world.Text` / `gs.world.Picture`), `gs.load_layout` (another scene's layout built into the running one; falls back to the older `rooms/`, and `gs.load_room` is its older name), tile layers, and moving against them (`Entity:slide`, `touching_tile`, `gs.tile_kind`: a layer with `solid = true`, its tileset's `kinds`). Live reload restarts the scene when its layout changes |
| `timers.lua` | after / every / tween / coroutines (`gs.go`, `gs.wait`), owned by an entity or scene so they die with it |
| `camera.lua`, `input.lua`, `draw.lua`, `ui.lua`, `save.lua`, `sound.lua`, `assets.lua`, `json.lua` | what the names say |
| `reload.lua` | live reload (GS_DEV=1): polls file mtimes, re-requires changed files into the same class tables, rolls back on error |
| `inspect.lua` | the studio's Inspector (GS_INSPECT=<file>): reads pause / step / speed / what to look at from the file, answers with `@@gsi {json}` (kinds with update/draw/collision time, a kind's entities, one entity's values, watch expressions); `world.profile` turns the timing on only while it is open |
| `determinism.lua` | internal netplay foundations: `GS_SESSION_SEED` seeds gameplay before game.lua and isolates draw-time random/randomseed (including cached references); `GS_CHECKSUM=1` emits scalar-state hashes every 60 steps. Not a complete state hash or a public networking API; see `docs/netplay-design.md` |
| `net.lua` | experimental local Wi-Fi sessions: discovery, lobby/start retries, chunked host saves, fixed two-step lockstep inputs and relay for four, scalar drift checks, waiting/end handling. `gs.net` is the game API (`players` in game.lua); `gs.transport` is private native UDP. No socket until a game asks for one. See `docs/netplay-design.md` for current limits |
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
Live queries (`nearest`, `in_radius`, `in_rect`, `touching`, `touching_all`) scan current entities in native code, not the collision grid's
step snapshot: direct position/scale/hitbox edits and spawns/destroys must be visible to the next query. They remain O(tag size) per query.
`gs.in_radius_batch(points, radius, tag, out)` is the explicit snapshot alternative: capture positions once, sort targets along x, then
range-search each point and restore creation order in each result. Ordinary live queries are unchanged. Reuses output lists; temporary
snapshot storage lives in Lua RAM, with no external pointers to repair on Resume. Apply movement after collecting the batch.
Drawing pools buckets for active depths and releases drawable references after each draw; particles likewise pool only simultaneous depths.
Tile edits maintain occupancy and patch the changed cell rectangle of an existing layer picture; a new layer still needs a full composition,
even when it reuses another scene's picture slot. Composed recipes stay current for same-run state loads and cross-process Resume.
Entities are classes keyed by module name; reloading a file fills the same table, so living instances keep their state and get the new methods.
Public names are documented at the top of each module. The runtime's own low-level calls stay in `gs.raw`.

## Other files

- `api/gs.d.lua`: the API as annotations (hover text, completion, the Help page and the language server all read it). **Add every new `gs.*` function or Entity method here**; `studio/test/lua-intel-core.test.mjs` fails if one is missing. Not embedded, not packed.

- `instruments.json`: ready-made instruments for the synth (type `gm` uses the SoundFont).
- `fonts/round-*.txt`, `fonts/square-*.txt`: the built-in letters, drawn as text. They reach `gs` through `runtime/fonts.h`, which
  `scripts/make-fonts.mjs` writes (with the bold style made from round), not through CMake: run it, then `build.sh`.
  `fonts/sans.txt`, `serif.txt`, `mono.txt` contain 16-row anti-aliased coverage drawings; the same generator embeds them.
  To redraw those from pinned open-licensed sources, run `scripts/rasterize-fonts.py` with Python 3 and Pillow 11.3.0 first.
- `gs/buttons.lua` draws the button icons in texts (`{a}`); their art, `gs/buttons_art.lua`, is written by `scripts/make-buttons.mjs` (do
  not edit it by hand): run it, then `build.sh`.
- `consoles/*.json`: console specs (screen, palette, limits, budgets, audio). See `consoles/README.md`. A cart names its console in `game.lua`.

## Testing

`tests/framework` is a cart that checks the framework from inside (prints `FRAMEWORK TEST PASS`); `tests/run.sh` runs it. New framework features get
a check there. Test hooks: `GS_DEV=1` (live reload, error overlay), `GS_STATS=1` (one `@@gs {json}` line a second on stderr for the studio's Handheld tab), `GS_FF=n` (fast-forward), `GS_BOT_LUA=file` (script run at boot; `bot_load` runs another file beside it), `GS_KEYS`, `GS_START_SCENE=name`,
`GS_DUMP_FRAME=file.bmp` (the last frame; with `GS_DUMP_EVERY=n` every nth, numbered). `gs.draw.bake` draws into a render target (`gs.raw.bake` in
`runtime/main.c`) and keeps the pixels read back, so a baked picture is an ordinary one to save states.
