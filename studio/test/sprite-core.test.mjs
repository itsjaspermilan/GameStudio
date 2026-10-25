import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/sprite-core.js";

const RED = [255, 0, 0, 255], BLUE = [0, 0, 255, 255], CLEAR = [0, 0, 0, 0];

test("createSprite makes one blank transparent frame", () => {
  const s = C.createSprite("spr_a", 4, 3);
  assert.equal(s.frames.length, 1);
  assert.equal(s.frames[0].length, 4 * 3 * 4);
  assert.deepEqual(C.getPixel(s, 0, 2, 1), CLEAR);
});

test("setPixel ignores out-of-bounds writes", () => {
  const s = C.createSprite("s", 2, 2);
  C.setPixel(s, 0, -1, 0, RED); C.setPixel(s, 0, 2, 0, RED); C.setPixel(s, 0, 0, 5, RED);
  assert.ok(s.frames[0].every((v) => v === 0));
  C.setPixel(s, 0, 1, 1, RED);
  assert.deepEqual(C.getPixel(s, 0, 1, 1), RED);
});

test("floodFill fills the connected region only", () => {
  const s = C.createSprite("s", 4, 4);
  for (let y = 0; y < 4; y++) C.setPixel(s, 0, 2, y, BLUE); // vertical wall
  const n = C.floodFill(s, 0, 0, 0, RED);
  assert.equal(n, 8);
  assert.deepEqual(C.getPixel(s, 0, 1, 3), RED);
  assert.deepEqual(C.getPixel(s, 0, 3, 0), CLEAR); // other side untouched
  assert.deepEqual(C.getPixel(s, 0, 2, 2), BLUE);
});

test("floodFill with the same colour is a no-op, and transparent pixels match each other", () => {
  const s = C.createSprite("s", 3, 3);
  C.setPixel(s, 0, 1, 1, [9, 9, 9, 0]); // transparent with hidden rgb
  assert.equal(C.floodFill(s, 0, 0, 0, CLEAR), 0);
  assert.equal(C.floodFill(s, 0, 0, 0, RED), 9);
});

test("line covers both endpoints and is connected", () => {
  const pts = [];
  C.line(0, 0, 5, 2, (x, y) => pts.push([x, y]));
  assert.deepEqual(pts[0], [0, 0]);
  assert.deepEqual(pts.at(-1), [5, 2]);
  for (let i = 1; i < pts.length; i++) {
    assert.ok(Math.abs(pts[i][0] - pts[i - 1][0]) <= 1 && Math.abs(pts[i][1] - pts[i - 1][1]) <= 1);
  }
  const single = [];
  C.line(3, 3, 3, 3, (x, y) => single.push([x, y]));
  assert.equal(single.length, 1);
});

test("rect outline vs filled", () => {
  let o = 0, f = 0;
  C.rect(0, 0, 3, 3, false, () => o++);
  C.rect(0, 0, 3, 3, true, () => f++);
  assert.equal(o, 12);
  assert.equal(f, 16);
  let flipped = 0;
  C.rect(3, 3, 0, 0, true, () => flipped++); // corners in any order
  assert.equal(flipped, 16);
});

test("frame operations", () => {
  const s = C.createSprite("s", 2, 2);
  C.setPixel(s, 0, 0, 0, RED);
  assert.ok(C.duplicateFrame(s, 0));
  assert.equal(s.frames.length, 2);
  assert.deepEqual(C.getPixel(s, 1, 0, 0), RED);
  C.setPixel(s, 1, 0, 0, BLUE); // the copy is independent
  assert.deepEqual(C.getPixel(s, 0, 0, 0), RED);
  assert.ok(C.addFrame(s));
  assert.equal(s.frames.length, 3);
  assert.ok(C.moveFrame(s, 1, 0));
  assert.deepEqual(C.getPixel(s, 0, 0, 0), BLUE);
  assert.ok(C.deleteFrame(s, 0));
  assert.equal(s.frames.length, 2);
  C.deleteFrame(s, 0);
  assert.equal(C.deleteFrame(s, 0), false); // never delete the last frame
  assert.equal(s.frames.length, 1);
});

