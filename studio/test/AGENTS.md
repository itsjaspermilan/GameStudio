# studio/test/: node:test

Run with `cd studio && npm test` (`node --test test/*.test.mjs`, ~165 tests, a few seconds). Files ending `.test.mjs` are tests; `synth-helpers.mjs` and `builtin-helper.mjs` are helpers.

- **`synth-helpers.mjs`** renders a description through the real runtime: `runRender(desc, files?)` writes it to a temp dir, runs `build/gs render-audio` there and returns
  `{samples, left, right, fmt}`; also `rms`, `seg(seconds)`, `freq`, `skip` (true when `build/gs` is missing, so audio tests skip instead of fail). Tests that need the SoundFont also check
  `assets/soundfonts/FluidR3Mono_GM.sf3` exists.
- **`builtin-helper.mjs`** loads `engine/instruments.json` into `audio-core.js` (`setBuiltinInstruments`). Import it first in any test that touches built-in instruments.
- `audio-core.test.mjs` (sfx model, instruments, ranges, ties), `audio-tracker.test.mjs` (songs, notes, kit, key lock, timing, beats, melody, starter songs, plus runtime renders),
  `synth*.test.mjs` (waveforms and effects measured from rendered audio), `project-core` (names, the folder scan, templates; the starter game and every template really run through `build/gs`),
  `rename-core` (sound references, code mentions), `lua-intel-core` (API file, completion, hover, lint; also checks `engine/api/gs.d.lua` covers the framework), `budget-core` (Handheld rows), `help` (every page parses, links resolve, **every tutorial game runs**, highlighter, API page, search; about 30 s), `lsp-client` (protocol on a fake server), `lua-server` (the real LuaLS binary, skipped when `third_party/luals` is missing), `sprite-core`, `consoles`, `console-check`, `info-core`, `wav`.
- Test the **behaviour** (notes in key, lengths, waveforms), not the DOM. UI is checked by hand in the browser pane.
- Reminder: rebuild `build/gs` after editing `runtime/` or `engine/` or these tests exercise a stale binary.
