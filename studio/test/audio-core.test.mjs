import test from "node:test";
import assert from "node:assert/strict";
import "./builtin-helper.mjs";
import * as A from "../src/audio-core.js";

test("note names follow the synth's mapping (pitch 0 is C1, 33 is A3)", () => {
  assert.equal(A.noteName(0), "C1");
  assert.equal(A.noteName(33), "A3");
  assert.equal(A.noteName(63), "D#6");
  assert.ok(Math.abs(A.pitchHz(33) - 220) < 0.01);
  assert.ok(Math.abs(A.pitchHz(45) / A.pitchHz(33) - 2) < 1e-9);
});

test("normalizeSfx repairs anything it is given", () => {
  const d = A.normalizeSfx({ speed: 999, tracks: [{ instrument: "piano", steps: [[99, 99, 99], "junk", [30, 1]] }, { instrument: 7 }], loop: { start: 5, end: 1 } });
  assert.equal(d.speed, 64);
  assert.equal(d.tracks.length, A.SFX_TRACKS);
  assert.deepEqual(d.tracks[0].steps[0], [63, 7, 0]); // the effect 99 is Hold, which needs a note before it, so it is dropped
  assert.deepEqual(d.tracks[0].steps[1], [36, 0, 0]);
  assert.deepEqual(d.tracks[0].steps[2], [30, 1, 0]);
  assert.equal(d.tracks[1].instrument, null);               // not a valid instrument
  assert.equal(d.tracks[1].steps.length, 3);                // every track as long as the longest
  assert.deepEqual(d.loop, { start: 2, end: 2 });
  assert.equal(A.normalizeSfx(null).tracks[0].steps.length, 1);
  assert.equal(A.normalizeSfx({ tracks: [{ steps: new Array(100).fill([1, 1, 1]) }] }).tracks[0].steps.length, A.MAX_STEPS);
  assert.equal(A.normalizeSfx({ tracks: [{ steps: [[1, 1, 1]] }], loop: "no" }).loop, null);
  assert.equal(A.normalizeSfx({ tracks: new Array(9).fill({ instrument: "bass", steps: [] }) }).tracks.length, A.MAX_SFX_TRACKS);
});

test("the older single-row sound effects become one track per instrument", () => {
  const d = A.normalizeSfx({ speed: 4, steps: [[30, 2, 7, 0], [32, 5, 6, 3], [34, 2, 5, 0]], loop: null });
  assert.equal(d.tracks[0].instrument, "square");
  assert.equal(d.tracks[1].instrument, "noise");
  assert.deepEqual(d.tracks[0].steps.map((s) => s[1]), [7, 0, 5]);   // the noise step is a rest here
  assert.deepEqual(d.tracks[1].steps.map((s) => s[1]), [0, 6, 0]);
  assert.deepEqual(d.tracks[1].steps[1], [32, 6, 3]);
  assert.equal(d.tracks.length, 2);                              // a sound effect has two lanes
  assert.equal(A.normalizeSfx({ speed: 4, steps: [[30, "lead", 7, 0]] }).tracks[0].instrument, "lead");
});

test("resizing adds silent steps and keeps the loop inside", () => {
  const d = A.normalizeSfx({ speed: 4, tracks: [{ instrument: "square", steps: [[40, 7, 0], [42, 7, 0], [44, 7, 0], [46, 7, 0]] }], loop: { start: 1, end: 3 } });
  A.resizeSfx(d, 6);
  assert.equal(d.tracks[0].steps.length, 6);
  assert.equal(d.tracks[1].steps.length, 6);                   // all tracks follow
  assert.deepEqual(d.tracks[0].steps[5], [46, 0, 0]);          // silent, same pitch as the step before
  A.resizeSfx(d, 3);
  assert.deepEqual(d.loop, { start: 1, end: 2 });
  A.resizeSfx(d, 1);
  assert.equal(d.loop, null);
  assert.equal(A.sfxLength(A.resizeSfx(d, 999)), A.MAX_STEPS);
  assert.equal(A.sfxSeconds(A.resizeSfx(A.newSfx(), 10)) * 1, (10 * 8) / 60);
});

