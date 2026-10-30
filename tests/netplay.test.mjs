import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import dgram from "node:dgram";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GS_") && !k.startsWith("RETRO_")));
async function freePort() {
  const socket = dgram.createSocket("udp4");
  await new Promise(resolve => socket.bind(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}
function launch(port, count, role, saves, loss, extra = {}) {
  const child = spawn(join(root, "build/gs"), ["tests/netplay"], {
    cwd: root, env: { ...env, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_SAVE_DIR: saves,
      GS_NET_PORT: String(port), GS_NET_DISCOVERY: "127.0.0.1", GS_NET_ROLE: role, GS_NET_EXPECT: String(count),
      GS_BOT_LUA: join(root, "tests/netplay-bot.lua"), GS_MAX_FRAMES: "900", GS_CHECKSUM: "1",
      ...(loss ? { GS_NET_LOSS: "1" } : {}), ...extra },
  });
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal, output }));
  });
  return { child, done, output: () => output };
}
async function waitFor(process, text) {
  const deadline = Date.now() + 10000;
  while (!process.output().includes(text)) {
    assert.ok(Date.now() < deadline && process.child.exitCode === null, process.output());
    await sleep(20);
  }
}
async function session(count, loss = false, pause = false, leave = false, drift = false) {
  const temp = mkdtempSync(join(tmpdir(), "gs-netplay-"));
  const processes = [];
  try {
    const port = await freePort();
    const dirs = Array.from({ length: count }, (_, i) => mkdtempSync(join(temp, `p${i}-`)));
    const extra = { ...(leave ? { GS_NET_LEAVE: "1" } : {}), ...(drift ? { GS_NET_DRIFT: "1" } : {}) };
    processes.push(launch(port, count, "host", dirs[0], loss, extra));
    await sleep(150);
    for (let i = 1; i < count; i++) processes.push(launch(port, count, `Guest${i}`, dirs[i], loss, extra));
    if (pause) {
      await waitFor(processes[0], "NETPLAY STEP 60");
      processes[1].child.kill("SIGSTOP");
      await waitFor(processes[0], "NETPLAY WAITING");
      processes[1].child.kill("SIGCONT");
    }
    const results = await Promise.all(processes.map(p => p.done));
    const records = [];
    const assigned = [];
    for (let i = 0; i < results.length; i++) {
      const { code, output } = results[i];
      assert.equal(code, 0, output);
      assert.doesNotMatch(output, /error:|FAIL|timed out/);
      if (!drift) assert.doesNotMatch(output, /out of step/);
      assert.match(output, drift ? /NETPLAY DRIFT PASS/ : leave ? /NETPLAY LEAVE PASS/ : /NETPLAY TEST PASS/);
      const start = output.match(new RegExp(`NETPLAY START (\\d+) ${count}`));
      assert.ok(start, output);
      assigned.push(Number(start[1]));
      if (i === 0) assert.equal(assigned[0], 1);
      const gameplay = output.slice(output.indexOf("NETPLAY START"));
      records.push([...gameplay.matchAll(/^@@gscheck (.+)$/gm)].map(m => JSON.parse(m[1])).filter(r => r.step <= 120));
      assert.equal(readFileSync(join(dirs[i], "score"), "utf8"), i === 0 ? (leave || drift ? "137" : "197") : "91", output);
      assert.equal(readFileSync(join(dirs[i], "_net_name"), "utf8"), i === 0 ? '"Host"' : `"Guest${i}"`);
    }
    assert.deepEqual(assigned.sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i + 1));
    if (!leave && !drift) {
      assert.deepEqual(records[0].map(r => r.step), [60, 120]);
      for (const record of records.slice(1)) assert.deepEqual(record, records[0]);
    }
  } finally {
    for (const p of processes) {
      if (p.child.exitCode === null) { p.child.kill("SIGCONT"); p.child.kill("SIGTERM"); }
    }
    await Promise.allSettled(processes.map(p => p.done));
    rmSync(temp, { recursive: true, force: true });
  }
}
test("two runtimes discover, join and play with separate buttons and the host's saves", { timeout: 20000 }, () => session(2));
test("four runtimes recover lost/reordered UDP and a paused peer without drifting", { timeout: 20000 }, () => session(4, true, true));
test("leaving notifies peers, restores private saves and releases the host socket", { timeout: 20000 }, () => session(2, false, false, true));
test("scalar state drift ends the session on both devices", { timeout: 20000 }, () => session(2, false, false, false, true));

test("discovery filters other games and malformed packets do not break a host", { timeout: 20000 }, async () => {
  const temp = mkdtempSync(join(tmpdir(), "gs-net-filter-"));
  const processes = [];
  const socket = dgram.createSocket("udp4");
  try {
    const port = await freePort();
    const host = launch(port, 2, "host", mkdtempSync(join(temp, "host-")), false);
    processes.push(host);
    await sleep(150);
    await new Promise((resolve, reject) => socket.send(Buffer.from("GSN1"), port, "127.0.0.1", error => error ? reject(error) : resolve()));
    const scanner = launch(port, 2, "scanner", mkdtempSync(join(temp, "scanner-")), false, { GS_NET_GAME: "Another game" });
    processes.push(scanner);
    const scanned = await scanner.done;
    assert.equal(scanned.code, 0, scanned.output);
    assert.match(scanned.output, /NETPLAY FILTER PASS/);
    const guest = launch(port, 2, "Guest1", mkdtempSync(join(temp, "guest-")), false);
    processes.push(guest);
    for (const result of await Promise.all([host.done, guest.done])) {
      assert.equal(result.code, 0, result.output);
      assert.match(result.output, /NETPLAY TEST PASS/);
      assert.doesNotMatch(result.output, /error:|out of step|timed out/);
    }
    assert.match(host.output(), /ignored a malformed packet/);
  } finally {
    socket.close();
    for (const p of processes) if (p.child.exitCode === null) p.child.kill("SIGTERM");
    await Promise.allSettled(processes.map(p => p.done));
    rmSync(temp, { recursive: true, force: true });
  }
});

const core = ["gs_libretro.dylib", "gs_libretro.so"].map(name => join(root, "build", name)).find(existsSync);
test("libretro refuses save states while the Wi-Fi socket is active", { skip: !core }, async () => {
  const saves = mkdtempSync(join(tmpdir(), "gs-net-state-"));
  try {
    const port = await freePort();
    const r = spawnSync(join(root, "build/retro-run"), [core, "tests/netplay", "4"], {
      cwd: root, encoding: "utf8", timeout: 10000,
      env: { ...env, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_CORE_GPU: "0", GS_SAVE_DIR: saves,
        GS_NET_PORT: String(port), GS_NET_ROLE: "host", GS_NET_STATE_GUARD: "1", GS_BOT_LUA: join(root, "tests/netplay-bot.lua"),
        RETRO_SAVE: `2:${join(saves, "state")}` },
    });
    assert.ifError(r.error);
    const output = r.stdout + r.stderr;
    assert.equal(r.status, 0, output);
    assert.match(output, /RETRO state size 0/);
    assert.match(output, /RETRO save FAILED/);
    assert.match(output, /leave Wi-Fi play before saving a state/);
    assert.equal(existsSync(join(saves, "state")), false);
  } finally { rmSync(saves, { recursive: true, force: true }); }
});
