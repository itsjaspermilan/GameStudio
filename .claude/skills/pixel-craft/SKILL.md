---
name: pixel-craft
description: Pixel art craft from the masters (Pedro Medeiros / saint11 and others) - clusters without anti-aliasing, hue-shifted ramps, selective outlines, dithering, subpixel animation, character proportions, frame economy (4-frame walks), and the anti-patterns (pillow shading, banding, doubles, thin protrusions, sliding walks). Use alongside the project's own pixel-art skill when drawing or reviewing sprites and animations.
---

# Pixel craft

General pixel-art technique, from the `pixel-art` skill of [omer-metin/skills-for-antigravity](https://github.com/omer-metin/skills-for-antigravity)
(Apache License 2.0, see `LICENSE`). The project's own `pixel-art` skill says how art is made and sized in GameStudio (banks, sizes, the
generators); this one is the craft to judge it by.

- **Creating:** read `references/patterns.md` (clusters, hue shifting, dithering, subpixel animation, selective outlining, retro hardware,
  tilesets, character proportions, animation frame economy).
- **Diagnosing:** read `references/sharp_edges.md` (rotation, mixed pixel scales, non-integer scaling, colour count, subpixel jitter,
  too much dithering, characters that slide instead of walk).
- **Reviewing:** read the anti-patterns at the end of `references/patterns.md` (pillow shading, banding, too many colours, mixed scales,
  automatic anti-aliasing, outline-to-background AA, frame count obsession, thin protrusions, insufficient contrast, doubles in lines)
  and `references/validations.md`.

Check every sprite at 1x and at the handheld's 2x before calling it done: if it cannot be read at 1x, it has failed.
