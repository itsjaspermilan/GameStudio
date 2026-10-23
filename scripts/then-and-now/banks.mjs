// Then & Now's colour banks (the game's palette.json), GBA style: each tileset and each group of sprites has a bank of 15 colours.
// Tile banks are three ramps of five shades each (places 1-5, 6-10, 11-15, dark to light); the art in tiles.mjs draws with those places.
import { ramp, quantize } from "../../studio/src/palette-core.js";


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

// ---------- sprite banks ----------
// Sprites are drawn with the classic palette's places as MATERIALS (the jacket in 10, the hair in 29, ...) and shaded by shade.mjs:
// each material gets a slice of a ramp in its group's bank (dark to light) or one fixed place. A group's 15 colours are ramps shared
// between materials (Wren's warm ramp is her boots, jacket and skin at different heights), the way a GBA sprite fits 15 colours.
//   colors: the bank, places 1-15 in order        dark: the darkest place (outlines on the shadow side)
//   alias: places that are only a hand-drawn light or dark of another (the shader does the light now)
//   mats: place -> [bank places, dark to light] (shaded) or a bank place (flat)   outline: material -> its coloured outline
//   outlineFrom: places the drawing used for its outline     shade: false for tiny sprites (flat colours, no shading)
//   sprites: { name: overrides of alias / mats / outlineFrom for that sprite }
const hex = (list) => list.map((h) => quantize(h));
export const SPRITE_GROUPS = {
  // Wren: outline; warm (boots, jacket, skin); the red scarf; violet (hair, trousers); steel and the goggles' teal
  wren: {
    colors: hex(["#1a1024", "#4a2428", "#8e3e2a", "#d8702e", "#f4a878", "#fde4c8", "#6a1a34", "#c8323c", "#2e1e52", "#5a3a9a", "#9068d0", "#c8a8f0", "#3c4a66", "#40d0d0", "#f4f4e8"]),
    dark: 1, outlineFrom: [0],
    alias: { 3: 2, 5: 6, 9: 10, 11: 10, 18: 17, 28: 29, 30: 29 },
    mats: { 0: 1, 1: 13, 2: [9, 13, 15], 6: [7, 8, 4], 7: [4, 5, 6], 8: [1, 2, 3], 10: [2, 3, 4, 5], 13: 6, 14: 14, 17: [1, 9, 10], 21: [13, 14], 22: 14, 23: 15, 29: [9, 10, 11, 12] },
    outline: { 10: 2, 7: 3, 29: 9, 8: 1, 6: 7, 17: 1, 2: 1 },
    sprites: { spr_jacket: { alias: { 2: 1, 5: 6, 9: 10 }, mats: { 1: [9, 13], 3: 15, 8: 2 } } },
    members: ["spr_hero", "spr_jacket", "spr_por_wren"],
  },
  // the echoes are memories, all in teal (six shades); the Hollow is a shadow in violet with glowing eyes
  echo: {
    colors: hex(["#0a1a20", "#10343e", "#1a5a64", "#23868c", "#3cb6b0", "#74dcd0", "#c0f4ea", "#1c1030", "#3a2458", "#5c3c84", "#8a64b4", "#e8fff4", "#0a1a20", "#0a1a20", "#0a1a20"]).slice(0, 12),
    dark: 1, outlineFrom: [20, 29],
    alias: {},
    mats: { 0: 1, 20: [2, 3], 21: [3, 4, 5], 22: [4, 5, 6], 23: 7, 28: [8, 9, 10, 11], 29: 8 },
    outline: { 21: 2, 22: 3, 28: 8, 20: 1 },
    sprites: { spr_hollow: { mats: { 23: 12 } } },
    members: ["spr_ossie", "spr_por_ossie", "spr_echo_pilot", "spr_hollow"],
  },
  // terminals and consoles: steel casings, teal screens, amber lights, a green button
  consoles: {
    colors: hex(["#12141e", "#262a3c", "#40465e", "#646c86", "#949cb2", "#d0d6e2", "#0e3440", "#16707a", "#30b8b0", "#a0f0e0", "#8a5a1c", "#e0a038", "#fbe08a", "#2a8a44", "#7ae070"]),
    dark: 1, outlineFrom: [0],
    alias: { 3: 2 },
    mats: { 0: 1, 1: [2, 3, 4], 2: [3, 4, 5, 6], 6: 11, 13: 11, 14: 12, 15: 13, 18: 14, 19: 15, 20: 7, 21: 8, 22: 9, 23: 10 },
    outline: { 1: 2, 2: 2, 21: 7, 22: 7 },
    sprites: { spr_launch: { outlineFrom: [20], mats: { 20: [7, 8], 21: [7, 8, 9], 22: [8, 9, 10] } } },
    members: ["spr_terminal", "spr_console", "spr_launch"],
  },
  // doors and the lift: steel frames, blue panels, red and amber lamps
  doors: {
    colors: hex(["#10121c", "#242838", "#3c4258", "#5c647e", "#8a92aa", "#c4cad8", "#142450", "#20408a", "#3466c0", "#5c94e8", "#a8ccf8", "#6a1828", "#d0383c", "#e0a040", "#f4f0e0"]),
    dark: 1, outlineFrom: [],
    alias: { 2: 1, 25: 24, 26: 24 },
    mats: { 0: 1, 1: [2, 3, 4, 5], 24: [7, 8, 9, 10], 27: [5, 6], 4: 12, 6: 13 },
    outline: {},
    members: ["spr_door", "spr_lift"],
  },
  // Wren's ship (warm, rusted in Now) and the shuttle (white with blue in Then, burnt in Now)
  ships: {
    colors: hex(["#12101a", "#3e2826", "#74402c", "#b06a36", "#e2a056", "#f6d494", "#3a4058", "#6a7290", "#a4acc4", "#e8ecf2", "#8a2430", "#e04a3a", "#1c6a78", "#3cc0c0", "#b0f4ec"]),
    dark: 1, outlineFrom: [0],
    alias: {},
    mats: { 0: 1, 1: [7, 8], 2: [7, 8, 9], 3: [8, 9, 10], 8: [2, 3], 9: [3, 4, 5], 10: [4, 5, 6], 11: [5, 6], 4: 11, 5: 11, 6: 12, 14: 6, 21: [13, 14], 22: 14, 23: 15, 25: [13, 14] },
    outline: { 9: 2, 10: 3, 2: 7, 3: 7, 1: 1 },
    members: ["spr_ship", "spr_shuttle"],
  },
  // the loader drone (orange, hazard yellow) and the turret (a red eye-ball)
  enemies: {
    colors: hex(["#160e14", "#2e3040", "#585c74", "#9aa0b6", "#5a2a1c", "#a04e22", "#e08a30", "#f8c46a", "#5a1428", "#b02c38", "#ee6a50", "#a8801c", "#f0d040", "#fff0c0", "#f4b4a0"]),
    dark: 1, outlineFrom: [0],
    alias: { 3: 2, 8: 9, 10: 9, 4: 5, 6: 5, 7: 5 },
    mats: { 0: 1, 1: [2, 3], 2: [2, 3, 4], 9: [5, 6, 7, 8], 12: [12, 13], 13: 13, 14: 14, 15: 14, 5: [9, 10, 11, 15] },
    outline: { 9: 5, 5: 9, 2: 2, 1: 1 },
    members: ["spr_loader", "spr_turret"],
  },
  // shots and pickups: too small to shade, flat colours
  fx: {
    colors: hex(["#16121f", "#3a4058", "#8a92aa", "#f4f2e4", "#6a1830", "#d03a40", "#f08070", "#f8b8a0", "#e08a30", "#c09030", "#f0d850", "#fbf2b8", "#1f8494", "#4ccfc4", "#b2f2e6"]),
    shade: false,
    mats: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 10: 9, 13: 10, 14: 11, 15: 12, 21: 13, 22: 14, 23: 15 },
    members: ["spr_shot", "spr_eshot", "spr_pickup"],
  },
  // Tender: a ring of amber light
  tender: {
    colors: hex(["#100c08", "#f4f0e0", "#8a4a1c", "#c07a2a", "#6a5a20", "#c09a30", "#f0d058", "#fbf2b8"]),
    shade: false,
    mats: { 0: 1, 3: 2, 10: 3, 11: 4, 12: 5, 13: 6, 14: 7, 15: 8 },
    members: ["spr_por_tender"],
  },
};
export const groupOf = (sprite) => Object.keys(SPRITE_GROUPS).find((g) => SPRITE_GROUPS[g].members.includes(sprite));

// The shading spec of one sprite: its group's, with the sprite's own overrides.
export function spriteSpec(name) {
  const g = SPRITE_GROUPS[groupOf(name)], own = (g.sprites || {})[name] || {};
  return { shade: g.shade !== false, dark: g.dark, outlineFrom: own.outlineFrom || g.outlineFrom || [], alias: { ...(g.alias || {}), ...(own.alias || {}) },
    mats: { ...g.mats, ...(own.mats || {}) }, outline: { ...(g.outline || {}), ...(own.outline || {}) } };
}
// A Canvas palette for a group's bank: place 0 see-through, places 1-15 its colours.
export const bankPal = (group) => [null, ...SPRITE_GROUPS[group].colors];

// palette.json: the tile banks and the sprite banks.
export function paletteJson() {
  const sprites = Object.entries(SPRITE_GROUPS).map(([name, g]) => {
    if (g.colors.length > 15) throw new Error(`sprite bank ${name} has ${g.colors.length} colours`);
    return { name, colors: g.colors };
  });
  const tiles = Object.entries(TILE_BANKS).map(([name, colors]) => ({ name, colors }));
  return { sprites, tiles };
}
