// Shared by the synth tests: render a description through the real runtime and look at the waveform.
import { existsSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const gs = path.join(root, "build/gs");
export const skip = !existsSync(gs);
export const SR = 44100;
export const WAVE = { triangle: 0, saw: 1, square: 2, pulse: 3, sine: 4, noise: 5 };
export const FX = { none: 0, slide: 1, vibrato: 2, drop: 3, fadeIn: 4, fadeOut: 5, arp: 6 };
const dir = skip ? "" : mkdtempSync(path.join(os.tmpdir(), "gs-synth-"));

// Renders `desc`. `files` are written under the working directory first (e.g. {"sounds/x.wav": bytes}).
export function runRender(desc, files = {}) {
  const work = mkdtempSync(path.join(dir, "w-"));
  for (const [rel, bytes] of Object.entries(files)) { mkdirSync(path.dirname(path.join(work, rel)), { recursive: true }); writeFileSync(path.join(work, rel), bytes); }
  const d = path.join(work, "d.txt"), o = path.join(work, "o.wav");
  writeFileSync(d, desc);
  const r = spawnSync(gs, ["render-audio", d, o], { encoding: "utf8", cwd: work });
  if (r.status !== 0) return { status: r.status, stderr: r.stderr };
  const buf = readFileSync(o);
  let p = 12, data = null, fmt = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString("ascii", p, p + 4), len = buf.readUInt32LE(p + 4);
    if (id === "fmt ") fmt = { channels: buf.readUInt16LE(p + 10), rate: buf.readUInt32LE(p + 12), bits: buf.readUInt16LE(p + 22) };
    if (id === "data") data = new Int16Array(buf.buffer.slice(buf.byteOffset + p + 8, buf.byteOffset + p + 8 + len));
    p += 8 + len + (len & 1);
  }
  const all = Float32Array.from(data, (v) => v / 32768);
  const ch = fmt.channels;
  const pick = (c) => Float32Array.from({ length: all.length / ch }, (_, i) => all[i * ch + c]);
  const samples = pick(0);
  return { status: 0, fmt, samples, left: samples, right: ch > 1 ? pick(1) : samples };
}

export const seg = (secs) => Math.round(secs * SR);
export const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };

// Frequency from zero crossings, with a little hysteresis so tiny wobble doesn't count.
export function freq(x, a, b) {
  let crossings = 0, state = 0;
  for (let i = a; i < b; i++) {
    if (x[i] > 0.01 && state <= 0) { if (state < 0) crossings++; state = 1; }
    else if (x[i] < -0.01 && state >= 0) { if (state > 0) crossings++; state = -1; }
  }
  return crossings / 2 / ((b - a) / SR);
}

// Lengths of individual cycles (rising crossings): how steady the pitch is.
export function periodSpread(x, a, b) {
  const ups = [];
  for (let i = a + 1; i < b; i++) if (x[i - 1] < 0 && x[i] >= 0) ups.push(i);
  const periods = ups.slice(1).map((u, k) => u - ups[k]);
  return Math.max(...periods) - Math.min(...periods);
}

// steps: [pitch, instrument, volume, effect]
export function sfx(speed, steps, { loop = [-1, -1], render = "render sfx 0", pre = "" } = {}) {
  return `${pre}sfx 0 ${speed} ${steps.length} ${loop[0]} ${loop[1]}\n${steps.map((s) => `s ${s.join(" ")}`).join("\n")}\n${render}\n`;
}
