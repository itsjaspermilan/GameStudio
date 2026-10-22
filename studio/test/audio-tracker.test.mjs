// The tracker song model and render descriptions, checked through the real runtime where it matters.
import test from "node:test";
import assert from "node:assert/strict";
import "./builtin-helper.mjs";
import * as A from "../src/audio-core.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { runRender, rms, seg, skip, root } from "./synth-helpers.mjs";

test("note names round-trip", () => {
  for (let n = 0; n < 96; n++) assert.equal(A.parseNoteToken(A.noteToToken(n)), n);
  assert.equal(A.trackerNoteName(48), "C4");
  assert.equal(A.parseNoteToken("Db2"), 25);
  assert.equal(A.parseNoteToken("H4"), undefined);
  assert.equal(A.parseNoteToken("OFF"), A.NOTE_OFF);
});

test("cells round-trip through tokens (no instrument: the track has it)", () => {
  const cells = [A.cellOf(48), A.cellOf(50, 9), A.cellOf(52, -1, 3, 4), A.cellOf(A.NOTE_OFF), A.cellOf(A.NOTE_NONE, 5)];
  for (const c of cells) assert.deepEqual(A.tokenToCell(A.cellToToken(c)), c);
  assert.equal(A.cellToToken(A.cellOf(48, 12)), "C4,12");
  assert.equal(A.cellToToken(null), "--");
  assert.equal(A.tokenToCell("--"), null);
  assert.equal(A.tokenToCell("zz"), null);
  assert.deepEqual(A.tokenToCell("C4,2,9,3,4", true), { note: 48, vol: 9, fx: 3, fxp: 4, inst: 2 }); // the older form
});

test("a new song has four tracks with a band ready to go", () => {
  const s = A.newSong();
  assert.equal(s.tracks, 4);
  assert.deepEqual(s.track_inst, ["lead", "piano", "bass", "kick"]);
  for (const n of s.track_inst) assert.ok(A.isBuiltinName(n), n);
  assert.equal(s.patterns[0].tracks.length, 16);              // four tracks of four voices each
});

test("songs round-trip and repair bad data", () => {
  const s = A.newSong();
  A.setCell(s, 0, 0, 0, A.cellOf(48, 12));
  A.setCell(s, 0, 2, 5, A.cellOf(40, -1, 4, 3));
  A.setTrackInstrument(s, 1, null);
  const json = JSON.parse(JSON.stringify(A.serializeSong(s)));
  assert.deepEqual(json.track_instruments, ["lead", "", "bass", "kick"]);
  assert.deepEqual(A.parseSong(json), s);
  const bad = A.parseSong({ tempo: 9999, tracks: 99, order: [7, -3], patterns: [{ rows: 500, tracks: ["C4 C9 junk"] }] });
  assert.equal(bad.tempo, A.TRACKER.MAX_TEMPO);
  assert.equal(bad.tracks, A.TRACKER.MAX_TRACKS);
  assert.equal(bad.patterns[0].rows, A.TRACKER.MAX_ROWS);
  assert.deepEqual(bad.order, [0, 0]);
  assert.equal(bad.patterns[0].tracks[0][0].note, 48);
  assert.equal(bad.patterns[0].tracks[0][1], null);
  assert.ok(A.parseSong(null).patterns.length === 1);
});

test("a song in the older form keeps the instrument each track used most", () => {
  const old = { format: "tracker", tempo: 100, tracks: 2, instruments: ["square", "tri", "noise"], order: [0], loop_to: null, reverb: 0,
    patterns: [{ rows: 8, tracks: ["C4,1,12 D4,1 E4,0 --", "C2,2 C2,2,8 --"] }] };
  const s = A.parseSong(old);
  assert.deepEqual(s.track_inst.slice(0, 2), ["tri", "noise"]);
  assert.deepEqual(s.patterns[0].tracks[0][0], { note: 48, vol: 12, fx: 0, fxp: 0 });
  assert.deepEqual(s.patterns[0].tracks[1][1], { note: 24, vol: 8, fx: 0, fxp: 0 });
  assert.equal(s.tempo, 100);
});