test("resize crops and pads, clamping origin and mask", () => {
  const s = C.createSprite("s", 4, 4);
  C.setPixel(s, 0, 3, 3, RED); C.setPixel(s, 0, 0, 0, BLUE);
  s.origin = [3, 3]; s.mask = [1, 1, 3, 3];
  C.resize(s, 2, 2);
  assert.equal(s.w, 2);
  assert.deepEqual(C.getPixel(s, 0, 0, 0), BLUE);
  assert.deepEqual(s.origin, [1, 1]);
  assert.deepEqual(s.mask, [1, 1, 1, 1]);
  C.resize(s, 5, 3);
  assert.equal(s.frames[0].length, 5 * 3 * 4);
  assert.deepEqual(C.getPixel(s, 0, 0, 0), BLUE);
  assert.deepEqual(C.getPixel(s, 0, 4, 2), CLEAR);
  C.resize(s, 9999, 0);
  assert.equal(s.w, C.MAX_SIZE);
  assert.equal(s.h, 1);
});

test("history: undo and redo restore full state, new edits clear redo", () => {
  const s = C.createSprite("s", 2, 2), h = new C.History();
  h.record(C.snapshot(s));
  C.setPixel(s, 0, 0, 0, RED);
  h.record(C.snapshot(s));
  C.addFrame(s);
  const back1 = h.undo(C.snapshot(s));
  C.restore(s, back1);
  assert.equal(s.frames.length, 1);
  assert.deepEqual(C.getPixel(s, 0, 0, 0), RED);
  const back0 = h.undo(C.snapshot(s));
  C.restore(s, back0);
  assert.deepEqual(C.getPixel(s, 0, 0, 0), CLEAR);
  assert.equal(h.undo(C.snapshot(s)), null);
  C.restore(s, h.redo(C.snapshot(s)));
  assert.deepEqual(C.getPixel(s, 0, 0, 0), RED);
  h.record(C.snapshot(s));
  assert.equal(h.redo(C.snapshot(s)), null);
});

test("strip packing round-trips frames", () => {
  const s = C.createSprite("spr", 3, 2);
  C.addFrame(s);
  C.setPixel(s, 0, 0, 0, RED); C.setPixel(s, 1, 2, 1, BLUE);
  const strip = C.packStrip(s);
  assert.equal(strip.width, 6); assert.equal(strip.height, 2);
  const back = C.unpackStrip(strip.width, strip.height, strip.data, 2);
  assert.equal(back.w, 3); assert.equal(back.h, 2);
  assert.deepEqual([...back.frames[0]], [...s.frames[0]]);
  assert.deepEqual([...back.frames[1]], [...s.frames[1]]);
});

test("toJSON matches the engine's sprite format", () => {
  const s = C.createSprite("spr_x", 8, 8);
  C.addFrame(s); s.origin = [4, 4]; s.mask = [1, 1, 6, 6]; s.fps = 10;
  assert.deepEqual(C.toJSON(s), { image: "sprites/spr_x.png", frames: 2, origin: [4, 4], mask: [1, 1, 6, 6], fps: 10 });
});

test("colour helpers and name validation", () => {
  assert.deepEqual(C.hexToRgba("#ff8000"), [255, 128, 0, 255]);
  assert.equal(C.rgbaToHex([255, 128, 0, 255]), "#ff8000");
  assert.ok(C.isValidName("spr_player-1"));
  assert.ok(!C.isValidName("../x") && !C.isValidName("") && !C.isValidName(".hidden") && !C.isValidName("a b"));
});

test("tileset: sheet geometry, indexing and resizing", () => {
  const t = C.createTileset("ts", 8, 4, 3, 2); // 24x8 px sheet, 3x2 tiles of 8x4
  assert.equal(t.w, 24); assert.equal(t.h, 8);
  assert.equal(C.tileCount(t), 6);
  assert.equal(C.tileIndexAt(t, 0, 0), 0);
  assert.equal(C.tileIndexAt(t, 17, 5), 5); // col 2, row 1
  assert.equal(C.tileIndexAt(t, 24, 0), -1);
  assert.equal(C.tileIndexAt(t, -1, 0), -1);
  C.setPixel(t, 0, 1, 1, RED);
  C.resizeSheet(t, 8, 4, 5, 4);
  assert.equal(t.w, 40); assert.equal(t.h, 16);
  assert.deepEqual(C.getPixel(t, 0, 1, 1), RED); // pixels stay put
  C.resizeSheet(t, 16, 16, 1000, 1000); // capped at the maximum sheet size
  assert.ok(t.w <= C.MAX_SHEET && t.h <= C.MAX_SHEET);
  assert.deepEqual(t.tile, [16, 16]);
});

