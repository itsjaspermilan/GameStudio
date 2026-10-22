// The project's skills (.claude/skills/*/SKILL.md) must stay true: a name and a description Claude Code can match, and every MCP tool,
// repo file and generator style they name must exist, so an agent following one never reaches for something that is gone.
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

test("every skill names real tools, files and instruments", () => {
  const skills = readdirSync(skillsDir);
  assert.ok(skills.length >= 3, "the pixel-art, room-design and game-music skills");
  for (const s of skills) {
    const text = readFileSync(join(skillsDir, s, "SKILL.md"), "utf8");
    const head = /^---\nname: ([\w-]+)\ndescription: (.+)\n---\n/.exec(text);
    assert.ok(head, `${s}: front matter with name and description`);
    assert.equal(head[1], s, `${s}: the name matches the folder`);
    assert.ok(head[2].length > 80 && /Use when/.test(head[2]), `${s}: the description says when to use it`);
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
