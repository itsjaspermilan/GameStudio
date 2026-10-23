import test from "node:test";
import assert from "node:assert/strict";
import * as I from "../src/info-core.js";

test("a missing or odd info object becomes a tidy empty one", () => {
  for (const bad of [undefined, null, 5, "x", []]) {
    const i = I.normalizeInfo(bad);
    assert.deepEqual(i, { title: "", description: "", developer: "", genre: "", players: 1, box_art: "" });
  }
});

test("fields are trimmed, limited and checked", () => {
  const i = I.normalizeInfo({ title: "  Breakout  ", description: "x".repeat(900), developer: "Me", genre: "Arcade", players: 2, box_art: "meta/box_art.png", extra: 1 });
  assert.equal(i.title, "Breakout");
  assert.equal(i.description.length, I.LIMITS.description);
  assert.equal(i.genre, "Arcade");
  assert.equal(i.players, 2);
  assert.equal(i.box_art, "meta/box_art.png");
  assert.ok(!("extra" in i));
  assert.equal(I.normalizeInfo({ genre: "Nonsense" }).genre, "");
  assert.equal(I.normalizeInfo({ players: 9 }).players, 1);
  assert.equal(I.normalizeInfo({ players: "3" }).players, 3);
  assert.equal(I.normalizeInfo({ box_art: "../../etc/passwd" }).box_art, ""); // only the one fixed path is allowed
});

test("the default title comes from the folder name", () => {
  assert.equal(I.defaultTitle("breakout"), "Breakout");
  assert.equal(I.defaultTitle("my_cool-game"), "My cool game");
  assert.equal(I.defaultTitle(""), "Untitled");
});

test("PNG checks and size", () => {
  const png = new Uint8Array(33);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(png.buffer).setUint32(16, 96); new DataView(png.buffer).setUint32(20, 128);
  assert.ok(I.isPng(png));
  assert.deepEqual(I.pngSize(png), { width: 96, height: 128 });
  assert.ok(!I.isPng(new Uint8Array(40)));
  assert.equal(I.pngSize(new Uint8Array(40)), null);
});

test("box art zoom is a whole number that fits", () => {
  assert.equal(I.boxArtScale(32), 9);
  assert.equal(I.boxArtScale(64), 4);
  assert.equal(I.boxArtScale(1000), 1);
  assert.equal(I.boxArtScale(0), 300);
});

test("the gamelist entry is escaped, complete, and leaves out empty fields", () => {
  const when = new Date(2026, 9, 21, 8, 5, 9);
  const xml = I.gamelistEntry({ title: "Cats & <Dogs>", description: "Line one\nLine two", developer: "A \"B\"", genre: "Puzzle", players: 2 },
    { cartName: "cats", launcher: "cats.sh", image: "images/cats.png", date: when });
  assert.match(xml, /<path>\.\/cats\.sh<\/path>/);
  assert.match(xml, /<name>Cats &amp; &lt;Dogs&gt;<\/name>/);
  assert.match(xml, /<desc>Line one\nLine two<\/desc>/);
  assert.match(xml, /<image>\.\/images\/cats\.png<\/image>/);
  assert.match(xml, /<thumbnail>\.\/images\/cats\.png<\/thumbnail>/);
  assert.match(xml, /<developer>A &quot;B&quot;<\/developer>/);
  assert.match(xml, /<genre>Puzzle<\/genre>/);
  assert.match(xml, /<players>2<\/players>/);
  assert.match(xml, /<releasedate>20261021T080509<\/releasedate>/);
  const bare = I.gamelistEntry({}, { cartName: "my_game", launcher: "my_game.sh", date: when });
  assert.match(bare, /<name>My game<\/name>/);
  assert.ok(!/<desc>|<image>|<developer>|<genre>/.test(bare));
});

test("the game list entry shows the screenshot as image, the box art as thumbnail and the logo as marquee", () => {
  const when = new Date(2026, 0, 2, 3, 4, 5);
  const all = I.gamelistEntry({ title: "Game" }, { cartName: "g", launcher: "g.sh", images: { boxart: "images/g.png", screenshot: "images/g-screenshot.png", logo: "images/g-logo.png" }, date: when });
  assert.match(all, /<image>\.\/images\/g-screenshot\.png<\/image>/);
  assert.match(all, /<thumbnail>\.\/images\/g\.png<\/thumbnail>/);
  assert.match(all, /<marquee>\.\/images\/g-logo\.png<\/marquee>/);
  const boxOnly = I.gamelistEntry({}, { cartName: "g", launcher: "g.sh", images: { boxart: "images/g.png" }, date: when });
  assert.match(boxOnly, /<image>\.\/images\/g\.png<\/image>/); // no screenshot: the box art stands in
  assert.ok(!/<marquee>/.test(boxOnly));
  const shotOnly = I.gamelistEntry({}, { cartName: "g", launcher: "g.sh", images: { screenshot: "images/g-screenshot.png" }, date: when });
  assert.match(shotOnly, /<thumbnail>\.\/images\/g-screenshot\.png<\/thumbnail>/); // no box art: the screenshot stands in
  assert.deepEqual(Object.keys(I.ART_FILES), ["boxart", "screenshot", "logo"]);
});

test("a frame the runtime saved (BMP) is read top-down with solid alpha", async () => {
  const { decodeBmp, PICTURES } = await import("../src/info-core.js");
  // 2x2, 24 bit, bottom-up rows (padded to 8 bytes): bottom row blue, white; top row red, green
  const b = new Uint8Array(54 + 16); const v = new DataView(b.buffer);
  b[0] = 0x42; b[1] = 0x4d; v.setUint32(10, 54, true); v.setInt32(18, 2, true); v.setInt32(22, 2, true); v.setUint16(28, 24, true);
  b.set([255, 0, 0, 255, 255, 255, 0, 0], 54);          // bottom row (BGR): blue, white
  b.set([0, 0, 255, 0, 255, 0, 0, 0], 62);              // top row: red, green
  const f = decodeBmp(b);
  assert.deepEqual([f.width, f.height], [2, 2]);
  assert.deepEqual([...f.data.slice(0, 8)], [255, 0, 0, 255, 0, 255, 0, 255]);
  assert.deepEqual([...f.data.slice(8, 16)], [0, 0, 255, 255, 255, 255, 255, 255]);
  assert.throws(() => decodeBmp(new Uint8Array(10)));
  assert.deepEqual(PICTURES.map((p) => p.path), ["meta/box_art.png", "meta/screenshot.png", "meta/logo.png"]);
});
