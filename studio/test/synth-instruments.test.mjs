// Instruments, samples, envelopes, pan, the lo-fi output stage, reverb and tracker songs: rendered through the real runtime.
import test from "node:test";
import assert from "node:assert/strict";
import { runRender, seg, rms, freq, periodSpread, sfx, skip, SR } from "./synth-helpers.mjs";

// instrument description lines: kind-specific part, then the common numbers
const common = (o = {}) => [o.vol ?? 100, o.pan ?? 0, o.atk ?? 0, o.dec ?? 0, o.sus ?? 100, o.rel ?? 0, o.vd ?? 0, o.vr ?? 50, o.vdl ?? 0].join(" ");
const pulse = (duty, o) => `inst 6 pulse ${duty} ${common(o)}\n`;
const wave = (hex, o) => `inst 6 wave ${hex} ${common(o)}\n`;
const noise = (short, o) => `inst 6 noise ${short} ${common(o)}\n`;
const held = (pre, pitch = 33, extra = {}) => sfx(60, [[pitch, 6, 7, 0]], { pre, ...extra }); // one second on instrument 6

function wavFile(seconds = 0.5, rate = 22050, hz = 440) {
  const n = Math.round(rate * seconds), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 0.9 * 32767), 44 + i * 2);
  return b;
}
const positiveShare = (x, a, b) => { let n = 0; for (let i = a; i < b; i++) if (x[i] > 0) n++; return n / (b - a); };

test("pulse instruments have the four GBA duty cycles", { skip }, () => {
  for (const [duty, share] of [[0, 0.125], [1, 0.25], [2, 0.5], [3, 0.75]]) {
    const x = runRender(held(pulse(duty))).samples;
    assert.ok(Math.abs(positiveShare(x, seg(0.1), seg(0.8)) - share) < 0.03, `duty ${duty}: ${positiveShare(x, seg(0.1), seg(0.8))}`);
    assert.ok(Math.abs(freq(x, seg(0.1), seg(0.8)) - 220) < 6);
  }
});

test("a wavetable instrument plays its 32 four-bit steps", { skip }, () => {
  const square = runRender(held(wave("FFFFFFFFFFFFFFFF0000000000000000"))).samples;
  assert.ok(Math.abs(freq(square, seg(0.1), seg(0.8)) - 220) < 6);
  const levels = (x) => new Set(Array.from(x.slice(seg(0.2), seg(0.8)), (v) => Math.round(v * 32768))).size;
  assert.ok(levels(square) <= 3, `square wave has ${levels(square)} levels`);
  const ramp = runRender(held(wave("0123456789ABCDEFFEDCBA9876543210"))).samples;
  assert.ok(levels(ramp) > 8 && levels(ramp) <= 16, `a 4-bit wave has at most 16 levels, got ${levels(ramp)}`);
  const smooth = runRender(sfx(60, [[33, 0, 7, 0]])).samples; // the original triangle is not quantised
  assert.ok(levels(smooth) > 100);
  const silent = runRender(held(wave("88888888888888888888888888888888"))).samples; // a flat wave is nearly silent
  assert.ok(rms(silent, seg(0.2), seg(0.8)) < 0.02);
});

test("noise: the short mode repeats quickly (metallic), the long mode does not (hiss)", { skip }, () => {
  const corr = (x, lag, a, n) => { let s = 0, e = 0; for (let i = a; i < a + n; i++) { s += x[i] * x[i + lag]; e += x[i] * x[i]; } return s / e; };
  const lag = Math.round((127 * SR) / (440 * Math.pow(2, (45 - 57) / 12) * 16)); // one trip round the 7-bit register at pitch 33
  const short = runRender(held(noise(1))).samples, long = runRender(held(noise(0))).samples;
  assert.ok(rms(short, seg(0.2), seg(0.6)) > 0.05 && rms(long, seg(0.2), seg(0.6)) > 0.05);
  assert.ok(corr(short, lag, 6000, 8000) > 0.8, `short ${corr(short, lag, 6000, 8000)}`);
  assert.ok(corr(long, lag, 6000, 8000) < 0.2, `long ${corr(long, lag, 6000, 8000)}`);
});

