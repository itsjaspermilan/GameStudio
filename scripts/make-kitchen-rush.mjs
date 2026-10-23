// Generates the art and sound of carts/kitchen-rush: sprites, the kitchen tileset, sound effects and songs, and lib/art.lua (food frame
// numbers and tile numbers). The game itself (game.lua, scenes/, the rest of lib/, meta/) is hand-written and NOT touched here.
// usage: node scripts/make-kitchen-rush.mjs
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { png } from "./png.mjs";
import { Canvas, strip } from "./lib/canvas.mjs";
import * as A from "./kitchen-rush/art.mjs";
import { SFX, allMusic } from "./kitchen-rush/audio.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "carts", "kitchen-rush");
for (const d of ["sprites", "tilesets", "sfx", "music", "lib"]) mkdirSync(join(dir, d), { recursive: true });
for (const sub of ["sprites", "tilesets", "sfx", "music"]) for (const f of readdirSync(join(dir, sub))) rmSync(join(dir, sub, f));

const json = (path, v) => writeFileSync(join(dir, path), JSON.stringify(v, null, 1) + "\n");
let count = 0;
// sprites are drawn from their top-left corner: the kitchen is laid out on a grid, not around centres
function sprite(name, def, extra = {}) {
  const fr = [];
  for (let f = 0; f < def.frames; f++) { const c = new Canvas(def.w, def.h); def.draw(c, f); fr.push(c); }
  const s = strip(fr);
  writeFileSync(join(dir, "sprites", name + ".png"), png(s.w, s.h, s.rgba()));
  json(`sprites/${name}.json`, { image: `sprites/${name}.png`, frames: def.frames, origin: [0, 0], mask: null, fps: 0, ...extra });
  count++;
}
// the chef and the food first: the cart art puts a project's first sprites on the box
sprite("spr_chef", A.SPR_CHEF);
sprite("spr_food", A.SPR_FOOD);
sprite("spr_face", A.SPR_FACE);
sprite("spr_plate", A.SPR_PLATE);
sprite("spr_bin", A.SPR_BIN);
sprite("spr_bell", A.SPR_BELL);
sprite("spr_coin", A.SPR_COIN);
sprite("spr_heart", A.SPR_HEART);
sprite("spr_star", A.SPR_STAR);

const ts = A.kitchenTileset();
writeFileSync(join(dir, "tilesets", "ts_kitchen.png"), png(ts.w, ts.h, ts.rgba()));
json("tilesets/ts_kitchen.json", { image: "tilesets/ts_kitchen.png", tile_w: 16, tile_h: 16 });

for (const [n, d] of Object.entries(SFX)) json(`sfx/${n}.json`, d);
const music = allMusic();
for (const [n, d] of Object.entries(music)) json(`music/${n}.json`, d);

const lua = ["-- Written by scripts/make-kitchen-rush.mjs: food frames in spr_food (from 0), ts_kitchen tiles.", "local M = {}",
  "M.FOOD = { " + A.FOOD_IDS.map((id, i) => `${id} = ${i}`).join(", ") + " }",
  "M.TILE = { " + Object.entries(A.TILE).map(([k, v]) => `${k} = ${v}`).join(", ") + " }",
  "return M", ""];
writeFileSync(join(dir, "lib", "art.lua"), lua.join("\n"));

console.log(`kitchen-rush: ${count} sprites, 1 tileset, ${Object.keys(SFX).length} sound effects, ${Object.keys(music).length} songs`);
