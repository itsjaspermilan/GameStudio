import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findInFiles, replaceInText, searchPattern, outline, reindent, wrapComments, tidyLua, applyEdits } from "../src/search-core.js";
import { parsePage, gameFiles } from "../src/help-core.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("find in the game's files", () => {
  const files = { "b.lua": "local speed = 10\nspeed = speed + 1", "a.lua": "-- Speed\nlocal x = 1" };
  const hits = findInFiles(files, "speed");
  assert.deepEqual(hits.map((h) => `${h.rel}:${h.line}:${h.col}`), ["a.lua:1:3", "b.lua:1:6", "b.lua:2:0", "b.lua:2:8"]);
  assert.equal(findInFiles(files, "speed", { caseSensitive: true }).length, 3);
  assert.equal(findInFiles(files, "spee", { wholeWord: true }).length, 0);
  assert.equal(findInFiles(files, "x\\s*=", { regex: true }).length, 1);
  assert.equal(searchPattern("(", { regex: true }), null, "a broken pattern finds nothing instead of throwing");
  assert.equal(findInFiles(files, "").length, 0);
});

test("replace in a file", () => {
  assert.deepEqual(replaceInText("hp = hp - 1", "hp", "health"), { text: "health = health - 1", count: 2 });
  assert.deepEqual(replaceInText("a.b a.c", "a\\.(\\w)", "x_$1", { regex: true }), { text: "x_b x_c", count: 2 });
  assert.deepEqual(replaceInText("x", "y", "z"), { text: "x", count: 0 });
  assert.deepEqual(replaceInText("local a\nlocal b", "^local", "var", { regex: true }), { text: "var a\nvar b", count: 2 }, "^ is the start of each line, as in Find");
  assert.deepEqual(replaceInText("ab", "(?<=a)b", "c", { regex: true }), { text: "ac", count: 1 });
});

test("outline of a Lua file", () => {
  const o = outline("local Grub = gs.entity{}\nfunction Grub:update(dt)\nend\nlocal function helper(a)\nend\nfunction M.make()\nend\nlocal f = function(x) end\n");
  assert.deepEqual(o.map((x) => `${x.line} ${x.kind} ${x.name}`), ["2 method Grub:update", "4 local helper", "6 function M.make", "8 local f"]);
});

test("the formatter puts indentation right", () => {
  const messy = [
    "function Grub:update(dt)",
    "if self.hp <= 0 then",
    "self:destroy()",
    "elseif self.hp < 3 then self.flash = true",
    "else",
    "self.flash = false",
    "end",
    "gs.go(function()",
    "local s = \"end then do\" -- function {",
    "gs.wait(1)",
    "end)",
    "local t = {",
    "1, 2,",
    "}",
    "local long = [[",
    "   keep  this   end",
    "]]",
    "end",
  ].join("\n");
  assert.equal(reindent(messy), [
    "function Grub:update(dt)",
    "  if self.hp <= 0 then",
    "    self:destroy()",
    "  elseif self.hp < 3 then self.flash = true",
    "  else",
    "    self.flash = false",
    "  end",
    "  gs.go(function()",
    "    local s = \"end then do\" -- function {",
    "    gs.wait(1)",
    "  end)",
    "  local t = {",
    "    1, 2,",
    "  }",
    "  local long = [[",
    "   keep  this   end",
    "]]",
    "end",
  ].join("\n"));
  assert.equal(reindent("local x = a +\nb\nlocal y = 1"), "local x = a +\n  b\nlocal y = 1", "a statement that goes on keeps one level");
  assert.equal(reindent("local a, b = ...\nprint(a)"), "local a, b = ...\nprint(a)", "... is not an unfinished expression");
});

test("every Lua file in the repository and every tutorial is already formatted", () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith(".lua")) files.push(p); } };
  for (const d of ["carts", "engine/gs", "tests/framework"]) walk(join(root, d));
  // the sample games and tutorials are what people open in the studio, so they pass the whole Tidy (comments included);
  // the engine's own files only have to be indented right
  for (const f of files) {
    const t = readFileSync(f, "utf8");
    assert.equal(f.includes("/carts/") ? tidyLua(t) : reindent(t), t, f);
  }
  for (const f of readdirSync(join(root, "docs/help"))) {
    const g = gameFiles(parsePage(readFileSync(join(root, "docs/help", f), "utf8"), f));
    for (const [rel, text] of Object.entries(g || {})) assert.equal(tidyLua(text), text, `${f} ${rel}`);
  }
});

test("language-server edits apply last first", () => {
  const r = (l1, c1, l2, c2) => ({ start: { line: l1, character: c1 }, end: { line: l2, character: c2 } });
  assert.equal(applyEdits("local hp = 3\nhp = hp - 1", [{ range: r(0, 6, 0, 8), newText: "health" }, { range: r(1, 0, 1, 2), newText: "health" }, { range: r(1, 5, 1, 7), newText: "health" }]),
    "local health = 3\nhealth = health - 1");
});

test("Tidy wraps long comments at the column and keeps the rest", () => {
  const long = "-- one two three four five six seven eight nine ten eleven twelve";
  assert.equal(wrapComments(long, 30), "-- one two three four five six\n-- seven eight nine ten eleven\n-- twelve");
  // what runs over goes in front of a next line that carries on the sentence, not one that starts a new one
  assert.equal(wrapComments("  -- alpha beta gamma delta\n  -- epsilon zeta", 23), "  -- alpha beta gamma\n  -- delta epsilon zeta");
  assert.equal(wrapComments("-- alpha beta gamma delta\n-- Next one", 20), "-- alpha beta gamma\n-- delta\n-- Next one");
  // left alone: code with a comment after it, annotations, indented comment text, long comments, long strings, words longer than the line
  const keep = [
    "local x = 1 -- " + "word ".repeat(30),
    "---@param a number " + "word ".repeat(30),
    "--   example = { " + "a = 1, ".repeat(20) + "}",
    "--[[ " + "word ".repeat(30) + "]]",
    "local s = [[",
    "-- " + "word ".repeat(30),
    "]]",
    "-- " + "x".repeat(140),
  ].join("\n");
  assert.equal(wrapComments(keep, 60), keep);
  const t = tidyLua("if a then\n-- " + "word ".repeat(40).trim() + "\nend");
  assert.ok(t.split("\n").every((l) => l.length <= 100), "wrapped lines keep their indent and fit");
  assert.equal(tidyLua(t), t, "a second Tidy changes nothing");
});
