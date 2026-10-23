// Generates the art and the test room of carts/derelict: sprites, the station tileset, scenes/station.layout.lua and lib/art.lua
// (the hero's frame numbers and tile numbers). Sound effects are copied from Void Swarm for now. The game's code (game.lua, entities/,
// scenes/station.lua, the rest of lib/, meta/) is hand-written and NOT touched here.
// usage: node scripts/make-derelict.mjs
import { mkdirSync, writeFileSync, rmSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { png } from "./png.mjs";
import { Canvas, strip } from "./lib/canvas.mjs";
import * as A from "./derelict/art.mjs";
import { buildLevel, solidLayer, backLayer, COLS, ROWS, T } from "./derelict/level.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "carts", "derelict");
for (const d of ["sprites", "tilesets", "sfx", "scenes", "lib"]) mkdirSync(join(dir, d), { recursive: true });
for (const sub of ["sprites", "tilesets", "sfx"]) for (const f of readdirSync(join(dir, sub))) rmSync(join(dir, sub, f));

const json = (path, v) => writeFileSync(join(dir, path), JSON.stringify(v, null, 1) + "\n");
function sprite(name, def, origin) {
  const fr = [];
  for (let f = 0; f < def.frames; f++) { const c = new Canvas(def.w, def.h); def.draw(c, f); fr.push(c); }
  const s = strip(fr);
  writeFileSync(join(dir, "sprites", name + ".png"), png(s.w, s.h, s.rgba()));
  json(`sprites/${name}.json`, { image: `sprites/${name}.png`, frames: def.frames, origin, mask: null, fps: 0 });
}
sprite("spr_hero", A.SPR_HERO, [16, 32]);
sprite("spr_upgrade", A.SPR_UPGRADE, [8, 8]);
sprite("spr_drone", A.SPR_DRONE, [12, 12]);
sprite("spr_terminal", A.SPR_TERMINAL, [12, 32]);
sprite("spr_shot", A.SPR_SHOT, [4, 4]);

const ts = A.stationTileset();
writeFileSync(join(dir, "tilesets", "ts_station.png"), png(ts.w, ts.h, ts.rgba()));
json("tilesets/ts_station.json", { image: "tilesets/ts_station.png", tile_w: 16, tile_h: 16 });

// placeholder sounds until the game gets its own
const SFX = { sfx_shoot: "sfx_shoot", sfx_charge: "sfx_lance", sfx_missile: "sfx_missile", sfx_dash: "sfx_dash", sfx_hit: "sfx_hit",
  sfx_boom: "sfx_explode", sfx_upgrade: "sfx_unlock", sfx_terminal: "sfx_heal", sfx_empty: "sfx_error", sfx_switch: "sfx_move" };
for (const [to, from] of Object.entries(SFX)) copyFileSync(join(root, "carts", "void-swarm", "sfx", from + ".json"), join(dir, "sfx", to + ".json"));

// the room
const { grid, entities } = buildLevel();
const rows = (data) => data.map((r) => "      { " + r.join(", ") + " },").join("\n");
const lua = (v) => typeof v === "string" ? JSON.stringify(v) : String(v);
const ent = (e) => {
  const props = e.props ? ", { " + Object.entries(e.props).map(([k, v]) => `${k} = ${lua(v)}`).join(", ") + " }" : "";
  return `    { "${e.kind}", ${e.x}, ${e.y}${props}${e.name ? `, name = "${e.name}"` : ""} },`;
};
writeFileSync(join(dir, "scenes", "station.layout.lua"), [
  "-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.",
  "-- Written by scripts/make-derelict.mjs. The \"solid\" layer is what the hero stands on (lib/tiles.lua); \"back\" is only the wall behind.",
  "return {",
  `  width = ${COLS * T}, height = ${ROWS * T}, background = "#000000",`,
  "  layers = {",
  `    { name = "back", tileset = "ts_station", depth = 200, data = {\n${rows(backLayer())}\n    } },`,
  `    { name = "solid", tileset = "ts_station", depth = 100, data = {\n${rows(solidLayer(grid))}\n    } },`,
  "  },",
  "  entities = {",
  ...entities.map(ent),
  "  },",
  "}",
  "",
].join("\n"));

writeFileSync(join(dir, "lib", "art.lua"), [
  "-- Written by scripts/make-derelict.mjs: the hero's frames in spr_hero, the upgrade capsules' frames, ts_station tiles.",
  "local M = {}",
  "M.HERO_DY = { " + A.HERO_DY.join(", ") + " }   -- how far each frame's body sits lower than standing (index frame + 1)",
  "M.HERO = { " + Object.entries(A.HERO_FRAMES).map(([k, v]) => `${k} = ${v}`).join(", ") + " }",
  "M.UPGRADES = { " + A.UPGRADES.map((id) => JSON.stringify(id)).join(", ") + " }",
  "M.TILE = { " + Object.entries(A.TILE).map(([k, v]) => `${k} = ${v}`).join(", ") + " }",
  "return M",
  "",
].join("\n"));

console.log(`derelict: 5 sprites, 1 tileset, ${Object.keys(SFX).length} sound effects, a ${COLS}x${ROWS} test room`);
