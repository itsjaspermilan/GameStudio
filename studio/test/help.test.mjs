// The help pages: every page has what the viewer needs, and every tutorial game really runs. A page's <pre class="lua" data-path="..."> blocks
// are the files of a small game; they are written to a temp folder and played by a random bot through the real runtime.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePage, gameFiles, decodeEntities } from "../src/help-core.js";
import { parseApi, buildIndex, diagnose } from "../src/lua-intel-core.js";
import { scanProject } from "../src/project-core.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dir = join(root, "docs/help");
const pages = readdirSync(dir).filter((f) => f.endsWith(".html")).sort().map((f) => ({ file: f, ...parsePage(readFileSync(join(dir, f), "utf8"), f.replace(/^\d+-|\.html$/g, "")) }));

test("every page has a title, group, order and unique id", () => {
  const ids = new Set();
  for (const p of pages) {
    assert.ok(p.title && p.group && Number.isFinite(p.order), p.file);
    assert.ok(!ids.has(p.id), "duplicate id " + p.id); ids.add(p.id);
    assert.ok(p.body.includes("<h1"), p.file + " needs a heading");
  }
  assert.ok(pages.length >= 10);
});

test("links between pages point at pages that exist", () => {
  const ids = new Set(pages.map((p) => p.id)); ids.add("api");
  for (const p of pages) for (const m of p.body.matchAll(/href="help:([\w-]+)"/g)) assert.ok(ids.has(m[1]), `${p.file} links to missing page ${m[1]}`);
  // "Open ..." links name a finished example in carts/
  for (const p of pages) for (const m of p.body.matchAll(/href="open:([\w-]+)"/g)) assert.ok(existsSync(join(root, "carts", m[1], "game.lua")), `${p.file} opens a missing example ${m[1]}`);
});

test("entities are decoded in code blocks", () => {
  assert.equal(decodeEntities("a &lt;= b &amp;&amp; c &gt; &quot;d&quot;"), 'a <= b && c > "d"');
});

const gs = join(root, "build/gs");
for (const p of pages) {
  const files = gameFiles(p);
  if (!files) continue;
  test(`tutorial "${p.title}": the game runs, and its code has no warnings`, { skip: !existsSync(gs) }, () => {
    const out = mkdtempSync(join(tmpdir(), "gs-help-"));
    for (const [rel, text] of Object.entries(files)) { mkdirSync(dirname(join(out, rel)), { recursive: true }); writeFileSync(join(out, rel), text); }
    for (const seed of [1]) {
      const r = spawnSync(gs, [out], { encoding: "utf8", timeout: 60000, env: { ...process.env, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_SAVE_DIR: out, GS_FF: "20", GS_MAX_FRAMES: "240", GS_BOT_LUA: join(root, "tests/random-bot.lua"), GS_SEED: String(seed) } });
      const text = r.stdout + r.stderr;
      assert.doesNotMatch(text, /error|warning:/i, text);
      assert.equal(r.status, 0, text);
    }
    // the editor's own checks find nothing wrong in the tutorial's code
    const scan = scanProject(Object.keys(files));
    const texts = Object.fromEntries(Object.entries(files).filter(([f]) => f.endsWith(".lua")));
    const index = buildIndex(scan.groups, texts);
    for (const [rel, text] of Object.entries(texts)) {
      const bad = diagnose(text, rel, index).filter((d) => d.severity !== "info");
      assert.deepEqual(bad, [], `${rel}: ${JSON.stringify(bad)}`);
    }
  });
}
void parseApi;

import { highlightLua, apiPageHtml, escapeHtml, contents, search } from "../src/help-core.js";

test("highlighting keeps the text and escapes it", () => {
  const code = 'local x = "a<b" -- note\nif x then return gs.spawn(1.5) end';
  const html = highlightLua(code);
  assert.equal(html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"'), code);
  assert.match(html, /<span class="tk-k">local<\/span>/);
  assert.match(html, /<span class="tk-s">&quot;a&lt;b&quot;<\/span>/);
  assert.match(html, /<span class="tk-c">-- note<\/span>/);
  assert.match(html, /<span class="tk-g">gs<\/span>/);
  assert.match(html, /<span class="tk-n">1\.5<\/span>/);
  assert.equal(escapeHtml('<a href="x">&</a>'), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
});

test("the API page documents every function with its signature", () => {
  const api = parseApi(readFileSync(join(root, "engine/api/gs.d.lua"), "utf8"));
  const html = apiPageHtml(api);
  for (const want of ["gs.spawn(name, x, y, props)", "gs.draw.rect(x, y, w, h, color)", "Entity:play(name, restart)", "gs.camera:follow(target, opts)", "gs.input.pressed(name)"]) assert.ok(html.includes(escapeHtml(want)), want);
  assert.ok(!html.includes("<script"));
});

test("contents are grouped in order and search finds words in titles and text", () => {
  const groups = contents(pages);
  assert.equal(groups[0].group, "Start here");
  assert.deepEqual(groups.map((g) => g.group), ["Start here", "Tutorials", "Guides"]);
  assert.equal(search(pages, "star catcher")[0].id, "first-game");
  assert.ok(search(pages, "coroutine").some((p) => p.id === "timers"));
  assert.deepEqual(search(pages, "zzzqqq"), []);
  assert.deepEqual(search(pages, ""), []);
});
