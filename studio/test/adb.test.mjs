import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { findAdb, parseDevices, selectDevice } from "../../scripts/adb.mjs";

const root = new URL("../../", import.meta.url).pathname;

function fixture(t, os = "nextui") {
  const ws = mkdtempSync(join(tmpdir(), "gs-adb-"));
  t.after(() => rmSync(ws, { recursive: true, force: true }));
  const put = (p, text) => { mkdirSync(join(ws, p, ".."), { recursive: true }); writeFileSync(join(ws, p), text); };
  for (const p of ["push.sh", "run.sh", "device.sh", "adb.mjs", "gamelist.mjs"]) {
    mkdirSync(join(ws, "scripts"), { recursive: true });
    cpSync(join(root, "scripts", p), join(ws, "scripts", p));
  }
  cpSync(join(root, "engine/consoles"), join(ws, "engine/consoles"), { recursive: true });
  cpSync(join(root, "studio/src/info-core.js"), join(ws, "studio/src/info-core.js"), { recursive: true });
  put("studio/package.json", '{"type":"module"}');
  put("build/gs", '#!/bin/sh\nprintf packed > "$3"\n');
  put("build-aarch64/gs", "runtime");
  put("build-aarch64/gs_libretro.so", "core");
  put("game/meta/info.json", '{"console":"glow43","title":"A game & its title"}');
  put("game/game.lua", "return {}");
  const sd = join(ws, "SD Card"), runtime = join(ws, "remote/runtime");
  put("scripts/device.env", `DEVICE_OS=${os}\nDEVICE_SERIAL=\nDEVICE_DIR='${runtime}'\nDEVICE_SDCARD='${sd}'\nDEVICE_ROMS_DIR='${ws}/remote/roms'\nDEVICE_PORTS_DIR='${ws}/remote/ports'\n`);
  const adb = join(ws, "fake-adb");
  put("fake-adb", `#!${process.execPath}
const { spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync, appendFileSync, copyFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.ADB_LOG, JSON.stringify(args) + "\\n");
const map = s => s.replaceAll("/userdata", process.env.ADB_REMOTE + "/userdata")
  .replaceAll("/mnt/mmc", process.env.ADB_REMOTE + "/mmc")
  .replaceAll("/opt/muos", process.env.ADB_REMOTE + "/muos")
  .replaceAll("/tmp/gs-", process.env.ADB_REMOTE + "/gs-");
if (args[0] === "devices") {
  if (process.env.ADB_DISCOVERY_FAIL) { console.error("daemon unavailable"); process.exit(1); }
  console.log("List of devices attached\\n" + process.env.ADB_DEVICES); process.exit(0);
}
if (args[0] !== "-s" || !args[1]) process.exit(90);
if (args[2] === "push") {
  if (process.env.ADB_TRANSFER_FAIL) { console.error("USB disconnected"); process.exit(1); }
  copyFileSync(args[3], map(args[4]));
  if (process.env.ADB_CORRUPT) writeFileSync(map(args[4]), "corrupt");
  process.exit(0);
}
if (args[2] === "shell") {
  if (args[3] === "-T") { console.error("device only supports allocating a pty"); process.exit(1); }
  const command = map(args[3]).replaceAll("sha256sum ", "shasum -a 256 ")
    .replaceAll("curl -s -m 3 http://127.0.0.1:1234/reloadgames", "true");
  const r = spawnSync("sh", ["-c", command], { encoding: "utf8", input: readFileSync(0) });
  process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || "");
  process.exit(0); // legacy adbd does not propagate the shell's status
}
process.exit(91);
`);
  put("bin/sed", `#!${process.execPath}
const { spawnSync } = require("node:child_process");
const args = process.argv.slice(2);
if (process.platform === "darwin" && args[0] === "-i") args.splice(1, 0, "");
process.exit(spawnSync("/usr/bin/sed", args, { stdio: "inherit" }).status);
`);
  const chmod = spawnSync("chmod", ["+x", adb, join(ws, "bin/sed"), join(ws, "build/gs"), join(ws, "scripts/push.sh")]);
  assert.equal(chmod.status, 0);
  const env = { ...process.env, ADB: adb, ADB_LOG: join(ws, "adb.log"), ADB_REMOTE: join(ws, "remote"),
    ADB_DEVICES: "one\\tdevice model:Handheld".replace("\\t", "\t"), GS_DEVICE: "", DEVICE_ENV: join(ws, "scripts/device.env"),
    GS_ADB_SERIAL: "", ANDROID_SERIAL: "", GS_BUILD_DIR: join(ws, "build"), DEVICE_STOP_FRONTEND: "", DEVICE_PLATFORM: "tg5040",
    GS_RUN_AFTER_PUSH: "", GS_NEXTUI_PROGRAM: "", GS_KNULLI_PROGRAM: "", GS_DEBUG: "", GS_PERF: "", GS_GOVERNOR: "",
    DEVICE_HOST: "", DEVICE_USER: "", SSH_OPTS: "", PATH: join(ws, "bin") + ":" + process.env.PATH,
    ASDF_PYTHON_VERSION: "3.11.0", GS_SAVE_DIR: join(ws, "saves") };
  const cli = (...args) => spawnSync(process.execPath, [join(ws, "scripts/adb.mjs"), ...args], { env, encoding: "utf8" });
  const send = (script = "push.sh", game = "game") => spawnSync("sh", [join(ws, "scripts", script), join(ws, game)], { cwd: ws, env, encoding: "utf8" });
  const calls = () => existsSync(env.ADB_LOG) ? readFileSync(env.ADB_LOG, "utf8").trim().split("\n").map(JSON.parse) : [];
  return { ws, sd, runtime, env, put, cli, send, calls, adb };
}

