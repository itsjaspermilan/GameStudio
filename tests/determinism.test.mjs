import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = resolve(root, "build/gs");
const core = ["build/gs_libretro.dylib", "build/gs_libretro.so"].map(p => resolve(root, p)).find(existsSync);
const hostEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GS_") && !k.startsWith("RETRO_")));

function run(overrides = {}, { args = ["tests/determinism"], executable = runtime, status = 0 } = {}) {
  const saves = mkdtempSync(join(tmpdir(), "gs-determinism-"));
  try {
    const r = spawnSync(executable, args, {
      cwd: root, encoding: "utf8", timeout: 30000,
      env: { ...hostEnv, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_CORE_GPU: "0",
        GS_SAVE_DIR: saves, RETRO_SAVE_DIR: saves, GS_FIXED_STEP: "1", GS_MAX_FRAMES: "240",
        GS_SESSION_SEED: "41", GS_CHECKSUM: "1", GS_BOT_LUA: resolve(root, "tests/keys-bot.lua"),
        GS_KEYS: "right*40,a,left*60,down+a*30,wait*10,up*50", ...overrides },
    });
    assert.ifError(r.error);
    const output = r.stdout + r.stderr;
    assert.equal(r.status, status, output);
    return output;
  } finally {
    rmSync(saves, { recursive: true, force: true });
  }
}

function checks(output, started = true) {
  assert.doesNotMatch(output, /error:|FAIL|boot:/i);
  if (started) assert.match(output, /DETERMINISM TEST PASS/);
  const records = [...output.matchAll(/^@@gscheck (.+)$/gm)].map(m => JSON.parse(m[1]));
  assert.ok(records.length > 0, output);
  for (const r of records) {
    assert.equal(r.step % 60, 0);
    assert.match(r.hash, /^[0-9a-f]{16}$/);
  }
  return records;
}

test("separate processes replay the same recorded inputs and seed", () => {
  const a = checks(run());
  assert.deepEqual(a.map(r => r.step), [60, 120, 180, 240]);
  assert.deepEqual(checks(run()), a);
  assert.deepEqual(checks(run({ GS_RAM: "1" })), a);
});

test("draw randomness and fewer draws do not change simulation", () => {
  const expected = checks(run());
  assert.deepEqual(checks(run({ GS_DRAW_NOISE: "7" })), expected);
  assert.deepEqual(checks(run({ GS_DRAW_NOISE: "7", GS_DRAW_RESEED: "1" })), expected);
  assert.deepEqual(checks(run({ GS_DRAW_NOISE: "7", GS_FF: "4", GS_MAX_FRAMES: "60" })), expected);
});

test("a different seed or input produces different fingerprints", () => {
  const expected = checks(run());
  assert.notDeepEqual(checks(run({ GS_SESSION_SEED: "42" })), expected);
  assert.notDeepEqual(checks(run({ GS_KEYS: "left*240" })), expected);
});

test("Breakout replays to the same fingerprints in independent processes", () => {
  const options = { GS_KEYS: "start,wait*10,a,right*60,left*60", GS_MAX_FRAMES: "300" };
  const args = ["carts/breakout"];
  const expected = checks(run(options, { args }), false);
  assert.equal(expected.length, 5);
  assert.deepEqual(checks(run(options, { args }), false), expected);
});

test("single-player RNG semantics stay unchanged without a session seed", () => {
  checks(run({ GS_SESSION_SEED: undefined }));
});

test("invalid session seeds are reported instead of silently substituted", () => {
  for (const seed of ["not-a-seed", "1.5", "9223372036854775808", ""]) {
    assert.match(run({ GS_SESSION_SEED: seed }, { status: 1 }), /GS_SESSION_SEED must be an integer/);
  }
});

test("diagnostic fingerprints are opt-in", () => {
  const output = run({ GS_CHECKSUM: undefined });
  assert.match(output, /DETERMINISM TEST PASS/);
  assert.doesNotMatch(output, /@@gscheck|error:/);
});

test("libretro replay and cross-process Resume preserve both random streams", { skip: !core }, () => {
  const temp = mkdtempSync(join(tmpdir(), "gs-determinism-state-"));
  try {
    const state = join(temp, "state");
    const executable = resolve(root, "build/retro-run");
    const args = [core, "tests/determinism", "240"];
    const options = { GS_DRAW_NOISE: "7", GS_DRAW_TRACE: "1" };
    const baseline = run(options);
    const expected = checks(baseline);
    const saved = run({ ...options, RETRO_SAVE: `120:${state}` }, { args, executable });
    assert.deepEqual(checks(saved), expected);
    const drawChecks = output => output.split("\n").filter(l => l.startsWith("@@gsdraw "));
    assert.deepEqual(drawChecks(saved), drawChecks(baseline));
    const resumed = run({ ...options, RETRO_LOAD: `0:${state}` },
      { args: [core, "tests/determinism", "120"], executable });
    assert.match(resumed, /RETRO load ok/);
    assert.deepEqual(checks(resumed, false), expected.filter(r => r.step > 120));
    assert.deepEqual(drawChecks(resumed), drawChecks(baseline).slice(2));
    const replay = checks(run({ ...options, RETRO_SAVE: `120:${state}`, RETRO_LOAD: `241:${state}` },
      { args: [core, "tests/determinism", "360"], executable }));
    assert.deepEqual(replay, [...expected, ...expected.filter(r => r.step > 120)]);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
