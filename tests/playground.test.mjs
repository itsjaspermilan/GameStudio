import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import dgram from "node:dgram";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { buildIndex, diagnose } from "../studio/src/lua-intel-core.js";
import { scanProject } from "../studio/src/project-core.js";
import { reindent } from "../studio/src/search-core.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const cart = join(root, "carts/netplay-playground");
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GS_") && !key.startsWith("RETRO_")));

async function freePort() {
  const socket = dgram.createSocket("udp4");
  try {
    await new Promise(resolve => socket.bind(0, "127.0.0.1", resolve));
    return socket.address().port;
  } finally { socket.close(); }
}

test("the built-in playground has complete metadata, formatted Lua and no editor warnings", () => {
  const files = readdirSync(cart, { recursive: true }).filter(file => !file.includes(".gamestudio"));
  const texts = Object.fromEntries(files.filter(file => file.endsWith(".lua")).map(file => [file, readFileSync(join(cart, file), "utf8")]));
  const index = buildIndex(scanProject(files).groups, texts);
  for (const [file, text] of Object.entries(texts)) {
    assert.equal(reindent(text), text, `${file} needs formatting`);
    assert.deepEqual(diagnose(text, file, index).filter(d => d.severity !== "info"), [], file);
  }
  const info = JSON.parse(readFileSync(join(cart, "meta/info.json")));
  assert.equal(info.players, 4);
  assert.equal(info.console, "glow43");
  const bundle = readFileSync(join(root, "scripts/build-app.sh"), "utf8");
  assert.match(bundle, /for c in [^\n]*netplay-playground/);
  assert.match(bundle, /git ls-files --cached --others --exclude-standard/);
});

test("board lines, occupied cells, draws and simultaneous star pickups follow the rules", () => {
  const saves = mkdtempSync(join(tmpdir(), "gs-playground-rules-"));
  try {
    const result = spawnSync(join(root, "build/gs"), [cart], {
      cwd: root, encoding: "utf8", timeout: 10000,
      env: {
        ...cleanEnv, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_SAVE_DIR: saves,
        GS_START_SCENE: "board", GS_BOT_LUA: join(root, "tests/playground-rules.lua"), GS_MAX_FRAMES: "30",
      },
    });
    assert.ifError(result.error);
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
    assert.doesNotMatch(output, /error|warning:/i);
    assert.match(output, /PLAYGROUND RULES PASS/);
  } finally { rmSync(saves, { recursive: true, force: true }); }
});

async function play(count, mode, practice = false) {
  const temp = mkdtempSync(join(tmpdir(), "gs-playground-"));
  const children = [];
  try {
    const port = await freePort();
    for (let i = 0; i < (practice ? 1 : count); i++) {
      const child = spawn(join(root, "build/gs"), [cart], {
        cwd: root, timeout: 45000,
        env: {
          ...cleanEnv, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy",
          GS_SAVE_DIR: mkdtempSync(join(temp, `p${i}-`)), GS_RAM: "1",
          GS_NET_PORT: String(port), GS_NET_DISCOVERY: "127.0.0.1",
          GS_PLAYGROUND_ROLE: practice ? "practice" : i === 0 ? "host" : `guest${i}`,
          GS_PLAYGROUND_PLAYERS: String(count), GS_PLAYGROUND_MODE: String(mode),
          GS_BOT_LUA: join(root, "tests/playground-bot.lua"),
          GS_CHECKSUM: "1", GS_MAX_FRAMES: "3000",
          ...(practice ? { GS_FF: "20" } : {}),
        },
      });
      let output = "";
      child.stdout.on("data", data => { output += data; });
      child.stderr.on("data", data => { output += data; });
      const done = new Promise((resolve, reject) => {
        child.on("error", reject);
        child.on("exit", (code, signal) => resolve({ code, signal, output }));
      });
      children.push({ child, done });
      if (i === 0) await sleep(100);
    }
    const results = await Promise.all(children.map(child => child.done));
    const checksums = [];
    for (const { code, output } of results) {
      assert.equal(code, 0, output);
      assert.doesNotMatch(output, /error|warning:|out of step|timed out/i);
      assert.match(output, /PLAYGROUND WON board 1/);
      assert.match(output, /PLAYGROUND WON sprint \d/);
      assert.match(output, /PLAYGROUND REMATCH PASS/);
      assert.match(output, /PLAYGROUND TEST PASS/);
      const gameplay = output.slice(output.indexOf("PLAYGROUND ENTER")).split("PLAYGROUND REMATCH PASS")[0];
      checksums.push([...gameplay.matchAll(/^@@gscheck (.+)$/gm)].map(match => JSON.parse(match[1])));
    }
    if (!practice) {
      const common = Math.min(...checksums.map(checks => checks.length));
      assert.ok(common >= 3, "compare multiple checkpoints in actual gameplay");
      for (const checks of checksums.slice(1)) assert.deepEqual(checks.slice(0, common), checksums[0].slice(0, common));
    }
  } finally {
    for (const { child } of children) if (child.exitCode === null) child.kill("SIGTERM");
    await Promise.allSettled(children.map(child => child.done));
    rmSync(temp, { recursive: true, force: true });
  }
}

test("local practice plays both games, switches modes, rematches and returns to the menu", { timeout: 50000 }, () => play(2, 1, true));
test("two devices use the actual lobby and finish both games without drifting", { timeout: 50000 }, () => play(2, 1));
test("four devices start with the live platformer, switch to turn-based play and rematch", { timeout: 50000 }, () => play(4, 2));
