# carts/: the examples that come with the studio

The user's own games are folders anywhere on disk (the studio's **Open folder…** / **New game** ask where; most live in `Documents/GameStudio`).
`carts/` holds only what ships with the studio: the examples and two device tools. The studio never edits these in place: opening an example copies it
into a folder of the user's own first (`copy_example`). A game is a **framework cart**: `game.lua`, `entities/`, `scenes/` (code and `<name>.layout.lua` layouts), `rooms/`, `lib/`,
`sprites/ tilesets/ sfx/ music/ instruments/ sounds/`, `palette.json` (colour banks), `meta/info.json` and pictures for the game list, and a hidden `.gamestudio/` the studio writes (open tabs; never packed). Details: `engine/AGENTS.md`.

| Cart | What |
| --- | --- |
| `breakout` | **The example**, made the way the Help teaches: every screen is a scene with a layout (`title`, `play`, `over`); the play layout places the paddle, ball, 48 bricks (entities with `{ row = n }`), a tile-panel score bar (`ui`) and named texts the code fills in; a starfield tile layer (`space`, 32x32 tiles) on every screen; colour banks `ball`, `paddle`, `bricks`, `space`, `ui`, `text`; built-in fonts (`bold_tall`, `round_tall`, shadows). Three entities (`paddle`, `ball`, `brick`), `lib/state.lua` (score, lives, best in `gs.save`). Also the fixture for `tests/run.sh` (inspector, layer pictures, sound queue, stats line, a bot playthrough), the studio's Play panel test and the MCP server's tests (which copy it into a throwaway workspace) |
| `netplay-playground` | Multiplayer example: `scenes/menu.lua` hosts/finds/joins with remembered preset names; `board.lua` is 2–4-player Three in a row (a scalar string board, indexed active-turn input); `sprint.lua` and `entities/runner.lua` are a live star-collecting platform race. `lib/course.lua` holds platforms/star sites; `lib/playground.lua` shares UI and leave/rematch behaviour. Offline practice is a two-player pass-and-play board or solo sprint. State starts in `enter`; `gs.net.me` is presentation-only. Tests in `tests/playground.test.mjs` drive the actual menus and both modes with separate runtimes; Help's Playing together guide opens a copy |
| `buttontest`, `padsetup` | Small framework carts for checking controller buttons on a device (they call the runtime's `gs.btn`, `gs.pad_last`, `gs.pad_set` directly); Pad setup also records the HOTKEY |

`tests/run.sh` runs all four headless and requires no errors or warnings, so keep them loading. The examples' art was drawn with the MCP server's `sprite_write`; redraw it the same way. Keep Breakout's sprite `fps` at 0 (the brick's six frames are six colours, not an animation).
