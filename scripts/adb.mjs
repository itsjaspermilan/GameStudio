import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";

export function findAdb(env = process.env) {
  const home = env.HOME || homedir(), exe = process.platform === "win32" ? "adb.exe" : "adb";
  const candidates = env.ADB ? [env.ADB] : [
    ...(env.PATH || "").split(delimiter).filter(Boolean).map(p => join(p, exe)),
    ...[env.ANDROID_HOME, env.ANDROID_SDK_ROOT, join(home, "Library/Android/sdk"),
      join(home, "Android/Sdk"), env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Android/Sdk")]
      .filter(Boolean).map(p => join(p, "platform-tools", exe)),
    "/opt/homebrew/bin/adb", "/usr/local/bin/adb",
  ];
  for (const p of candidates) {
    try { accessSync(p, constants.X_OK); if (statSync(p).isFile()) return resolve(p); } catch { /* try the next installed location */ }
  }
  throw new Error(env.ADB
    ? "The ADB program in Settings (or ADB) is not executable. Choose the full path to platform-tools/adb."
    : "ADB was not found. Install Android SDK Platform-Tools (on Mac: brew install --cask android-platform-tools), or set the full path to adb in Settings (ADB for scripts).");
}

function adb(args, options = {}) {
  const r = spawnSync(findAdb(), args, { encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (r.error) throw new Error(`Could not run ADB: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ADB failed: ${(r.stderr || r.stdout || `exit ${r.status}`).trim()}`);
  return r.stdout;
}

export function parseDevices(text) {
  return text.split(/\r?\n/).flatMap(line => {
    const m = /^(\S+)\s+(device|offline|unauthorized|no permissions)\b(.*)$/.exec(line);
    if (!m) return [];
    return [{ serial: m[1], state: m[2], model: /(?:^|\s)model:(\S+)/.exec(m[3])?.[1]?.replaceAll("_", " ") || "" }];
  });
}

export function devices() {
  return parseDevices(adb(["devices", "-l"]));
}

export function selectDevice(list, serial = "") {
  if (!serial) {
    if (!list.length) throw new Error("No ADB device found. Connect a data-capable USB cable, wake the handheld and enable ADB/USB debugging in its firmware.");
    if (list.length !== 1) throw new Error("More than one ADB device is connected. Choose a device in Settings, or set DEVICE_SERIAL (MCP: serial).");
  }
  const d = serial ? list.find(d => d.serial === serial) : list[0];
  if (!d) throw new Error("The selected ADB device is not connected. Reconnect it or choose another device in Settings.");
  if (d.state === "unauthorized") throw new Error(`ADB device ${d.serial} is unauthorized. Unlock the handheld and accept its USB debugging authorization, then refresh.`);
  if (d.state === "offline") throw new Error(`ADB device ${d.serial} is offline. Wake it, reconnect the USB cable and refresh.`);
  if (d.state !== "device") throw new Error(`ADB device ${d.serial}: ${d.state}. Check USB permissions and the firmware's ADB setup.`);
  return d.serial;
}

export const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";

function shellCommand(args, input) {
  let command = args.length === 1 ? args[0] : args.map(quote).join(" ");
  if (input?.length) command = `printf %s ${quote(input)} | ${command}`;
  // Some Linux handhelds only implement ADB's original PTY shell, which neither accepts -T nor reports remote exit codes.
  const marker = `__GS_EXIT_${randomUUID()}__`;
  return { marker, command: `(${command}\n) 2>&1; gs_status=$?; printf '\\n${marker}%s\\n' "$gs_status"` };
}

function shellResult(out, marker) {
  const match = new RegExp(`\\r?\\n${marker}(\\d+)\\r?\\n?$`).exec(out);
  if (!match) throw new Error("ADB shell did not return a command status. Check the connection and the firmware's ADB shell support.");
  const text = out.slice(0, match.index);
  if (match[1] !== "0") throw new Error(`ADB shell failed (exit ${match[1]}): ${text.trim()}`);
  return text;
}

export function shell(serial, args, options = {}) {
  if (!serial) throw new Error("An ADB serial is required.");
  const { marker, command } = shellCommand(args, options.input);
  return shellResult(adb(["-s", serial, "shell", command], { ...options, input: "" }), marker);
}

function run(serial, args) {
  if (!serial) throw new Error("An ADB serial is required.");
  const { marker, command } = shellCommand(args);
  return new Promise((resolve, reject) => {
    const child = spawn(findAdb(), ["-s", serial, "shell", command], { stdio: ["ignore", "pipe", "inherit"] });
    let tail = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", data => {
      tail += data;
      const end = tail.length > marker.length + 16 ? tail.lastIndexOf("\n", tail.length - marker.length - 16) : -1;
      if (end >= 0) { process.stdout.write(tail.slice(0, end + 1)); tail = tail.slice(end + 1); }
    });
    child.on("error", reject);
    child.on("close", code => {
      try {
        if (code !== 0) throw new Error(`ADB stopped while running the game (exit ${code}). ${tail.trim()}`);
        process.stdout.write(shellResult(tail, marker));
        resolve();
      } catch (e) { reject(e); }
    });
  });
}

export function push(serial, source, dest) {
  if (!serial || !dest.startsWith("/") || /[\r\n\0]/.test(dest)) throw new Error("ADB transfers need a serial and an absolute device path.");
  const hash = createHash("sha256").update(readFileSync(source)).digest("hex");
  const stage = `${dest}.gs-stage-${randomUUID()}`;
  try {
    adb(["-s", serial, "push", source, stage]);
    // Verify on the same filesystem before replacing the destination; an interrupted transfer never truncates the live game or core.
    shell(serial, [`set -e; actual=$(sha256sum ${quote(stage)}); actual=\${actual%% *}; [ "$actual" = ${quote(hash)} ] || { echo 'ADB transfer checksum mismatch' >&2; exit 1; }; mv -f ${quote(stage)} ${quote(dest)}`]);
  } catch (error) {
    try { shell(serial, [`rm -f ${quote(stage)}`]); }
    catch (cleanup) { throw new Error(`${error.message}\nCould not remove the staged transfer: ${cleanup.message}`); }
    throw error;
  }
}

async function main([command, ...args]) {
  if (command === "list") return console.log(JSON.stringify(devices()));
  if (command === "select") return console.log(selectDevice(devices(), args[0] || ""));
  if (command === "shell") return process.stdout.write(shell(args.shift(), args, { input: process.stdin.isTTY ? "" : readFileSync(0) }));
  if (command === "run") {
    const serial = args.shift();
    return run(serial, args);
  }
  if (command === "push") return push(...args);
  throw new Error("usage: node scripts/adb.mjs list|select [serial]|shell serial command|push serial source destination");
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try { await main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