test("tileset: JSON format and history keep the tile size", () => {
  const t = C.createTileset("ts_a", 16, 16, 2, 2), h = new C.History();
  assert.deepEqual(C.tilesetToJSON(t), { image: "tilesets/ts_a.png", tile_w: 16, tile_h: 16 });
  h.record(C.snapshot(t));
  C.resizeSheet(t, 8, 8, 4, 4);
  C.restore(t, h.undo(C.snapshot(t)));
  assert.deepEqual(t.tile, [16, 16]);
  assert.equal(t.w, 32);
});

test("importSheet replaces the pixels and clamps to the maximum size", () => {
  const t = C.createTileset("ts", 4, 4, 1, 1);
  const px = new Uint8ClampedArray(8 * 4 * 4); px.fill(200);
  C.importSheet(t, 8, 4, px);
  assert.equal(t.w, 8); assert.equal(t.h, 4);
  assert.deepEqual(C.getPixel(t, 0, 7, 3), [200, 200, 200, 200]);
  assert.equal(C.tilesetCols(t), 2);
  const big = new Uint8ClampedArray(2000 * 2 * 4);
  C.importSheet(t, 2000, 2, big);
  assert.equal(t.w, C.MAX_SHEET);
});

// ---- palettes ----
const PAL = [[0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 0, 255]];

test("nearestRgb picks the closest palette colour", () => {
  assert.deepEqual(C.nearestRgb([250, 10, 10], PAL), [255, 0, 0]);
  assert.deepEqual(C.nearestRgb([10, 10, 240], PAL), [0, 0, 255]);
  assert.deepEqual(C.nearestRgb([200, 200, 200], PAL), [255, 255, 255]);
  assert.deepEqual(C.nearestRgb([30, 30, 30], PAL), [0, 0, 0]);
  assert.deepEqual(C.nearestRgb([255, 0, 0], PAL), [255, 0, 0]); // exact colours stay exact
});

test("offPaletteCount counts opaque pixels that are not palette colours", () => {
  const s = C.createSprite("s", 2, 2);
  C.setPixel(s, 0, 0, 0, [255, 0, 0, 255]);      // on the palette
  C.setPixel(s, 0, 1, 0, [254, 0, 0, 255]);      // one off
  C.setPixel(s, 0, 0, 1, [255, 0, 0, 128]);      // right colour, half transparent: still off
  assert.equal(C.offPaletteCount(s, PAL), 2);    // the fully transparent pixel is fine
  C.addFrame(s); C.setPixel(s, 1, 1, 1, [1, 2, 3, 255]);
  assert.equal(C.offPaletteCount(s, PAL), 3);
});

