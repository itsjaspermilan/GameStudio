// Generates the art and sound of carts/void-swarm: sprites, backgrounds, sound effects and songs. The game itself (entities/, scenes/, lib/) is hand-written
// Lua and is NOT touched here; neither is meta/info.json. Everything in sprites/, tilesets/, sfx/ and music/ is rewritten.
// usage: node scripts/make-void-swarm.mjs
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeAssets } from "./void-swarm/assets.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "carts", "void-swarm");
const { sprites, tilesets, sfx, music } = writeAssets(dir);
console.log(`void-swarm: ${sprites.length} sprites, ${tilesets.length} tilesets, ${sfx.length} sound effects, ${music.length} songs`);