test("ADB parsing and selection never chooses arbitrarily or falls back from a saved serial", () => {
  const ds = parseDevices("List of devices attached\r\none device product:x model:Brick_Pro transport_id:1\r\ntwo unauthorized\r\nthree offline\r\nfour no permissions (udev)\r\n");
  assert.equal(ds[0].model, "Brick Pro");
  assert.equal(selectDevice(ds, "one"), "one");
  assert.throws(() => selectDevice(ds), /More than one/);
  assert.throws(() => selectDevice(ds, "missing"), /selected.*not connected/);
  assert.throws(() => selectDevice(ds, "two"), /unauthorized/);
  assert.throws(() => selectDevice(ds, "three"), /offline/);
  assert.throws(() => selectDevice(ds, "four"), /USB permissions/);
  assert.throws(() => selectDevice([]), /No ADB device/);
  assert.equal(selectDevice([ds[0]]), "one");
});

test("ADB discovery supports explicit paths and a packaged Mac app without shell PATH", t => {
  const f = fixture(t);
  assert.equal(findAdb({ ADB: f.adb }), f.adb);
  assert.throws(() => findAdb({ ADB: join(f.ws, "missing") }), /not executable/);
  cpSync(f.adb, join(f.ws, "Library/Android/sdk/platform-tools/adb"), { recursive: true });
  // The standard Mac SDK path is considered even when the app has only a minimal PATH.
  const sdk = findAdb({ HOME: f.ws, PATH: "" });
  assert.equal(sdk, join(f.ws, "Library/Android/sdk/platform-tools/adb"));
});

test("ADB preflight errors occur before any transfer or build", t => {
  const f = fixture(t);
  for (const [list, pattern] of [["", /No ADB device/], ["one\toffline", /offline/], ["one\tunauthorized", /unauthorized/],
    ["one\tdevice\ntwo\tdevice", /More than one/]]) {
    f.env.ADB_DEVICES = list;
    const r = f.send();
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, pattern);
  }
  f.env.ADB_DISCOVERY_FAIL = "1";
  assert.match(f.send().stderr, /daemon unavailable/);
  assert.ok(f.calls().every(c => c[0] === "devices"));
  f.env.ADB = join(f.ws, "missing");
  assert.match(f.send().stderr, /not executable/);
});

test("Legacy SSH profiles fail explicitly without printing their contents", t => {
  const f = fixture(t);
  f.put("scripts/device.env", "DEVICE_HOST=private-host\nDEVICE_USER=private-user\n");
  const r = f.send();
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /retired SSH settings/);
  assert.doesNotMatch(r.stderr, /private-host|private-user/);
  assert.equal(f.calls().length, 0);
});

