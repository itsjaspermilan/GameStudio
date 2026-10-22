import test from "node:test";
import assert from "node:assert/strict";
import { parseSong } from "../src/audio-core.js";
import { analyzeSong, describeAnalysis, findKey, nameChord, pitchName } from "../src/music-core.js";

// a 4-track song from rows of tokens per track (16 rows a bar)
const song = (tracks, inst = ["gm_vibraphone", "gm_warm_pad", "gm_fretless_bass", "gm_drum_kit"], extra = {}) => parseSong({
  format: "tracker", tempo: 120, rows_per_beat: 4, track_instruments: inst, loop_to: -1,
  patterns: [{ rows: tracks[0].length, tracks: tracks.map((t) => t.join(" ")) }], order: [0], ...extra,
});
const bar = (...cells) => { const r = Array(16).fill("--"); cells.forEach(([i, n]) => { r[i] = n; }); return r; };

test("keys and chords", () => {
  const cMajor = Array(12).fill(0); for (const k of [0, 2, 4, 5, 7, 9, 11]) cMajor[k] = 1; cMajor[0] = 3; cMajor[7] = 2; cMajor[4] = 2;
  assert.equal(findKey(cMajor).name, "C major");
  const am = Array(12).fill(0); am[9] = 3; am[0] = 2; am[4] = 2; am[2] = 1; am[11] = 1;
  assert.equal(findKey(am).name, "A minor");
  const w = Array(12).fill(0); w[7] = 2; w[11] = 1; w[2] = 1;
  assert.equal(nameChord(w).name, "G");
  assert.equal(pitchName(48), "C4");
});

test("a plain tune in C reads as C major, on the chords, nothing to fix", () => {
  const mel = [...bar([0, "E4"], [4, "D4"], [8, "C4"], [12, "D4"]), ...bar([0, "E4"], [4, "E4"], [8, "E4"], [12, "OFF"]), ...bar([0, "D4"], [4, "D4"], [8, "E4"], [12, "D4"]), ...bar([0, "C4"], [12, "OFF"])];
  const pad = [...bar([0, "C3"]), ...bar([0, "C3"]), ...bar([0, "G2"]), ...bar([0, "C3"])];
  const bass = [...bar([0, "C2"], [8, "G2"]), ...bar([0, "C2"], [8, "G2"]), ...bar([0, "G1"], [8, "D2"]), ...bar([0, "C2"])];
  const a = analyzeSong(song([mel, pad, bass, Array(64).fill("--")]));
  assert.equal(a.key.name, "C major");
  assert.deepEqual(a.chords.slice(0, 2), ["C", "C"]);
  assert.match(a.melody.ends, /home note/);
  assert.ok(a.melody.stepwise > 0.5);
  assert.equal(a.clashes, 0);
  assert.ok(!a.issues.some((i) => /shrill|rub/.test(i)), a.issues.join("\n"));
  assert.match(describeAnalysis(a), /key C major/);
});

test("shrill melodies, semitone rubs and wrong notes are pointed out", () => {
  const high = [...bar([0, "E7"], [4, "D7"], [8, "C7"], [12, "D7"]), ...bar([0, "F#6"], [8, "C#7"])];
  const pad = [...bar([0, "C3+E3+G3"]), ...bar([0, "C3+E3+G3"])];
  const bass = [...bar([0, "C2"]), ...bar([0, "C2"])];
  const rub = [...bar([0, "F7"]), ...bar([0, "F#6"])];
  const a = analyzeSong(song([high, pad, bass, rub], ["gm_flute", "gm_warm_pad", "gm_finger_bass", "gm_violin"]));
  assert.ok(a.issues.some((i) => /shrill/.test(i)), a.issues.join("\n"));
  assert.ok(a.issues.some((i) => /pierce/.test(i)));
  assert.ok(a.clashes >= 1, "F7 against E7 is a semitone held for a beat");
});

test("drums are left out of the harmony", () => {
  const drums = [...bar([0, "C3"], [4, "D3"], [8, "C3"], [12, "D3"])];
  const a = analyzeSong(song([Array(16).fill("--"), Array(16).fill("--"), Array(16).fill("--"), drums]));
  assert.match(a.issues[0], /No pitched notes/);
});

test("modes: a dorian and a lydian tune from the song generator read as such", async () => {
  const { Song } = await import("../../scripts/lib/music.mjs");
  const make = (root, scale, prog) => parseSong(new Song({ seed: 5, root, scale, tempo: 100, oct: 4, inst: ["gm_vibraphone", "gm_warm_pad", "gm_finger_bass", "gm_drum_kit"], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], sections: [{ prog }], order: [0, 0] }).build());
  assert.equal(analyzeSong(make(4, "dorian", [0, 3, 4, 0])).key.name, "E dorian");
  assert.equal(analyzeSong(make(5, "lydian", [0, 1, 4, 0])).key.name, "F lydian");
});
