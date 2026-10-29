// Add the stdio server to the read-only tools folder staged by scripts/build-app.sh.
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, "../..");

export function bundleMcp(destination) {
  const node = realpathSync(process.execPath);
  const license = join(dirname(node), "../LICENSE");
  if (!existsSync(license)) throw new Error(`Node's LICENSE is missing at ${license}; use an official Node.js distribution to build the app.`);
  if (process.platform !== "darwin") throw new Error("The app bundle currently targets macOS.");
  const linked = spawnSync("/usr/bin/otool", ["-L", node], { encoding: "utf8" });
  if (linked.error || linked.status !== 0) throw new Error(`Could not check Node's shared libraries: ${linked.error?.message || linked.stderr}`);
  const external = linked.stdout.split("\n").slice(1).map((s) => s.trim().split(" (")[0])
    .filter((s) => s && !s.startsWith("/usr/lib/") && !s.startsWith("/System/Library/"));
  if (external.length) throw new Error(`Node depends on libraries outside macOS: ${external.join(", ")}. Build with an official Node.js distribution, not a dynamically linked package-manager build.`);
  for (const name of ["@modelcontextprotocol/sdk", "zod"]) {
    if (!existsSync(join(here, "node_modules", name, "package.json"))) throw new Error(`Missing ${name}; run npm ci in tools/mcp before building the app.`);
  }
  const copy = (from, to = from) => {
    const target = join(destination, to);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, from), target, { recursive: true, dereference: true });
  };
  for (const file of ["server.mjs", "tools.mjs", "package.json", "gamestudio-mcp"]) copy(`tools/mcp/${file}`);
  copy("tools/mcp/node_modules");
  cpSync(node, join(destination, "tools/mcp/node"));
  cpSync(license, join(destination, "tools/mcp/NODE-LICENSE"));
  chmodSync(join(destination, "tools/mcp/node"), 0o755);
  chmodSync(join(destination, "tools/mcp/gamestudio-mcp"), 0o755);
  copy("studio/package.json");
  for (const file of readdirSync(join(root, "studio/src")).filter((f) => f.endsWith(".js"))) copy(`studio/src/${file}`);
  for (const file of [
    "engine/instruments.json", "docs/help", "scripts/lib/canvas.mjs", "scripts/lib/music.mjs", "scripts/png.mjs",
    "tests/keys-bot.lua", "tests/random-bot.lua", "scripts/device.env.example",
  ]) copy(file);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error("usage: node tools/mcp/bundle.mjs <staged-gamestudio-folder>");
  bundleMcp(resolve(process.argv[2]));
}
