import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GROUPS, group, validName, resourceFiles, moduleName, refName, scanProject, consoleIdOf, setConsoleInGame, TEMPLATES, newGameFiles, renameProblem } from "../src/project-core.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("names: letters, digits, - and _; folders only where allowed", () => {
  assert.ok(validName("grub")); assert.ok(validName("a-b_9"));
  assert.ok(!validName("")); assert.ok(!validName("a b")); assert.ok(!validName(".hidden")); assert.ok(!validName("../x", true));
  assert.ok(!validName("enemies/grub")); assert.ok(validName("enemies/grub", true));
  assert.ok(!validName("a/b/c/d/e", true));
});

test("files and Lua names of a resource", () => {
  assert.deepEqual(resourceFiles(group("sprites"), "hero"), ["sprites/hero.json", "sprites/hero.png"]);
  assert.deepEqual(resourceFiles(group("entities"), "enemies/grub"), ["entities/enemies/grub.lua"]);
  assert.equal(moduleName(group("entities"), "enemies/grub"), "entities.enemies.grub");
  assert.equal(refName(group("entities"), "enemies/grub"), "enemies.grub");
  assert.equal(refName(group("scenes"), "title"), "scenes.title");
  assert.equal(refName(group("lib"), "state"), "lib.state");
});

test("the tree is found by scanning the file list", () => {
  const files = ["game.lua", "entities/player.lua", "entities/enemies/grub.lua", "scenes/title.lua", "sprites/hero.json", "sprites/hero.png", "sprites/lonely.png",
    "sfx/zap.json", "sounds/clap.wav", "meta/info.json", "meta/box_art.png", "README.md", "main.lua", "entities/bad name.lua"];
  const p = scanProject(files);
  assert.ok(p.hasGame);
  assert.deepEqual(p.groups.entities, ["enemies/grub", "player"]);
  assert.deepEqual(p.groups.sprites, ["hero"]);
  assert.deepEqual(p.groups.sounds, ["clap"]);
  assert.deepEqual(p.other, ["README.md", "entities/bad name.lua", "main.lua", "sprites/lonely.png"]);
  assert.ok(!scanProject(["main.lua"]).hasGame);
});

test("console in game.lua and info.json", () => {
  assert.equal(consoleIdOf({ console: "dash" }), "dash");
  assert.equal(consoleIdOf({}), "dot"); assert.equal(consoleIdOf(null), "dot"); assert.equal(consoleIdOf({ console: "x y" }), "dot");
  assert.equal(consoleIdOf({ console: "my_gba" }), "my_gba", "custom console ids may use _ like the console editor allows");
  assert.equal(setConsoleInGame('return gs.game{ title = "A", console = "dot", start = "s" }', "dash"), 'return gs.game{ title = "A", console = "dash", start = "s" }');
  assert.equal(setConsoleInGame("return gs.game{ console = my_console }", "dash"), null);
});

test("rename problems", () => {
  const g = group("sprites");
  assert.match(renameProblem(["a", "b"], g, "a", "b"), /already a sprite called 'b'/);
  assert.match(renameProblem(["a"], g, "a", "x y"), /letters/);
  assert.match(renameProblem(["a"], g, "a", "a"), /already its name/);
  assert.equal(renameProblem(["a"], g, "a", "c"), null);
  assert.equal(renameProblem(["a"], group("entities"), "a", "e/c"), null);
});

test("every group has what the tree needs", () => {
  const keys = new Set();
  for (const g of GROUPS) { assert.ok(g.title && g.dir && g.ext && g.kind && g.single, g.key); assert.ok(!keys.has(g.key)); keys.add(g.key); }
});

// The starter game and every template really run in the runtime (they are what a beginner sees first).
const gs = join(root, "build/gs");
test("a new game runs without errors, and templates are valid Lua", { skip: !existsSync(gs) }, () => {
  const dir = mkdtempSync(join(tmpdir(), "gs-new-"));
  const files = { ...newGameFiles("My Game", "dot"),
    "entities/enemy.lua": TEMPLATES.entities("enemy"), "entities/big/boss_one.lua": TEMPLATES.entities("big/boss_one"),
    "scenes/second.lua": TEMPLATES.scenes("second"), "lib/util.lua": TEMPLATES.lib("util"), "rooms/lvl1.lua": TEMPLATES.rooms("lvl1", { width: 320, height: 240 }) };
  for (const [rel, text] of Object.entries(files)) { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), text); }
  // load every template file as a module from the starter scene so a syntax error or a missing hook shows up
  writeFileSync(join(dir, "scenes/main.lua"), `local Main = gs.scene{}
function Main:enter()
  gs.spawn("player", 160, 120); gs.spawn("enemy", 10, 10); gs.spawn("big.boss_one", 20, 20)
  require "lib.util"; require "scenes.second"; gs.load_room("lvl1")
  print("NEW GAME OK")
  gs.raw.quit()
end
return Main
`);
  const r = spawnSync(gs, [dir], { encoding: "utf8", env: { ...process.env, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_SAVE_DIR: dir, GS_MAX_FRAMES: "60" } });
  assert.match(r.stdout + r.stderr, /NEW GAME OK/, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /error/i);
});