test("editing operations keep the song consistent", () => {
  const s = A.newSong();
  const p2 = A.addPattern(s, 0);
  A.insertOrder(s, 1, p2); A.insertOrder(s, 2, 0);
  assert.deepEqual(s.order, [0, 1, 0]);
  s.loop_to = 1;
  A.removePattern(s, 0);
  assert.deepEqual(s.order, [0]);
  assert.equal(s.loop_to, 0);
  assert.equal(A.removePattern(s, 0), false);
  A.setPatternRows(s, 0, 16);
  assert.equal(s.patterns[0].tracks[0].length, 16);
  assert.equal(s.patterns[0].tracks.length, 16);
  A.setTrackInstrument(s, 1, "strings"); assert.equal(s.track_inst[1], "strings");
});

test("play from here keeps the rest of the song", () => {
  const s = A.newSong(); A.setPatternRows(s, 0, 16); A.addPattern(s, 0); s.order = [0, 1, 0]; s.loop_to = 0;
  A.setCell(s, 0, 0, 8, A.cellOf(48));
  const f = A.songFrom(s, 0, 8);
  assert.equal(f.patterns[f.order[0]].rows, 8);
  assert.equal(f.patterns[f.order[0]].tracks[0][0].note, 48);
  assert.equal(f.order.length, 3);
  assert.equal(s.order.length, 3);
  assert.deepEqual(f.track_inst, s.track_inst);
});

test("seconds follow tempo and rows", () => {
  const s = A.newSong(); s.tempo = 120; s.rows_per_beat = 4; A.setPatternRows(s, 0, 32);
  assert.ok(Math.abs(A.songSeconds(s) - 4) < 1e-9);
});

test("keyboard maps like a piano", () => {
  assert.equal(A.noteForKey("z", 4), 48);
  assert.equal(A.noteForKey("s", 4), 49);
  assert.equal(A.noteForKey("q", 4), 60);
  assert.equal(A.noteForKey("/", 4), undefined);
});

test("render descriptions give every track its own instrument", () => {
  const lookups = { instrument: (n) => (n === "mine" ? { type: "pulse", duty: 1 } : n === "kick2" ? { type: "sample", sample: "kick", root: 36 } : null) };
  const s = A.newSong({ tracks: 4 }); s.track_inst = ["mine", "kick2", "piano", "ghost"];
  A.setCell(s, 0, 1, 0, A.cellOf(36, 9));
  const { text, problems } = A.renderSongDesc(s, lookups, { seconds: 4 });
  assert.match(text, /^style gba/m);
  assert.match(text, /^channels 6$/m);
  assert.match(text, /^inst 6 pulse 1 /m);
  assert.match(text, /^sample 0 sounds\/kick\.wav/m);
  assert.match(text, /^inst 7 sample 0 36 /m);
  assert.match(text, /^inst 8 wave /m);
  assert.match(text, /^slots 6 7 8 -1 -1/m);
  assert.match(text, /^cell 0 1 0 36 1 9 0 0$/m);   // the cell says its own track number as the slot
  assert.deepEqual(problems, ["instrument 'ghost' is missing"]);
});

test("a song and a note preview render to sound through the runtime", { skip }, () => {
  const s = A.newSong({ tracks: 2 });
  A.setCell(s, 0, 0, 0, A.cellOf(48, 15));
  const { text } = A.renderSongDesc(s, {}, { seconds: 1, channels: 2 });
  const r = runRender(text);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(rms(r.samples, 0, seg(0.2)) > 0.02);
  for (const name of ["piano", "kick", "snare", "hihat", "strings", "bell", "clap", "tom"]) {
    const p = runRender(A.namedNotePreviewDesc(name, 48, {}, { style: "clean" }).text);
    assert.equal(p.status, 0, `${name}: ${p.stderr}`);
    assert.ok(rms(p.samples, 0, seg(0.2)) > 0.01, `${name} is silent`);
  }
  const pv = A.instrumentPreviewDesc({ type: "pulse", duty: 2, release: 100 }, 57, {}, { style: "clean" });
  assert.ok(rms(runRender(pv.text).samples, 0, seg(0.2)) > 0.02);
});