test("envelopes: attack ramps up, decay falls to the sustain level, release rings out after the sound ends", { skip }, () => {
  const slow = runRender(held(pulse(2, { atk: 300 }))).samples;
  assert.ok(rms(slow, seg(0.01), seg(0.04)) < 0.25 * rms(slow, seg(0.45), seg(0.75)), "attack should start quiet");
  const dec = runRender(held(pulse(2, { dec: 200, sus: 25 }))).samples;
  const ratio = rms(dec, seg(0.6), seg(0.95)) / rms(dec, seg(0.0), seg(0.02));
  assert.ok(ratio > 0.2 && ratio < 0.32, `sustain level ${ratio}`);
  const steady = runRender(held(pulse(2))).samples;
  assert.ok(Math.abs(rms(steady, seg(0.6), seg(0.95)) / rms(steady, seg(0.0), seg(0.05)) - 1) < 0.1, "no envelope = steady");
  const quick = sfx(12, [[33, 6, 7, 0]], { render: "render sfx 0 1 1.0" }); // the effect lasts 0.2 s
  const rel = runRender(pulse(2, { rel: 300 }) + quick).samples, none = runRender(pulse(2) + quick).samples;
  const during = rms(rel, seg(0.1), seg(0.18));
  assert.ok(rms(rel, seg(0.21), seg(0.3)) > 0.3 * during, "release should keep sounding");
  assert.ok(rms(rel, seg(0.7), seg(0.95)) < 0.001, "and then die away");
  assert.ok(rms(none, seg(0.22), seg(0.5)) < 0.001, "no release stops at once");
});

test("sample instruments are pitched across the keyboard and can loop", { skip }, () => {
  const files = { "sounds/a.wav": wavFile(0.5) };
  const pre = (loop = "-1 -1") => `sample 0 sounds/a.wav\ninst 6 sample 0 57 ${loop} ${common()}\n`;
  const root = runRender(sfx(60, [[45, 6, 7, 0]], { pre: pre() }), files).samples; // pitch 45 is note 57: the root
  assert.ok(Math.abs(freq(root, seg(0.05), seg(0.4)) - 440) < 12, `root ${freq(root, seg(0.05), seg(0.4))}`);
  assert.ok(rms(root, seg(0.1), seg(0.4)) > 0.03);
  assert.ok(rms(root, seg(0.6), seg(0.95)) < 0.001, "a one-shot sample ends");
  const up = runRender(sfx(60, [[57, 6, 7, 0]], { pre: pre() }), files).samples;    // an octave up: twice as fast, half as long
  assert.ok(Math.abs(freq(up, seg(0.05), seg(0.2)) - 880) < 25, `octave ${freq(up, seg(0.05), seg(0.2))}`);
  assert.ok(rms(up, seg(0.05), seg(0.2)) > 0.03 && rms(up, seg(0.35), seg(0.9)) < 0.001);
  const looped = runRender(sfx(60, [[45, 6, 7, 0]], { pre: pre("0 11024") }), files).samples;
  assert.ok(rms(looped, seg(0.7), seg(0.95)) > 0.03, "a looped sample keeps going");
});

test("sample files are only read from the project's sounds folder", { skip }, () => {
  for (const bad of ["/etc/passwd", "sounds/../secret.wav", "other/x.wav"]) {
    assert.notEqual(runRender(`sample 0 ${bad}\n${sfx(10, [[33, 2, 7, 0]])}`).status, 0, bad);
  }
  assert.notEqual(runRender(`sample 0 sounds/missing.wav\n${sfx(10, [[33, 2, 7, 0]])}`).status, 0);
});

test("pan places an instrument in the stereo field", { skip }, () => {
  const side = (pan) => runRender(`stereo\n${pulse(2, { pan })}${held("", 33)}`.replace("sfx 0", `sfx 0`), {});
  const render = (pan) => runRender(`stereo\n${pulse(2, { pan })}` + sfx(60, [[33, 6, 7, 0]]));
  const left = render(-100), right = render(100), centre = render(0);
  assert.equal(left.fmt.channels, 2);
  assert.ok(rms(left.left, seg(0.1), seg(0.8)) > 20 * Math.max(0.0001, rms(left.right, seg(0.1), seg(0.8))), "pan left");
  assert.ok(rms(right.right, seg(0.1), seg(0.8)) > 20 * Math.max(0.0001, rms(right.left, seg(0.1), seg(0.8))), "pan right");
  assert.ok(Math.abs(rms(centre.left, seg(0.1), seg(0.8)) / rms(centre.right, seg(0.1), seg(0.8)) - 1) < 0.05, "centre");
  void side;
});

test("the GBA output stage is 10-bit and holds samples at about 32 kHz", { skip }, () => {
  const body = sfx(60, [[40, 4, 7, 0]]);
  const clean = runRender(body).samples, lofi = runRender(`style gba\n${body}`).samples;
  const distinct = (x) => new Set(Array.from(x.slice(seg(0.1), seg(0.9)), (v) => Math.round(v * 32768))).size;
  assert.ok(distinct(clean) > 500, `clean has ${distinct(clean)} levels`);
  assert.ok(distinct(lofi) <= 1024, `lo-fi has ${distinct(lofi)} levels`);
  let repeats = 0;
  for (let i = seg(0.1) + 1; i < seg(0.9); i++) if (lofi[i] === lofi[i - 1]) repeats++;
  assert.ok(repeats / (seg(0.8)) > 0.2, "held samples repeat");
  assert.ok(rms(lofi, seg(0.1), seg(0.9)) > 0.05, "and it still sounds");
});

