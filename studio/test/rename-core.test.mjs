import test from "node:test";
import assert from "node:assert/strict";
import { renameReferences, countCodeMentions, renameInCode, renameSceneFields, settleRenames } from "../src/rename-core.js";

const fixture = () => ({
  "music/song.json": { patterns: [["boop", null, "boop", null], [null, null, null, "other"]] },
  "music/band.json": { format: "tracker", track_instruments: ["lead", "bass"], patterns: [] },
  "sfx/zap.json": { tracks: [{ instrument: "lead", steps: [] }, { instrument: "bass", steps: [] }] },
  "sfx/old.json": { steps: [[30, "lead", 7, 0], [32, "bass", 7, 0]] },
  "instruments/kick.json": { type: "sample", sample: "clap" },
});
const run = (kind, from, to) => renameReferences(fixture(), kind, from, to);

test("renaming an instrument updates tracks, older steps and tracker songs", () => {
  const r = run("instruments", "lead", "pluck");
  assert.deepEqual(r.files["music/band.json"].track_instruments, ["pluck", "bass"]);
  assert.equal(r.files["sfx/zap.json"].tracks[0].instrument, "pluck");
  assert.equal(r.files["sfx/zap.json"].tracks[1].instrument, "bass");
  assert.equal(r.files["sfx/old.json"].steps[0][1], "pluck");
  assert.deepEqual(r.changed.sort(), ["music/band.json", "sfx/old.json", "sfx/zap.json"]);
  assert.equal(r.count, 3);
});

test("renaming a sound effect updates the older songs that play it; samples update instruments", () => {
  const r = run("sfx", "boop", "blip");
  assert.deepEqual(r.files["music/song.json"].patterns[0], ["blip", null, "blip", null]);
  assert.deepEqual(r.changed, ["music/song.json"]);
  const s = run("sounds", "clap", "snap");
  assert.equal(s.files["instruments/kick.json"].sample, "snap");
});

test("nothing changes when nothing refers to the name", () => {
  const r = run("sprites", "hero", "knight");
  assert.equal(r.count, 0);
  assert.deepEqual(r.changed, []);
});

test("code mentions count quoted names, in the forms Lua code uses", () => {
  const code = ['gs.spawn("enemies.grub", 1, 2)', "local s = require 'lib.state'", 'gs.sfx("zap") gs.sfx("zap")', 'local zapper = 1'];
  assert.equal(countCodeMentions(code, "entities", "enemies/grub"), 1);
  assert.equal(countCodeMentions(code, "lib", "state"), 1);
  assert.equal(countCodeMentions(code, "sfx", "zap"), 2);
  assert.equal(countCodeMentions(code, "sfx", "zapp"), 0);
});

test("renameInCode rewrites the plain ways code names a moved entity, scene, room or module", () => {
  const r = renameInCode({
    "scenes/play.lua": 'local G = require "entities.grub"\ngs.spawn("grub", 1, 2)\ngs.spawn( \'grub\' )\nlocal sprite = "grub"\ngs.spawn("grubby")',
    "rooms/one.lua": 'return { entities = { { "grub", 1, 2 }, { "grubby", 3, 4 } }, background = "grub" }',
    "lib/x.lua": "return 1",
  }, "entities", "grub", "enemies/grub");
  assert.equal(r.count, 4);
  assert.deepEqual(Object.keys(r.files).sort(), ["rooms/one.lua", "scenes/play.lua"]);
  assert.equal(r.files["scenes/play.lua"], 'local G = require "entities.enemies.grub"\ngs.spawn("enemies.grub", 1, 2)\ngs.spawn( \'enemies.grub\' )\nlocal sprite = "grub"\ngs.spawn("grubby")');
  assert.equal(r.files["rooms/one.lua"], 'return { entities = { { "enemies.grub", 1, 2 }, { "grubby", 3, 4 } }, background = "grub" }');
  const s = renameInCode({ "game.lua": 'start = "scenes.title"', "lib/m.lua": 'gs.goto_scene("title")\ngs.load_room("title")' }, "scenes", "title", "menus/title");
  assert.equal(s.files["game.lua"], 'start = "scenes.menus.title"');
  assert.equal(s.files["lib/m.lua"], 'gs.goto_scene("menus.title")\ngs.load_room("title")', "a room with the same name is left alone");
  const l = renameInCode({ "a.lua": 'local st = require("lib.state")' }, "lib", "state", "core/state");
  assert.equal(l.files["a.lua"], 'local st = require("lib.core.state")');
  assert.deepEqual(renameInCode({ "a.lua": '"spr"' }, "sprites", "spr", "x").files, {}, "art is not named by module");
});