test("Legacy ADB shell propagates remote failures and passes script stdin safely", t => {
  const f = fixture(t);
  assert.match(f.cli("shell", "one", "false").stderr, /exit 1/);
  const r = spawnSync(process.execPath, [join(f.ws, "scripts/adb.mjs"), "shell", "one", "sh", "-s", "--", "a'b"],
    { env: f.env, input: 'printf "%s" "$1"\n', encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "a'b");
  assert.equal(f.cli("run", "one", "true").status, 0);
  assert.match(f.cli("run", "one", "false").stderr, /exit 1/);
});

test("Transfers verify hashes before atomic replacement, preserving the old destination on failure", t => {
  const f = fixture(t), dest = join(f.ws, "remote/game with 'quotes'.g43");
  f.put("source", "new game"); f.put("remote/game with 'quotes'.g43", "old game");
  f.env.ADB_CORRUPT = "1";
  const bad = f.cli("push", "one", join(f.ws, "source"), dest);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /checksum mismatch/);
  assert.equal(readFileSync(dest, "utf8"), "old game");
  assert.ok(!readdirSync(join(f.ws, "remote")).some(p => p.includes(".gs-stage-")));
  delete f.env.ADB_CORRUPT;
  f.env.ADB_TRANSFER_FAIL = "1";
  assert.notEqual(f.cli("push", "one", join(f.ws, "source"), dest).status, 0);
  assert.equal(readFileSync(dest, "utf8"), "old game");
  delete f.env.ADB_TRANSFER_FAIL;
  assert.equal(f.cli("push", "one", join(f.ws, "source"), dest).status, 0);
  assert.equal(readFileSync(dest, "utf8"), "new game");
  assert.ok(f.calls().every(c => c[0] === "-s" && c[1] === "one"));
});

test("NextUI deployment preserves other games, saves and map entries with spaces in paths", t => {
  const f = fixture(t);
  const folder = "SD Card/Roms/Glow43 (G43)";
  f.put(`${folder}/map.txt`, "other.g43\tOther game\ngame.g43\tOld title\ngameXg43\tNot this game\ngameXcart\tAlso unrelated\ngame.cart\tLegacy title\n");
  f.put(`${folder}/game.cart`, "old format name");
  f.put(`${folder}/other.g43`, "untouched");
  f.put("SD Card/Saves/G43/game/save", "saved");
  f.env.ADB_DEVICES = "one\tdevice\ntwo\tdevice";
  f.env.GS_ADB_SERIAL = "two";
  const r = f.send();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(join(f.sd, "Roms/Glow43 (G43)/game.g43"), "utf8"), "packed");
  assert.equal(readFileSync(join(f.sd, "Roms/Glow43 (G43)/map.txt"), "utf8"),
    "other.g43\tOther game\ngameXg43\tNot this game\ngameXcart\tAlso unrelated\ngame.g43\tA game & its title\n");
  assert.ok(!existsSync(join(f.sd, "Roms/Glow43 (G43)/game.cart")));
  assert.equal(readFileSync(join(f.sd, "Saves/G43/game/save"), "utf8"), "saved");
  assert.equal(readFileSync(join(f.sd, "Roms/Glow43 (G43)/other.g43"), "utf8"), "untouched");
  assert.match(readFileSync(join(f.sd, "Emus/tg5040/G43.pak/launch.sh"), "utf8"), /minarch\.elf/);
  assert.ok(f.calls().filter(c => c[0] !== "devices").every(c => c[0] === "-s" && c[1] === "two"));
  f.env.ADB_DEVICES = "one\tdevice";
  const disconnected = f.send();
  assert.notEqual(disconnected.status, 0);
  assert.match(disconnected.stderr, /selected.*not connected/);
});

test("A profile can set the ADB program, and a bad device folder is rejected before transfer", t => {
  const f = fixture(t);
  delete f.env.ADB;
  f.put("scripts/device.env", `ADB='${f.adb}'\nDEVICE_OS=nextui\nDEVICE_DIR=relative\n`);
  assert.match(f.send().stderr, /absolute paths/);
  assert.ok(f.calls().some(c => c[0] === "devices"));
  assert.ok(f.calls().every(c => c[0] === "devices"));
});

test("MCP push forwards its explicit device profile and serial", t => {
  const f = fixture(t);
  cpSync(join(root, "engine/instruments.json"), join(f.ws, "engine/instruments.json"));
  cpSync(join(f.ws, "scripts/device.env"), join(f.ws, "scripts/device-brick.env"));
  f.env.ADB_DEVICES = "one\tdevice\ntwo\tdevice";
  const script = `const { push } = await import(${JSON.stringify(join(root, "tools/mcp/tools.mjs"))});
console.log(push({ game: ${JSON.stringify(join(f.ws, "game"))}, serial: "two", device: "brick" }).text);`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script],
    { env: { ...f.env, GS_WORKSPACE: f.ws }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /sent .* over ADB/);
  assert.ok(f.calls().filter(c => c[0] !== "devices").every(c => c[1] === "two"));
});