test("a sound effect with a layer plays on its own channels, leaving the music alone", { skip }, () => {
  const d = A.normalizeSfx({ speed: 12, tracks: [
    { instrument: "square", steps: [[40, 7, 0], [40, 7, 0]], layers: [[[47, 7, 0], [47, 7, 0]]] }, { instrument: "pulse", steps: [[44, 7, 0], [44, 7, 0]] }] });
  const one = A.renderSfxWith(d, {}, { style: "clean", seconds: 0.3 });
  const solo = runRender(one.text);
  assert.equal(solo.status, 0, solo.stderr);
  const single = A.renderSfxWith(A.normalizeSfx({ speed: 12, tracks: [{ instrument: "square", steps: d.tracks[0].steps }] }), {}, { style: "clean", seconds: 0.3 });
  assert.ok(rms(solo.samples, 0, seg(0.15)) > rms(runRender(single.text).samples, 0, seg(0.15)) * 1.3, "three voices are louder than one");
  // with music on every track and an effect on top, the music never loses a voice: the song alone and with the effect keep the same energy in its own part
  const s = A.newSong(); s.track_inst = ["square", "square", "square", "square"];
  for (let t = 0; t < 4; t++) A.setCell(s, 0, t, 0, A.cellOf(36 + t * 2, 15));
  const songDesc = A.renderSongDesc(s, {}, { style: "clean", seconds: 0.5 }).text;
  const alone = runRender(songDesc);
  const ad = new A.AudioDesc({}, { style: "clean", channels: 6, sfxChannels: 3, stereo: true });
  const ids = ad.addSfx(d); ad.addSong(s);
  const mixed = runRender(ad.text("render song 0 0.5") .replace(/render song 0 0.5\n?$/, "") + `render song 0 0.5\n`);
  assert.equal(mixed.status, 0, mixed.stderr);
  assert.ok(ids.length === 3);
  assert.ok(rms(alone.samples, 0, seg(0.4)) > 0.05);
});

test("sound effects have their own channels: the music keeps all its voices", { skip }, () => {
  const sq = { instrument: "square", steps: [[48, 7, 0], [48, 7, 0]] };
  const fx = A.normalizeSfx({ speed: 4, tracks: [sq, { ...sq, instrument: "pulse" }, { ...sq, instrument: "tri" }] }); // 2 steps of 4 ticks: 0.13 s
  const s = A.newSong(); s.track_inst = Array(4).fill("organ");
  for (let t = 0; t < 4; t++) A.setCell(s, 0, t, 0, A.cellOf(36 + t * 3, 15));
  s.tempo = 60;                                     // a row lasts a quarter second, so every note sustains through the test
  const build = (withFx) => {
    const ad = new A.AudioDesc({}, { style: "clean", channels: 6, sfxChannels: 3, stereo: true });
    const ids = ad.addSfx(fx); ad.addSong(s);
    return ad.text(`${withFx ? `with sfx ${ids.join(",")} 1\n` : ""}render song 0 1.5`);
  };
  const alone = runRender(build(false)), mixed = runRender(build(true));
  assert.equal(mixed.status, 0, mixed.stderr);
  assert.ok(rms(mixed.samples, 0, seg(0.1)) > rms(alone.samples, 0, seg(0.1)) * 1.1, "the effect is audible on top");
  const a = rms(alone.samples, seg(0.3), seg(0.9)), m = rms(mixed.samples, seg(0.3), seg(0.9));
  assert.ok(Math.abs(a - m) / a < 0.03, `the music after the effect is unchanged (${a} vs ${m})`);
});

test("overlapping notes sound together, in songs and in sound effects", { skip }, () => {
  const song = (voices) => { const s = A.newSong(); s.track_inst = ["square", "square", "square", "square"]; s.tempo = 60; voices.forEach((note, k) => A.setCell(s, 0, A.voiceIndex(k, 0), 0, A.cellOf(note, 15))); return A.renderSongDesc(s, {}, { style: "clean", seconds: 0.5 }).text; };
  const one = runRender(song([48])), three = runRender(song([48, 52, 55]));
  assert.equal(three.status, 0, three.stderr);
  assert.ok(rms(three.samples, seg(0.1), seg(0.4)) > rms(one.samples, seg(0.1), seg(0.4)) * 1.3, "three voices are louder than one");
  const fx = (layers) => A.normalizeSfx({ speed: 12, tracks: [{ instrument: "square", steps: [[36, 7, 0], [36, 7, 7]], ...(layers ? { layers: [[[40, 7, 0], [40, 7, 7]]] } : {}) }] });
  const sfx = (d) => runRender(A.renderSfxWith(d, {}, { style: "clean", seconds: 0.3 }).text);
  assert.ok(rms(sfx(fx(true)).samples, 0, seg(0.15)) > rms(sfx(fx(false)).samples, 0, seg(0.15)) * 1.3, "a sound effect's layer is audible too");
});

