// The craft guides (docs/help/93-art, 94-levels, 95-music) and the project's skills that point to them (.claude/skills/*/SKILL.md) must
// stay true: every MCP tool, repo file, Help page and instrument they name must exist, so nobody following them reaches for something gone.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const skillsDir = join(root, ".claude/skills");
const server = readFileSync(join(root, "tools/mcp/server.mjs"), "utf8");
const tools = new Set([...server.matchAll(/^tool\("(\w+)"/gm)].map((m) => m[1]));
const instruments = new Set(JSON.parse(readFileSync(join(root, "engine/instruments.json"), "utf8")).instruments.map((d) => d.name));
const ops = ["rect", "frame", "px", "line", "disc", "ellipse", "ring", "poly", "sphere", "dither", "outline", "mirror", "erase"];

const pageIds = new Set(readdirSync(join(root, "docs/help")).map((f) => f.replace(/^\d+-|\.html$/g, "")));

test("the craft guides name real tools, pages and instruments", () => {
  for (const f of ["93-art.html", "94-levels.html", "95-music.html"]) {
    const text = readFileSync(join(root, "docs/help", f), "utf8");
    assert.match(text, /<h2>With an agent<\/h2>/, `${f}: a section for agents`);
    for (const [, code] of text.matchAll(/<code>([^<]+)<\/code>/g)) {
      for (const w of code.match(/\b(?:[a-z]+_(?:view|write|check)|overview|inspect|instruments)\b/g) || []) assert.ok(tools.has(w), `${f}: tool ${w}`);
      for (const w of code.match(/\bgm_\w+/g) || []) assert.ok(instruments.has(w), `${f}: instrument ${w}`);
    }
  }
});

test("every skill points to guides and tools that exist", () => {
  const skills = readdirSync(skillsDir);
  assert.ok(skills.length >= 3, "the pixel-art, room-design and game-music skills");
  for (const s of skills) {
    const text = readFileSync(join(skillsDir, s, "SKILL.md"), "utf8");
    const head = /^---\nname: ([\w-]+)\ndescription: (.+)\n---\n/.exec(text);
    assert.ok(head, `${s}: front matter with name and description`);
    assert.equal(head[1], s, `${s}: the name matches the folder`);
    assert.ok(head[2].length > 80 && /Use when/.test(head[2]), `${s}: the description says when to use it`);
    const guides = [...text.matchAll(/help\('([\w-]+)'\)/g)].map((m) => m[1]);
    assert.ok(guides.length, `${s}: points to a Help guide`);
    for (const g of guides) assert.ok(pageIds.has(g), `${s}: Help page ${g}`);
    for (const [, code] of text.matchAll(/`([^`\n]+)`/g)) {
      // MCP tools: snake_case words that look like ours
      for (const w of code.match(/\b(?:[a-z]+_(?:view|write|check)|overview|inspect|instruments)\b/g) || []) assert.ok(tools.has(w), `${s}: tool ${w}`);
      // repo paths
      const path = /^((?:docs|scripts|studio|engine|tools|carts|tests)\/[\w./-]+\.\w+)$/.exec(code);
      if (path) assert.ok(existsSync(join(root, path[1])), `${s}: file ${path[1]}`);
      for (const w of code.match(/\bgm_\w+/g) || []) assert.ok(instruments.has(w), `${s}: instrument ${w}`);
    }
  }
  // the drawing ops the pixel-art skill and sprite_write describe are the ones sprite_write knows
  const tool = readFileSync(join(root, "tools/mcp/tools.mjs"), "utf8");
  for (const op of ops) assert.match(tool, new RegExp(`kind === "${op}"`), `sprite_write op ${op}`);
});