test("transpose stays within range, and tracks take instruments", () => {
  const d = A.normalizeSfx({ tracks: [{ instrument: "square", steps: [[60, 7, 0], [3, 7, 0]] }] });
  A.transposeSfx(d, 12);
  assert.deepEqual(d.tracks[0].steps.map((s) => s[0]), [63, 15]);
  A.transposeSfx(d, -24);
  assert.deepEqual(d.tracks[0].steps.map((s) => s[0]), [39, 0]);
  A.setSfxInstrument(d, 1, "bell");
  assert.equal(d.tracks[1].instrument, "bell");
});

test("the render description numbers instruments and joins the tracks", () => {
  const d = A.normalizeSfx({ speed: 6, tracks: [{ instrument: "piano", steps: [[40, 7, 0], [44, 6, 1]] }, { instrument: "square", steps: [[30, 5, 0], [30, 0, 0]] }, { instrument: null }], loop: { start: 0, end: 1 } });
  const r = A.renderSfxWith(d, {}, { volume: 0.5, seconds: 2, style: "gba" });
  assert.deepEqual(r.problems, []);
  assert.match(r.text, /^style gba$/m);
  assert.match(r.text, /^sfxchannels 3$/m);
  assert.match(r.text, /^inst 6 wave [0-9A-F]{32} /m);        // the built-in piano is described
  assert.match(r.text, /^sfx 0 6 2 0 1 0\ns 40 6 7 0\ns 44 6 6 1\nsfx 1 6 2 0 1 0\ns 30 2 5 0\ns 30 2 0 0\n/m);
  assert.match(r.text, /^render sfx 0,1 0.5 2$/m);            // the empty track is left out
  assert.equal(A.renderSfxWith(A.normalizeSfx({ tracks: [{ instrument: null }] }), {}).silent, true);
  assert.deepEqual(A.renderSfxWith(A.normalizeSfx({ tracks: [{ instrument: "ghost", steps: [[40, 7, 0]] }] }), {}).problems, ["instrument 'ghost' is missing"]);
});

test("the built-in instruments are all valid and cover a band", () => {
  const all = A.builtinInstruments();
  assert.ok(all.length >= 12);
  const groups = new Set(all.map((d) => d.group));
  for (const g of ["Keys", "Orchestra", "Synth", "Drums"]) assert.ok(groups.has(g), g);
  for (const d of all) {
    assert.ok(/^[a-z0-9_]+$/.test(d.name) && d.label, d.name);
    assert.deepEqual(A.normalizeInstrument(d).type, d.type, d.name);
    if (d.type === "wave") assert.match(d.wave, /^[0-9A-F]{32}$/, d.name);
  }
  for (const n of ["piano", "kick", "snare", "hihat", "bass", "lead"]) assert.ok(A.isBuiltinName(n), n);
  assert.ok(!A.isBuiltinName("mine"));
  assert.equal(A.instrumentLabel("tri"), "Triangle");
  assert.equal(A.instrumentLabel("hihat"), "Hi-hat");
  assert.equal(A.instrumentLabel("mine"), "mine");
  assert.equal(A.normalizeInstrument(A.builtinDef("kick")).fixed_note, 24);
  assert.deepEqual(A.normalizeInstrument(A.builtinDef("kick")).sweep, { semitones: 36, ms: 90 });
});

test("music: older patterns are padded to 4 channels and loops are kept in range", () => {
  const m = A.normalizeMusic({ patterns: [["a"], ["b", null, 7, "c", "extra"]], loop: { from: 9, to: 0 } });
  assert.deepEqual(m.patterns, [["a", null, null, null], ["b", null, null, "c"]]);
  assert.deepEqual(m.loop, { from: 1, to: 1 });
  assert.equal(A.normalizeMusic({}).patterns.length, 1);
  assert.equal(A.normalizeMusic({ patterns: [[]], loop: null }).loop, null);
});

test("presets and the randomiser always make valid sounds, and the same seed makes the same sound", () => {
  for (const [name, make] of Object.entries(A.PRESETS)) {
    const d = A.normalizeSfx(make());
    assert.deepEqual(A.normalizeSfx(d), d, name);
    assert.ok(d.tracks[0].steps.some((s) => s[1] > 0), name);
  }
  for (let seed = 1; seed <= 60; seed++) {
    const d = A.randomSfx(seed);
    assert.deepEqual(A.normalizeSfx(d), d, `seed ${seed}`);
    assert.ok(d.tracks.some((t) => t.steps.some((s) => s[1] > 0)), `seed ${seed} is silent`);
  }
  assert.deepEqual(A.randomSfx(7), A.randomSfx(7));
  assert.notDeepEqual(A.randomSfx(7), A.randomSfx(8));
});

