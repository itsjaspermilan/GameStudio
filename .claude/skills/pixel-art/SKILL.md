---
name: pixel-art
description: Drawing sprites and tiles for GameStudio games (heroes, enemies, bullets, pickups, effects, tilesets, icons), fitted to the kind of game being made and to the handheld's screen (Glow43: 256x192) and palette. Use when creating, redrawing, resizing or animating any sprite or tileset, or when art looks too small, muddy, blotchy or hard to read.
---

# Pixel art for GameStudio

The craft lives in the studio's Help, so people and every agent read the same text. **First read the guide**: help('art') and help('sizes') with the
`gamestudio` MCP server's `help` tool (or read `docs/help/93-art.html` and `docs/help/91-sizes.html`). Then work with its tools:
`overview` the game first (its console and the sizes already used), draw with `sprite_write` at the real size (never draw small and enlarge), look at each result and with `sprite_view` beside the hero, then `run` the game to see it among everything else. A tileset is `sprite_write` with `tileset: { cols }`.

Games on Glow43 and Glow169 have GBA-style colour banks (`palette.json`): a sprite draws with one sprite bank (`sprite_write`'s `bank`), each tile
with one of its tileset's banks; shade with the bank's five-step ramps and outline in a ramp's darkest place, not black.
The tool descriptions give the exact formats (bank places, drawing ops, map legends, the song generator's options). Any MCP client can
start the same work from the server's prompts (`draw-art`, `design-level`, `compose-music`).
