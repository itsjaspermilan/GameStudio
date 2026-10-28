# tools/mcp/: GameStudio for agents (an MCP server)

`server.mjs` speaks MCP over stdio; `tools.mjs` does the work as plain functions returning `{ text, images? }` (PNG, base64). The repo's
`.mcp.json` starts it for Claude Code (`node tools/mcp/server.mjs`); run `npm install` here once after cloning. `GS_WORKSPACE` points it at
another workspace (default: this repository).

It reuses, never copies: `studio/src/*-core.js` (lint, project scan, songs and sound effects, rooms, Help pages, Tidy), `studio/src/music-core.js`
(reading a song with music theory), `scripts/lib/` (pixel canvas, song generator), `scripts/png.mjs`, and the real runtime `build/gs`
(headless runs with `GS_DUMP_FRAME`, `GS_STATS`, `GS_INSPECT`, the key and random bots; `render-audio` for sound). Build `build/gs` first.

| Tool | What |
| --- | --- |
| `api`, `help`, `games`, `overview` | Look things up: the gs API from `engine/api/gs.d.lua`, Help pages as text, the games, one compact page per game |
| `check` | The editor's lint over every Lua file, untidy indentation, then a headless run's errors and numbers |
| `run`, `inspect` | Run headless (buttons, the random bot or a `bot_lua` of the caller's, from a `scene`) and return screenshots (`shots`, evenly spaced); the inspector's kinds and costs, an entity's values, watch expressions |
| `sprite_view`, `sprite_write` | A sprite as a picture (and as palette letters); draw one from letter rows or shape ops with the console's palette, or in a game with colour banks with one bank's places 1-f (`bank`; a tileset takes `banks` and a `bank` per tile); `tileset: { cols }` writes a tileset instead |
| `instruments`, `song_check`, `song_write`, `sound_check`, `sound_write` | Sound: the theory reading (key, chords, melody on the chords, clashes, registers, shape) plus render measurements (loudness, clipping, brightness in Hz) |
| `room_view`, `room_write` | A room (`level1`: `rooms/level1.lua`) or a scene's layout (`scenes/title`: `scenes/title.layout.lua`) drawn at its real size (tiles, panels, pictures, things as their sprites, texts in the game's fonts, paths, one screen dashed) with counts; build or change one: size, layers written as text maps or painted, things, texts, pictures and panels added or removed, paths |
| `push` | `scripts/push.sh` for a game |

The craft (art, levels, music by kind of game) lives once, in the Help pages `docs/help/93-art.html`, `94-levels.html`, `95-music.html`, so
people read it in the studio and every agent reads it through `help`. The server's three prompts (`draw-art`, `design-level`,
`compose-music`) start a task with the matching guide attached, for any MCP client; Claude Code's skills in `.claude/skills/` are short
pointers to the same guides (they only add automatic triggering). `test/skills.test.mjs` checks that the guides and skills name real tools,
pages and instruments.

Keep the tool count small and the answers short: every description costs the agent context. New tool: a function in `tools.mjs`, a `tool(...)`
line in `server.mjs` (zod shape, one-paragraph description), and a call in `test/server.test.mjs` (`npm test`; the writing test works on a
copy of Breakout in a temporary workspace, so real games are never touched).
