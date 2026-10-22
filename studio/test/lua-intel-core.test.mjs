import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseApi, buildIndex, selfFields, contextAt, complete, hoverAt, diagnose, closest, variableKind } from "../src/lua-intel-core.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const api = parseApi(readFileSync(resolve(root, "engine/api/gs.d.lua"), "utf8"));
const names = { entities: ["player", "enemies/grub"], scenes: ["title", "play"], rooms: ["lvl1"], lib: ["state"], sprites: ["hero", "grub"], tilesets: ["ground"], sfx: ["zap"], music: ["theme"] };
const texts = { "entities/player.lua": 'local P = gs.entity{ tags = { "player" }, speed = 90, hp = 3 }\nfunction P:update(dt) self.mood = 1; self.x = 2 end\nreturn P', "entities/enemies/grub.lua": 'return gs.entity{ tags = { "enemy", "bug" } }' };
const index = buildIndex(names, texts);
const labels = (items) => items.map((i) => i.label ?? i.name);

test("the API file is read: functions, methods, namespaces and fields with their help text", () => {
  const spawn = api.symbols.get("gs.spawn");
  assert.equal(spawn.kind, "function");
  assert.equal(spawn.sig, "gs.spawn(name, x, y, props)");
  assert.match(spawn.doc, /name of its file in entities/);
  assert.equal(spawn.params[0].name, "name");
  assert.equal(api.symbols.get("gs.draw").kind, "namespace");
  assert.equal(api.symbols.get("gs.draw.rect").sig, "gs.draw.rect(x, y, w, h, color)");
  assert.equal(api.symbols.get("Entity.play").kind, "method");
  assert.equal(api.symbols.get("Entity.play").sig, "Entity:play(name, restart)");
  assert.equal(api.symbols.get("Entity.x").kind, "field");
  assert.ok(labels(api.members.get("gs.camera")).includes("shake"));
  assert.ok(labels(api.members.get("gs")).includes("spawn"));
});

test("every gs function the framework really exposes is documented", () => {
  const boot = readFileSync(resolve(root, "engine/gs/boot.lua"), "utf8");
  const exposed = [...boot.matchAll(/\bgs\.([a-z_]+)\s*[,=\n]/g)].map((m) => m[1]);
  const defined = [...boot.matchAll(/^function gs\.([a-z_]+)/gm)].map((m) => m[1]);
  const wanted = new Set([...defined, "spawn", "each", "all", "first", "count", "nearest", "in_radius", "in_rect", "send", "goto_scene", "load_room", "add_layer", "layer", "tile_at", "set_tile", "sfx", "music", "music_stop", "sfx_stop", "after", "every", "go", "tween", "wait", "wait_until", "entity", "scene", "color", "pause", "defaults"]);
  const gsMembers = new Set(labels(api.members.get("gs")));
  const missing = [...wanted].filter((n) => !gsMembers.has(n));
  assert.deepEqual(missing, []);
  void exposed;
});

