import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { bundleMcp } from "../bundle.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));

test("the bundled stdio command works after relocation without system Node or the checkout", {
  skip: process.platform !== "darwin" || !existsSync(join(root, "build/gs")), timeout: 120000,
}, async () => {
  const temp = mkdtempSync(join(tmpdir(), "gs-mcp-bundle-"));
  const staged = join(temp, "staged"), ws = join(temp, "Relocated GameStudio.app/Contents/Resources/gamestudio");
  const game = join(temp, "My Game"), cwd = join(temp, "client");
  const client = new Client({ name: "bundle-test", version: "1" });
  const dirs = [];
  try {
    for (const file of ["build/gs", "engine/api", "engine/consoles", "assets/soundfonts", "carts/breakout"]) {
      mkdirSync(dirname(join(staged, file)), { recursive: true });
      cpSync(join(root, file), join(staged, file), { recursive: true });
    }
    bundleMcp(staged);
    mkdirSync(dirname(ws), { recursive: true });
    renameSync(staged, ws);
    cpSync(join(ws, "carts/breakout"), game, { recursive: true });
    mkdirSync(cwd);
    const readOnly = (dir) => {
      for (const f of readdirSync(dir)) if (statSync(join(dir, f)).isDirectory()) readOnly(join(dir, f));
      dirs.push(dir);
      chmodSync(dir, 0o555);
    };
    readOnly(ws);
    await client.connect(new StdioClientTransport({
      command: join(ws, "tools/mcp/gamestudio-mcp"), cwd,
      env: { ...process.env, PATH: "/usr/bin:/bin", GS_WORKSPACE: join(temp, "not-a-checkout"), GS_SOUNDFONT: "/missing.sf3", GS_STUDIO_CONFIG: cwd, DEVICE_ENV: join(temp, "missing-device.env") },
    }));
    assert.equal((await client.listTools()).tools.length, 17);
    assert.equal((await client.listPrompts()).prompts.length, 3);
    const call = async (name, args) => {
      const r = await client.callTool({ name, arguments: args });
      assert.ok(!r.isError, `${name}: ${JSON.stringify(r.content)}`);
      return r;
    };
    assert.match((await call("api", { query: "spawn" })).content[0].text, /gs\.spawn/);
    assert.match((await call("help", { topic: "art" })).content[0].text, /sprite/i);
    assert.match((await call("games", {})).content[0].text, /breakout/);
    assert.match((await call("overview", { game })).content[0].text, /entities \(\d+\)/);
    for (const play of [{ keys: "right*10" }, { bot: true }]) {
      const run = await call("run", { game, seconds: 0.5, ...play });
      assert.equal(run.content[1].type, "image");
    }
    assert.match((await call("check", { game, seconds: 0.5 })).content[0].text, /ran 0.5 s with no errors or warnings/);
    assert.match((await call("song_check", { game, name: "title" })).content[0].text, /loudness/);
    assert.equal((await call("room_view", { game, name: "title" })).content[1].type, "image");
    assert.equal((await call("sprite_write", {
      game, name: "bundle_test", w: 8, h: 8, frames: [{ ops: [["disc", 4, 4, 3, 1]] }],
    })).content[1].type, "image");
    const push = await client.callTool({ name: "push", arguments: { game } });
    assert.ok(push.isError);
    assert.match(push.content[0].text, /DEVICE_ENV/);
  } finally {
    await client.close();
    for (const dir of dirs) chmodSync(dir, 0o755);
    rmSync(temp, { recursive: true, force: true });
  }
});
