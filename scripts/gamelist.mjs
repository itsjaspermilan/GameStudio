// Prints the gamelist.xml <game> entry for a cart, from its meta/info.json (see studio/src/info-core.js).
//   node scripts/gamelist.mjs <cart-dir> <launcher-file-name> [box-art] [screenshot] [logo]     (picture paths relative to the list; "" for none)
// push.sh merges the output into the device's game list. A cart without info (or a plain Lua cart) still gets a name from its folder.
import { readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { gamelistEntry } from "../studio/src/info-core.js";

const [dir, launcher, boxart = "", screenshot = "", logo = ""] = process.argv.slice(2);
if (!dir || !launcher) { console.error("usage: node scripts/gamelist.mjs <cart-dir> <launcher> [box-art] [screenshot] [logo]"); process.exit(2); }

let info = {};
const file = join(dir, "meta", "info.json");
if (existsSync(file)) {
  try { info = JSON.parse(readFileSync(file, "utf8")) || {}; } catch { /* a broken info.json just means no info */ }
}
process.stdout.write(gamelistEntry(info, { cartName: basename(dir.replace(/\/+$/, "")), launcher, images: { boxart, screenshot, logo } }));
