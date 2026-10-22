---
name: pixel-art
description: Drawing sprites and tiles for GameStudio games (heroes, enemies, bullets, pickups, effects, tilesets, icons), fitted to the kind of game being made and to the handheld's 320x240 screen and palette. Use when creating, redrawing, resizing or animating any sprite or tileset, or when art looks too small, muddy, blotchy or hard to read.
---

# Pixel art for GameStudio

The craft lives in the studio's Help, so people and every agent read the same text. **First read the guide**: help('art') and help('sizes') with the
`gamestudio` MCP server's `help` tool (or read `docs/help/93-art.html` and `docs/help/91-sizes.html`). Then work with its tools:
`overview` the game first (its console and the sizes already used), draw with `sprite_write` at the real size (never draw small and enlarge), look at each result and with `sprite_view` beside the hero, then `run` the game to see it among everything else. A tileset is `sprite_write` with `tileset: { cols }`.

The tool descriptions give the exact formats (palette places, drawing ops, map legends, the song generator's options). Any MCP client can
start the same work from the server's prompts (`draw-art`, `design-level`, `compose-music`).