test("a track's volume steps change how loud it plays", { skip }, () => {
  const song = (vol) => { const s = A.newSong(); s.track_inst = ["square", "square", "square", "square"]; s.tempo = 60; s.track_vol[0] = vol; A.setCell(s, 0, 0, 0, A.cellOf(48, 15)); return A.renderSongDesc(s, {}, { style: "clean", seconds: 0.5 }).text; };
  const at = (vol) => rms(runRender(song(vol)).samples, seg(0.1), seg(0.4));
  assert.ok(at(3) > at(0) * 1.5 && at(0) > at(-3) * 1.5, `${at(-3)} < ${at(0)} < ${at(3)}`);
  const sfx = (vol) => rms(runRender(A.renderSfxWith(A.normalizeSfx({ speed: 12, tracks: [{ instrument: "square", vol, steps: [[36, 7, 0], [36, 7, 7]] }] }), {}, { style: "clean", seconds: 0.3 }).text).samples, 0, seg(0.15));
  assert.ok(sfx(3) > sfx(0) * 1.5 && sfx(0) > sfx(-3) * 1.5);
});

test("drums keep their pitch whatever note is played, and a kick sweeps down", { skip }, () => {
  const kick = (note) => runRender(A.namedNotePreviewDesc("kick", note, {}, { style: "clean" }).text).samples;
  const lo = kick(24), hi = kick(72);
  let diff = 0; for (let i = 0; i < seg(0.2); i++) diff = Math.max(diff, Math.abs(lo[i] - hi[i]));
  assert.ok(diff < 1e-3, "the same sound for any note");
  const cross = (x, a, b) => { let n = 0; for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) n++; return n; };
  assert.ok(cross(lo, seg(0.002), seg(0.04)) > cross(lo, seg(0.12), seg(0.16)) * 1.5, "higher at the start than later");
});

test("General MIDI instruments play through the SoundFont", { skip: skip || !existsSync(path.join(root, "assets/soundfonts/TimGM6mb.sf2")) }, () => {
  for (const name of ["gm_acoustic_grand_piano", "gm_violin", "gm_trumpet", "gm_steel_guitar", "gm_drum_kit"]) {
    const r = runRender(A.namedNotePreviewDesc(name, 48, {}, { style: "clean" }).text);
    assert.equal(r.status, 0, `${name}: ${r.stderr}`);
    let peak = 0; for (let i = 0; i < seg(0.15); i++) peak = Math.max(peak, Math.abs(r.samples[i]));
    assert.ok(peak > 0.03, `${name} is silent (peak ${peak})`);
    assert.ok(rms(r.samples, seg(0.9), seg(1.1)) < peak / 3, `${name} dies away after the note ends`);
  }
  const piano = (n) => runRender(A.namedNotePreviewDesc("gm_acoustic_grand_piano", n, {}, { style: "clean" }).text).samples;
  let diff = 0; const a = piano(48), b = piano(60); for (let i = 0; i < seg(0.2); i++) diff = Math.max(diff, Math.abs(a[i] - b[i]));
  assert.ok(diff > 0.01, "a different note is a different sound");
});

const cellsOf = (n = 16) => Array.from({ length: n }, () => null);
const spans = (cells) => A.trackNotes(cells).map((x) => [x.col, x.len]);

test("placing a note makes one step, dragging makes a longer one", () => {
  const c = cellsOf();
  A.placeNote(c, 0, 48);
  A.placeNote(c, 4, 50, 3);
  assert.deepEqual(spans(c), [[0, 1], [4, 3]]);
  assert.equal(c[1].note, A.NOTE_OFF);
  assert.equal(c[7].note, A.NOTE_OFF);
  A.placeNote(c, 4, 55);                                      // on an existing note: only the pitch changes
  assert.deepEqual([c[4].note, ...spans(c)[1]], [55, 4, 3]);
});

