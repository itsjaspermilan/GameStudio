// Writes the pictures, backgrounds, sound effects and songs of Void Swarm into the game's folder (called by scripts/make-void-swarm.mjs).
// opts.mask(name, w, h) may return [x, y, w, h], the part of a sprite that counts for collisions (default: the whole picture).
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { png } from "../png.mjs";
import { Canvas, strip } from "./canvas.mjs";
import { PILOTS, CLIPS as PILOT_CLIPS } from "./pilots.mjs";
import { ENEMIES } from "./enemies.mjs";
import { BOSSES } from "./bosses.mjs";
import { PROJECTILES, FX, PICKUPS, ICONS, PLANETS, BACKGROUNDS, backgroundTile, dustTile } from "./misc.mjs";
import { SFX, allMusic } from "./audio.mjs";

export function writeAssets(dir, opts = {}) {
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
    json(`sprites/${name}.json`, { image: `sprites/${name}.png`, frames, origin: [w >> 1, h >> 1], mask: opts.mask ? opts.mask(name, w, h) ?? null : null, fps: def.fps ?? (frames > 1 ? 6 : 0), ...extra });
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
  function tileset(name, c) {
    writeFileSync(join(dir, "tilesets", name + ".png"), png(c.w, c.h, c.rgba()));
    json(`tilesets/${name}.json`, { image: `tilesets/${name}.png`, tile_w: 16, tile_h: 16 });
    tilesets.push(name);
  }
  BACKGROUNDS.forEach((b, i) => tileset("ts_bg_" + b.id, backgroundTile(i)));
  tileset("ts_dust", dustTile());

  for (const [n, d] of Object.entries(SFX)) json(`sfx/${n}.json`, d);
  const music = allMusic();
  for (const [n, d] of Object.entries(music)) json(`music/${n}.json`, d);


  return { art, sprites, tilesets, sfx: Object.keys(SFX), music: Object.keys(music), json, PILOTS, BACKGROUNDS };
}
