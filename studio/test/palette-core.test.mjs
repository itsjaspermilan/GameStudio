import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/palette-core.js";
import { BUILTIN_CONSOLES } from "../src/consoles.js";

const dot = BUILTIN_CONSOLES[0];
const px = (...cols) => new Uint8ClampedArray(cols.flatMap((c) => (c ? [...P.hexToRgb(c), 255] : [0, 0, 0, 0])));

test("colours round to the console's 15-bit colours", () => {
  assert.equal(P.quantize("#ffffff"), "#ffffff");
  assert.equal(P.quantize("#000000"), "#000000");
  assert.equal(P.quantize("#7f7f7f"), "#7b7b7b"); // 127 is level 15 of 31
  assert.ok(P.isConsoleColor("#7b7b7b"));
  assert.ok(!P.isConsoleColor("#7f7f7f"));
  assert.equal(P.quantize("#7f7f7f", 24), "#7f7f7f");
});

test("palette.json is read leniently and checked in plain words", () => {
  const pal = P.normalizePalette({ sprites: [{ name: "hero", colors: ["#FF0000", "nope", "00ff00"] }, { colors: [] }], tiles: "x" });
  assert.deepEqual(pal, { sprites: [{ name: "hero", colors: ["#ff0000", "#00ff00"] }], tiles: [] });
  assert.deepEqual(P.checkPalette(pal, dot), []);
  const bad = P.normalizePalette({ sprites: [{ name: "a", colors: ["#7f7f7f"] }], tiles: [{ name: "a", colors: Array(15).fill("#000000") }, { name: "9x", colors: [] }] });
  const problems = P.checkPalette(bad, dot).join("\n");
  assert.match(problems, /cannot show exactly/);
  assert.match(problems, /Two banks are called "a"/);
  assert.match(problems, /"9x" is not a usable bank name/);
  const many = { sprites: Array.from({ length: 17 }, (_, i) => ({ name: "b" + i, colors: [] })), tiles: [] };
  assert.match(P.checkPalette(many, dot)[0], /room for 16/);
  assert.equal(P.freeBankName({ sprites: [{ name: "sky" }, { name: "sky2" }], tiles: [] }, "sky"), "sky3");
});

test("the starter banks fit the console: 16 places, 15-bit colours, dark first", () => {
  const pal = P.starterPalette();
  assert.ok(pal.sprites.length >= 6 && pal.tiles.length >= 6);
  assert.deepEqual(P.checkPalette(pal, dot), []);
  for (const b of [...pal.sprites, ...pal.tiles]) {
    assert.equal(b.colors.length, 15, b.name);
    const light = (h) => P.hexToRgb(h).reduce((a, v) => a + v, 0);
    assert.ok(light(b.colors[0]) < light(b.colors[4]), `${b.name}: each ramp runs dark to light`);
    assert.ok(!b.colors.includes("#000000") && !b.colors.includes("#ffffff"), `${b.name}: no pure black or white`);
  }
});

test("each tile of a tileset must keep to one of its banks", () => {
  const banks = [{ name: "a", colors: ["#ff0000", "#00ff00"] }, { name: "b", colors: ["#0000ff"] }];
  // a 2x1 sheet of 1x1 tiles... made 4 tiles: red, blue, empty, red+blue mixed would need 2 pixels a tile, so use 2x1 tiles
  const sheet = { w: 8, h: 1, tile: [2, 1], frames: [px("#ff0000", "#00ff00", "#0000ff", null, null, null, "#ff0000", "#0000ff")] };
  assert.deepEqual(P.tileBanks(sheet, banks), [0, 1, 0, -1]);
  assert.deepEqual(P.tilesOutsideBanks(sheet, banks), [3]);
  const n = P.snapTilesToBanks(sheet, banks);
  assert.equal(n, 1); // the mixed tile goes to one bank: one pixel moves
  assert.deepEqual(P.tilesOutsideBanks(sheet, banks), []);
});

test("moving to another bank keeps each pixel's place", () => {
  const from = { name: "blue", colors: ["#000080", "#0000ff"] }, to = { name: "red", colors: ["#800000", "#ff0000"] };
  const data = px("#0000ff", null, "#000080", "#123456");
  assert.equal(P.recolorByPlace(data, from, to), 2);
  assert.deepEqual([...data], [...px("#ff0000", null, "#800000", "#123456")]);
});

test("a ramp from a picked colour runs dark to light in its hue", () => {
  const r = P.rampFrom("#3070c0");
  assert.equal(r.length, 5);
  assert.ok(r.every((c) => P.isConsoleColor(c)));
  const [lo, mid, hi] = [r[0], r[2], r[4]].map(P.hexToRgb);
  assert.ok(lo[2] < mid[2] && mid[2] < hi[2] && mid[2] > mid[0], r.join(" "));
});
