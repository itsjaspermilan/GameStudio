import test from "node:test";
import assert from "node:assert/strict";
import * as K from "../src/consoles.js";

test("the built-in consoles are valid and have the documented screens", () => {
  assert.deepEqual(K.BUILTIN_CONSOLES.map((c) => c.id), ["dot", "dash"]);
  for (const c of K.BUILTIN_CONSOLES) assert.deepEqual(K.validateConsole(c), [], c.id);
  const [dot, dash] = K.BUILTIN_CONSOLES;
  assert.equal(K.screenText(dot), "320×240");
  assert.equal(K.screenText(dash), "320×180");
  assert.equal(dot.palette.colors.length, 32);
});

test("projects without a console are the legacy 640x480 console, and a project's own console is used", () => {
  assert.equal(K.consoleFor(null), K.LEGACY_CONSOLE);
  assert.equal(K.consoleFor({}), K.LEGACY_CONSOLE);
  assert.equal(K.LEGACY_CONSOLE.screen.width, 640);
  assert.equal(K.instanceLimit(K.LEGACY_CONSOLE), Infinity);
  const c = K.consoleFor({ console: { id: "x", screen: { width: 200, height: 100 } } });
  assert.deepEqual([c.screen.width, c.screen.height], [200, 100]);
  assert.equal(c.screen.scale, "letterbox"); // missing parts come from the legacy defaults
  assert.equal(c.rooms.tile_layers, 16);
});

