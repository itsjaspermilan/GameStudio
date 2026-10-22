// Generates the art and sound of carts/panel-pop: sprites, backgrounds, sound effects and songs, and lib/art.lua (the sizes of every sprite). The game's rules
// are hand-written Lua in carts/panel-pop/lib/ and are NOT touched here, nor are game.lua, scenes/ and meta/.
// usage: node scripts/make-panel-pop.mjs
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { png } from "./png.mjs";
import { Canvas, strip, PAL, R } from "./lib/canvas.mjs";
import { PANELS, GARBAGE, CHARS, PILLS, VIRUSES, BIG_VIRUSES, DOC, ICONS, bgTile, PANEL_STATES, GARBAGE_PIECES } from "./panel-pop/art.mjs";
import { SFX, allMusic } from "./panel-pop/audio.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "carts", "panel-pop");
for (const d of ["sprites", "tilesets", "sfx", "music", "scripts"]) mkdirSync(join(dir, d), { recursive: true });
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
charSprite(CHARS[0]);
sprite("spr_doc", DOC);
for (const c of CHARS.slice(1)) charSprite(c);
sprite("spr_bigvirus", BIG_VIRUSES);
sprite("spr_panels", PANELS);
sprite("spr_garbage", GARBAGE);
sprite("spr_pills", PILLS);
sprite("spr_viruses", VIRUSES);
for (const i of ICONS) sprite("spr_ico_" + i.id, i);

const tilesets = [];
const HUES = [R.blue, R.purple, R.teal, R.green, R.red, R.orange, R.yellow, R.blue];
HUES.forEach((h, i) => {
  const c = bgTile(h, i), name = "ts_bg" + i;
  writeFileSync(join(dir, "tilesets", name + ".png"), png(c.w, c.h, c.rgba()));
  json(`tilesets/${name}.json`, { image: `tilesets/${name}.png`, tile_w: 16, tile_h: 16 });
  tilesets.push(name);
});

for (const [n, d] of Object.entries(SFX)) json(`sfx/${n}.json`, d);
const music = allMusic();
for (const [n, d] of Object.entries(music)) json(`music/${n}.json`, d);

const lua = ["-- Written by scripts/make-panel-pop.mjs: frame counts and sizes of every sprite, and the palette.", "local M = {}", "M.ART = {"];
for (const [k, v] of Object.entries(art)) lua.push(`  ${k} = { f = ${v.f}, w = ${v.w}, h = ${v.h} },`);
lua.push("}", "M.PAL = {" + PAL.map((h) => `{${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}}`).join(", ") + "}",
  `M.PANEL_STATES = ${PANEL_STATES}`, `M.GARBAGE_PIECES = ${GARBAGE_PIECES}`, "M.CHAR_IDS = {" + CHARS.map((c) => `"${c.id}"`).join(", ") + "}", "M.BG_COUNT = " + HUES.length,
  "M.SFX_NAMES = {" + Object.keys(SFX).map((n) => `"${n}"`).join(", ") + "}", "M.MUSIC_NAMES = {" + Object.keys(music).map((n) => `"${n}"`).join(", ") + "}", "return M", "");
writeFileSync(join(dir, "lib", "art.lua"), lua.join("\n"));

console.log(`panel-pop: ${sprites.length} sprites, ${tilesets.length} tilesets, ${Object.keys(SFX).length} sound effects, ${Object.keys(music).length} songs`);