test("Deployment stops on a failed transfer without updating the game list", t => {
  const f = fixture(t);
  f.env.ADB_TRANSFER_FAIL = "1";
  const r = f.send();
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /USB disconnected/);
  assert.ok(!existsSync(join(f.sd, "Roms/Glow43 (G43)/map.txt")));
});

test("Existing game folders with spaces and periods retain their deployed file names", t => {
  const f = fixture(t);
  cpSync(join(f.ws, "game"), join(f.ws, "My game.v2"), { recursive: true });
  const r = f.send("push.sh", "My game.v2");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(join(f.sd, "Roms/Glow43 (G43)/My game.v2.g43"), "utf8"), "packed");
});

test("NextUI tools and run.sh use the deployed cart on the same selected serial", t => {
  const f = fixture(t);
  f.put("game/meta/info.json", '{"title":"Pad setup"}');
  f.put("build-aarch64/gs", '#!/bin/sh\nprintf "launched %s\\n" "$1"\n');
  f.env.ADB_DEVICES = "one\tdevice\ntwo\tdevice";
  f.env.GS_ADB_SERIAL = "two";
  const r = f.send("run.sh");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(join(f.sd, "Tools/tg5040/Pad setup.pak/launch.sh")));
  assert.match(r.stdout, /launched .*runtime\/carts\/game\.cart/);
  assert.equal(f.calls().filter(c => c[0] === "devices").length, 1);
  assert.ok(f.calls().filter(c => c[0] !== "devices").every(c => c[1] === "two"));
});

test("muOS deployment keeps its launcher, title and External - Ports assignment", t => {
  const f = fixture(t, "muos");
  f.put("remote/muos/share/info/assign/assign.json", '{"existing":"Other"}');
  f.put("remote/mmc/MUOS/info/name/global.json", '{"other":"Other game"}');
  const r = f.send();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(readFileSync(join(f.runtime, "carts/game.cart"), "utf8"), "packed");
  assert.ok(existsSync(join(f.ws, "remote/roms/Glow43/game.sh")));
  assert.deepEqual(JSON.parse(readFileSync(join(f.ws, "remote/muos/share/info/assign/assign.json"), "utf8")),
    { existing: "Other", glow43: "External - Ports" });
  assert.deepEqual(JSON.parse(readFileSync(join(f.ws, "remote/mmc/MUOS/info/name/global.json"), "utf8")),
    { other: "Other game", game: "A game & its title" });
});

test("Knulli deployment retains console system, libretro configuration and game-list metadata", t => {
  const f = fixture(t, "knulli");
  f.put("remote/roms/glow43/gamelist.xml", '<gameList><game><path>./game.sh</path><favorite>true</favorite></game><game><path>./other.sh</path><name>Other</name></game></gameList>');
  const r = f.send();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(readFileSync(join(f.ws, "remote/userdata/system/configs/emulationstation/es_systems_gamestudio.cfg"), "utf8"), /<name>glow43<\/name>/);
  const list = readFileSync(join(f.ws, "remote/roms/glow43/gamelist.xml"), "utf8");
  assert.match(list, /<favorite>true<\/favorite>/);
  assert.match(list, /other\.sh/);
  const config = readFileSync(join(f.runtime, "retroarch-game.cfg"), "utf8");
  assert.match(config, /aspect_ratio_index/);
  assert.match(config, /input_joypad_driver = "sdl2"/);
  for (const [button, id] of Object.entries({ a: 1, b: 0, x: 3, y: 2, up: 11, down: 12, left: 13, right: 14, start: 6, select: 4 })) {
    assert.ok(config.includes(`input_player1_${button}_btn = "${id}"`), button);
    assert.ok(config.includes(`input_player1_${button}_axis = "nul"`), button);
  }
  assert.match(config, /input_player1_l2_axis = "\+4"/);
  assert.match(config, /input_player1_r2_axis = "\+5"/);
  assert.match(config, /input_enable_hotkey_btn = "5"/);
  assert.match(config, /input_exit_emulator_btn = "6"/);
  assert.match(readFileSync(join(f.ws, "remote/roms/glow43/game.sh"), "utf8"), /retroarch -L/);
});
