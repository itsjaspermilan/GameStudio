# studio/src/: file map

Sizes are lines. Pure = no DOM, covered by a test in `../test/`.

| File | What |
| --- | --- |
| `main.js` (~700) | State, the tree, save/rename/delete, run/pack/push, creates every editor. Sections: log, code editor, the project's console, rendering, actions, consoles, changing a console, files, game info, resources (tree), sprites, tilesets, samples, **sound effects, music and instruments** (+ audio context, previews), toolbar, settings, boot |
| `project-core.js` pure | The project model: `GROUPS` (folders and how each opens), `scanProject` (file list to tree), names and Lua module names, templates of new files, `newGameFiles` (the starter game), console in `game.lua` / `meta/info.json` |
| `mock-backend.js` | In-memory fake of the Rust commands for plain-browser development (demo projects, fake `render_audio`) |
| `audio-core.js` (~870) pure | Sound hub: sfx tracks/steps/ties, instruments + built-in set, key lock, `AudioDesc` (builds `gs render-audio` descriptions), tracker song model + note/kit ops, ranges, timing, drum beats, melody generator, starter songs, legacy converters |
| `lanes.js` | Canvas lanes (instrument box + piano roll / drum / drum kit strip): rows, snapping, resize, collapse, hover, playhead. Reports user actions through callbacks |
| `sfx-editor.js`, `music-editor.js` | The two lane editors (drag to stretch or move notes, overlapping notes on voices, per-lane key and volume, key lock, inspector strip, playback + playhead) |
| `instrument-panel.js` | Right-hand palette (drag instruments), colours, `CHANNEL_COLORS`, drag helpers |
| `instrument-editor.js` | Custom instrument editor (kind, wave drawing, ADSR, range, piano preview) |
| `lua-intel-core.js` pure | What the editor knows without a language server: reads `engine/api/gs.d.lua` (`parseApi`), the project index (tags, modules, `self` fields), cursor context, completion, hover, and the lint rules (unknown sprite/sound/entity/scene/tag names with "did you mean", missing `return`, tables allocated in `update`) |
| `lua-editor.js` | The CodeMirror extensions over it: completion (own first, then the server), hover, linter (own + server), ctrl/cmd-click and F12 to open what a name refers to |
| `lsp-client.js` pure, `lua-server.js` | The Lua language server (LuaLS): `lsp-client.js` speaks the protocol over any `send`/`receive`; `lua-server.js` starts it for the open game (`lsp_start` in `src-tauri/src/lsp.rs`), syncs documents and answers completion / hover / definition / diagnostics. Optional: without `third_party/luals` the editor uses `lua-intel-core.js` alone |
| `budget-core.js` pure | The Handheld panel's rows (size, art, sound, code, and the live numbers) from the console spec and measured facts; parses the game's `@@gs` stats line. The panel itself is the "Handheld" section of `main.js` |
| `help-core.js` pure, `help.js` | The Help window: reads `docs/help/*.html` (comment header + HTML), search, contents, a Lua colourer, the API page made from `engine/api/gs.d.lua`, and the files of a tutorial's game (`gameFiles`). `help.js` is the dialog: "Copy", "Add to my game" and "Make this game" |
| `consoles.js` pure, `console-editor.js`, `console-check.js` pure | Console specs: defaults/validation, the dialog, project-vs-console budget checks |
| `sprite-editor.js`, `sprite-core.js` pure, `sprite-io.js`, `palette-ui.js` | Pixel editor for sprites and tilesets (`History` undo class lives in `sprite-core.js`) |
| `info-core.js` pure | Game info (`meta/info.json`: title, description, developer, genre, players; pictures `PICTURES`: box art, screenshot, logo in `meta/`): normalising, PNG and BMP reading (the screenshot comes from `take_screenshot`), the `gamelist.xml` `<game>` entry that `scripts/gamelist.mjs` prints for `scripts/push.sh`. The dialog is the "game info" section of `main.js` |
| `room-core.js` pure, `room-editor.js` | Rooms (`rooms/<name>.lua`): `parseRoom` reads the data subset of Lua (refuses code, so such a room opens as text), `serializeRoom` writes it back tidy (a tile row per line, an entity per line, `paths`); the editor paints tile layers, places and drags entities (shown with the sprite their file names), draws paths, sets the room size (the camera's bounds). Opened from the Rooms group (`openRoom` in `main.js`) |
| `search-core.js` pure | Find and replace across the game's Lua files, `outline` (functions in a file), `reindent` (the Tidy button: indentation from blocks and brackets; a test runs it over every Lua file in the repo and the tutorials, which must come out unchanged), `applyEdits` (language-server edits) |
| `inspector-core.js` pure | The Inspector tab: `@@gsi` lines in, the GS_INSPECT command text out, kinds sorted by cost. The tab itself is the "inspector" section of `main.js` |
| `steps-core.js` pure | The First steps checklist on the welcome screen (kept in localStorage) |
| `rename-core.js` pure | Rename a resource and rewrite the sound files that name it; counts mentions in Lua code |
| `wav.js` pure | WAV import checks |
| `style.css` (~480) | All styles; sections per editor. Colours are CSS variables on `:root` |

Imports: `main.js` imports everything; editors import `audio-core.js` / `sprite-core.js` (History) / `instrument-panel.js` / `lanes.js`. `engine/instruments.json` is imported
by `main.js` only (`audio-core.js` receives the instruments through `setBuiltinInstruments`, so tests can load it without JSON imports).