test("a lane's notes can overlap, each on its own voice", () => {
  const s = A.newSong(), pat = s.patterns[0], notes = (t) => A.voiceNotes(pat, t).map((n) => [n.layer, n.col, n.len, n.note]);
  assert.equal(A.addVoiceNote(pat, 0, 0, 48, 4), 0);          // a held note on the track's own voice
  assert.equal(A.addVoiceNote(pat, 0, 2, 52), 1);             // under it: the next voice, nothing is replaced
  assert.equal(A.addVoiceNote(pat, 0, 2, 52), 1);             // the same pitch again adds nothing
  A.resizeNote(pat.tracks[A.voiceIndex(1, 0)], 2, 5);         // each note has its own length
  assert.deepEqual(notes(0), [[0, 0, 4, 48], [1, 2, 5, 52]]);
  assert.equal(A.addVoiceNote(pat, 0, 3, 55), 2);
  assert.equal(A.addVoiceNote(pat, 0, 3, 57), 3);
  assert.equal(A.addVoiceNote(pat, 0, 3, 59), -1);            // a track has four voices
  assert.deepEqual(A.voiceNotes(pat, 1), []);                 // other tracks are untouched
  const json = A.serializeSong(s);
  assert.equal(json.patterns[0].tracks.length, 4);
  assert.equal(json.patterns[0].layers.length, 12);           // the extra voices are saved after the tracks
  assert.deepEqual(A.parseSong(JSON.parse(JSON.stringify(json))), s);
  assert.equal("layers" in A.serializeSong(A.newSong()).patterns[0], false);   // and only when a lane uses them
  // moving a note keeps its length, volume and effect, and lands on the first voice with room
  const r = A.moveVoiceNote(pat, { track: 0, layer: 1, col: 2 }, { track: 1, col: 6, note: 60 });
  assert.deepEqual(r, { layer: 0, col: 6 });
  assert.deepEqual(notes(1), [[0, 6, 5, 60]]);
  assert.equal(notes(0).some((n) => n[3] === 52), false);
  const full = A.newSong(); for (let k = 0; k < 4; k++) A.addVoiceNote(full.patterns[0], 1, 0, 40 + k, 4);
  A.addVoiceNote(full.patterns[0], 0, 0, 60);
  const before = JSON.stringify(full.patterns[0]);
  assert.equal(A.moveVoiceNote(full.patterns[0], { track: 0, layer: 0, col: 0 }, { track: 1, col: 1, note: 70 }), null);   // no room: nothing changes
  assert.equal(JSON.stringify(full.patterns[0]), before);
});

test("a track's volume is a step from -3 to +3", () => {
  const s = A.parseSong({ track_vol: [9, -9, 1] });
  assert.deepEqual(s.track_vol, [3, -3, 1, 0]);
  assert.equal("track_vol" in A.serializeSong(A.newSong()), false);
  assert.deepEqual(A.serializeSong(s).track_vol, [3, -3, 1, 0]);
  assert.match(A.renderSongDesc(s, {}, { seconds: 1 }).text, /^tvol 3 -3 1 0$/m);
});

test("erasing a note leaves the note before it as long as it was", () => {
  const c = cellsOf();
  for (const col of [0, 4, 8, 12]) A.placeNote(c, col, 48 + col, 4);   // four quarter notes, back to back
  assert.deepEqual(spans(c), [[0, 4], [4, 4], [8, 4], [12, 4]]);
  A.eraseNote(c, 8);
  assert.deepEqual(spans(c), [[0, 4], [4, 4], [12, 4]]);              // the one before did NOT grow into the gap
  A.eraseNote(c, 12);
  assert.deepEqual(spans(c), [[0, 4], [4, 4]]);
  A.eraseNote(c, 0);                                                   // the first one: nothing before it
  assert.deepEqual(spans(c), [[4, 4]]);
  const d = cellsOf(); A.placeNote(d, 0, 48); A.placeNote(d, 1, 50); A.placeNote(d, 2, 52);
  A.eraseNote(d, 1);
  assert.deepEqual(spans(d), [[0, 1], [2, 1]]);
  assert.equal(A.eraseNote(cellsOf(), 3), null);
});

