// Then & Now's colour banks (the game's palette.json), GBA style: each tileset and each group of sprites has a bank of 15 colours.
// Tile banks are three ramps of five shades each (places 1-5, 6-10, 11-15, dark to light); the art in tiles.mjs draws with those places.
// Sprites are still drawn with the classic palette's places (lib/canvas.mjs PAL) and are recoloured on the way out: TUNED is the
// classic palette made softer and hue-shifted (shadows cool, highlights warm, no pure black or white), and each group of sprites gets the
// tuned colours of the places it uses, merged where a group would need more than 15.
import { ramp, quantize } from "../../studio/src/palette-core.js";

const q = (list) => list.map((h) => quantize(h));

// ---------- tile banks ----------
// hull: the station's plating. steel (walls, pipes, frames), back (the wall panels behind), accent (Now: rust and amber warning paint;
// Then: warm paint and lamp light).
export const TILE_BANKS = {
  hull_now: [...ramp(222, 0.16, { lo: 0.09, hi: 0.6 }), ...ramp(232, 0.32, { lo: 0.04, hi: 0.3, shift: 8 }), ...ramp(26, 0.62, { lo: 0.12, hi: 0.72 })],
  hull_then: [...ramp(214, 0.2, { lo: 0.22, hi: 0.86 }), ...ramp(216, 0.42, { lo: 0.16, hi: 0.58 }), ...ramp(40, 0.7, { lo: 0.34, hi: 0.9 })],
  // light: added on top of the room (blend "add"), so these are dim: black would add nothing. lamp (places 1-5), window and sky (6-10),
  // screens (11-15).
  light_now: [...ramp(30, 0.85, { lo: 0.05, hi: 0.36, shift: 6 }), ...ramp(212, 0.55, { lo: 0.03, hi: 0.22, shift: 6 }), ...ramp(175, 0.6, { lo: 0.03, hi: 0.25, shift: 6 })],
  light_then: [...ramp(44, 0.7, { lo: 0.06, hi: 0.46, shift: 6 }), ...ramp(205, 0.6, { lo: 0.05, hi: 0.32, shift: 6 }), ...ramp(170, 0.6, { lo: 0.04, hi: 0.3, shift: 6 })],
};
export const TILESET_BANK = { hangar_now: "hull_now", hangar_then: "hull_then", hangar_light_now: "light_now", hangar_light_then: "light_then" };

// ---------- the classic palette, tuned ----------
// Same order as PAL: grey 0-3, red 4-7, orange and brown 8-11, yellow 12-15, green 16-19, teal 20-23, blue 24-27, purple 28-31.
export const TUNED = q([
  "#16121f", "#3a3d5a", "#8a8ea8", "#f2efe0",
  "#4a1832", "#a52c44", "#e2604c", "#f8b494",
  "#4a2a2c", "#9a522e", "#e2903f", "#f9d48e",
  "#5e5626", "#c29c36", "#f0d758", "#faf2b4",
  "#183a32", "#2e7c4a", "#68c45a", "#c6eea0",
  "#123852", "#1f8494", "#4ccfc4", "#b2f2e6",
  "#1a2452", "#2c55b8", "#58a0ea", "#b2d8fa",
  "#2c1a4c", "#6a3fae", "#a670dc", "#dcb8fa",
]);

// ---------- sprite banks ----------
// Which sprites share a bank, and the classic places merged so a group fits 15 colours. Wren uses 21 places: the boots take the
// jacket's dark brown, the trousers become dark steel (the gun's colours), the belt and buckle the jacket's light, the goggles' white
// shine the gun's shine.
export const SPRITE_GROUPS = {
  wren: { sprites: ["spr_hero", "spr_jacket", "spr_por_wren"], merge: { 8: 9, 17: 1, 18: 2, 13: 11, 14: 11, 23: 3 } },
  echo: { sprites: ["spr_ossie", "spr_por_ossie", "spr_echo_pilot", "spr_hollow"], merge: {} },
  consoles: { sprites: ["spr_terminal", "spr_console", "spr_launch"], merge: {} },
  doors: { sprites: ["spr_door", "spr_lift"], merge: {} },
  ships: { sprites: ["spr_ship", "spr_shuttle"], merge: { 4: 5 } },
  enemies: { sprites: ["spr_loader", "spr_turret"], merge: {} },
  fx: { sprites: ["spr_shot", "spr_eshot", "spr_pickup"], merge: { 8: 10 } },
  tender: { sprites: ["spr_por_tender"], merge: {} },
};
export const groupOf = (sprite) => Object.keys(SPRITE_GROUPS).find((g) => SPRITE_GROUPS[g].sprites.includes(sprite));

// The palette a sprite of a group is drawn with: classic place -> its tuned colour after the group's merges (a Canvas palette).
export function spritePal(group) {
  const m = SPRITE_GROUPS[group].merge;
  return TUNED.map((_, i) => TUNED[m[i] ?? i]);
}

// palette.json: the tile banks, and one sprite bank per group with the colours its sprites use (`used`: group -> Set of classic places),
// darkest first so place 1 is the outline.
export function paletteJson(used) {
  const light = (h) => parseInt(h.slice(1, 3), 16) * 0.3 + parseInt(h.slice(3, 5), 16) * 0.59 + parseInt(h.slice(5, 7), 16) * 0.11;
  const sprites = Object.keys(SPRITE_GROUPS).map((g) => {
    const pal = spritePal(g), colors = [...new Set([...(used[g] || [])].map((i) => pal[i]))].sort((a, b) => light(a) - light(b));
    if (colors.length > 15) throw new Error(`sprite bank ${g} needs ${colors.length} colours; merge some places`);
    return { name: g, colors };
  });
  const tiles = Object.entries(TILE_BANKS).map(([name, colors]) => ({ name, colors }));
  return { sprites, tiles };
}