test("validateConsole reports clear problems", () => {
  const base = () => JSON.parse(JSON.stringify(K.BUILTIN_CONSOLES[0]));
  const problems = (mutate) => { const c = base(); mutate(c); return K.validateConsole(c); };
  assert.match(problems((c) => { c.id = "Bad Id"; })[0], /id must be/);
  assert.match(problems((c) => { c.screen.width = 10; })[0], /screen width/);
  assert.match(problems((c) => { c.palette.mode = "rainbow"; })[0], /palette mode/);
  assert.match(problems((c) => { c.palette.colors = ["#000000", "#000000"]; })[0], /different/);
  assert.match(problems((c) => { c.palette.colors = ["#000000", "red"]; })[0], /#rrggbb/);
  assert.match(problems((c) => { c.rooms.max_width = 100; })[0], /at least as big as the screen/);
  assert.match(problems((c) => { c.rooms.tile_layers = 0; })[0], /tile layers/);
  assert.match(problems((c) => { c.limits.instances_per_room = -1; })[0], /limit instances_per_room/);
  assert.deepEqual(problems((c) => { c.palette = { mode: "free" }; }), []);
  assert.deepEqual(problems((c) => { c.palette = { mode: "limited", size: 16 }; }), []);
  assert.ok(K.validateConsole(null).length);
});

test("fitScale picks the largest whole-number scale", () => {
  const dot = K.BUILTIN_CONSOLES[0].screen, dash = K.BUILTIN_CONSOLES[1].screen;
  assert.deepEqual(K.fitScale(dot, { width: 640, height: 480 }), { scale: 2, width: 640, height: 480 });
  assert.deepEqual(K.fitScale(dash, { width: 640, height: 480 }), { scale: 2, width: 640, height: 360 });
  assert.deepEqual(K.fitScale(dash, { width: 1920, height: 1080 }), { scale: 6, width: 1920, height: 1080 });
  assert.deepEqual(K.fitScale(dot, { width: 1920, height: 1080 }), { scale: 4, width: 1280, height: 960 });
  assert.equal(K.fitScale(dot, { width: 100, height: 100 }).scale, 1); // never below 1
});

test("clampRoomSize respects the console and the 16 px floor", () => {
  const c = K.BUILTIN_CONSOLES[0];
  assert.deepEqual(K.clampRoomSize(c, 320, 240), [320, 240]);
  assert.deepEqual(K.clampRoomSize(c, 5000, 5000), [1024, 1024]);
  assert.deepEqual(K.clampRoomSize(c, 1, 1), [16, 16]);
  assert.deepEqual(K.clampRoomSize(c, "abc", 100), [1024, 100]); // not a number: the maximum
  assert.equal(K.instanceLimit(c), 512);
});

test("duplicateConsole makes an independent copy for a custom console", () => {
  const src = K.BUILTIN_CONSOLES[0], copy = K.duplicateConsole(src, "tiny", "Tiny");
  assert.equal(copy.based_on, "dot");
  copy.screen.width = 240; copy.screen.height = 160;
  assert.equal(src.screen.width, 320); // the original is untouched
  assert.deepEqual(K.validateConsole(copy), []);
});

test("paletteOf describes what colours a console allows", () => {
  const dot = K.paletteOf(K.BUILTIN_CONSOLES[0]);
  assert.equal(dot.mode, "fixed");
  assert.equal(dot.colors.length, 32);
  assert.ok(dot.colors.every((c) => c === c.toLowerCase()));
  assert.deepEqual(K.paletteOf(K.LEGACY_CONSOLE), { mode: "free" });
  assert.deepEqual(K.paletteOf({ palette: { mode: "limited", size: 16 } }), { mode: "limited", size: 16 });
  assert.deepEqual(K.paletteOf(null), { mode: "free" });
});

test("graphics limits are validated", () => {
  const base = () => JSON.parse(JSON.stringify(K.BUILTIN_CONSOLES[0]));
  const problems = (mutate) => { const c = base(); mutate(c); return K.validateConsole(c); };
  assert.match(problems((c) => { c.graphics.sprite_size.multiple_of = 0; })[0], /sprite size/);
  assert.match(problems((c) => { c.graphics.tile_sizes = [8, "x"]; })[0], /tile sizes/);
  assert.match(problems((c) => { c.graphics.tileset_max.width = 5000; })[0], /tileset/);
  assert.deepEqual(problems((c) => { c.graphics.tile_sizes = null; }), []); // any tile size
});

test("console ids: slugs, uniqueness, and reserved names", () => {
  assert.equal(K.slugify("My Cool Console!"), "my-cool-console");
  assert.equal(K.slugify("  --Hi--  "), "hi");
  assert.equal(K.slugify("Éé"), "");
  assert.equal(K.slugify("x".repeat(80)).length, 40);
  assert.equal(K.uniqueId("Dot", []), "dot-2"); // reserved by a built-in
  assert.equal(K.uniqueId("Tiny", []), "tiny");
  assert.equal(K.uniqueId("Tiny", ["tiny", "tiny-2"]), "tiny-3");
  assert.equal(K.uniqueId("???", []), "console");
});

test("parseCustomConsoles keeps good consoles and reports the rest", () => {
  const good = JSON.stringify(K.duplicateConsole(K.BUILTIN_CONSOLES[0], "tiny", "Tiny"));
  const dupe = JSON.stringify(K.duplicateConsole(K.BUILTIN_CONSOLES[0], "dot", "Fake Dot"));
  const bad = JSON.stringify({ id: "broken", name: "Broken", screen: { width: 1, height: 1 } });
  const r = K.parseCustomConsoles([good, "not json", bad, dupe, good]);
  assert.deepEqual(r.consoles.map((c) => c.id), ["tiny"]);
  assert.equal(r.problems.length, 4); // bad json, invalid, reserved id, repeated id
  assert.deepEqual(K.allConsoles(r.consoles).map((c) => c.id), ["dot", "dash", "tiny"]);
  assert.equal(K.allConsoles().length, 2);
});

test("projects made when Dot and Dash were called Pocket and Wide still load, shown under the new names", () => {
  const old = K.consoleFor({ console: { id: "pocket", name: "Pocket", screen: { width: 320, height: 240 } } });
  assert.equal(old.id, "dot");
  assert.equal(old.name, "Dot");
  assert.equal(old.screen.width, 320);
  assert.equal(K.consoleFor({ console: { id: "wide", name: "Wide" } }).id, "dash");
  assert.equal(K.consoleFor({ console: { id: "wide", name: "My own name" } }).name, "My own name"); // a name the user chose stays
  assert.ok(K.RESERVED_IDS.includes("pocket") && K.RESERVED_IDS.includes("wide")); // no custom console may take the old ids
});

test("runtime limits and budgets of a console are checked", () => {
  const ok = K.duplicateConsole(K.BUILTIN_CONSOLES[0], "mine", "Mine");
  assert.deepEqual(K.validateConsole(ok), []);
  assert.equal(ok.limits.instances_alive, 512);
  assert.equal(ok.budgets.draw_screens, 6);
  ok.budgets.draw_screens = 2.5; // the drawing budget may have decimals
  assert.deepEqual(K.validateConsole(ok), []);
  ok.budgets.collision_tests = 0;
  assert.match(K.validateConsole(ok)[0], /budget collision_tests must be a positive number/);
  ok.budgets.collision_tests = 600; ok.limits.particles = 2.5;
  assert.match(K.validateConsole(ok)[0], /limit particles must be a positive whole number/);
});

test("each limit and budget has a line about what a typical GBA-style game uses", () => {
  for (const k of ["instances", "alive", "particles", "collisions", "drawing", "sprites"]) assert.match(K.TYPICAL[k], /GBA/, k);
});

test("a game carries the custom console it uses", () => {
  const tiny = { ...K.BUILTIN_CONSOLES[0], id: "tiny_gba", name: "Tiny", screen: { width: 240, height: 160, scale: "integer" } };
  assert.equal(K.consoleFileOf("dot"), null);
  assert.equal(K.consoleFileOf("tiny_gba"), "consoles/tiny_gba.json");
  assert.equal(K.resolveConsole("tiny_gba", [tiny], null).id, "tiny_gba", "one of yours by id");
  assert.equal(K.resolveConsole("tiny_gba", [], K.consoleFileText(tiny)).screen.width, 240, "the copy in the game when it is not one of yours");
  assert.equal(K.resolveConsole("other", [], K.consoleFileText(tiny)).id, "dot", "a copy with another id does not count");
  assert.equal(K.resolveConsole("tiny_gba", [], "not json").id, "dot");
});