test("moving a sprite, tileset or sound to a folder renames the plain places that name it", () => {
  const r = renameInCode({
    "entities/player.lua": 'local P = gs.entity{ sprite = "logo" }\nfunction P:hit() self:set_sprite("logo") end\nlocal s = "logo"\ngs.sfx("logo")',
    "scenes/title.layout.lua": '-- A layout.\nreturn {\n  entities = {\n    { "logo", 1, 2 },\n  },\n  pictures = {\n    { "logo", 10, 20, name = "logo" },\n  },\n  texts = {\n    { "HI", 1, 1, font = "logo" },\n  },\n}\n',
  }, "sprites", "logo", "ui/logo");
  assert.equal(r.count, 4);
  assert.equal(r.files["entities/player.lua"], 'local P = gs.entity{ sprite = "ui/logo" }\nfunction P:hit() self:set_sprite("ui/logo") end\nlocal s = "logo"\ngs.sfx("logo")', "other strings and other kinds are left");
  const layout = r.files["scenes/title.layout.lua"];
  assert.match(layout, /\{ "ui\/logo", 10, 20, name = "logo" \}/); assert.match(layout, /font = "ui\/logo"/);
  assert.match(layout, /\{ "logo", 1, 2 \}/, "an entity with the same name is not the sprite");
  assert.ok(layout.startsWith("-- A layout.\n"), "the layout's comment is kept");
  const t = renameInCode({ "rooms/one.lua": 'return { layers = { { tileset = "ground", data = {} } } }', "lib/x.lua": 'gs.add_layer{ tileset = "ground" }' }, "tilesets", "ground", "world/ground");
  assert.match(t.files["rooms/one.lua"], /tileset = "world\/ground"/); assert.equal(t.files["lib/x.lua"], 'gs.add_layer{ tileset = "world/ground" }');
  assert.equal(renameInCode({ "a.lua": 'gs.sfx("zap", 1)\ngs.music("zap")' }, "sfx", "zap", "hits/zap").files["a.lua"], 'gs.sfx("hits/zap", 1)\ngs.music("zap")');
});

test("renaming something in a layout renames self.<it> in the scene's code, and only there", () => {
  const code = 'self.prompt.text = "self.prompt" -- self.prompt\nmyself.prompt = 1\nself . prompt:tween{}\nself.prompts = 2\nlocal s = [[self.prompt]]';
  const r = renameSceneFields(code, { prompt: "hint" });
  assert.equal(r.count, 2);
  assert.equal(r.text, 'self.hint.text = "self.prompt" -- self.prompt\nmyself.prompt = 1\nself . hint:tween{}\nself.prompts = 2\nlocal s = [[self.prompt]]');
  assert.deepEqual(settleRenames([["a", "b"], ["b", "c"]], ["c"]), { a: "c" }, "a chain of renames is one");
  assert.deepEqual(settleRenames([["a", "b"]], ["a"]), {}, "an undone rename is not applied");
  const moved = renameInCode({ "scenes/lvl1.layout.lua": 'return { code = "level", entities = { { "grub", 1, 2 } } }' }, "scenes", "level", "rules/level");
  assert.equal(moved.files["scenes/lvl1.layout.lua"], 'return { code = "rules.level", entities = { { "grub", 1, 2 } } }', "a layout follows its code when that scene is renamed");
});