test("a note can be made longer or shorter, up to the next note", () => {
  const c = cellsOf();
  A.placeNote(c, 0, 48); A.placeNote(c, 8, 52);
  A.resizeNote(c, 0, 5);
  assert.deepEqual(spans(c), [[0, 5], [8, 1]]);
  A.resizeNote(c, 0, 50);
  assert.deepEqual(spans(c), [[0, 8], [8, 1]]);
  A.resizeNote(c, 0, 2);
  assert.deepEqual(spans(c), [[0, 2], [8, 1]]);
  A.resizeNote(c, 8, 99);
  assert.deepEqual(spans(c), [[0, 2], [8, 8]]);
  assert.equal(c.filter((x) => x && x.note === A.NOTE_OFF).length, 1);  // no stray note-offs left behind
});

test("drum kit hits: several pieces on one step", () => {
  const c = cellsOf();
  assert.equal(A.toggleKitHit(c, 0, 36), true);
  assert.equal(A.toggleKitHit(c, 0, 42), true);
  assert.deepEqual(A.cellNotes(c[0]), [36, 42]);
  assert.deepEqual(A.kitHits(c), [{ col: 0, key: 36 }, { col: 0, key: 42 }]);
  assert.equal(A.cellToToken(c[0]), "C3+F#3");
  assert.deepEqual(A.tokenToCell("C3+F#3,9"), { note: 36, extra: [42], vol: 9, fx: 0, fxp: 0 });
  assert.equal(A.toggleKitHit(c, 0, 36), false);
  assert.deepEqual(A.cellNotes(c[0]), [42]);
  assert.equal(A.toggleKitHit(c, 0, 42), false);
  assert.equal(c[0], null);
  const s = A.newSong({ tracks: 2 }); s.track_inst = ["gm_drum_kit", "lead"];
  A.setCell(s, 0, 0, 0, A.cellOf(36, -1, 0, 0, [42]));
  assert.deepEqual(A.parseSong(A.serializeSong(s)).patterns[0].tracks[0][0], A.cellOf(36, -1, 0, 0, [42]));
  assert.match(A.renderSongDesc(s, {}, {}).text, /^cell 0 0 0 36 0 -1 0 0 42$/m);
});

test("a drum kit plays its pieces together, and a held sound effect note does not retrigger", { skip: skip || !existsSync(path.join(root, "assets/soundfonts/TimGM6mb.sf2")) }, () => {
  const song = (extra) => { const s = A.newSong({ tracks: 1 }); s.track_inst = ["gm_drum_kit"]; s.tempo = 60; A.setCell(s, 0, 0, 0, A.cellOf(36, -1, 0, 0, extra)); return A.renderSongDesc(s, {}, { style: "clean", channels: 1, seconds: 1 }).text; };
  const one = runRender(song([])), two = runRender(song([42, 38]));
  assert.equal(two.status, 0, two.stderr);
  const energy = (r) => rms(r.samples, 0, seg(0.15));
  assert.ok(energy(two) > energy(one) * 1.1, "kick plus hi-hat plus snare is louder than the kick alone");
  const held = A.normalizeSfx({ speed: 6, tracks: [{ instrument: "bell", steps: [[48, 7, 0], [48, 7, 7], [48, 7, 7], [48, 7, 7]] }] });
  const hit4 = A.normalizeSfx({ speed: 6, tracks: [{ instrument: "bell", steps: [[48, 7, 0], [48, 7, 0], [48, 7, 0], [48, 7, 0]] }] });
  const a = runRender(A.renderSfxWith(held, {}, { style: "clean" }).text), b = runRender(A.renderSfxWith(hit4, {}, { style: "clean" }).text);
  assert.equal(a.status, 0, a.stderr);
  assert.ok(rms(a.samples, seg(0.2), seg(0.35)) < rms(b.samples, seg(0.2), seg(0.35)), "four hits are louder later on than one held note decaying");
});

