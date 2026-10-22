// Generates the art and sound of carts/panel-pop: sprites, fonts, the two tilesets (backgrounds and window panels), sound effects and songs,
// and lib/art.lua (the sizes of every sprite). The game's rules and screens are hand-written Lua and layouts in carts/panel-pop (lib/,
// scenes/) and are NOT touched here, nor are game.lua and meta/.
// usage: node scripts/make-panel-pop.mjs
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { png } from "./png.mjs";
import { Canvas, strip } from "./lib/canvas.mjs";
import { PANELS, GARBAGE, CHARS, CHAR_IDS, LOGOS, LOGO_LETTERS, CURSOR, SPARK, ICONS, FONTS, PANEL_STATES, GARBAGE_PIECES, SKY_LOOKS, skyTileset, UI_BLOCKS, uiTileset } from "./panel-pop/art.mjs";
import { SFX, allMusic } from "./panel-pop/audio.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "carts", "panel-pop");
for (const d of ["sprites", "tilesets", "sfx", "music"]) mkdirSync(join(dir, d), { recursive: true });
for (const sub of ["sprites", "tilesets", "sfx", "music"]) for (const f of readdirSync(join(dir, sub))) rmSync(join(dir, sub, f));

const json = (path, v) => writeFileSync(join(dir, path), JSON.stringify(v, null, 1) + "\n");
const art = {};
const sprites = [];

function sprite(name, def, extra = {}) {
  const w = def.w || 16, h = def.h || 16, frames = def.frames || 1, fr = [];
  for (let f = 0; f < frames; f++) { const c = new Canvas(w, h); def.draw(c, f); fr.push(c); }
  const s = strip(fr);
  writeFileSync(join(dir, "sprites", name + ".png"), png(s.w, s.h, s.rgba()));
  json(`sprites/${name}.json`, { image: `sprites/${name}.png`, frames, origin: [w >> 1, h >> 1], mask: null, fps: def.fps ?? 0, ...extra });
  sprites.push(name); art[name] = { f: frames, w, h };
}
// the cast first: the cart art (scripts/make-cart-art.mjs) puts a project's first sprites on the box
const charSprite = (c) => sprite("spr_char_" + c.id, c, { animations: { idle: { from: 0, to: 1, fps: 2, loop: true } } });
for (const c of CHARS) charSprite(c);
sprite("spr_panels", PANELS);
sprite("spr_garbage", GARBAGE);
sprite("spr_logo", LOGOS);
sprite("spr_cursor", CURSOR);
sprite("spr_spark", SPARK);
for (const i of ICONS) sprite("spr_ico_" + i.id, i);
// fonts are drawn from their top-left corner, like the built-in one
for (const f of FONTS) sprite(f.id, f, { origin: [0, 0] });

const tilesets = [];
function tileset(name, c, tile) {
  writeFileSync(join(dir, "tilesets", name + ".png"), png(c.w, c.h, c.rgba()));
  json(`tilesets/${name}.json`, { image: `tilesets/${name}.png`, tile_w: tile, tile_h: tile });
  tilesets.push(name);
}
tileset("ts_sky", skyTileset(), 16);
tileset("ts_ui", uiTileset(), 8);

for (const [n, d] of Object.entries(SFX)) json(`sfx/${n}.json`, d);
const music = allMusic();
for (const [n, d] of Object.entries(music)) json(`music/${n}.json`, d);

const lua = ["-- Written by scripts/make-panel-pop.mjs: sprite sizes and where things are in the tilesets.", "local M = {}", "M.ART = {"];
for (const [k, v] of Object.entries(art)) lua.push(`  ${k} = { f = ${v.f}, w = ${v.w}, h = ${v.h} },`);
lua.push("}",
  `M.PANEL_STATES = ${PANEL_STATES}`, `M.GARBAGE_PIECES = ${GARBAGE_PIECES}`, "M.CHAR_IDS = {" + CHAR_IDS.map((c) => `"${c}"`).join(", ") + "}", "M.CHAR_SPRITES = {" + CHAR_IDS.map((c) => `"spr_char_${c}"`).join(", ") + "}",
  `M.LOGO_LETTERS = "${LOGO_LETTERS}"`,
  "-- ts_sky: backgrounds of 4x4 tiles, four across", "M.SKIES = {" + SKY_LOOKS.map((l) => `"${l.name}"`).join(", ") + "}",
  "-- ts_ui: 3x3 blocks of 8x8 tiles for panels, four across", "M.UI = {" + UI_BLOCKS.map((b, i) => `${b.name} = ${Math.floor(i / 4) * 36 + (i % 4) * 3}`).join(", ") + "}",
  "M.SFX_NAMES = {" + Object.keys(SFX).map((n) => `"${n}"`).join(", ") + "}", "M.MUSIC_NAMES = {" + Object.keys(music).map((n) => `"${n}"`).join(", ") + "}", "return M", "");
writeFileSync(join(dir, "lib", "art.lua"), lua.join("\n"));

console.log(`panel-pop: ${sprites.length} sprites, ${tilesets.length} tilesets, ${Object.keys(SFX).length} sound effects, ${Object.keys(music).length} songs`);
