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
| `run`, `inspect` | Run headless (buttons or a bot) and return a screenshot; the inspector's kinds and costs, an entity's values, watch expressions |
| `sprite_view`, `sprite_write` | A sprite as a picture (and as palette letters); draw one from letter rows or shape ops with the console's palette; `tileset: { cols }` writes a tileset instead |
| `instruments`, `song_check`, `song_write`, `sound_check`, `sound_write` | Sound: the theory reading (key, chords, melody on the chords, clashes, registers, shape) plus render measurements (loudness, clipping, brightness in Hz) |
| `room_view`, `room_write` | A room drawn at its real size (tiles, things as their sprites, paths, one screen dashed) with counts; build or change a room: size, layers written as text maps or painted, things added or removed, paths |
| `push` | `scripts/push.sh` for a game |

The project's skills (`.claude/skills/`: `pixel-art`, `room-design`, `game-music`) tell an agent how to use these tools well for the kind of
game being made; `test/skills.test.mjs` checks that every tool, file and instrument they name exists.

Keep the tool count small and the answers short: every description costs the agent context. New tool: a function in `tools.mjs`, a `tool(...)`
line in `server.mjs` (zod shape, one-paragraph description), and a call in `test/server.test.mjs` (`npm test`; the writing test works on a
copy of Breakout in a temporary workspace, so real games are never touched).
