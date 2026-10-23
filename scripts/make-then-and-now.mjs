// Generates the art, sound and rooms of carts/then-and-now: sprites, tilesets, sound effects, songs, scenes/rooms/*.layout.lua,
// lib/world.lua (the map: rooms, doors, seals) and lib/art.lua (frame and tile numbers). The game's code (game.lua, entities/,
// scenes/*.lua, the rest of lib/, meta/) is hand-written and NOT touched here.
// usage: node scripts/make-then-and-now.mjs
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { png } from "./png.mjs";
import { Canvas, strip } from "./lib/canvas.mjs";
import * as A from "./then-and-now/art.mjs";
import * as SP from "./then-and-now/sprites.mjs";
import * as PE from "./then-and-now/people.mjs";
import { tileset, lightset, TILE } from "./then-and-now/tiles.mjs";
import { TILE_BANKS, TILESET_BANK, groupOf, spritePal, paletteJson } from "./then-and-now/banks.mjs";
import { buildRoom, layoutLua, worldLua } from "./then-and-now/rooms.mjs";
import { ROOMS as HANGAR } from "./then-and-now/hangar.mjs";
import { SFX, allMusic } from "./then-and-now/audio.mjs";
import { tidyLua } from "../studio/src/search-core.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "carts", "then-and-now");
for (const d of ["sprites", "tilesets", "sfx", "music", "scenes/rooms", "lib"]) mkdirSync(join(dir, d), { recursive: true });
for (const sub of ["sprites", "tilesets", "sfx", "music", "scenes/rooms"]) for (const f of readdirSync(join(dir, sub))) rmSync(join(dir, sub, f));

const json = (path, v) => writeFileSync(join(dir, path), JSON.stringify(v, null, 1) + "\n");
// The Lua it writes goes through the studio's Tidy, so the files are already formatted (a test checks every cart is) and
// opening one in the studio and pressing Tidy changes nothing.
const lua = (path, text) => writeFileSync(join(dir, path), tidyLua(text));
let sprites = 0;
const used = {}; // colour bank -> the classic places its sprites draw with (for palette.json)
// Every sprite belongs to a group with a colour bank (banks.mjs): it is drawn with the classic places and recoloured with the group's
// tuned colours, and its JSON names the bank.
function sprite(name, def, origin) {
  const fr = [], group = groupOf(name);
  if (!group) throw new Error(`${name} is in no sprite group (banks.mjs SPRITE_GROUPS)`);
  used[group] = used[group] || new Set();
  for (let f = 0; f < def.frames; f++) { const c = new Canvas(def.w, def.h); def.draw(c, f); fr.push(c); for (const v of c.d) if (v >= 0) used[group].add(v); }
  const s = strip(fr);
  writeFileSync(join(dir, "sprites", name + ".png"), png(s.w, s.h, s.rgba(spritePal(group))));
  json(`sprites/${name}.json`, { image: `sprites/${name}.png`, frames: def.frames, origin, mask: null, fps: 0, bank: group });
  sprites++;
}
// the hero first: the cart art puts a project's first sprites on the box
sprite("spr_hero", A.SPR_HERO, [16, 32]);
sprite("spr_shot", A.SPR_SHOT, [4, 4]);
sprite("spr_eshot", SP.SPR_ESHOT, [4, 4]);
sprite("spr_loader", SP.SPR_LOADER, [12, 24]);
sprite("spr_turret", SP.SPR_TURRET, [8, 8]);
sprite("spr_echo_pilot", SP.SPR_ECHO_PILOT, [12, 32]);
sprite("spr_hollow", SP.SPR_HOLLOW, [16, 16]);
sprite("spr_shuttle", SP.SPR_SHUTTLE, [32, 20]);
sprite("spr_door", SP.SPR_DOOR, [0, 48]);
sprite("spr_terminal", SP.SPR_TERMINAL, [12, 32]);
sprite("spr_console", SP.SPR_CONSOLE, [12, 32]);
sprite("spr_launch", SP.SPR_LAUNCH, [12, 32]);
sprite("spr_pickup", SP.SPR_PICKUP, [8, 8]);
sprite("spr_jacket", SP.SPR_JACKET, [16, 16]);
sprite("spr_ship", SP.SPR_SHIP, [32, 48]);
sprite("spr_lift", SP.SPR_LIFT, [16, 48]);
sprite("spr_ossie", PE.SPR_OSSIE, [16, 32]);
sprite("spr_por_wren", PE.SPR_POR_WREN, [0, 0]);
sprite("spr_por_tender", PE.SPR_POR_TENDER, [0, 0]);
sprite("spr_por_ossie", PE.SPR_POR_OSSIE, [0, 0]);

