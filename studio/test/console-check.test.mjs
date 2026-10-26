import test from "node:test";
import assert from "node:assert/strict";
import { checkProject } from "../src/console-check.js";
import * as K from "../src/consoles.js";

const dot = K.BUILTIN_CONSOLES[0], dash = K.BUILTIN_CONSOLES[1];
const texts = (r) => r.map((x) => x.text);

test("a project that fits reports nothing, and a screen change is only a note", () => {
  const facts = { rooms: { rm: { width: 320, height: 240, instances: 10, layers: 1 } }, sprites: { s: { w: 16, h: 16, frames: 2, offPalette: 0 } }, tilesets: { t: { w: 64, h: 32, tile_w: 16, tile_h: 16, offPalette: 0 } } };
  assert.deepEqual(checkProject(dot, dot, facts), []);
  const r = checkProject(dot, dash, facts);
  assert.equal(r.length, 1);
  assert.equal(r[0].level, "note");
  assert.match(r[0].text, /320×240 to 320×180/);
});

test("levels, entities and layers over the limits are problems", () => {
  const facts = { rooms: { big: { width: 2000, height: 100, instances: 600, layers: 5 } } };
  const t = texts(checkProject(dot, dot, facts));
  assert.equal(t.length, 3);
  assert.ok(t[0].includes("2000×100") && t[0].includes("1024×1024"));
  assert.ok(t[1].includes("600 entities") && t[1].includes("512"));
  assert.ok(t[2].includes("5 tile layers") && t[2].includes("4"));
});

test("sprites and tilesets must fit the console's graphics rules", () => {
  const facts = {
    sprites: { odd: { w: 30, h: 16, frames: 1 }, huge: { w: 256, h: 16, frames: 1 }, long: { w: 16, h: 16, frames: 40 } },
    tilesets: { weird: { w: 100, h: 100, tile_w: 12, tile_h: 12 }, sheet: { w: 1024, h: 64, tile_w: 16, tile_h: 16 }, rect: { w: 64, h: 64, tile_w: 16, tile_h: 8 } },
  };
  const r = checkProject(dot, dot, facts), t = texts(r);
  assert.ok(t.some((x) => x.startsWith("Sprite odd") && x.includes("multiples of 8")));
  assert.ok(t.some((x) => x.startsWith("Sprite huge") && x.includes("128×128")));
  assert.ok(t.some((x) => x.startsWith("Tileset weird") && x.includes("8×8 or 16×16 or 32×32")));
  assert.ok(t.some((x) => x.startsWith("Tileset sheet") && x.includes("512×512")));
  assert.ok(t.some((x) => x.startsWith("Tileset rect"))); // non-square tiles aren't allowed when sizes are listed
  assert.equal(r.at(-1).level, "note"); // the frames budget is a note, listed after the problems
  assert.ok(r.at(-1).text.includes("40 frames"));
  assert.equal(r.filter((x) => x.level === "problem").length, 5);
});

test("palettes: a fixed palette flags stray pixels, a limited one flags too many colours, free flags nothing", () => {
  const facts = { sprites: { a: { w: 8, h: 8, frames: 1, offPalette: 12, colors: 20 } }, tilesets: { b: { w: 16, h: 16, tile_w: 16, tile_h: 16, offPalette: 0, colors: 3 } } };
  const fixed = texts(checkProject(dot, dot, facts));
  assert.deepEqual(fixed.length, 1);
  assert.match(fixed[0], /Sprite a has 12 pixels outside/);
  const limited = K.duplicateConsole(dot, "lim", "Lim"); limited.palette = { mode: "limited", size: 16 };
  assert.match(texts(checkProject(dot, limited, facts))[0], /Sprite a uses 20 colours; this console allows 16/);
  const free = K.duplicateConsole(dot, "fr", "Fr"); free.palette = { mode: "free" };
  assert.deepEqual(checkProject(dot, free, facts), []);
});

test("colour banks: each sprite needs its bank, each tile keeps to one of its banks", () => {
  const facts = { palette: { sprites: 2, tiles: 1, problems: ["Two banks are called \"a\": every bank needs its own name."] },
    sprites: { a: { w: 8, h: 8, frames: 1, noBank: true }, b: { w: 8, h: 8, frames: 1, noBank: "gone" }, c: { w: 8, h: 8, frames: 1, offBank: 4 }, d: { w: 8, h: 8, frames: 1, offBank: 0, offPalette: 9 } },
    tilesets: { t: { w: 16, h: 16, tile_w: 16, tile_h: 16, tilesOff: 1 } } };
  const t = texts(checkProject(dot, dot, facts)).join(" | ");
  assert.match(t, /Colours: Two banks/);
  assert.match(t, /Sprite a has no colour bank yet/);
  assert.match(t, /Sprite b uses bank gone/);
  assert.match(t, /Sprite c has 4 pixels outside its bank/);
  assert.match(t, /Tileset t has 1 tile that mix/);
  assert.doesNotMatch(t, /Sprite d/); // inside its bank: the classic colours do not matter any more
});

test("moving to the legacy console has no limits to break", () => {
  const facts = { rooms: { r: { width: 5000, height: 5000, instances: 9999, layers: 12 } }, sprites: { s: { w: 130, h: 33, frames: 90, offPalette: 7 } } };
  assert.deepEqual(checkProject(dot, K.LEGACY_CONSOLE, facts).filter((x) => x.level === "problem"), []);
});

test("a room that starts with more objects than may be alive at once is a problem", () => {
  const c = K.duplicateConsole(dot, "tight", "Tight"); c.limits = { instances_alive: 100 };
  const facts = { rooms: { rm: { width: 320, height: 240, instances: 150, layers: 1 } }, sprites: {}, tilesets: {} };
  const t = texts(checkProject(dot, c, facts));
  assert.ok(t.some((x) => /starts with 150 entities; this console allows 100 alive at once/.test(x)), t.join(" | "));
});
