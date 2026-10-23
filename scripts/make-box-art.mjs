// Box art and previews for the sample games (meta/box_art.png and meta/screenshot.png), drawn by the runtime with each game's own sprites
// in the cover layout of scripts/lib/cover.mjs. A new game gets a plain cover from scripts/make-cart-art.mjs instead.
// usage: node scripts/make-box-art.mjs [panel-pop] [void-swarm]      (needs build/gs; with no names it makes both)
import { makeCover, makePreview } from "./lib/cover.mjs";

const COVERS = {
  "panel-pop": {
    title: "Panel Pop", accent: "#f5d94a",
    // the pastel sky, a stack of panels popping along the bottom, Pip in the middle and two rivals
    scene: `
  local sky = gs.image("tilesets/ts_sky.png")
  for y = 0, H, 64 do for x = 0, W, 64 do gs.tile(sky, 0, 0, 64, 64, x, y) end end
  local P = gs.image("sprites/spr_panels.png")
  local function panel(c, state, x, y) gs.tile(P, (c * 6 + state) * 16, 0, 16, 16, x, y) end
  for i, c in ipairs({ 0, 3, 1, 4, 2, 5, 0, 3 }) do panel(c, 0, (i - 1) * 16 - 4, 108) end
  for i, c in ipairs({ 2, 2, 2, 5, 1, 4, 3, 0 }) do panel(c, i <= 3 and 3 or 0, (i - 1) * 16 - 4, 92) end
  for _, s in ipairs({ { 1, 6, 22 }, { 4, 98, 18 }, { 2, 100, 64 }, { 5, 4, 66 } }) do panel(s[1], 0, s[2], s[3]) end
  gs.draw.sprite("spr_spark", 22, 90, { frame = 0 }); gs.draw.sprite("spr_spark", 38, 88, { frame = 1 })
  gs.draw.sprite("spr_char_kit", 18, 50, { frame = 0 })
  gs.draw.sprite("spr_char_bloop", 103, 46, { frame = 1, flip = true })
  gs.draw.sprite("spr_char_pip", 60, 58, { frame = 2, scale = 2 })
`,
  },
  "void-swarm": {
    title: "Void Swarm", accent: "#7aeede",
    // deep space with a ringed planet, Nova in the middle of a swarm, shots flying out
    scene: `
  local bg = gs.image("tilesets/ts_bg_belt.png")
  gs.tile(bg, 40, 30, W, H, 0, 0)
  gs.draw.sprite("spr_planet_a", 104, 34, { scale = 1 })
  for _, e in ipairs({ { "spr_e_saucer", 18, 34 }, { "spr_e_imp", 102, 96 }, { "spr_e_jelly", 16, 104 }, { "spr_e_gnat", 88, 70 }, { "spr_e_spore", 22, 70 }, { "spr_e_gnat", 62, 26 } }) do
    gs.draw.sprite(e[1], e[2], e[3], { frame = 0 })
  end
  for _, s in ipairs({ { 38, 80, -30 }, { 76, 62, 20 }, { 70, 92, 60 } }) do gs.draw.sprite("spr_p_bolt", s[1], s[2], { angle = s[3] }) end
  gs.draw.sprite("spr_fx_spark", 92, 70, { frame = 1, blend = "add" })
  gs.draw.sprite("spr_pilot_nova", 56, 80, { frame = 3, scale = 2 })
`,
  },
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(COVERS);
for (const name of names) {
  const c = COVERS[name];
  if (!c) { console.error(`no cover for ${name} (${Object.keys(COVERS).join(", ")})`); process.exit(2); }
  const dir = `carts/${name}`;
  const cover = makeCover(dir, c);
  const shot = makePreview(dir, 120, name === "void-swarm" ? { GS_SCREEN: "play", GS_BOT: "1", GS_STAGE: "1", GS_T0: "45" } : { GS_MODE: "endless", GS_BOT: "1" });
  console.log(`wrote ${dir}/meta/box_art.png (${cover.w}x${cover.h}) and screenshot.png (${shot.w}x${shot.h})`);
}
