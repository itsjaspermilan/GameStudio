import test from "node:test";
import assert from "node:assert/strict";
import { parseWav, sampleName } from "../src/wav.js";
import { budgetStatus, formatKB } from "../src/consoles.js";

function wav({ rate = 22050, channels = 1, bits = 16, seconds = 1, extraChunk = false } = {}) {
  const dataLen = Math.round(rate * channels * (bits / 8) * seconds);
  const parts = [];
  const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255], u16 = (n) => [n & 255, (n >> 8) & 255];
  const str = (s) => [...s].map((c) => c.charCodeAt(0));
  parts.push(...str("RIFF"), ...u32(36 + dataLen), ...str("WAVE"), ...str("fmt "), ...u32(16), ...u16(1), ...u16(channels), ...u32(rate), ...u32(rate * channels * bits / 8), ...u16(channels * bits / 8), ...u16(bits));
  if (extraChunk) parts.push(...str("LIST"), ...u32(3), 1, 2, 3, 0); // an odd-sized chunk (padded) before the data
  parts.push(...str("data"), ...u32(dataLen));
  const bytes = new Uint8Array(parts.length + dataLen);
  bytes.set(parts);
  return bytes;
}

test("parseWav reads format and duration", () => {
  const r = parseWav(wav({ rate: 22050, seconds: 2 }));
  assert.deepEqual({ channels: r.channels, rate: r.rate, bits: r.bits }, { channels: 1, rate: 22050, bits: 16 });
  assert.ok(Math.abs(r.seconds - 2) < 1e-6);
  assert.ok(Math.abs(parseWav(wav({ rate: 44100, channels: 2, seconds: 0.5 })).seconds - 0.5) < 1e-6);
  assert.ok(Math.abs(parseWav(wav({ seconds: 1.5, extraChunk: true })).seconds - 1.5) < 1e-6); // skips other chunks
});

test("parseWav rejects things that aren't usable WAV files", () => {
  assert.match(parseWav(new Uint8Array(10)).error, /too small/);
  const notWav = wav(); notWav[0] = 88;
  assert.match(parseWav(notWav).error, /isn't a WAV/);
  const noData = wav(); noData.set([120, 120, 120, 120], 36); // the "data" chunk renamed, so there is none
  assert.match(parseWav(noData).error, /no sound data/);
  const broken = wav(); broken.set([0, 0, 0, 0], 28); // byte rate 0
  assert.match(parseWav(broken).error, /isn't valid/);
  // the data chunk claims more than the file holds: use what is there
  const truncated = wav({ seconds: 1 }).slice(0, 44 + 22050); // half a second of 16-bit mono at 22050
  assert.ok(Math.abs(parseWav(truncated).seconds - 0.5) < 0.01);
});

test("sampleName makes safe, unique resource names", () => {
  assert.equal(sampleName("Coin Pickup!.wav", []), "coin_pickup");
  assert.equal(sampleName("jump.WAV", ["jump"]), "jump_2");
  assert.equal(sampleName("jump.wav", ["jump", "jump_2"]), "jump_3");
  assert.equal(sampleName("...wav", []), "sample");
  assert.equal(sampleName("éé.wav", []), "sample");
  assert.ok(sampleName("a".repeat(80) + ".wav", []).length <= 40);
});

test("budgets: ok under 80%, warn up to the budget, over past it", () => {
  assert.equal(budgetStatus(100, 1000).level, "ok");
  assert.equal(budgetStatus(800, 1000).level, "warn");
  assert.equal(budgetStatus(1000, 1000).level, "warn");
  assert.equal(budgetStatus(1001, 1000).level, "over");
  assert.deepEqual(budgetStatus(5, undefined), { level: "ok", ratio: 0, budget: 0 });
  assert.equal(formatKB(512), "0.5 KB");
  assert.equal(formatKB(150 * 1024), "150 KB");
  assert.equal(formatKB(5 * 1024 + 300), "5.3 KB");
});
