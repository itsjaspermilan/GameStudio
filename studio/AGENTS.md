# studio/: the app (Vite + vanilla JS, Tauri 2 + Rust)

`index.html` + `src/` (front end, no framework; CodeMirror for Lua) and `src-tauri/` (Rust back end). Per-file map: `src/AGENTS.md`. Tests: `test/AGENTS.md`.
Back-end commands: `src-tauri/AGENTS.md`.

```sh
npm test                      # node --test test/*.test.mjs   (the synth tests need ../build/gs, build it first)
npm run dev                   # Vite only, port 1420 (strictPort). With no Tauri present, src/mock-backend.js fakes the Rust commands in memory
npm run tauri dev             # the real app (the user normally runs this; it hot-reloads the front end)
npx vite build                # quick syntax/bundle check of the front end
```

## How the front end is organised

- **The project is its folder.** No index file: `project-core.js` (`GROUPS`, `scanProject`) turns the file list into the tree, so files added outside the studio show up. A game has
  `game.lua`, `entities/ scenes/ rooms/ lib/` (Lua) and `sprites/ tilesets/ sfx/ music/ instruments/ sounds/`, plus `meta/info.json` (title, description, console, box art for the game list).
- **`main.js` is the conductor.** It owns `state` (open game, file list, the scan, which editor shows which file), the tree, saving, rename/delete, run/pack/push, and creates every
  editor with a `hooks` object.
- **Editors** (`*-editor.js`) are `createXEditor(rootElement, hooks)` returning `{load, getDef, isDirty, markClean, stop?, refresh?}`. They build their own DOM, keep their own undo `History`
  (`sprite-core.js`), call `hooks.onChange()` when dirty, and never touch files: `main.js` passes data in (`load(name, json)`) and reads it out (`getDef()`).
- **Pure logic** lives in `*-core.js` / `consoles.js` / `wav.js` (no DOM, unit-tested). Put new rules there, not in an editor.
- Rust is reached only through `invoke(...)` in `main.js` (and a few hooks); every command has a twin in `src/mock-backend.js`.
- Browser-only convenience state (collapsed groups, recent games, output hidden, the Look override) uses `localStorage` inside try/catch and must never be required.
- **Colours come from the theme.** CSS uses the variables at the top of `style.css` (`--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--surface`, `--ink`, ...), never a fixed colour for interface parts; canvas code uses `theme.js`. Fixed colours are only for content (the game's palette, a room's background, instrument lane colours, the mock game screen). Check new UI in both modes (the browser pane can emulate light and dark).
- **Run** starts the game with `GS_DEV=1`: saving a Lua file or an asset updates the running game (live reload, see `../engine/AGENTS.md`).

## Checklists

**New resource kind** (like `instruments`): a `GROUPS` entry in `project-core.js` (folder, extension, `kind`) → a `creators` and an `openers` entry in `main.js` → if it has its own editor: a `PANES` entry,
`index.html` container, create/open/save wiring (JSON editors reuse `openJsonResource`/`saveJsonResource`) → sound references to it go in `rename-core.js` → a test in `test/project-core.test.mjs`.

**New Tauri command:** `#[tauri::command]` fn in `lib.rs` (validate every path with `safe_rel`/`valid_name`; never take raw paths from JS) → add to `generate_handler!` → mock in `mock-backend.js` → call
from `main.js`. `cargo check` in `src-tauri/`.

## The Lua editor

Two layers. **`lua-intel-core.js`** (always on, no process): reads the API from `../engine/api/gs.d.lua`, so **a new `gs.*` function needs a documented entry in that file** (a test checks
the framework's functions and Entity methods are all there) and then completes, hovers and type-checks everywhere. It also knows the game's own files: `gs.spawn("` completes entity names,
`gs.sfx("` sound names, `gs.goto_scene("` scenes, tags, `require` paths; unknown names get a warning with a suggestion. **LuaLS** (optional, `scripts/fetch-luals.sh` puts it in
`third_party/luals`) adds general Lua: locals, `require`d modules, the standard library, go to definition, type diagnostics. Its settings are written by `src-tauri/src/lsp.rs`
(`write_config`: classes are open, unused locals are hints); `test/lua-server.test.mjs` drives the real binary. The app bundle carries the server (`tauri.conf.json` `bundle.resources`; the build runs
`scripts/fetch-luals.sh --if-missing` for the target's processor); `lsp.rs` prefers the workspace's `third_party/luals` and falls back to the bundled one.

## Help pages and the Handheld panel

`docs/help/NN-slug.html` are the help pages (a comment header with `title`, `group`, `order`, `summary`, then HTML). A tutorial's game is its `<pre class="lua" data-path="entities/x.lua">` blocks (HTML-escaped: `&lt;`);
**`test/help.test.mjs` writes each tutorial's files to a temp folder and plays it with `tests/random-bot.lua` through `build/gs`, and runs the editor's own lint over it**, so a tutorial with a mistake fails the tests.
Links between pages are `href="help:<slug>"`. The API page is generated; document new `gs.*` functions in `engine/api/gs.d.lua`, not in a page.
The Handheld tab gets its live numbers from the game's stderr (`@@gs {json}` once a second, only when `GS_STATS` is set, which `run_preview` does); `engine/gs/boot.lua` writes it. Times are CPU time on the computer, so the panel
only uses them as a guide and treats the entity count as the exact number. The `@@gs` line also carries `checks` (collision checks in the busiest step) and `screens` (pixels drawn in the busiest frame, in screens); the panel shows them against the console's `collision_tests` and `draw_screens` budgets.

## Sound editors (the most active area)

`audio-core.js` is the hub (instruments, sfx tracks, tracker songs, key lock, timing, beats, starter songs, `AudioDesc` for previews). `lanes.js` draws the piano-roll lanes shared by
`sfx-editor.js` and `music-editor.js`; `instrument-panel.js` is the drag-and-drop palette; `instrument-editor.js` edits custom instruments. Previews render through `build/gs render-audio`
via the `render_audio` command, so they sound exactly like the game. Start with the section markers in `audio-core.js` (`// ---------- name ----------`).

## Verifying UI changes

Use the built-in browser pane on `http://localhost:1420` (see the root guide about the port). The mock backend has demo projects (`demo`, `hello`). Typical flow: click `demo` →
the **+** beside a group → type a name → Enter. Hot reload resets the page, so redo the clicks after edits. The pane is small (about 1024x768 CSS px): keep editors usable at that size.
