# carts/: the examples that come with the studio

The user's own games are folders anywhere on disk (the studio's **Open folder…** / **New game** ask where; most live in `Documents/GameStudio`).
`carts/` holds only what ships with the studio: the example and two device tools. The studio never edits these in place: opening an example copies it
into a folder of the user's own first (`copy_example`). A game is a **framework cart**: `game.lua`, `entities/`, `scenes/` (code and `<name>.layout.lua` layouts), `rooms/`, `lib/`,
`sprites/ tilesets/ sfx/ music/ instruments/ sounds/`, `palette.json` (colour banks), `meta/info.json` and pictures for the game list, and a hidden `.gamestudio/` the studio writes (open tabs; never packed). Details: `engine/AGENTS.md`.

| Cart | What |
| --- | --- |
| `breakout` | **The example**, made the way the Help teaches: every screen is a scene with a layout (`title`, `play`, `over`); the play layout places the paddle, ball, 48 bricks (entities with `{ row = n }`), a tile-panel score bar (`ts_ui`) and named texts the code fills in; a starfield tile layer (`ts_space`, 32x32 tiles) on every screen; colour banks `ball`, `paddle`, `bricks`, `space`, `ui`, `text`; built-in fonts (`bold_tall`, `round_tall`, shadows). Three entities (`paddle`, `ball`, `brick`), `lib/state.lua` (score, lives, best in `gs.save`). Also the fixture for `tests/run.sh` (inspector, layer pictures, sound queue, stats line, a bot playthrough), the studio's Play panel test and the MCP server's tests (which copy it into a throwaway workspace) |
| `buttontest`, `padsetup` | Small framework carts for checking controller buttons on a device (they call the runtime's `gs.btn`, `gs.pad_last`, `gs.pad_set` directly); Pad setup also records the HOTKEY |

`tests/run.sh` runs all three headless and requires no errors or warnings, so keep them loading. Breakout's art was drawn with the MCP server's `sprite_write`; redraw it the same way, and keep sprite `fps` at 0 (the brick's six frames are six colours, not an animation).
