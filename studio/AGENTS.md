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

- **The project is its folder**, anywhere on disk: `state.cart` is the folder's absolute path (every `invoke` passes it as `cart`), `state.cartName` its name for display; the start screen lists recent folders (`list_projects`) and the examples (`list_examples`, opened as a copy). Open tabs and the tab you were on are saved to the game's `.gamestudio/state.json` (`saveProjectState`) and restored when it opens; the folder holds a `.gitignore` of `*` so git leaves it out. No index file: `project-core.js` (`GROUPS`, `scanProject`) turns the file list into the tree, so files added outside the studio show up. A game has
- **The built app is self-contained** (`scripts/build-app.sh`): `bundled_root` finds its read-only copy of the GameStudio folder in the
  app's resources and `workspace()` returns it (the Settings workspace is only used in development). What the studio writes goes
  elsewhere: `scratch_dir` (the workspace's `build/` in development, the app's cache folder when built: packed copies for the device,
  ADB `device.env` made from Settings, the language server's settings) and `consoles_dir` (custom consoles: the app's data folder when
  built). Every runtime launch goes through `runtime_command`, which passes the SoundFont's path (`GS_SOUNDFONT`).
  `game.lua`, `entities/ scenes/ rooms/ lib/` (Lua) and `sprites/ tilesets/ sfx/ music/ instruments/ sounds/`, plus `meta/info.json` (title, description, console, box art for the game list).
- **`main.js` is the conductor.** It owns `state` (open game, file list, the scan, which editor shows which file), the tree, saving, rename/delete, run/pack/push, and creates every
  editor with a `hooks` object.
- **Editors** (`*-editor.js`) are `createXEditor(rootElement, hooks)` returning `{load, getDef, isDirty, markClean, stop?, refresh?}`. They build their own DOM, keep their own undo `History`
  (`sprite-core.js`), call `hooks.onChange()` when dirty, and never touch files: `main.js` passes data in (`load(name, json)`) and reads it out (`getDef()`).
- **Pure logic** lives in `*-core.js` / `consoles.js` / `wav.js` (no DOM, unit-tested). Put new rules there, not in an editor.
- Rust is reached only through `invoke(...)` in `main.js` (and a few hooks); every command has a twin in `src/mock-backend.js`.
- Browser-only convenience state (collapsed groups, recent games, output hidden, the Look override) uses `localStorage` inside try/catch and must never be required.
- **Colours come from the theme.** CSS uses the variables at the top of `style.css` (`--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--surface`, `--ink`, ...), never a fixed colour for interface parts; canvas code uses `theme.js`. Fixed colours are only for content (the game's palette, a room's background, instrument lane colours, the mock game screen). Check new UI in both modes (the browser pane can emulate light and dark).
- **Run** starts the game with `GS_DEV=1`: saving a Lua file or an asset updates the running game (live reload, see `../engine/AGENTS.md`). By default the game shows in the Play panel beside the code
  (`play-panel.js`: the runtime sends frames over a local socket, `run_preview` relays them through a Tauri `Channel`); Settings can keep it in a window of its own.
  **The studio plays like the Brick:** `run_preview` sets `GS_RAM=1`, so Lua gets the libretro core's fixed 8 MB block (`runtime/ram.c`) and runs out of memory where the Brick does;
  the Play panel's Save state / Load state send `S` / `L` on the same socket (`preview_state`; one state a run, kept by the runtime). `brick-core.js` turns the `@@gs` numbers into
  the RAM in use and an estimated Brick frame (0.34 ms per screen drawn + 10.6 x this computer's update time, fitted 2026-10-24 to 8 Brick runs of `tests/heavy` and Breakout against
  an M4; `test/brick-core.test.mjs` keeps the fit); the Play panel shows it under the screen, the Handheld tab as rows. Refit `BRICK` when the core's drawing or the engine changes a lot.

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

`docs/help/NN-slug.html` are the help pages (a comment header with `title`, `group`, `order`, `summary`, then HTML). A tutorial's game is its `<pre class="lua" data-path="entities/x.lua">` blocks (HTML-escaped: `&lt;`)
and its art, sprites written as text: `<pre class="sprite" data-path="sprites/coin.json" data-bank="items" data-origin="8,8" data-mask="..." data-animations="idle 0-0 4; walk 1-2 6">`, one character a
pixel (`.` see-through, `1`-`f` the bank's places), frames apart by an empty line; Help shows them as pictures and they become real sprites (`spriteBlockFiles` in help-core, `spriteFromText` in sprite-core).
Tutorials draw with sprites, not with `gs.draw.rect`, like the starter game (its player is `STARTER_PLAYER` in project-core);
**`test/help.test.mjs` writes each tutorial's files to a temp folder and plays it with `tests/random-bot.lua` through `build/gs`, and runs the editor's own lint over it**, so a tutorial with a mistake fails the tests.
Links between pages are `href="help:<slug>"`. The API page is generated; document new `gs.*` functions in `engine/api/gs.d.lua`, not in a page.
Help opens in a **window of its own** (`help.html` + `src/help-window.js`, the Vite build's second page; Tauri window label `help`), so
a tutorial stays open beside the studio. `help.js` (`createHelp`) draws the pages in either that window or a `<dialog>`. What a page does
to the game (Add to my game, Make this game, open an example) is a request to the studio's window over `src/help-bridge.js` (Tauri events
in the app, a `BroadcastChannel` between tabs in the browser mock), which does it and replies; the studio tells Help whether a game is
open and which consoles exist (`tellHelp`, on every render, only when it changed). Closing the studio's window quits the app, Help too.
The Handheld tab gets its live numbers from the game's stderr (`@@gs {json}` once a second, only when `GS_STATS` is set, which `run_preview` does); `engine/gs/boot.lua` writes it. Times are CPU time on the computer, so the panel
only uses them as a guide and treats the entity count as the exact number. The `@@gs` line also carries `checks` (collision checks in the busiest step), `screens` (pixels drawn in the busiest frame, in screens) and `calls` (drawing calls in it); the panel shows the first two against the console's `collision_tests` and `draw_screens` budgets.
With the console's RAM (`GS_RAM`, or the core) it adds `ram_kb`, `ram_peak_kb` and `ram_size_kb` (from `gs.raw.ram()`: TLSF blocks in use, overhead included).

## Sound editors (the most active area)

`audio-core.js` is the hub (instruments, sfx tracks, tracker songs, key lock, timing, beats, starter songs, `AudioDesc` for previews). `lanes.js` draws the piano-roll lanes shared by
`sfx-editor.js` and `music-editor.js`; `instrument-panel.js` is the drag-and-drop palette; `instrument-editor.js` edits custom instruments. Previews render through `build/gs render-audio`
via the `render_audio` command, so they sound exactly like the game. Start with the section markers in `audio-core.js` (`// ---------- name ----------`).

## Verifying UI changes

Use the built-in browser pane on `http://localhost:1420` (see the root guide about the port). The mock backend has demo projects (`demo`, `hello`, as `/Users/you/Documents/GameStudio/...` paths; `demo` is also its example, and the folder pickers always pick Documents/GameStudio). Typical flow: click `demo` →
the **+** beside a group → type a name → Enter. Hot reload resets the page, so redo the clicks after edits. The pane is small (about 1024x768 CSS px): keep editors usable at that size.
