// Colour banks, GBA style (pure logic, no DOM). A game on a console with `palette.mode: "banks"` keeps its colours in palette.json:
//   { "sprites": [ { "name": "hero", "colors": ["#rrggbb", ... up to 15] }, ... ], "tiles": [ ... ] }
// A bank has 16 places; place 0 is see-through, so `colors` holds places 1 to 15. A sprite names one sprite bank ({"bank": "hero"}) and uses
// only its colours. A tileset lists the tile banks it uses ({"banks": ["forest", "water"]}) and each tile keeps to one of them, like the GBA's
// per-tile palette number. Every colour is one of the console's 15-bit colours (5 bits a channel). Bank names are unique across both lists,
// so code can say "sky:3" without saying which list. A game without palette.json keeps the console's classic colours (`palette.colors`).
import { nearestRgb, snapPixels } from "./sprite-core.js";

export const PLACES = 15; // colours a bank holds (16 places, place 0 see-through)
export const BANK_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,23}$/;

// ---------- 15-bit colour ----------
const to5 = (v) => Math.round((Math.max(0, Math.min(255, v)) * 31) / 255);
const from5 = (v) => Math.round((v * 255) / 31);
const hex2 = (v) => v.toString(16).padStart(2, "0");
export const rgbToHex = (r, g, b) => "#" + hex2(r) + hex2(g) + hex2(b);
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}
// The console colour nearest to a colour: each channel rounded to 5 bits (32 levels), the GBA's 32,768 colours.
export function quantize(hex, bits = 15) {
  const c = hexToRgb(hex);
  if (!c) return "#000000";
  if (bits !== 15) return rgbToHex(...c);
  return rgbToHex(...c.map((v) => from5(to5(v))));
}
export const isConsoleColor = (hex, bits = 15) => !!hexToRgb(hex) && quantize(hex, bits) === hex.toLowerCase();

// ---------- the file ----------
export function emptyPalette() { return { sprites: [], tiles: [] }; }

// Read palette.json leniently: junk is dropped, colours lowercased, at most 15 a bank.
export function normalizePalette(raw) {
  const out = emptyPalette();
  if (!raw || typeof raw !== "object") return out;
  for (const kind of ["sprites", "tiles"]) {
    for (const b of Array.isArray(raw[kind]) ? raw[kind] : []) {
      if (!b || typeof b.name !== "string") continue;
      const colors = (Array.isArray(b.colors) ? b.colors : []).filter((c) => hexToRgb(c)).map((c) => (c.startsWith("#") ? c : "#" + c).toLowerCase()).slice(0, PLACES);
      out[kind].push({ name: b.name, colors });
    }
  }
  return out;
}

export const paletteText = (pal) => JSON.stringify(normalizePalette(pal), null, 2) + "\n";

// What the console allows: from its palette spec (Glow43 and Glow169: 16 sprite banks, 16 tile banks, 15-bit colour).
export function bankLimits(spec) {
  const p = (spec && spec.palette) || spec || {};
  return { sprites: p.sprite_banks || 16, tiles: p.tile_banks || 16, places: Math.min(PLACES, (p.bank_colors || 16) - 1), bits: p.color_bits || 15 };
}

// Problems with a palette (an empty list means it is fine), in plain words.
export function checkPalette(pal, spec) {
  const lim = bankLimits(spec), bad = [], seen = new Set();
  for (const kind of ["sprites", "tiles"]) {
    const list = pal[kind] || [], word = kind === "sprites" ? "sprite" : "tile";
    if (list.length > lim[kind]) bad.push(`${list.length} ${word} banks: this console has room for ${lim[kind]}.`);
    for (const b of list) {
      if (!BANK_NAME.test(b.name)) bad.push(`"${b.name}" is not a usable bank name (letters, digits, - and _, starting with a letter).`);
      if (seen.has(b.name)) bad.push(`Two banks are called "${b.name}": every bank needs its own name.`);
      seen.add(b.name);
      if (b.colors.length > lim.places) bad.push(`Bank ${b.name} has ${b.colors.length} colours; a bank holds ${lim.places}.`);
      const off = b.colors.filter((c) => !isConsoleColor(c, lim.bits));
      if (off.length) bad.push(`Bank ${b.name} has ${off.length} colour${off.length === 1 ? "" : "s"} the console cannot show exactly (it rounds to ${lim.bits}-bit colour).`);
    }
  }
  return bad;
}

export const findBank = (pal, name) => (pal.sprites || []).find((b) => b.name === name) || (pal.tiles || []).find((b) => b.name === name) || null;
export const bankRgb = (bank) => (bank ? bank.colors.map(hexToRgb) : []);
export const allBankNames = (pal) => [...(pal.sprites || []), ...(pal.tiles || [])].map((b) => b.name);