test("the key lock: scales, snapping, and saving", () => {
  const cMajor = { root: 0, scale: "major" };
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((n) => A.inKey(n, cMajor)), [0, 2, 4, 5, 7, 9, 11]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((n) => A.inKey(n + 48, { root: 9, scale: "minor" })), [0, 2, 4, 5, 7, 9, 11]); // A minor has C major's notes
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((n) => A.inKey(n, { root: 2, scale: "major-pentatonic" })), [2, 4, 6, 9, 11]);
  assert.equal(A.inKey(61, null), true);
  assert.equal(A.snapToKey(61, cMajor), 60);         // C# next to C and D: the lower one
  assert.equal(A.snapToKey(63, cMajor), 62);
  assert.equal(A.snapToKey(60, cMajor), 60);         // already fits
  assert.equal(A.snapToKey(61, null), 61);
  assert.equal(A.snapToKey(36, { root: 1, scale: "major" }, 36, 71) >= 36, true);  // never leaves the range
  assert.equal(A.normalizeKey({ root: 14, scale: "major" }), null);
  assert.equal(A.normalizeKey({ root: 3, scale: "nope" }), null);
  assert.deepEqual(A.normalizeKey({ root: 7, scale: "blues" }), { root: 7, scale: "blues" });
  assert.equal(A.keyLabel({ root: 9, scale: "minor-pentatonic" }), "A minor pentatonic");
  assert.equal(A.keyLabel(null), "off");
  const s = A.newSong(); assert.deepEqual(s.key, { root: 0, scale: "major" });   // new songs start in C major
  s.key = { root: 5, scale: "minor" };
  assert.deepEqual(A.parseSong(JSON.parse(JSON.stringify(A.serializeSong(s)))).key, { root: 5, scale: "minor" });
  s.key = null;
  assert.equal(A.parseSong(A.serializeSong(s)).key, null);
  assert.equal(A.parseSong({ patterns: [] }).key, null);                         // an older song: no lock
  assert.deepEqual(A.newSfx().key, { root: 0, scale: "major" });                 // new effects start in C major too (a lane can opt out)
  assert.equal(A.normalizeSfx({ tracks: [] }).key, null);                        // an older effect: no lock
  // a lane can follow the shared key, have its own, or allow any note
  assert.deepEqual(A.laneKey(cMajor, null), cMajor);
  assert.equal(A.laneKey(cMajor, false), null);
  assert.deepEqual(A.laneKey(cMajor, { root: 9, scale: "minor" }), { root: 9, scale: "minor" });
  s.key = cMajor; s.track_keys[1] = false; s.track_keys[2] = { root: 7, scale: "blues" };
  const back = A.parseSong(JSON.parse(JSON.stringify(A.serializeSong(s))));
  assert.deepEqual(back.track_keys.slice(0, 4), [null, false, { root: 7, scale: "blues" }, null]);
  assert.equal("track_keys" in A.serializeSong(A.newSong()), false);             // nothing saved when every track follows the song
  const fx = A.normalizeSfx({ tracks: [{ instrument: "square", key: false, steps: [[36, 5, 0]] }, { instrument: "pulse", key: { root: 2, scale: "major" }, steps: [[36, 5, 0]] }] });
  assert.deepEqual(fx.tracks.map((t) => t.key), [false, { root: 2, scale: "major" }]);
  assert.equal("key" in A.normalizeSfx({ tracks: [{ instrument: "tri", key: 9, steps: [[36, 5, 0]] }] }).tracks[0], false);   // nonsense follows the sound's key
});

test("a lane offers its base octave and one octave either way", () => {
  assert.deepEqual(A.laneWindow([36, 71]), [36, 71]);          // three octaves centred on C4: C3 to B5
  assert.deepEqual(A.laneWindow([24, 47]), [12, 47]);          // a bass sits an octave lower
  assert.deepEqual(A.laneWindow([60, 72]), [48, 83]);
  assert.deepEqual(A.laneWindow([0, 11]), [0, 23]);            // never below the lowest note
  assert.deepEqual(A.laneWindow([60, 95], [0, 75]), [60, 75]); // nor above what the editor can store
  assert.deepEqual(A.normalizeSfx({ key: { root: 2, scale: "minor" }, tracks: [] }).key, { root: 2, scale: "minor" });
});

test("timing units: a step is a sixteenth, a beat is four", () => {
  assert.deepEqual(A.TIMINGS.map((t) => A.unitSteps(t.id)), [8, 4, 2, 1]);
  assert.equal(A.unitSteps("1/4", 2), 2);           // two steps to a beat: a quarter note is two steps
  assert.equal(A.unitSteps("1/16", 2), 1);          // never less than a step
  assert.equal(A.unitSteps("nonsense"), 4);
});

