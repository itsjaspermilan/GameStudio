import test from "node:test";
import assert from "node:assert/strict";
import { renameReferences, countCodeMentions, renameInCode } from "../src/rename-core.js";

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
