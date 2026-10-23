import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { budgetRows, parseStatsLine, consoleSummary } from "../src/budget-core.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dot = JSON.parse(readFileSync(resolve(root, "engine/consoles/glow43.json"), "utf8"));
const find = (rows, label) => rows.find((r) => r.label === label);

test("a small game is all green", () => {
  const rows = budgetRows(dot, { cartBytes: 300 * 1024, sprites: { hero: { w: 32, h: 32, frames: 4, offPalette: 0 } }, tilesets: { ground: { w: 128, h: 64, tile_w: 16, tile_h: 16, offPalette: 0 } },
    songs: { theme: { tracks: 4 } }, sfx: 5, samples: 0, lua: { files: 6, lines: 300 } }, null);
  assert.equal(find(rows, "Game size").level, "ok");
  assert.equal(find(rows, "Biggest sprite").level, "ok");
  assert.equal(find(rows, "Colours outside the palette").text, "none");
  assert.equal(find(rows, "Songs and effects").text, "1 song, 5 sound effects");
  assert.equal(find(rows, "Most tracks in a song").level, "ok"); // 4 of Dot's 8
  assert.ok(!rows.some((r) => r.group === "While it runs"));
});

test("things over the console's limits are flagged", () => {
  const rows = budgetRows(dot, { cartBytes: 20000 * 1024, sprites: { boss: { w: 160, h: 64, frames: 40, offPalette: 3 }, odd: { w: 12, h: 12, frames: 1 } }, tilesets: { t: { w: 1024, h: 64, tile_w: 12, tile_h: 12 } }, songs: { big: { tracks: 10 } }, sfx: 0, lua: { files: 1, lines: 1 } }, null);
  assert.equal(find(rows, "Game size").level, "over");
  assert.match(find(rows, "Game size").text, /over budget/);
  assert.equal(find(rows, "Biggest sprite").level, "over");
  assert.match(find(rows, "Biggest sprite").text, /boss: 160×64/);
  assert.equal(find(rows, "Most frames in a sprite").level, "over");
  assert.equal(find(rows, "Biggest tileset").level, "over");
  assert.equal(find(rows, "Colours outside the palette").level, "over");
  assert.equal(find(rows, "Most tracks in a song").level, "over");
});

test("a game with colour banks: the banks against the console, and art outside its banks", () => {
  const ok = budgetRows(dot, { palette: { sprites: 3, tiles: 2, problems: [] }, sprites: { hero: { w: 32, h: 32, frames: 1, offBank: 0 } }, tilesets: { t: { w: 64, h: 64, tile_w: 16, tile_h: 16, tilesOff: 0 } }, lua: { files: 0, lines: 0 } }, null);
  assert.equal(find(ok, "Colour banks").text, "3 sprite, 2 tile");
  assert.equal(find(ok, "Art outside its banks").level, "ok");
  assert.equal(find(ok, "Colours outside the palette"), undefined);
  const bad = budgetRows(dot, { palette: { sprites: 17, tiles: 2, problems: [] }, sprites: { hero: { w: 32, h: 32, frames: 1, noBank: true } }, tilesets: { t: { w: 64, h: 64, tile_w: 16, tile_h: 16, tilesOff: 2 } }, lua: { files: 0, lines: 0 } }, null);
  assert.equal(find(bad, "Colour banks").level, "over");
  assert.equal(find(bad, "Art outside its banks").text, "2: hero, t");
});

test("a sprite that is not a multiple of 8 is a warning, not an error", () => {
  const rows = budgetRows(dot, { sprites: { odd: { w: 12, h: 12, frames: 1 } }, lua: { files: 0, lines: 0 } }, null);
  assert.equal(find(rows, "Biggest sprite").level, "warn");
  assert.match(find(rows, "Biggest sprite").text, /not a multiple of 8/);
});

test("live numbers: entities against the limit, time against the guide", () => {
  const calm = budgetRows(dot, { lua: { files: 0, lines: 0 } }, { entities: 40, peak: 60, limit: 512, update_ms: 0.2, draw_ms: 0.3, fps: 60, mem_kb: 800 });
  assert.equal(find(calm, "Things alive at once").level, "ok");
  assert.equal(find(calm, "Time per frame (this computer)").level, "ok");
  const busy = budgetRows(dot, { lua: { files: 0, lines: 0 } }, { entities: 500, peak: 512, limit: 512, update_ms: 2.5, draw_ms: 1.5, fps: 44, mem_kb: 2000 });
  assert.equal(find(busy, "Things alive at once").level, "warn");
  assert.equal(find(busy, "Time per frame (this computer)").level, "over");
  assert.equal(find(busy, "Frames a second").level, "warn");
  assert.equal(find(busy, "Collision checks (busiest step)"), undefined, "older runtimes send no checks: no row");
  const heavy = budgetRows(dot, { lua: { files: 0, lines: 0 } }, { entities: 40, peak: 60, limit: 512, update_ms: 0.2, draw_ms: 0.3, fps: 60, mem_kb: 800, checks: 1400, screens: 2.5 });
  assert.equal(find(heavy, "Collision checks (busiest step)").level, "over");
  assert.match(find(heavy, "Drawing (busiest frame)").text, /2\.5 screens of 6\.0 screens/);
});

test("the stats line and the console summary", () => {
  assert.deepEqual(parseStatsLine('@@gs {"entities":3,"peak":4,"limit":null,"update_ms":0.1,"draw_ms":0.2,"fps":60,"mem_kb":400}').peak, 4);
  assert.equal(parseStatsLine("hello"), null);
  assert.equal(parseStatsLine("@@gs not json"), null);
  assert.equal(parseStatsLine('@@gs {"x":1}'), null);
  assert.deepEqual(consoleSummary(dot), ["Glow43 320×240", "colour banks: 16 sprite, 16 tile", "8 music tracks", "4 sound effect channels"]);
});