test("drum beats fill a kit lane and repeat every bar", () => {
  const cells = cellsOf(32);
  A.applyKitBeat(cells, "rock");
  const at = (col) => A.cellNotes(cells[col]);
  assert.deepEqual(at(0), [36, 42]);
  assert.deepEqual(at(4), [38, 42]);
  assert.deepEqual(at(2), [42]);
  assert.deepEqual(at(16), [36, 42]);               // the second bar repeats the first
  assert.deepEqual(at(20), [38, 42]);
  assert.deepEqual(at(1), []);
  A.applyKitBeat(cells, "dance");                   // replaces the beat
  assert.deepEqual(at(2), [46]);
  assert.deepEqual(at(4), [36, 39]);
  A.applyKitBeat(cells, "fill");                    // adds toms to the last beat of the last bar, keeping the rest
  assert.deepEqual(at(28), [36, 39, 50]);
  assert.deepEqual(at(30).includes(45), true);
  assert.deepEqual(at(12), [36, 39]);               // the first bar is untouched
  for (const b of A.KIT_BEATS) assert.ok(Object.keys(b.hits).every((k) => A.kitOf("gm_drum_kit").some((p) => p.key === +k)), b.id);
  const sixty4 = cellsOf(64); A.applyKitBeat(sixty4, "simple"); assert.deepEqual(A.cellNotes(sixty4[48]), [36]);
});

test("a generated melody stays in the key and the range, on the grid, and is repeatable", () => {
  const key = { root: 9, scale: "minor-pentatonic" };
  for (let seed = 1; seed <= 40; seed++) {
    const cells = A.generateMelody({ key, lo: 48, hi: 83, rows: 32, unit: 2, seed });
    const notes = A.trackNotes(cells);
    assert.ok(notes.length >= 4, `seed ${seed}: ${notes.length} notes`);
    for (const n of notes) { assert.ok(A.inKey(n.note, key) && n.note >= 48 && n.note <= 83, `seed ${seed}: ${n.note}`); assert.equal(n.col % 2, 0); }
    const last = notes[notes.length - 1];
    assert.equal((last.note - key.root) % 12, 0, `seed ${seed} ends on the home note`);
  }
  assert.deepEqual(A.generateMelody({ key, lo: 48, hi: 83, rows: 32, seed: 5 }), A.generateMelody({ key, lo: 48, hi: 83, rows: 32, seed: 5 }));
  assert.notDeepEqual(A.generateMelody({ key, lo: 48, hi: 83, rows: 32, seed: 5 }), A.generateMelody({ key, lo: 48, hi: 83, rows: 32, seed: 6 }));
  assert.equal(A.generateMelody({ key: null, lo: 60, hi: 71, rows: 16, seed: 1 }).some(Boolean), true); // no lock: a pentatonic phrase
});

test("starter songs are valid, in key, in range and play", () => {
  for (const { id, label, song } of A.STARTER_SONGS) {
    const s = A.starterSong(id);
    assert.ok(label && s, id);
    assert.deepEqual(A.parseSong(A.serializeSong(s)), s, id);
    assert.equal(s.tracks, 4);
    for (const p of s.patterns) for (let t = 0; t < s.tracks; t++) {
      const inst = s.track_inst[t], kit = A.kitOf(inst), [lo, hi] = A.instrumentRange(inst);
      assert.ok(A.isBuiltinName(inst), `${id}: ${inst}`);
      for (const c of p.tracks[t]) for (const n of A.cellNotes(c)) {
        if (kit) assert.ok(kit.some((k) => k.key === n), `${id}: drum key ${n}`);
        else { assert.ok(A.inKey(n, s.key), `${id}: ${n} is out of ${A.keyLabel(s.key)}`); assert.ok(n >= lo && n <= hi, `${id}: ${n} outside ${lo}-${hi} for ${inst}`); }
      }
    }
    assert.equal(s.patterns[0].tracks[0].filter(Boolean).length > 3, true);
  }
  assert.equal(A.starterSong("nope"), null);
});

test("every starter song renders to sound", { skip }, () => {
  for (const { id } of A.STARTER_SONGS) {
    const s = A.starterSong(id);
    const r = runRender(A.renderSongDesc(s, {}, { style: "clean", channels: 6, seconds: 2 }).text);
    assert.equal(r.status, 0, `${id}: ${r.stderr}`);
    assert.ok(rms(r.samples, 0, seg(1.5)) > 0.01, `${id} is silent`);
  }
});