test("a quiet GBA-style sound fades smoothly and silence stays silent", { skip }, () => {
  // 8-bit steps without dither left quiet notes a dozen levels, heard as crackle on the handheld
  const body = sfx(60, [[40, 1, 7, 0]]);
  const lofi = runRender(`style gba\n${body}`).samples;
  const levels = new Set(Array.from(lofi.slice(seg(0.1), seg(0.9)), (v) => Math.round(v * 32768))).size;
  assert.ok(levels > 40, `a quiet note has ${levels} levels`);
  const clean = runRender(body).samples; // where the clean output is silent (before the note, after its release), so is this one
  let loud = 0;
  for (let i = 4; i < Math.min(clean.length, lofi.length); i++) if (clean.slice(i - 4, i + 1).every((v) => v === 0) && lofi[i] !== 0) loud++;
  assert.equal(loud, 0, "silence stays silent (no hiss)");
});

// ---------------- tracker songs ----------------
// bpm 120 with 4 rows a beat: a row is 0.125 s. slots: song instrument 0 = the square wave (2), 1 = triangle (0), 2 = instrument 6.
const slots = (...h) => `slots ${[...h, ...Array(16).fill(-1)].slice(0, 16).join(" ")}\n`;
function song({ bpm = 120, rpb = 4, tracks = 4, loop = -1, reverb = 0, rows = 16, order = [0], cells = [], patterns = 1, pre = "", seconds = 3, slotList = [2, 0, 6] } = {}) {
  let d = `${pre}song 0 ${bpm} ${rpb} ${tracks} ${loop} ${reverb}\n${slots(...slotList)}order ${order.length} ${order.join(" ")}\n`;
  for (let p = 0; p < patterns; p++) d += `pattern ${p} ${rows}\n`;
  for (const [p, t, r, note, inst = 0, vol = -1, fx = 0, fxp = 0] of cells) d += `cell ${p} ${t} ${r} ${note} ${inst} ${vol} ${fx} ${fxp}\n`;
  return d + `render song 0 ${seconds}\n`;
}
const A4 = 57, A3 = 45, OFF = -1;

test("songs: rows follow the tempo, and note-off ends a note", { skip }, () => {
  const x = runRender(song({ cells: [[0, 0, 0, A4, 0, 15], [0, 0, 4, OFF]], seconds: 1.5 })).samples;
  assert.ok(rms(x, seg(0.05), seg(0.45)) > 0.03, "plays for 4 rows");
  assert.ok(rms(x, seg(0.55), seg(0.95)) < 0.001, "then stops");
  const slow = runRender(song({ bpm: 60, cells: [[0, 0, 0, A4, 0, 15], [0, 0, 4, OFF]], seconds: 2 })).samples; // rows are twice as long
  assert.ok(rms(slow, seg(0.6), seg(0.95)) > 0.03 && rms(slow, seg(1.1), seg(1.9)) < 0.001);
  assert.ok(Math.abs(freq(x, seg(0.05), seg(0.4)) - 440) < 8);
});

test("songs: the order plays pattern after pattern and can loop", { skip }, () => {
  const cells = [[0, 0, 0, A4, 0, 15], [0, 0, 4, OFF]]; // pattern 0 has a note; pattern 1 (8 rows, 1 s) is empty
  const once = runRender(song({ rows: 8, patterns: 2, order: [0, 1], cells, seconds: 5 })).samples;
  assert.ok(rms(once, seg(0.05), seg(0.45)) > 0.03 && rms(once, seg(2.05), seg(4.5)) < 0.001, "plays once");
  const looped = runRender(song({ rows: 8, patterns: 2, order: [0, 1], loop: 0, cells, seconds: 5 })).samples;
  assert.ok(rms(looped, seg(2.05), seg(2.45)) > 0.03 && rms(looped, seg(4.05), seg(4.45)) > 0.03, "loops back");
  assert.ok(rms(looped, seg(1.2), seg(1.9)) < 0.001, "the empty pattern is silent");
});