// tilesets: each in one tile bank (place 0 is see-through, so the bank's colours are places 1 to 15)
const TILESETS = ["hangar_now", "hangar_then", "hangar_light_now", "hangar_light_then"];
for (const name of TILESETS) {
  const ts = name.includes("light") ? lightset() : tileset(name), bank = TILESET_BANK[name];
  writeFileSync(join(dir, "tilesets", `ts_${name}.png`), png(ts.w, ts.h, ts.rgba([null, ...TILE_BANKS[bank]])));
  json(`tilesets/ts_${name}.json`, { image: `tilesets/ts_${name}.png`, tile_w: 16, tile_h: 16, banks: [bank] });
}
writeFileSync(join(dir, "palette.json"), JSON.stringify(paletteJson(used), null, 2) + "\n");

for (const [n, d] of Object.entries(SFX)) json(`sfx/${n}.json`, d);
const music = allMusic();
for (const [n, d] of Object.entries(music)) json(`music/${n}.json`, d);

// rooms
const rooms = [...HANGAR.map((r) => ({ ...r, file: "hangar" }))];
const world = [];
const ids = new Set(rooms.map((r) => r.id));
for (const def of rooms) {
  const built = buildRoom(def);
  for (const [id, d] of Object.entries(built.doors)) {
    if (!ids.has(d.to)) throw new Error(`${def.id}.${id} leads to unknown room ${d.to}`);
    const other = rooms.find((r) => r.id === d.to);
    const back = other.doors?.[d.at];
    if (!back || back[0] !== def.id || back[1] !== id) throw new Error(`${def.id}.${id} -> ${d.to}.${d.at} does not lead back`);
  }
  lua(`scenes/rooms/${def.id}.layout.lua`, layoutLua(def, built));
  world.push(worldLua(def, built));
}
lua("lib/world.lua", [
  "-- Written by scripts/make-then-and-now.mjs: every room (its map place in screens, doors, seals, music) and the biomes.",
  "local M = {}",
  "M.rooms = {",
  ...world,
  "}",
  "M.biomes = {",
  '  hangar = { name = "HANGAR RING", color = "#4f9bf0" },',
  "}",
  "return M",
  "",
].join("\n"));

lua("lib/art.lua", [
  "-- Written by scripts/make-then-and-now.mjs: Wren's frames in spr_hero (with each frame's body bob) and tile numbers.",
  "local M = {}",
  "M.HERO_DY = { " + A.HERO_DY.join(", ") + " }   -- how far each frame's body sits lower than standing (index frame + 1)",
  "M.HERO = { " + Object.entries(A.HERO_FRAMES).map(([k, v]) => `${k} = ${v}`).join(", ") + " }",
  "M.TILE = { " + Object.entries(TILE).map(([k, v]) => `${k} = ${v}`).join(", ") + " }",
  "return M",
  "",
].join("\n"));

console.log(`then-and-now: ${sprites} sprites, ${TILESETS.length} tilesets, ${Object.keys(SFX).length} sound effects, ${Object.keys(music).length} songs, ${rooms.length} rooms`);