// A name not yet taken: "sky", "sky2", "sky3", ...
export function freeBankName(pal, base) {
  const taken = new Set(allBankNames(pal));
  const stem = (String(base || "bank").replace(/[^A-Za-z0-9_-]/g, "").replace(/^[^A-Za-z]+/, "") || "bank").slice(0, 20);
  if (!taken.has(stem)) return stem;
  for (let i = 2; ; i++) if (!taken.has(stem + i)) return stem + i;
}

// ---------- pictures and banks ----------
const key = (r, g, b) => (r << 16) | (g << 8) | b;

// The opaque colours in a rectangle of RGBA pixels (a sheet `w` wide), as a Set of 0xRRGGBB.
function colorsIn(data, w, x0, y0, tw, th) {
  const set = new Set();
  for (let y = y0; y < y0 + th; y++)
    for (let x = x0; x < x0 + tw; x++) {
      const i = (y * w + x) * 4;
      if (i + 3 < data.length && data[i + 3] > 0) set.add(key(data[i], data[i + 1], data[i + 2]));
    }
  return set;
}

// Every tile of a tileset against its banks: for each tile, the first bank that holds all its colours (its index in `banks`), or -1 when
// no single bank does (the tile mixes banks or uses other colours). Empty tiles fit bank 0. sheet: {w, h, tile: [tw, th], frames: [data]}.
export function tileBanks(sheet, banks) {
  const [tw, th] = sheet.tile, cols = Math.floor(sheet.w / tw), rows = Math.floor(sheet.h / th), data = sheet.frames[0];
  const sets = banks.map((b) => new Set(bankRgb(b).map((c) => key(...c))));
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const used = colorsIn(data, sheet.w, c * tw, r * th, tw, th);
      out.push(used.size === 0 ? 0 : sets.findIndex((s) => [...used].every((k) => s.has(k))));
    }
  return out;
}
export const tilesOutsideBanks = (sheet, banks) => tileBanks(sheet, banks).reduce((list, b, i) => (b < 0 ? [...list, i] : list), []);

// Move a tileset onto its banks: each tile goes to the bank that changes it least, then every pixel takes that bank's nearest colour.
// Returns how many pixels changed.
export function snapTilesToBanks(sheet, banks) {
  const rgbs = banks.map(bankRgb).filter((l) => l.length);
  if (!rgbs.length) return 0;
  const [tw, th] = sheet.tile, cols = Math.floor(sheet.w / tw), rows = Math.floor(sheet.h / th), data = sheet.frames[0];
  let changed = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const tile = new Uint8ClampedArray(tw * th * 4);
      for (let y = 0; y < th; y++) tile.set(data.subarray(((r * th + y) * sheet.w + c * tw) * 4, ((r * th + y) * sheet.w + c * tw + tw) * 4), y * tw * 4);
      let best = rgbs[0], bestCost = Infinity;
      for (const rgb of rgbs) {
        const cost = snapCost(tile, rgb);
        if (cost < bestCost) { bestCost = cost; best = rgb; }
      }
      const n = snapPixels(tile, best);
      if (!n) continue;
      changed += n;
      for (let y = 0; y < th; y++) data.set(tile.subarray(y * tw * 4, (y + 1) * tw * 4), ((r * th + y) * sheet.w + c * tw) * 4);
    }
  return changed;
}
function snapCost(tile, rgb) {
  let cost = 0;
  for (let i = 0; i < tile.length; i += 4) {
    if (tile[i + 3] < 128) continue;
    const p = [tile[i], tile[i + 1], tile[i + 2]], q = nearestRgb(p, rgb);
    cost += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  }
  return cost;
}

// Give pixels the colour in the same place of another bank (a sprite moved to a new bank keeps its shading). Colours not in `from`
// stay as they are. Returns how many pixels changed.
export function recolorByPlace(data, from, to) {
  const map = new Map();
  bankRgb(from).forEach((c, i) => { const t = to.colors[i] && hexToRgb(to.colors[i]); if (t && !map.has(key(...c))) map.set(key(...c), t); });
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const t = map.get(key(data[i], data[i + 1], data[i + 2]));
    if (t && (t[0] !== data[i] || t[1] !== data[i + 1] || t[2] !== data[i + 2])) { data[i] = t[0]; data[i + 1] = t[1]; data[i + 2] = t[2]; n++; }
  }
  return n;
}

