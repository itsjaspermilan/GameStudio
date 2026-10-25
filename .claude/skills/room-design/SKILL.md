---
name: room-design
description: Designing levels (scene layouts) for GameStudio games, fitted to the kind of game: platformer stages, top-down maps, survivors arenas, shoot-'em-up stretches, puzzle boards. Use when making or changing scenes/<name>.layout.lua (or an older game's rooms/<name>.lua), laying out tiles, placing enemies and pickups, drawing patrol paths, or when a level is too hard, too empty, confusing or slow on the handheld.
---

# Level design for GameStudio

The craft lives in the studio's Help, so people and every agent read the same text. **First read the guide**: help('levels') with the
`gamestudio` MCP server's `help` tool (or read `docs/help/94-levels.html`). Then work with its tools:
`overview` the game, read the hero's entity file for its numbers (speed, jump, gravity), write the level with `room_write` (a layer can be a text map, one character a tile), look with `room_view`, play the route with `run` and `keys`, and finish with `check` and `inspect`.
A level is a scene's layout (`scenes/<name>.layout.lua`); `room_write` with name "level1" writes `scenes/level1.layout.lua`. Ten levels
can share one scene's rules (`code = "play"` in each layout), or a scene can build one into itself with `gs.load_layout("level1")`.

The tool descriptions give the exact formats (palette places, drawing ops, map legends, the song generator's options). Any MCP client can
start the same work from the server's prompts (`draw-art`, `design-level`, `compose-music`).