test("snapToPalette moves everything onto the palette and clears mostly-transparent pixels", () => {
  const s = C.createSprite("s", 3, 1);
  C.setPixel(s, 0, 0, 0, [250, 10, 10, 255]);
  C.setPixel(s, 0, 1, 0, [10, 10, 240, 200]);   // mostly opaque: snaps and becomes opaque
  C.setPixel(s, 0, 2, 0, [255, 255, 255, 40]);  // mostly transparent: cleared
  const changed = C.snapToPalette(s, PAL);
  assert.equal(changed, 3);
  assert.deepEqual(C.getPixel(s, 0, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(C.getPixel(s, 0, 1, 0), [0, 0, 255, 255]);
  assert.deepEqual(C.getPixel(s, 0, 2, 0), [0, 0, 0, 0]);
  assert.equal(C.offPaletteCount(s, PAL), 0);
  assert.equal(C.snapToPalette(s, PAL), 0); // already on the palette: nothing to do
});

test("usedColors and colorAllowed enforce a limit on distinct colours", () => {
  const s = C.createSprite("s", 4, 1);
  C.addFrame(s);
  C.setPixel(s, 0, 0, 0, [1, 2, 3, 255]); C.setPixel(s, 1, 1, 0, [4, 5, 6, 255]); C.setPixel(s, 0, 2, 0, [1, 2, 3, 255]);
  assert.equal(C.usedColors(s).size, 2); // counted over all frames, repeats once
  assert.ok(C.colorAllowed(s, [1, 2, 3, 255], 2));   // already used
  assert.ok(!C.colorAllowed(s, [9, 9, 9, 255], 2));  // a third colour is over the limit
  assert.ok(C.colorAllowed(s, [9, 9, 9, 255], 3));
  assert.ok(C.colorAllowed(s, [9, 9, 9, 255], 0));   // no limit
});

test("animations: add, rename, clamp and play", () => {
  const s = C.createSprite("hero", 4, 4);
  C.addFrame(s); C.addFrame(s); C.addFrame(s); // 4 frames
  assert.ok(C.addAnimation(s, "walk"));
  assert.ok(!C.addAnimation(s, "walk"), "no duplicates");
  assert.ok(!C.addAnimation(s, "bad name"), "names are simple words");
  assert.deepEqual(s.animations.walk, { from: 0, to: 3, fps: 6, loop: true });
  assert.ok(C.addAnimation(s, "jump"));
  assert.ok(!C.renameAnimation(s, "jump", "walk"), "rename onto a taken name is refused");
  assert.ok(C.renameAnimation(s, "jump", "hop"));
  assert.deepEqual(Object.keys(s.animations), ["walk", "hop"]);
  C.deleteFrame(s, 3); C.deleteFrame(s, 2);
  s.animations = C.normalizeAnimations(s.animations, s.frames.length);
  assert.equal(s.animations.walk.to, 1, "clips shrink with the frames");
  assert.deepEqual(C.normalizeAnimations({ x: { from: 5, to: 1 }, "no way": {}, y: 3 }, 6), { x: { from: 1, to: 5, fps: 6, loop: true } });
  assert.deepEqual(C.toJSON(s).animations.walk, s.animations.walk);
  assert.equal(C.toJSON(C.createSprite("p")).animations, undefined, "a sprite without clips keeps its file as before");
  const loop = { from: 1, to: 3, fps: 10, loop: true }, once = { ...loop, loop: false };
  assert.deepEqual([0, 0.1, 0.2, 0.3, 0.4].map((t) => C.animationFrame(loop, t)), [1, 2, 3, 1, 2]);
  assert.equal(C.animationFrame(once, 5), 3);
  const snap = C.snapshot(s); s.animations.walk.to = 0; C.restore(s, snap);
  assert.equal(s.animations.walk.to, 1, "undo brings clips back");
});

test("the size guide fits Dot's sprite rules", async () => {
  const { SIZE_GUIDE, REFERENCE_SIZES } = await import("../src/sprite-core.js");
  const { BUILTIN_CONSOLES } = await import("../src/consoles.js");
  const ss = BUILTIN_CONSOLES[0].graphics.sprite_size;
  for (const r of SIZE_GUIDE) assert.ok(r.w % ss.multiple_of === 0 && r.h % ss.multiple_of === 0 && r.w <= ss.max_width && r.h <= ss.max_height, r.id);
  assert.deepEqual([SIZE_GUIDE[0].w, SIZE_GUIDE[0].h], [32, 32], "a hero starts at 32x32");
  assert.deepEqual(REFERENCE_SIZES, [16, 32, 48, 64]);
});

test("selection: a box between corners, lifted, moved, stamped and flipped", () => {
  const s = C.createSprite("sel", 4, 4);
  C.setPixel(s, 0, 1, 1, RED); C.setPixel(s, 0, 2, 1, BLUE);
  assert.deepEqual(C.boxBetween(s, [2, 1], [1, 1]), { x: 1, y: 1, w: 2, h: 1 }, "corners in any order, both included");
  assert.deepEqual(C.boxBetween(s, [-3, -3], [9, 1]), { x: 0, y: 0, w: 4, h: 2 }, "kept inside the picture");
  assert.equal(C.boxBetween(s, [5, 5], [7, 7]), null);
  assert.ok(C.inBox({ x: 1, y: 1, w: 2, h: 1 }, 2, 1) && !C.inBox({ x: 1, y: 1, w: 2, h: 1 }, 3, 1));

  const buf = C.liftArea(s, 0, { x: 1, y: 1, w: 2, h: 1 });
  assert.deepEqual(C.getPixel(s, 0, 1, 1), CLEAR, "lifting leaves see-through pixels behind");
  C.setPixel(s, 0, 0, 3, BLUE);
  C.stampArea(s, 0, { w: 2, h: 1, data: new Uint8ClampedArray([0, 0, 0, 0, 255, 0, 0, 255]) }, 0, 3);
  assert.deepEqual(C.getPixel(s, 0, 0, 3), BLUE, "see-through pixels leave what is under them");
  assert.deepEqual(C.getPixel(s, 0, 1, 3), RED);
  C.stampArea(s, 0, buf, 3, 0);
  assert.deepEqual(C.getPixel(s, 0, 3, 0), RED, "pixels past the edge are dropped, the rest land");

  const flipped = C.flipArea(buf);
  assert.deepEqual([...flipped.data.slice(0, 4)], BLUE);
  assert.deepEqual([...flipped.data.slice(4, 8)], RED);
  assert.deepEqual([...C.copyArea(s, 0, { x: 3, y: 0, w: 2, h: 1 }).data.slice(4, 8)], CLEAR, "outside the picture copies as see-through");
});
