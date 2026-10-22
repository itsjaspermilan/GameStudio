// The Lua language server end to end: the real LuaLS binary (installed by scripts/fetch-luals.sh; the test is skipped without it)
// driven through lua-server.js, with the Rust side's framing re-done here.
import test from "node:test";
import { applyEdits } from "../src/search-core.js";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLuaServer } from "../src/lua-server.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const bin = join(root, "third_party/luals/bin/lua-language-server");
const skip = !existsSync(bin);

function harness(gameDir) {
  const work = mkdtempSync(join(tmpdir(), "gs-luals-"));
  const config = join(work, "luarc.json");
  writeFileSync(config, JSON.stringify({
    runtime: { version: "Lua 5.4", path: ["?.lua", "?/init.lua"] }, workspace: { library: [join(root, "engine/api")], checkThirdParty: false },
    diagnostics: { disable: ["undefined-field", "inject-field", "duplicate-set-field", "lowercase-global", "need-check-nil"], severity: { "unused-local": "Hint" } },
    hint: { enable: false }, telemetry: { enable: false },
  }));
  let child, listener, buf = Buffer.alloc(0);
  const invoke = async (cmd, args) => {
    if (cmd === "lsp_start") {
      child = spawn(bin, [`--configpath=${config}`, `--logpath=${work}/log`, `--metapath=${work}/meta`], { stdio: ["pipe", "pipe", "ignore"] });
      child.stdout.on("data", (d) => {
        buf = Buffer.concat([buf, d]);
        for (;;) {
          const i = buf.indexOf("\r\n\r\n"); if (i < 0) return;
          const len = +/Content-Length: (\d+)/i.exec(buf.subarray(0, i).toString())[1];
          if (buf.length < i + 4 + len) return;
          const body = buf.subarray(i + 4, i + 4 + len).toString(); buf = buf.subarray(i + 4 + len);
          if (listener) listener({ payload: body });
        }
      });
      return { root: gameDir };
    }
    if (cmd === "lsp_send") { child.stdin.write(`Content-Length: ${Buffer.byteLength(args.message)}\r\n\r\n${args.message}`); return; }
    if (cmd === "lsp_stop") { if (child) child.kill(); return; }
    throw new Error("unexpected " + cmd);
  };
  const listen = (name, fn) => { listener = fn; };
  return { invoke, listen, kill: () => child && child.kill() };
}

test("completion, hover, diagnostics and go to definition from the real server", { skip, timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "gs-game-"));
  mkdirSync(join(dir, "lib")); mkdirSync(join(dir, "entities"));
  writeFileSync(join(dir, "lib/state.lua"), "local M = { score = 0 }\nfunction M.reset() M.score = 0 end\nreturn M\n");
  const text = 'local state = require "lib.state"\nlocal P = gs.entity{ tags = { "p" } }\nfunction P:update(dt)\n  state.re\n  gs.dr\n  local n = nope + 1\n  self:mo\n  state.reset()\nend\nreturn P\n';
  writeFileSync(join(dir, "entities/p.lua"), text);
  const h = harness(dir);
  const seen = [];
  const server = createLuaServer({ invoke: h.invoke, listen: h.listen, note: (m) => seen.push(m), onDiagnostics: (rel) => seen.push("diag:" + rel) });
  try {
    assert.equal(await server.start("g"), true, JSON.stringify(seen));
    server.files(["lib/state.lua", "entities/p.lua"]);
    server.open("entities/p.lua", text);
    // the server is busy reading the project at first; its first diagnostics for the file say it is ready
    for (let i = 0; i < 200 && !seen.includes("diag:entities/p.lua"); i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(seen.includes("diag:entities/p.lua"), "no diagnostics arrived");
    const at = (needle, after = needle.length) => text.indexOf(needle) + after;
    const c1 = await server.completion("entities/p.lua", text, at("gs.dr"), true);
    assert.ok(c1.some((i) => i.label === "draw"), JSON.stringify(c1.slice(0, 5)));
    const c2 = await server.completion("entities/p.lua", text, at("state.re"), true);
    assert.ok(c2.some((i) => i.label === "reset"), "a function of the required module: " + JSON.stringify(c2.slice(0, 8)) + JSON.stringify(seen));
    const c3 = await server.completion("entities/p.lua", text, at("self:mo"), true);
    assert.ok(c3.some((i) => i.label === "move_toward"), "an Entity method from our API file");
    const hov = await server.hover("entities/p.lua", text, at("gs.entity", 5));
    assert.match(hov, /entity/i);
    const def = await server.definition("entities/p.lua", text, at('require "lib.state"', 14));
    assert.ok(def.length && def[0].rel === "lib/state.lua", JSON.stringify(def));
    const def2 = await server.definition("entities/p.lua", text, at("state.reset()", 9));
    assert.deepEqual([def2[0].rel, def2[0].line], ["lib/state.lua", 1]);
    await new Promise((r) => setTimeout(r, 2500));
    const diags = server.diagnostics("entities/p.lua", text);
    assert.ok(diags.some((d) => /nope/.test(d.message) && d.severity === "warning"), JSON.stringify(diags));
    assert.ok(!diags.some((d) => /Unused local/.test(d.message)), "unused locals are hints and hidden");
    // every use of a module function, across files, and renaming it everywhere
    const refs = await server.references("entities/p.lua", text, at("state.reset()", 9));
    assert.deepEqual([...new Set(refs.map((r) => r.rel))].sort(), ["entities/p.lua", "lib/state.lua"], JSON.stringify(refs));
    const edits = await server.rename("entities/p.lua", text, at("state.reset()", 9), "restart");
    assert.ok(edits && edits["lib/state.lua"] && edits["entities/p.lua"], JSON.stringify(edits));
    assert.match(applyEdits(text, edits["entities/p.lua"]), /state\.restart\(\)/);
  } finally { await server.stop(); h.kill(); }
});

test("a server that cannot start leaves the editor working", async () => {
  const notes = [];
  const server = createLuaServer({ invoke: async () => { throw "the Lua language server is not installed (run scripts/fetch-luals.sh)"; }, listen: () => {}, note: (m) => notes.push(m), onDiagnostics: () => {} });
  assert.equal(await server.start("g"), false);
  assert.match(notes[0], /fetch-luals/);
  assert.equal(server.ready, false);
  assert.deepEqual(await server.completion("a.lua", "", 0, true), []);
  assert.equal(await server.hover("a.lua", "", 0), "");
  server.open("a.lua", ""); server.change("a.lua", ""); server.close("a.lua"); // all harmless
});
