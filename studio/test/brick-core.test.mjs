import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BRICK, brickFrameMs, brickSpeed, playStatus, ramUse } from "../src/brick-core.js";

test("the Brick's RAM is the runtime's RAM_BYTES", () => {
  const src = readFileSync(new URL("../../runtime/ram.c", import.meta.url), "utf8");
  const m = src.match(/#define RAM_BYTES \(\(size_t\)(\d+) << 20\)/);
  assert.ok(m, "RAM_BYTES not found in runtime/ram.c");
  assert.equal(BRICK.ram_kb, Number(m[1]) * 1024);
});

test("the estimate reproduces the measured Brick frames", () => {
  // [screens, update ms on the studio's M4, ms measured on the Brick] (tests/heavy with stars, with moving things, and Breakout)
  const runs = [[7.63, 0.025, 3.11], [7.76, 0.392, 6.63], [7.89, 0.965, 13.07], [8.01, 1.666, 20.31], [11.05, 0.01, 4.15], [14.45, 0.009, 4.91], [21.21, 0.004, 6.94], [1.53, 0.15, 2.1]];
  for (const [screens, update_ms, brick] of runs) {
    const ms = brickFrameMs({ screens, update_ms });
    assert.ok(Math.abs(ms - brick) < 0.45, `${screens} screens, ${update_ms} ms: estimated ${ms.toFixed(2)}, measured ${brick}`);
  }
  assert.equal(brickFrameMs({ update_ms: 1 }), null, "no screens (an older runtime): no estimate");
  assert.equal(brickFrameMs(null), null);
});

test("speed in plain words", () => {
  assert.equal(brickSpeed({ screens: 1.5, update_ms: 0.15 }).level, "ok");
  assert.match(brickSpeed({ screens: 1.5, update_ms: 0.15 }).text, /^about 2\.1 ms of 16\.7 \(1[23]%\)$/);
  assert.equal(brickSpeed({ screens: 1.5, update_ms: 0.15 }).words, "plenty of room");
  assert.equal(brickSpeed({ screens: 8, update_ms: 1 }).level, "warn");
  assert.equal(brickSpeed({ screens: 8, update_ms: 1.7 }).level, "over");
  assert.match(brickSpeed({ screens: 8, update_ms: 1.7 }).words, /skip frames/);
});

test("RAM use and the Play panel's line", () => {
  assert.equal(ramUse({ mem_kb: 700 }), null, "without the console's RAM there is nothing to show");
  const live = { screens: 1.5, update_ms: 0.15, ram_kb: 1126, ram_peak_kb: 1150, ram_size_kb: 8192 };
  assert.equal(ramUse(live).level, "ok");
  assert.equal(ramUse({ ...live, ram_peak_kb: 7900 }).level, "over");
  assert.deepEqual(playStatus(live), { text: "RAM 1.1 of 8 MB · Brick frame ≈ 2.1 ms (13%)", level: "ok" });
  assert.equal(playStatus({ ...live, update_ms: 1.7, screens: 8 }).level, "over");
  assert.deepEqual(playStatus(null), { text: "", level: "ok" });
});
