---
name: game-music
description: Composing songs and sound effects for GameStudio games, fitted to the kind of game and its moods (title, levels, bosses, menus, victory, game over, jumps, hits, pickups). Use when writing or changing music/*.json or sfx/*.json, choosing instruments, or when sound is harsh, shrill, too loud, too quiet, repetitive or clashing.
---

# Game music for GameStudio

The craft lives in the studio's Help, so people and every agent read the same text. **First read the guide**: help('music') with the
`gamestudio` MCP server's `help` tool (or read `docs/help/95-music.html`). Then work with its tools:
`overview` the game to hear what it already uses, list instruments with `instruments`, write with `song_write` or `sound_write`, and act on everything `song_check` or `sound_check` reports (it reads the notes with music theory and measures loudness, clipping and brightness) before calling it done.

The tool descriptions give the exact formats (palette places, drawing ops, map legends, the song generator's options). Any MCP client can
start the same work from the server's prompts (`draw-art`, `design-level`, `compose-music`).
