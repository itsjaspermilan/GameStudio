import test from "node:test";
import assert from "node:assert/strict";
import { StringStream } from "@codemirror/language";
import { luaTokens } from "../src/lua-highlight.js";

// [token, text] for each word and sign of some lines, as the editor colours them
function tokens(src) {
  const s = luaTokens.startState(), out = [];
  for (const line of src.split("\n")) {
    const stream = new StringStream(line, 2, 2);
    while (!stream.eol()) {
      const kind = luaTokens.token(stream, s);
      const text = stream.current();
      if (kind && text.trim()) out.push([kind, text]);
      stream.start = stream.pos;
    }
  }
  return out;
}
const kindOf = (src, word) => (tokens(src).find(([, x]) => x === word) || [])[0];

test("the editor tells the parts of Lua apart", () => {
  const src = 'local Player = gs.entity{ sprite = "hero", hp = 3 }\nfunction Player:update(dt)\n  if self.hp <= 0 then self:destroy() end\n  local d = math.max(1, gs.dist(0, 0, 3, 4))\nend';
  assert.equal(kindOf(src, "local"), "declare");
  assert.equal(kindOf(src, "Player"), "class");
  assert.equal(kindOf(src, "gs"), "gs");
  assert.equal(kindOf(src, "entity"), "method", "gs.entity{...} is a call");
  assert.equal(kindOf(src, "sprite"), "variable");
  assert.equal(kindOf(src, '"hero"'), "string");
  assert.equal(kindOf(src, "3"), "number");
  assert.equal(kindOf(src, "update"), "define", "the name of the function being made");
  assert.equal(kindOf(src, "self"), "self");
  assert.equal(kindOf(src, "hp"), "variable");
  assert.equal(tokens(src).filter(([k, x]) => x === "hp")[1][0], "field", "self.hp");
  assert.equal(kindOf(src, "destroy"), "method");
  assert.equal(kindOf(src, "if"), "control");
  assert.equal(kindOf(src, "math"), "standard");
  assert.equal(kindOf(src, "dist"), "method");
});

test("comments, annotations and long strings", () => {
  assert.deepEqual(tokens("x = 1 -- a note"), [["variable", "x"], ["operator", "="], ["number", "1"], ["comment", "-- a note"]]);
  assert.equal(tokens("---@param n number")[0][0], "doc");
  const t = tokens("--[[ one\ntwo ]] y = [[a\nb]]");
  assert.deepEqual(t.map(([k]) => k), ["comment", "comment", "variable", "operator", "string", "string"]);
  assert.equal(kindOf("a = true or nil", "true"), "atom");
  assert.equal(kindOf("a = true or nil", "or"), "word");
  assert.equal(kindOf('s = "a" .. b', ".."), "operator");
});