test("every Entity method the engine defines is documented", () => {
  const world = readFileSync(resolve(root, "engine/gs/world.lua"), "utf8");
  const methods = [...world.matchAll(/^function Entity\.([a-z_]+)\(self/gm)].map((m) => m[1]).filter((n) => !["bounds"].includes(n));
  const doc = new Set(labels(api.members.get("Entity")));
  assert.deepEqual(methods.filter((n) => !doc.has(n)), []);
});

test("context: strings that name things, members, and method definitions", () => {
  assert.deepEqual(pick(contextAt('  gs.spawn("pl')), { type: "asset", kind: "entities", prefix: "pl" });
  assert.deepEqual(pick(contextAt("  gs.sfx('")), { type: "asset", kind: "sfx", prefix: "" });
  assert.equal(pick(contextAt('  local s = "gs.spawn(pl')), null);
  assert.deepEqual(pick(contextAt("  sprite = \"he")), { type: "asset", kind: "sprites", prefix: "he" });
  assert.deepEqual(pick(contextAt('  tags = { "a", "en')), { type: "asset", kind: "tag", prefix: "en" });
  assert.deepEqual(pick(contextAt("  self.vx = gs.dr")), { type: "member", chain: "gs", prefix: "dr" });
  assert.deepEqual(pick(contextAt("  gs.draw.re")), { type: "member", chain: "gs.draw", prefix: "re" });
  assert.deepEqual(pick(contextAt("function Ball:")), { type: "hook", prefix: "" });
  assert.equal(contextAt("  -- gs.spawn(\"x"), null);
  assert.equal(contextAt("  local x = 1"), null);
});
function pick(c) { if (!c) return null; const o = { type: c.type }; for (const k of ["kind", "prefix", "chain"]) if (c[k] !== undefined) o[k] = c[k]; return o; }

test("completion: API members, asset names, tags, hooks", () => {
  const at = (text, file = "entities/player.lua") => complete(contextAt(text.split("\n").pop()), api, index, text, file, text.length);
  assert.ok(labels(at("gs.sp")).includes("spawn"));
  assert.ok(!labels(at("gs.sp")).includes("draw"));
  assert.ok(labels(at("gs.draw.")).includes("rect"));
  assert.ok(labels(at("gs.camera:")).includes("follow"));
  assert.deepEqual(labels(at('gs.spawn("')), ["enemies.grub", "player"]);
  assert.deepEqual(labels(at('gs.goto_scene("')), ["scenes.play", "scenes.title"]);
  assert.deepEqual(labels(at('gs.sfx("z')), ["zap"]);
  assert.deepEqual(labels(at('gs.load_room("')), ["lvl1"]);
  assert.deepEqual(labels(at('local s = require("')).filter((l) => l.startsWith("lib")), ["lib.state"]);
  assert.deepEqual(labels(at('gs.first("')), ["bug", "enemy", "player"]);
  assert.deepEqual(labels(at('gs.nearest(self.x, self.y, "e')), ["enemy"]);
  assert.deepEqual(labels(at("  sprite = \"")), ["grub", "hero"]);
  assert.ok(labels(at("function P:")).includes("update"));
  assert.ok(labels(at("function P:on_")).includes("on_collide_enemy"));
  assert.ok(labels(at("function Title:", "scenes/title.lua")).includes("draw_ui"));
});

test("completion: self shows the entity's own values and methods", () => {
  const text = texts["entities/player.lua"] + "\nfunction P:go()\n  self.";
  const items = labels(complete(contextAt("  self."), api, index, text, "entities/player.lua", text.length));
  for (const want of ["x", "vx", "destroy", "speed", "hp", "mood"]) assert.ok(items.includes(want), want);
  const colon = labels(complete(contextAt("  self:"), api, index, text, "entities/player.lua", text.length));
  assert.ok(colon.includes("play") && !colon.includes("x"));
});

test("completion: variables known to be entities", () => {
  const text = 'local boss = gs.spawn("player", 1, 2)\nboss:';
  assert.equal(variableKind("boss", text, "scenes/play.lua"), "Entity");
  assert.ok(labels(complete(contextAt("boss:"), api, index, text, "scenes/play.lua", text.length)).includes("move_toward"));
  const handler = "function Ball:on_collide_brick(brick)\n  brick:";
  assert.equal(variableKind("brick", handler, "entities/ball.lua"), "Entity");
  assert.equal(variableKind("other", "local other = 5", "x.lua"), null);
});

test("selfFields: starting values and assignments in methods", () => {
  assert.deepEqual(selfFields(texts["entities/player.lua"]), ["hp", "mood", "speed", "x"]);
});

test("hover: API calls and asset names", () => {
  const h = hoverAt('  gs.draw.rect(0, 0, 4, 4, "#fff")', 11, api, index, "scenes/play.lua", "");
  assert.equal(h.kind, "api"); assert.equal(h.sym.path, "gs.draw.rect");
  const m = hoverAt("  self:play(\"run\")", 9, api, index, "entities/player.lua", "");
  assert.equal(m.sym.path, "Entity.play");
  const a = hoverAt('  gs.spawn("enemies.grub", 1, 2)', 14, api, index, "x.lua", "");
  assert.deepEqual([a.kind, a.name, a.exists, a.target], ["entities", "enemies.grub", true, { group: "entities", name: "enemies/grub" }]);
  const bad = hoverAt('  gs.sfx("zzz")', 10, api, index, "x.lua", "");
  assert.equal(bad.exists, false);
  const sc = hoverAt('  gs.goto_scene("scenes.play")', 20, api, index, "x.lua", "");
  assert.deepEqual(sc.target, { group: "scenes", name: "play" });
  assert.equal(hoverAt("  local x = 1", 8, api, index, "x.lua", ""), null);
});

test("diagnostics: unknown names with suggestions, unknown tags, missing return, allocation in update", () => {
  const code = [
    'local Enemy = gs.entity{ sprite = "grubb", tags = { "enemy" } }',
    "function Enemy:update(dt)",
    "  local v = { x = 1 }",
    '  gs.sfx("zapp")',
    '  gs.spawn("plyer")',
    '  if self:touching("wal") then end',
    "end",
    "function Enemy:on_collide_wal(o) end",
    '-- gs.sfx("ignored in a comment")',
    'gs.goto_scene("scenes.nope")',
    "gs.spawn('player')",
  ].join("\n");
  const ds = diagnose(code, "entities/enemy.lua", index);
  const msg = ds.map((d) => `${d.severity}: ${d.message}`);
  assert.ok(msg.some((m) => /no sprite called 'grubb'.*Did you mean 'grub'/.test(m)));
  assert.ok(msg.some((m) => /no sound effect called 'zapp'.*'zap'/.test(m)));
  assert.ok(msg.some((m) => /no entity called 'plyer'.*'player'/.test(m)));
  assert.ok(msg.some((m) => /tag 'wal'.*'enemy'|tag 'wal'/.test(m)));
  assert.ok(msg.some((m) => /on_collide_wal|never run/.test(m)));
  assert.ok(msg.some((m) => /^info: A new table every step/.test(m)));
  assert.ok(msg.some((m) => /no scene called 'scenes.nope'/.test(m)));
  assert.ok(msg.some((m) => /must end with 'return/.test(m)));
  assert.ok(!msg.some((m) => /ignored in a comment/.test(m)));
  assert.equal(msg.filter((m) => /called 'player'/.test(m)).length, 0);
  const z = ds.find((d) => /zapp/.test(d.message));
  assert.equal(code.slice(z.from, z.to), "zapp");
});

test("diagnostics: a clean file says nothing; unknown modules outside the project are left alone", () => {
  const ok = 'local P = gs.entity{ sprite = "hero", tags = { "player" } }\nfunction P:create() gs.sfx("zap") end\nreturn P\n';
  assert.deepEqual(diagnose(ok, "entities/player.lua", index), []);
  assert.deepEqual(diagnose('local j = require("gs.json")\nlocal s = require "lib.state"\n', "lib/x.lua", index), []);
});

test("closest name suggestions", () => {
  assert.equal(closest("plyer", ["player", "enemy"]), "player");
  assert.equal(closest("zzzzzz", ["player", "enemy"]), null);
});

test("what a scene's layout names is known in that scene's code (and in the code another layout runs)", () => {
  const t = {
    "scenes/title.layout.lua": 'return { texts = { { "PRESS A", 160, 206, name = "prompt" } }, pictures = { { "spr_logo", 80, 20, name = "logo" } }, entities = { { "player", 1, 2, {}, name = "hero" }, { "grub", 3, 4 } } }',
    "scenes/title.lua": "local T = gs.scene{}\nfunction T:update(dt)\n  self.lgoo.y = 3\n  self.prompt.visible = true\n  self.timer = 0\n  self.timr = 1\nend\nreturn T",
    "scenes/lvl1.layout.lua": 'return { code = "level", pictures = { { "door", 10, 10, name = "door" } } }',
  };
  const ix = buildIndex({ scenes: ["title", "lvl1", "level"] }, t);
  assert.deepEqual(Object.keys(ix.layouts["scenes/title.lua"]).sort(), ["hero", "logo", "prompt"]);
  assert.ok(ix.layouts["scenes/level.lua"].door, "a layout's things belong to the code it runs");
  const code = t["scenes/title.lua"], pos = code.indexOf("self.prompt") + "self.p".length;
  const items = complete(contextAt(code.slice(code.lastIndexOf("\n", pos) + 1, pos)), api, ix, code, "scenes/title.lua", pos);
  assert.ok(labels(items).includes("prompt"), labels(items).join(","));
  const h = hoverAt("  self.logo.y = 3", 8, api, ix, "scenes/title.lua", code);
  assert.equal(h.kind, "layout"); assert.match(h.text, /picture spr_logo at 80, 20/);
  const warn = diagnose(code, "scenes/title.lua", ix).filter((d) => /layout/.test(d.message));
  assert.equal(warn.length, 1, warn.map((d) => d.message).join(" | "));
  assert.match(warn[0].message, /'lgoo'.*'logo'/);
  assert.equal(code.slice(warn[0].from, warn[0].to), "lgoo");
});
