// Renders sounds through the real runtime (gs render-audio) and checks the waveforms.
import test from "node:test";
import assert from "node:assert/strict";
import * as H from "./synth-helpers.mjs";

const { runRender, seg, rms, freq, periodSpread, sfx: sfxDesc, skip, SR, WAVE, FX } = H;

test("renders a mono 44.1 kHz 16-bit WAV of the right length", { skip }, () => {
  const r = runRender(sfxDesc(12, [[33, WAVE.square, 7, 0]])); // one step of 12 ticks = 0.2 s, plus a 0.05 s tail
  assert.deepEqual(r.fmt, { channels: 1, rate: SR, bits: 16 });
  assert.ok(Math.abs(r.samples.length - Math.round(0.25 * SR)) <= 2, `length ${r.samples.length}`);
});

test("pitch: pitch 33 is A3 (220 Hz) and +12 is an octave up", { skip }, () => {
  const a = runRender(sfxDesc(30, [[33, WAVE.square, 7, 0]])).samples;   // 0.5 s
  const b = runRender(sfxDesc(30, [[45, WAVE.square, 7, 0]])).samples;
  const fa = freq(a, seg(0.05), seg(0.45)), fb = freq(b, seg(0.05), seg(0.45));
  assert.ok(Math.abs(fa - 220) < 8, `A3 measured ${fa}`);
  assert.ok(Math.abs(fb / fa - 2) < 0.05, `octave ratio ${fb / fa}`);
});

test("volume scales the level, and volume 0 is silence", { skip }, () => {
  const loud = runRender(sfxDesc(30, [[33, WAVE.square, 7, 0]])).samples;
  const soft = runRender(sfxDesc(30, [[33, WAVE.square, 3, 0]])).samples;
  const ratio = rms(loud, seg(0.1), seg(0.4)) / rms(soft, seg(0.1), seg(0.4));
  assert.ok(Math.abs(ratio - 7 / 3) < 0.2, `loud/soft ${ratio}`);
  const mixed = runRender(sfxDesc(24, [[33, WAVE.square, 0, 0], [33, WAVE.square, 7, 0]])).samples; // 0.4 s per step
  assert.ok(rms(mixed, seg(0.05), seg(0.35)) < 0.002, "first step should be silent");
  assert.ok(rms(mixed, seg(0.45), seg(0.75)) > 0.05, "second step should sound");
});

test("every waveform makes sound; noise is not a plain tone", { skip }, () => {
  for (const [name, w] of Object.entries(WAVE)) {
    const x = runRender(sfxDesc(30, [[33, w, 7, 0]])).samples;
    assert.ok(rms(x, seg(0.1), seg(0.4)) > 0.02, `${name} is silent`);
  }
  const noise = runRender(sfxDesc(30, [[33, WAVE.noise, 7, 0]])).samples;
  const levels = new Set(Array.from(noise.slice(seg(0.1), seg(0.4)), (v) => Math.round(v * 20)));
  assert.ok(levels.size > 8, `noise has only ${levels.size} levels`);
  const sq = runRender(sfxDesc(30, [[33, WAVE.square, 7, 0]])).samples;
  const sqLevels = new Set(Array.from(sq.slice(seg(0.1), seg(0.4)), (v) => Math.round(v * 20)));
  assert.ok(sqLevels.size <= 3, "a square wave has two levels");
});

