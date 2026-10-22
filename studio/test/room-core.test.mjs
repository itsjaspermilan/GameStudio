import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRoom, serializeRoom, fitLayer, fillLayer, entityAt, snap, freshName, luaInline, layoutNames, nameProblem, textBox } from "../src/room-core.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("a room file is read as data, comments and all", () => {
  const { room, error } = parseRoom(`-- a level
return {
  width = 640, height = 480, -- bigger than the screen
  background = "#14234f",
  layers = {
    { name = "ground", tileset = "ts", depth = 100, data = { { 0, 1, -1 }, { 2, 2, 2 } } },
  },
  entities = {
    { "walker", 320, 240 },
    { "tree", 450, 250, { size = 14, tall = true } },
  },
  --[[ a long
  comment ]]
  music = "song",
}`);
  assert.equal(error, undefined);
  assert.equal(room.width, 640); assert.equal(room.background, "#14234f"); assert.equal(room.music, "song");
  assert.deepEqual(room.layers[0].data, [[0, 1, -1], [2, 2, 2]]);
  assert.deepEqual(room.entities[1], ["tree", 450, 250, { size: 14, tall: true }]);
  assert.deepEqual(room.paths, {});
});

test("code is not data: such a room stays a text file", () => {
  assert.match(parseRoom("local w = 640\nreturn { width = w }").error, /room file is `return/);
  assert.match(parseRoom("return { width = 320 * 2 }").error, /code/);
  assert.match(parseRoom("return { make = function() end }").error, /code/);
  assert.match(parseRoom("return { width = 1 } print(1)").error, /code/);
  assert.match(parseRoom("return { width = 1 } { }").error, /more after/);
  assert.ok(parseRoom("return { width = 'unclosed }").error);
});

test("writing and reading again gives the same room", () => {
  const { room } = parseRoom(`return { width = 320, height = 240, background = "#000000", extra = { a = 1, "b" },
    layers = { { name = "g", tileset = "t", depth = 50, solid = true, data = { { 1, -1 }, { -1, 3 } } } },
    entities = { { "player", 16, 32.5, { hp = 3, name = "it's \\"me\\"" } }, { "coin", 8, 8 } },
    paths = { patrol = { { 0, 0 }, { 64, 0 }, { 64, 64 }, loop = true }, line = { { 1, 2 } } } }`);
  const text = serializeRoom(room, "made in the room editor");
  assert.ok(text.startsWith("-- made in the room editor\nreturn {"));
  const back = parseRoom(text);
  assert.equal(back.error, undefined, text);
  assert.deepEqual(back.room, room);
  assert.deepEqual(room.paths.patrol, { points: [[0, 0], [64, 0], [64, 64]], loop: true });
  assert.match(text, /\{ 1, -1 \},\n/, "a tile row per line");
});

test("the rooms in the repository read as data", () => {
  const { room, error } = parseRoom(readFileSync(join(root, "carts/test/rooms/room1.lua"), "utf8"));
  assert.equal(error, undefined);
  assert.equal(room.width, 320);
});

test("editing helpers", () => {
  const room = { width: 40, height: 20, entities: [["a", 10, 10], ["b", 30, 10]] };
  const l = fitLayer({ data: [[1, 2, 3, 4, 5, 6]] }, room, 16, 16);
  assert.deepEqual(l.data, [[1, 2, 3], [-1, -1, -1]]);
  assert.equal(fillLayer(l, 0, 1, 7), 3);
  assert.deepEqual(l.data[1], [7, 7, 7]);
  assert.equal(fillLayer(l, 0, 1, 7), 0, "filling with the same tile changes nothing");
  assert.equal(entityAt(room, 28, 12), 1);
  assert.equal(entityAt(room, 20, 0), -1);
  assert.equal(snap(13, 8), 16); assert.equal(snap(13.4, 1), 13);
  assert.equal(freshName("path", ["path", "path2"]), "path3");
  assert.equal(luaInline({ end: 1, ok: "x" }), '{ ["end"] = 1, ok = "x" }', "Lua words are quoted as keys");
});

test("a scene layout keeps texts, pictures, names and the code it runs", () => {
  const src = `return {
  code = "level",
  entities = {
    { "player", 160, 120, {}, name = "hero" },
    { "grub", 10, 20, { hp = 2 } },
  },
  texts = {
    { "PRESS A", 160, 206, name = "prompt", color = 3, size = 2, align = "center" },
  },
  pictures = {
    { "spr_logo", 80, 20, name = "logo", scale = 2 },
  },
}`;
  const { room } = parseRoom(src);
  assert.deepEqual(room.entities[0], ["player", 160, 120, undefined, "hero"], "{} is no values");
  assert.deepEqual(room.entities[1], ["grub", 10, 20, { hp: 2 }]);
  assert.deepEqual(room.texts[0], { text: "PRESS A", x: 160, y: 206, name: "prompt", color: 3, size: 2, align: "center" });
  assert.deepEqual(room.pictures[0], { sprite: "spr_logo", x: 80, y: 20, name: "logo", scale: 2 });
  assert.equal(room.code, "level");
  const again = parseRoom(serializeRoom(room)).room;
  assert.deepEqual(again, room, "written and read back unchanged");
  assert.deepEqual(layoutNames(room).map((n) => n.name), ["hero", "logo", "prompt"]);
  assert.match(nameProblem("update", room), /every scene/);
  assert.match(nameProblem("logo", room), /already/);
  assert.equal(nameProblem("logo", room, "logo"), null, "a thing keeps its own name");
  assert.match(nameProblem("2fast", room), /letters/);
  assert.deepEqual(textBox({ text: "ABCD", x: 100, y: 10, size: 2, align: "center" }), [68, 10, 132, 26]);
});

test("the sample games' layouts are exactly what the layout editor writes", () => {
  const rels = [];
  for (const game of readdirSync(join(root, "carts"))) {
    const dir = join(root, "carts", game, "scenes");
    if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".layout.lua")) rels.push(`carts/${game}/scenes/${f}`);
  }
  assert.ok(rels.length >= 7, rels.join(", "));
  for (const rel of rels) {
    const text = readFileSync(join(root, rel), "utf8");
    const first = text.split("\n")[0].replace(/^-- /, "");
    assert.equal(serializeRoom(parseRoom(text).room, first), text, rel);
  }
});