test("General MIDI instruments: 128 programs and a drum kit, described for the runtime", () => {
  const gm = A.gmPrograms();
  assert.equal(gm.length, 128);
  assert.deepEqual(gm.map((d) => d.program), Array.from({ length: 128 }, (_, i) => i));
  assert.equal(gm[0].label, "Acoustic grand piano");
  assert.equal(gm[127].label, "Gunshot");
  assert.equal(new Set(gm.map((d) => d.group)).size, 16);
  assert.deepEqual(A.BUILTIN_SETS().map((s) => s.id), ["chip", "gm"]);
  assert.ok(A.BUILTIN_GROUPS("gm").includes("Drum kit") && !A.BUILTIN_GROUPS("chip").includes("Drum kit"));
  assert.ok(A.isDrum("kick") && !A.isDrum("gm_acoustic_grand_piano") && !A.isDrum("gm_drum_kit")); // the GM kit is one instrument with a piece per key, not a single drum
  const n = A.normalizeInstrument(A.builtinDef("gm_drum_kit"));
  assert.deepEqual([n.type, n.program, n.drum], ["gm", 0, true]);
  assert.equal(n.kit.length, 12);
  assert.deepEqual(A.kitOf("gm_drum_kit").map((k) => k.label).slice(-2), ["Snare", "Kick"]);
  assert.equal(A.kitOf("kick"), null);
  assert.deepEqual(A.normalizeInstrument({ type: "gm", program: 999 }).program, 127);
  const r = A.renderSfxWith(A.normalizeSfx({ tracks: [{ instrument: "gm_flute", steps: [[40, 7, 0]] }, { instrument: "gm_drum_kit", steps: [[40, 7, 0]] }] }), {});
  assert.match(r.text, /^inst 6 gm 73 0 /m);
  assert.match(r.text, /^inst 7 gm 0 1 /m);
});

test("every instrument has a comfortable range of at most three octaves", () => {
  for (const d of A.builtinInstruments()) {
    const [lo, hi] = A.instrumentRange(d.name);
    assert.ok(lo >= 0 && hi <= 95 && hi - lo >= 11 && hi - lo + 1 <= 36, `${d.name}: ${lo}-${hi}`);
  }
  assert.deepEqual(A.instrumentRange("bass"), [24, 47]);       // basses sit low
  assert.deepEqual(A.instrumentRange("flute"), [60, 95]);      // flutes sit high
  assert.deepEqual(A.instrumentRange("gm_acoustic_bass"), [24, 47]);
  assert.ok(A.instrumentRange("gm_violin")[0] > A.instrumentRange("gm_contrabass")[1] - 12);
  assert.deepEqual(A.instrumentRange("square"), [36, 71]);      // the basic waves and anything unknown
  assert.deepEqual(A.instrumentRange("mine", { instrument: () => ({ type: "pulse", range: [48, 71] }) }), [48, 71]);
  assert.deepEqual(A.instrumentRange("mygm", { instrument: () => ({ type: "gm", program: 33 }) }), A.instrumentRange("gm_finger_bass"));
  assert.equal(A.normalizeInstrument({ type: "pulse", range: [90, 10] }).range[1] >= 90, true);
});