// ---------- starter banks ----------
// Ready-made banks for a new game. Each is three ramps of five shades, dark to light, drawn the way GBA artists shade: shadows lean cool
// (toward blue and purple) and lose saturation, highlights lean warm (toward yellow) and get paler, and nothing is pure black or white,
// which is what makes a GBA screen look soft and rich rather than loud. Place 1 of every bank is its darkest colour, a good outline.
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return rgbToHex(Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255));
}
// Five shades of one hue. sat: how colourful the middle shade is; lo/hi: the darkest and lightest lightness; shift: degrees the hue turns
// toward cool in the shadows and warm in the highlights.
export function ramp(hue, sat, { lo = 0.14, hi = 0.8, shift = 18 } = {}) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    // hues turn toward 240 (cool) at the dark end and toward 60 (warm) at the light end, whichever way is shorter
    const toward = (target, amount) => { const d = ((target - hue + 540) % 360) - 180; return hue + Math.sign(d) * Math.min(Math.abs(d), amount); };
    const h = t < 0.5 ? toward(240, shift * (1 - t * 2)) : toward(60, shift * (t * 2 - 1));
    const s = sat * (0.8 + 0.2 * Math.sin(Math.PI * t));
    out.push(quantize(hsl(h, s, lo + (hi - lo) * t)));
  }
  return out;
}
// A ramp around a colour you picked: its hue and colourfulness, five shades from dark to light, with the same hue shifts as the starters.
export function rampFrom(hex) {
  const c = hexToRgb(hex) || [128, 128, 128];
  const [r, g, b] = c.map((v) => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return ramp(h, s, { shift: s < 0.15 ? 6 : 18 });
}

const bank = (name, ...ramps) => ({ name, colors: ramps.flat() });

// Sprite banks are made for one kind of thing each (a hero's skin, hair and clothes; a knight's steel, cloth and gold), the way a GBA
// character has a bank of its own. Tile banks are made for places.
export function starterPalette() {
  return {
    sprites: [
      bank("hero", ramp(22, 0.55, { lo: 0.16, hi: 0.88 }), ramp(40, 0.75), ramp(120, 0.5)),            // skin, blond hair, green tunic
      bank("knight", ramp(220, 0.18, { hi: 0.9 }), ramp(355, 0.62), ramp(45, 0.8, { lo: 0.2 })),       // steel, red cloth, gold
      bank("villager", ramp(18, 0.45, { lo: 0.15 }), ramp(28, 0.4, { lo: 0.1, hi: 0.7 }), ramp(205, 0.45)), // skin, brown hair, blue clothes
      bank("slime", ramp(105, 0.6), ramp(280, 0.45), ramp(50, 0.35, { lo: 0.3, hi: 0.95 })),          // green, purple, cream
      bank("fire", ramp(0, 0.8, { lo: 0.15, hi: 0.6 }), ramp(22, 0.9, { lo: 0.3, hi: 0.75 }), ramp(48, 0.95, { lo: 0.45, hi: 0.95 })),
      bank("ice", ramp(215, 0.6), ramp(190, 0.6, { lo: 0.25 }), ramp(200, 0.2, { lo: 0.5, hi: 0.97 })),
      bank("ghost", ramp(265, 0.35), ramp(320, 0.5, { lo: 0.25 }), ramp(230, 0.12, { lo: 0.35, hi: 0.95 })),
      bank("items", ramp(45, 0.85, { lo: 0.2 }), ramp(350, 0.7), ramp(200, 0.75)),                      // gold coins, red hearts, blue gems
    ],
    tiles: [
      bank("meadow", ramp(100, 0.5, { lo: 0.12, hi: 0.78 }), ramp(30, 0.42, { lo: 0.12, hi: 0.72 }), ramp(55, 0.75, { lo: 0.35, hi: 0.92 })), // grass, earth, flowers
      bank("forest", ramp(150, 0.42, { lo: 0.1, hi: 0.7 }), ramp(170, 0.38, { lo: 0.08, hi: 0.62 }), ramp(25, 0.35, { lo: 0.1, hi: 0.6 })),   // leaves, deep shade, bark
      bank("stone", ramp(225, 0.12, { lo: 0.12, hi: 0.85 }), ramp(35, 0.15, { lo: 0.15, hi: 0.82 }), ramp(95, 0.35, { lo: 0.15, hi: 0.65 })), // cool stone, warm stone, moss
      bank("water", ramp(212, 0.6, { lo: 0.12, hi: 0.75 }), ramp(185, 0.5, { lo: 0.2, hi: 0.9 }), ramp(42, 0.45, { lo: 0.4, hi: 0.92 })),     // deep water, shallows and foam, sand
      bank("desert", ramp(38, 0.55, { lo: 0.25, hi: 0.92 }), ramp(18, 0.5, { lo: 0.15, hi: 0.7 }), ramp(110, 0.35, { lo: 0.15, hi: 0.65 })),  // sand, red rock, cactus
      bank("castle", ramp(218, 0.45, { lo: 0.1, hi: 0.72 }), ramp(230, 0.1, { lo: 0.15, hi: 0.85 }), ramp(350, 0.55, { lo: 0.15, hi: 0.68 })), // carpet blue, stone, red and gold trim
      bank("station", ramp(215, 0.2, { lo: 0.08, hi: 0.75 }), ramp(235, 0.35, { lo: 0.06, hi: 0.45 }), ramp(38, 0.85, { lo: 0.3, hi: 0.85 })), // metal, deep navy, warning lights
      bank("cave", ramp(285, 0.22, { lo: 0.06, hi: 0.55 }), ramp(15, 0.9, { lo: 0.3, hi: 0.8 }), ramp(185, 0.7, { lo: 0.3, hi: 0.9 })),     // rock, lava, crystals
    ],
  };
}