test("songs: volume, tracks, channels and unmapped instruments", { skip }, () => {
  const vol = (v) => rms(runRender(song({ cells: [[0, 0, 0, A4, 0, v]], seconds: 1 })).samples, seg(0.1), seg(0.8));
  assert.ok(Math.abs(vol(8) / vol(15) - 8 / 15) < 0.05, `volume ${vol(8) / vol(15)}`);
  const second = [[0, 1, 0, A4, 0, 15]]; // a note on track 2
  assert.ok(rms(runRender(song({ cells: second, seconds: 1 })).samples, seg(0.1), seg(0.8)) > 0.03);
  assert.ok(rms(runRender(song({ cells: second, seconds: 1, pre: "channels 1\n" })).samples, seg(0.1), seg(0.8)) < 0.001, "channels limit the tracks that sound");
  assert.ok(rms(runRender(song({ cells: second, seconds: 1, tracks: 1 })).samples, seg(0.1), seg(0.8)) < 0.001, "so do the song's own tracks");
  assert.ok(rms(runRender(song({ cells: [[0, 0, 0, A4, 5, 15]], seconds: 1 })).samples, seg(0.1), seg(0.8)) < 0.001, "an unmapped instrument is silent, not an error");
});

test("songs: effects (slide, vibrato, arpeggio, cut, pan)", { skip }, () => {
  const slow = { bpm: 60, rpb: 2, rows: 8, seconds: 2 }; // rows of 0.5 s
  const slide = runRender(song({ ...slow, cells: [[0, 0, 0, A3, 0, 15, 1, 15]] })).samples;
  assert.ok(freq(slide, seg(0.4), seg(0.45)) / freq(slide, seg(0.05), seg(0.1)) > 2.2, "slide up"); // about 3 semitones early and 19 late: roughly 2.4x
  const down = runRender(song({ ...slow, cells: [[0, 0, 0, A4, 0, 15, 2, 15]] })).samples;
  assert.ok(freq(down, seg(0.4), seg(0.45)) / freq(down, seg(0.05), seg(0.1)) < 0.5, "slide down");
  const plain = runRender(song({ ...slow, cells: [[0, 0, 0, A3, 0, 15]] })).samples;
  assert.ok(periodSpread(plain, seg(0.05), seg(0.45)) <= 2);
  const vib = runRender(song({ ...slow, cells: [[0, 0, 0, A3, 0, 15, 3, 8]] })).samples;
  assert.ok(periodSpread(vib, seg(0.05), seg(0.45)) >= 12, `vibrato ${periodSpread(vib, seg(0.05), seg(0.45))}`);
  const arp = runRender(song({ ...slow, cells: [[0, 0, 0, A3, 0, 15, 4, 0]] })).samples;
  assert.ok(periodSpread(arp, seg(0.05), seg(0.45)) >= 30, `arpeggio ${periodSpread(arp, seg(0.05), seg(0.45))}`);
  const cut = runRender(song({ ...slow, cells: [[0, 0, 0, A4, 0, 15, 7, 4]], seconds: 1 })).samples; // cut after 4/30 s, inside the 0.5 s row
  assert.ok(rms(cut, seg(0.02), seg(0.1)) > 0.03 && rms(cut, seg(0.2), seg(0.6)) < 0.001, "cut");
  const left = runRender(song({ pre: "stereo\n", cells: [[0, 0, 0, A4, 0, 15, 6, 0]], seconds: 1 }));
  assert.ok(rms(left.left, seg(0.1), seg(0.8)) > 20 * Math.max(0.0001, rms(left.right, seg(0.1), seg(0.8))), "pan effect");
});

test("songs: an instrument's release plays out after note-off, and reverb rings after the note", { skip }, () => {
  const rel = runRender(pulse(2, { rel: 250 }) + song({ slotList: [6], cells: [[0, 0, 0, A4, 0, 15], [0, 0, 4, OFF]], seconds: 1.5 })).samples;
  assert.ok(rms(rel, seg(0.55), seg(0.62)) > 0.01 && rms(rel, seg(0.95), seg(1.2)) < 0.001, "release");
  const cells = [[0, 0, 0, A4, 0, 15], [0, 0, 2, OFF]]; // a quarter of a second
  const dry = runRender(song({ cells, seconds: 1.2 })).samples, wet = runRender(song({ cells, reverb: 100, seconds: 1.2 })).samples;
  assert.ok(rms(dry, seg(0.35), seg(0.6)) < 0.0005, "dry ends cleanly");
  assert.ok(rms(wet, seg(0.35), seg(0.6)) > 0.003, `reverb tail ${rms(wet, seg(0.35), seg(0.6))}`);
  assert.ok(rms(wet, seg(1.0), seg(1.2)) < rms(wet, seg(0.35), seg(0.6)), "and it fades");
});

test("songs render the same every time", { skip }, () => {
  const d = song({ cells: [[0, 0, 0, A4, 0, 15, 3, 8], [0, 1, 2, A3, 1, 12, 4, 1], [0, 0, 6, OFF]], reverb: 40, pre: "style gba\nstereo\n", seconds: 2 });
  const a = runRender(d), b = runRender(d);
  assert.ok(a.left.every((v, i) => v === b.left[i]) && a.right.every((v, i) => v === b.right[i]));
});