test("a long note in a sound effect is a step followed by hold steps", () => {
  const d = A.normalizeSfx({ speed: 6, tracks: [{ instrument: "square", steps: [[40, 5, 0], [40, 5, 7], [40, 5, 7], [44, 5, 0], [44, 0, 0], [50, 5, 7]] }] });
  const t = d.tracks[0];
  assert.deepEqual(A.sfxNotes(t).map((n) => [n.col, n.len, n.pitch]), [[0, 3, 40], [3, 1, 44], [5, 1, 50]]);
  assert.equal(t.steps[5][2], 0, "a hold with nothing before it becomes a note");
  A.resizeSfxNote(d, 0, 0, 2);
  assert.deepEqual(A.sfxNotes(t).map((n) => [n.col, n.len]), [[0, 2], [3, 1], [5, 1]]);
  A.resizeSfxNote(d, 0, 0, 9);                                   // can't run into the next note
  assert.equal(A.sfxNotes(t)[0].len, 3); // the next note starts at step 3
  A.setSfxPitch(d, 0, 1, 47);
  assert.deepEqual(t.steps.slice(0, 3).map((s) => s[0]), [47, 47, 47]);
  A.placeSfxNote(d, 0, 1, 30);                                 // inside a held note of the same voice: cuts it
  assert.deepEqual(A.sfxNotes(t).map((n) => [n.col, n.len, n.pitch]).slice(0, 3), [[0, 1, 47], [1, 1, 30], [3, 1, 44]]);
  A.eraseSfxNote(d, 0, 3);
  assert.equal(A.sfxNotes(t).some((n) => n.col === 3), false);
  A.placeSfxNote(d, 0, 20, 36);
  assert.ok(A.sfxLength(d) >= 21);
  assert.deepEqual(A.normalizeSfx(JSON.parse(JSON.stringify(d))), d);
});

test("notes that overlap live on layers of the lane, each with its own length", () => {
  const d = A.normalizeSfx({ speed: 6, tracks: [{ instrument: "square", steps: [[40, 5, 0], [40, 5, 7], [40, 5, 7], [44, 5, 0], [44, 0, 0], [50, 0, 0]] }, { instrument: "pulse", steps: [] }] });
  const notes = (t) => A.laneNotes(t).map((n) => [n.layer, n.col, n.len, n.pitch]);
  assert.equal(A.addSfxNote(d, 0, 1, 52), 1);                   // inside the held note: another voice, nothing is cut
  assert.equal(A.addSfxNote(d, 0, 1, 52), 1);                   // the same pitch again adds nothing
  assert.equal(A.addSfxNote(d, 0, 4, 55), 0);                    // free on the first voice: that one is used
  A.resizeSfxNote(d, 0, 1, 4, 1);                                // the new note has its own length
  assert.deepEqual(notes(d.tracks[0]), [[0, 0, 3, 40], [0, 3, 1, 44], [0, 4, 1, 55], [1, 1, 4, 52]]);
  assert.deepEqual(A.normalizeSfx(JSON.parse(JSON.stringify(d))), d);          // layers are saved
  assert.equal(A.addSfxNote(d, 0, 1, 56), 2);                    // a third voice
  assert.equal(A.addSfxNote(d, 0, 1, 58), -1);                   // the console's four channels are all used
  assert.equal(A.addSfxNote(d, 1, 0, 40), 0);                    // the other lane is free
  const moved = A.moveSfxNote(d, { track: 0, layer: 2, col: 1 }, { track: 1, col: 2, pitch: 50 });
  assert.equal(moved, true);
  assert.deepEqual(notes(d.tracks[1]), [[0, 0, 1, 40], [0, 2, 1, 50]]);
  assert.equal(d.tracks[0].layers.length, 1);                    // the emptied layer is gone
  // a move with no room leaves the sound as it was
  const e = A.normalizeSfx({ speed: 6, tracks: [{ instrument: "square", steps: [[40, 5, 0], [40, 5, 7]] }, { instrument: "pulse", steps: [[40, 5, 0], [40, 5, 7]] }] });
  A.addSfxNote(e, 0, 0, 50); A.addSfxNote(e, 1, 0, 50);
  const before = JSON.stringify(e);
  assert.equal(A.moveSfxNote(e, { track: 1, layer: 0, col: 0 }, { track: 0, col: 0, pitch: 60 }), false);
  assert.equal(JSON.stringify(e), before);
});

test("a track's volume is a step from -3 to +3 and a sound effect keeps its own", () => {
  const d = A.normalizeSfx({ tracks: [{ instrument: "square", vol: 9, steps: [[40, 5, 0]] }, { instrument: "pulse", vol: -2, steps: [[40, 5, 0]] }] });
  assert.deepEqual(d.tracks.map((t) => t.vol), [3, -2]);
  assert.equal("vol" in A.normalizeSfx({ tracks: [{ instrument: "square", vol: 0, steps: [[40, 5, 0]] }] }).tracks[0], false);
  assert.match(A.renderSfxWith(d, {}).text, /^sfx 0 8 1 -1 -1 3\n/m);
});
