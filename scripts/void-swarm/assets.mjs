// Writes the pictures, backgrounds, sound effects and songs of Void Swarm into the game's folder (called by scripts/make-void-swarm.mjs).
// opts.mask(name, w, h) may return [x, y, w, h], the part of a sprite that counts for collisions (default: the whole picture).
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { png } from "../png.mjs";
import { Canvas, strip } from "../lib/canvas.mjs";
import { PILOTS, CLIPS as PILOT_CLIPS, PILOT_BANKS } from "./pilots.mjs";
import { ENEMIES, ENEMY_BANKS } from "./enemies.mjs";
import { BOSSES, BOSS_BANKS } from "./bosses.mjs";
import { PROJECTILES, FX, PICKUPS, ICONS, PLANETS, ITEM_BANKS } from "./items.mjs";
import { SECTORS, BACKGROUNDS, DUST_BANK, skyFar, skyMid, dustTile } from "./skies.mjs";
import { SFX, allMusic } from "./audio.mjs";
import { panelTiles } from "./panels.mjs";

export function writeAssets(dir, opts = {}) {
  for (const d of ["sprites", "tilesets", "sfx", "music"]) mkdirSync(join(dir, d), { recursive: true });
  for (const sub of ["sprites", "tilesets", "sfx", "music"]) for (const f of readdirSync(join(dir, sub))) rmSync(join(dir, sub, f));

  const json = (path, v) => writeFileSync(join(dir, path), JSON.stringify(v, null, 1) + "\n");
  // every sprite is painted in one of the console's 16 sprite banks (place 0 see-through, 15 colours each)
  const spriteBanks = { ...PILOT_BANKS, ...ENEMY_BANKS, ...BOSS_BANKS, ...ITEM_BANKS };
  if (Object.keys(spriteBanks).length > 16) throw new Error("more than 16 sprite banks");
  // and every sky in a tile bank of its own sector's (the dust, over every sky, has one too)
  const tileBanks = { ...Object.fromEntries(Object.entries(SECTORS).map(([id, s]) => ["sky_" + id, s.bank])), dust: DUST_BANK };
  if (Object.keys(tileBanks).length > 16) throw new Error("more than 16 tile banks");
  const banksOf = (m) => Object.entries(m).map(([name, b]) => ({ name, colors: b.colors }));
  json("palette.json", { sprites: banksOf(spriteBanks), tiles: banksOf(tileBanks) });
  const art = {};
  const sprites = [];

  function sprite(name, def, extra = {}) {
    const w = def.w || 16, h = def.h || 16, frames = def.frames || 1, fr = [];
    for (let f = 0; f < frames; f++) { const c = new Canvas(w, h); def.draw(c, f); fr.push(c); }
    const s = strip(fr);
    writeFileSync(join(dir, "sprites", name + ".png"), png(s.w, s.h, s.rgba(def.bank.pal)));
    json(`sprites/${name}.json`, { image: `sprites/${name}.png`, frames, origin: [w >> 1, h >> 1], mask: opts.mask ? opts.mask(name, w, h) ?? null : null, fps: def.fps ?? (frames > 1 ? 6 : 0), bank: def.bankName, ...extra });
    sprites.push(name); art[name] = { f: frames, w, h };
  }

  for (const p of PILOTS) sprite("spr_pilot_" + p.id, p, { animations: PILOT_CLIPS });
  // the boomer walks, then flickers while its fuse burns
  const boomerClips = { animations: { walk: { from: 0, to: 1, fps: 4, loop: true }, fuse: { from: 2, to: 3, fps: 16, loop: true } } };
  for (const e of ENEMIES) sprite("spr_e_" + e.id, e, e.id === "boomer" ? boomerClips : {});
  for (const b of BOSSES) sprite("spr_b_" + b.id, b, { fps: 4 });
  for (const p of PROJECTILES) sprite("spr_p_" + p.id, p);
  for (const p of FX) sprite("spr_fx_" + p.id, { ...p, fps: 12 });
  for (const p of PICKUPS) sprite("spr_pk_" + p.id, p);
  for (const p of ICONS) sprite("spr_ico_" + p.id, p);
  for (const p of PLANETS) sprite("spr_" + p.id, p);

  const tilesets = [];
  function tileset(name, c, bankName) {
    writeFileSync(join(dir, "tilesets", name + ".png"), png(c.w, c.h, c.rgba(tileBanks[bankName].pal)));
    json(`tilesets/${name}.json`, { image: `tilesets/${name}.png`, tile_w: 16, tile_h: 16, banks: [bankName] });
    tilesets.push(name);
  }
  for (const { id } of BACKGROUNDS) { tileset("ts_bg_" + id, skyFar(id), "sky_" + id); tileset("ts_mid_" + id, skyMid(id), "sky_" + id); }
  tileset("ts_dust", dustTile(), "dust");
  const panel = panelTiles();
  writeFileSync(join(dir, "tilesets", "ts_panel.png"), png(panel.w, panel.h, panel.rgba));
  json("tilesets/ts_panel.json", { image: "tilesets/ts_panel.png", tile_w: panel.tile, tile_h: panel.tile });
  tilesets.push("ts_panel");

  for (const [n, d] of Object.entries(SFX)) json(`sfx/${n}.json`, d);
  const music = allMusic();
  for (const [n, d] of Object.entries(music)) json(`music/${n}.json`, d);


  return { art, sprites, tilesets, sfx: Object.keys(SFX), music: Object.keys(music), json, PILOTS, BACKGROUNDS };
}