test("effects: slide rises, drop falls, fades ramp the level, vibrato wobbles", { skip }, () => {
  const slide = runRender(sfxDesc(40, [[20, WAVE.square, 7, 0], [44, WAVE.square, 7, FX.slide]])).samples; // 0.667 s per step
  const s0 = seg(0.667);
  const early = freq(slide, s0 + seg(0.05), s0 + seg(0.15)), late = freq(slide, s0 + seg(0.5), s0 + seg(0.6));
  assert.ok(late / early > 1.5, `slide ${early} -> ${late}`);

  const drop = runRender(sfxDesc(40, [[40, WAVE.square, 7, FX.drop]])).samples;
  assert.ok(freq(drop, seg(0.05), seg(0.15)) / freq(drop, seg(0.5), seg(0.6)) > 2, "drop should fall");

  const fin = runRender(sfxDesc(40, [[33, WAVE.square, 7, FX.fadeIn]])).samples;
  assert.ok(rms(fin, seg(0.5), seg(0.65)) > 3 * rms(fin, seg(0.02), seg(0.17)), "fade in should get louder");
  const fout = runRender(sfxDesc(40, [[33, WAVE.square, 7, FX.fadeOut]])).samples;
  assert.ok(rms(fout, seg(0.02), seg(0.17)) > 3 * rms(fout, seg(0.5), seg(0.65)), "fade out should get quieter");

  // Vibrato wobbles the pitch by about half a semitone: look at how much individual cycle lengths vary.
  const steady = runRender(sfxDesc(40, [[33, WAVE.square, 7, 0]])).samples;
  const vib = runRender(sfxDesc(40, [[33, WAVE.square, 7, FX.vibrato]])).samples;
  assert.ok(periodSpread(steady, seg(0.05), seg(0.6)) <= 2, "a steady tone has even cycles");
  assert.ok(periodSpread(vib, seg(0.05), seg(0.6)) >= 8, `vibrato cycle spread ${periodSpread(vib, seg(0.05), seg(0.6))}`);
});

test("rendering is deterministic", { skip }, () => {
  const desc = sfxDesc(10, [[30, WAVE.noise, 6, FX.vibrato], [35, WAVE.saw, 5, FX.slide], [20, WAVE.pulse, 7, FX.arp]]);
  const a = runRender(desc).samples, b = runRender(desc).samples;
  assert.equal(a.length, b.length);
  assert.ok(a.every((v, i) => v === b[i]));
});

test("a looping sound effect keeps going, a plain one stops", { skip }, () => {
  const steps = [[33, WAVE.square, 7, 0], [40, WAVE.square, 7, 0]];
  const once = runRender(sfxDesc(6, steps, { render: "render sfx 0 1 1.5" })).samples;       // 0.2 s long, rendered for 1.5 s
  const loop = runRender(sfxDesc(6, steps, { loop: [0, 1], render: "render sfx 0 1 1.5" })).samples;
  assert.ok(rms(once, seg(1.0), seg(1.4)) < 0.001, "plain effect should have ended");
  assert.ok(rms(loop, seg(1.0), seg(1.4)) > 0.05, "looping effect should still sound");
});

test("music: patterns play in order on separate channels, and loop points work", { skip }, () => {
  const tone = (n, pitch) => `${Array.from({ length: n }, () => `s ${pitch} ${WAVE.square} 7 0`).join("\n")}`;
  const head = `sfx 0 6 4 -1 -1\n${tone(4, 30)}\nsfx 1 6 2 -1 -1\n${tone(2, 42)}\n`; // A: 0.4 s, B: 0.2 s
  const patterns = "p 0 1 -1 -1\np 0 -1 -1 -1\n";                                    // pattern 0 = A+B (0.4 s), pattern 1 = A
  const once = runRender(`${head}music 0 2 -1 -1\n${patterns}render music 0 3\n`).samples;
  assert.ok(rms(once, seg(0.02), seg(0.18)) > 1.25 * rms(once, seg(0.22), seg(0.38)), "two channels, then one");
  assert.ok(rms(once, seg(0.45), seg(0.75)) > 0.03, "the second pattern should sound");
  assert.ok(rms(once, seg(1.2), seg(2.9)) < 0.001, "music without a loop should end");
  const loop = runRender(`${head}music 0 2 0 1\n${patterns}render music 0 3\n`).samples;
  assert.ok(rms(loop, seg(2.2), seg(2.9)) > 0.03, "music with a loop should keep playing");
});

test("bad descriptions fail cleanly", { skip }, () => {
  assert.notEqual(runRender("nonsense\n").status, 0);
  assert.notEqual(runRender("sfx 5 6 1 -1 -1\ns 1 1 1 1\nrender sfx 0\n").status, 0); // ids must count up from 0
});
