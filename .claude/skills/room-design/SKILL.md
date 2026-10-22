---
name: room-design
description: Designing levels (rooms) for GameStudio games, fitted to the kind of game: platformer stages, top-down maps, survivors arenas, shoot-'em-up stretches, puzzle boards. Use when making or changing rooms/<name>.lua, laying out tiles, placing enemies and pickups, drawing patrol paths, or when a level is too hard, too empty, confusing or slow on the handheld.
---

# Room design for GameStudio

The craft lives in the studio's Help, so people and every agent read the same text. **First read the guide**: help('levels') with the
`gamestudio` MCP server's `help` tool (or read `docs/help/94-levels.html`). Then work with its tools:
`overview` the game, read the hero's entity file for its numbers (speed, jump, gravity), write the room with `room_write` (a layer can be a text map, one character a tile), look with `room_view`, play the route with `run` and `keys`, and finish with `check` and `inspect`.

The tool descriptions give the exact formats (palette places, drawing ops, map legends, the song generator's options). Any MCP client can
start the same work from the server's prompts (`draw-art`, `design-level`, `compose-music`).
