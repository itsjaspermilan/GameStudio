// Tilesets: each biome has a Now sheet (the wreck) and a Then sheet (as it was), with the same tile numbers so one room drawing fits
// both, and a light sheet per era that the room adds on top (blend "add": lamps, their beams, windows). 16x16 tiles, 8 to a row.
// Each sheet keeps to one colour bank (banks.mjs): places 1-5 steel, 6-10 back panels, 11-15 accent (dark to light in each).
//   0-15  wall, numbered by its open sides (1 top, 2 right, 4 bottom, 8 left) so edges get trim. The game reads 0-17; the rest is only drawn.
//   16    thin floor (stand on it, jump up through it, Down + B drops)
//   17    hazard (hurts; Now: sparking cable, Then: never used)
//   24-31 single background tiles: panel, lamp, vent, porthole, pipe down, pipe across, hazard stripe, broken panel (Then: a screen)
//   32-35 a big wall panel (2 x 2: top left, top right, bottom left, bottom right)   36-39 a big window onto space   40-43 a big fan vent
//   44    a strut (an upright rib between panels)   45 a pipe joint   48-51 a big panel with a screen   52-55 a plain big panel
//   56-59 Now: a big hole where a panel fell off (torn cables, darkness), Then: a maintenance hatch
// Light sheet: 0-8 a lamp's glow (3 x 3 around the lamp), 9-14 its beam (3 wide, 2 down), 16-19 a window's glow (2 x 2), 20 a screen's glow.
import { Canvas, rng } from "../lib/canvas.mjs";

export const TILE = { THIN: 16, HAZARD: 17, PANEL: 24, LIGHT: 25, VENT: 26, WINDOW: 27, PIPE_V: 28, PIPE_H: 29, STRIPE: 30, DARK: 31,
  BIG: 32, BIG_WINDOW: 36, BIG_VENT: 40, RIB: 44, JOINT: 45, BIG_SCREEN: 48, BIG_PLAIN: 52, BIG_HOLE: 56 };
export const LIGHT = { GLOW: 0, BEAM: 9, WINDOW: 16, SCREEN: 20 };

// places in the bank
const S1 = 1, S2 = 2, S3 = 3, S4 = 4, S5 = 5, B1 = 6, B2 = 7, B3 = 8, B4 = 9, B5 = 10, A1 = 11, A2 = 12, A3 = 13, A4 = 14, A5 = 15;
const SIZE = 128;

// a 4 x 4 ordered dither: blends two shades without noise, the way GBA art fakes in-between colours
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y, t) => t * 16 > BAYER[y & 3][x & 3] + 0.5;

const at = (n) => [(n % 8) * 16, Math.floor(n / 8) * 16];

function wall(c, n, now, rand) {
  const [ox, oy] = at(n), open = n;
  // the plate: mid steel, brushed with a faint diagonal grain
  c.rect(ox, oy, 16, 16, S3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x * 5 + y * 3) % 29 === 0) c.px(ox + x, oy + y, S2);
  // its bevel (light from the top left) and four bolts
  c.rect(ox, oy, 16, 1, S4).rect(ox, oy, 1, 16, S4).rect(ox, oy + 15, 16, 1, S2).rect(ox + 15, oy, 1, 16, S2);
  for (const [bx, by] of [[3, 3], [12, 3], [3, 12], [12, 12]]) c.px(ox + bx, oy + by, S5).px(ox + bx + 1, oy + by + 1, S1).px(ox + bx + 1, oy + by, S2);
  if (now) { // rust weeping from the bolts, and a dent
    for (const bx of [4, 13]) if (rand() < 0.6) for (let k = 0; k < 2 + Math.floor(rand() * 4); k++) c.px(ox + bx, oy + 14 - k, k < 2 ? A2 : A1);
    if (rand() < 0.4) { const dx = 5 + Math.floor(rand() * 6), dy = 6 + Math.floor(rand() * 4); c.rect(ox + dx, oy + dy, 3, 2, S2).px(ox + dx, oy + dy, S1).px(ox + dx + 2, oy + dy + 1, S4); }
  }
  if (open & 8) c.rect(ox, oy, 2, 16, S4).rect(ox, oy, 1, 16, S5);
  if (open & 2) c.rect(ox + 14, oy, 2, 16, S2).rect(ox + 15, oy, 1, 16, S1);
  if (open & 4) c.rect(ox, oy + 13, 16, 3, S2).rect(ox, oy + 15, 16, 1, S1);
  if (open & 1) { // a floor: a lit walkway edge, a grip pattern, a hazard line, a shadow under
    c.rect(ox, oy, 16, 1, S5).rect(ox, oy + 1, 16, 2, S4).rect(ox, oy + 3, 16, 1, S3).rect(ox, oy + 4, 16, 1, S1);
    for (let x = 1; x < 16; x += 3) c.px(ox + x, oy + 2, S3);
    for (let x = 0; x < 16; x++) c.px(ox + x, oy + 3, ((x >> 1) & 1) ? A3 : S1);
    if (now) for (let x = 0; x < 16; x++) if (rand() < 0.12) c.px(ox + x, oy, -1); // the wreck's edges are chipped
  }
}

function thinFloor(c, now) {
  const [ox, oy] = at(16);
  c.rect(ox, oy, 16, 1, S5).rect(ox, oy + 1, 16, 2, S4).rect(ox, oy + 3, 16, 1, S1);
  for (let x = 1; x < 16; x += 3) c.px(ox + x, oy + 1, S2).px(ox + x, oy + 2, S2);
  for (const sx of [2, 12]) c.rect(ox + sx, oy + 4, 2, 3, S2).px(ox + sx, oy + 4, S3).px(ox + sx + 1, oy + 6, S1);
  if (now) c.px(ox + 7, oy, -1).px(ox + 8, oy, -1).px(ox + 8, oy + 1, S2);
}

function hazard(c) {
  const [ox, oy] = at(17);
  c.rect(ox, oy + 13, 16, 3, A1).rect(ox + 1, oy + 14, 14, 1, A2).px(ox + 4, oy + 13, A2).px(ox + 11, oy + 13, A2); // a scorched strip
  // a torn cable: dark sheath with a lit top, frayed ends throwing sparks
  for (const [x0, y0, x1, y1] of [[0, 12, 5, 9], [5, 9, 9, 12], [9, 12, 15, 10]]) { c.line(ox + x0, oy + y0, ox + x1, oy + y1, S1); c.line(ox + x0, oy + y0 - 1, ox + x1, oy + y1 - 1, S2); }
  for (const [x, y, k] of [[4, 7, A5], [6, 5, A4], [9, 8, A5], [12, 6, A4], [7, 10, A3], [11, 4, A5], [5, 8, A3], [10, 9, A4]]) c.px(ox + x, oy + y, k);
}

// A recessed back panel of w x h tiles at tile n (left to right, top to bottom in the sheet): a gap round it, a bevel, a ridge, bolts.
function panel(c, ox, oy, w, h, now, rand, detail) {
  c.rect(ox, oy, w, h, B3);
  // light from above: a lighter band at the top and a darker one at the bottom, each blended into the flat middle over a few pixels
  // (dither only in those narrow bands: dithering a whole surface reads as noise)
  const top = Math.max(2, Math.round(h * 0.16)), fade = Math.max(2, Math.round(h * 0.12)), low = h - Math.max(2, Math.round(h * 0.14));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (y < top) c.px(ox + x, oy + y, B4);
    else if (y < top + fade && dith(x, y, 1 - (y - top) / fade)) c.px(ox + x, oy + y, B4);
    else if (y >= low && dith(x, y, 0.25 + (y - low) / (h - low) * 0.5)) c.px(ox + x, oy + y, B2);
  }
  c.rect(ox, oy, w, 1, B1).rect(ox, oy, 1, h, B1);                 // the gap between panels
  c.rect(ox + 1, oy + 1, w - 2, 1, B5).rect(ox + 1, oy + 1, 1, h - 2, B4); // the lit bevel
  c.rect(ox + 1, oy + h - 1, w - 1, 1, B2).rect(ox + w - 1, oy + 1, 1, h - 1, B2);
  if (h >= 32) { const ry = oy + Math.floor(h * 0.62); c.rect(ox + 3, ry, w - 6, 1, B2).rect(ox + 3, ry + 1, w - 6, 1, B4); } // a ridge
  for (const [bx, by] of [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]]) c.px(ox + bx, oy + by, B5).px(ox + bx + 1, oy + by + 1, B1);
  if (detail === "label" && w >= 32) { c.rect(ox + 6, oy + 6, 10, 4, B1).rect(ox + 7, oy + 7, 8, 2, A3).rect(ox + 7, oy + 7, 3, 2, A4); }
  if (detail === "plain" && w >= 32) for (const x of [10, 21]) { c.rect(ox + x, oy + 4, 1, h - 8, B2).rect(ox + x + 1, oy + 4, 1, h - 8, B4); } // two upright ridges
  if (now) {
    for (let k = 0; k < 3; k++) { // scratches and grime
      const x = ox + 3 + Math.floor(rand() * (w - 8)), y = oy + 3 + Math.floor(rand() * (h - 8));
      c.line(x, y, x + 3, y + 2, B4).px(x + 1, y + 2, B2);
    }
    for (let y = oy + h - 4; y < oy + h - 1; y++) for (let x = ox + 2; x < ox + w - 2; x++) if (dith(x, y, (y - (oy + h - 4)) / 4)) c.px(x, y, B1); // grime settled at the bottom
    if (rand() < 0.5) { const x = ox + 4 + Math.floor(rand() * (w - 10)); for (let y = oy + 4; y < oy + h - 3; y++) if (rand() < 0.7) c.px(x, y, (y & 1) ? A1 : B2); } // a water stain
  }
}
function bigPanel(c, n0, now, rand, detail) {
  const p = new Canvas(32, 32);
  panel(p, 0, 0, 32, 32, now, rand, detail);
  if (detail === "screen") { // a wall display: Then shows lines of warm text, Now a dead cracked screen
    p.rect(6, 6, 20, 13, S1).rect(7, 7, 18, 11, now ? B1 : B2).rect(6, 19, 20, 1, S4);
    if (now) p.line(9, 8, 16, 16, B3).line(16, 16, 22, 11, B3).px(16, 16, B5);
    else for (let r = 0; r < 4; r++) p.rect(9, 9 + r * 2, 6 + ((r * 5) % 9), 1, r === 0 ? A5 : A3);
  }
  stamp4(c, p, n0);
}
// copy a 32 x 32 picture into four tiles n0, n0+1, n0+2, n0+3 (top left, top right, bottom left, bottom right)
function stamp4(c, p, n0) {
  for (let k = 0; k < 4; k++) {
    const [ox, oy] = at(n0 + k), sx = (k & 1) * 16, sy = (k >> 1) * 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = p.get(sx + x, sy + y); if (v >= 0) c.px(ox + x, oy + y, v); }
  }
}

function bigHole(c, now, rand) {
  const p = new Canvas(32, 32);
  if (!now) { // a hatch: a panel with a heavy frame, a handle and a stencilled stripe
    panel(p, 0, 0, 32, 32, false, rand);
    p.frame(4, 4, 24, 24, S1).frame(5, 5, 22, 22, S4).rect(13, 14, 6, 3, S2).rect(13, 14, 6, 1, S5).rect(7, 24, 18, 2, A3);
    for (let x = 7; x < 25; x += 4) p.rect(x, 24, 2, 2, B1);
  } else { // the panel is gone: darkness, the back of the hull, cables hanging out, a bent edge
    panel(p, 0, 0, 32, 32, true, rand);
    for (let y = 3; y < 30; y++) for (let x = 3; x < 29; x++) { const edge = Math.min(x - 3, 28 - x, y - 3, 29 - y); if (edge + ((x * 7 + y * 3) % 3) > 1) p.px(x, y, edge < 3 && dith(x, y, 0.5) ? B2 : B1); }
    for (const [x0, len, col] of [[8, 14, A2], [12, 9, S3], [19, 17, A1], [23, 11, S2]]) for (let y = 3; y < 3 + len; y++) p.px(x0 + Math.round(Math.sin(y / 3) * 1.5), y, col);
    p.px(8 + Math.round(Math.sin(16 / 3) * 1.5), 17, A4).line(3, 3, 9, 3, S4).line(3, 3, 3, 8, S4);
  }
  stamp4(c, p, TILE.BIG_HOLE);
}

function bigWindow(c, now, rand) {
  const p = new Canvas(32, 32);
  p.rect(0, 0, 32, 32, S2);
  // the glass: deep space getting lighter toward the bottom, stars, and the edge of a planet with a lit rim
  for (let y = 4; y < 28; y++) for (let x = 4; x < 28; x++) p.px(x, y, dith(x, y, (y - 4) / 40) ? B2 : B1);
  for (let y = 4; y < 28; y++) for (let x = 4; x < 28; x++) {
    const d = Math.hypot(x - 34, y - 38);
    if (d < 20) p.px(x, y, d > 18.5 ? B5 : d > 16 ? B4 : dith(x, y, (20 - d) / 12) ? B2 : B3);
  }
  const r = rng(7);
  for (let k = 0; k < 9; k++) { const x = 5 + Math.floor(r() * 18), y = 5 + Math.floor(r() * 12); p.px(x, y, k % 3 ? S4 : S5); }
  p.px(9, 8, A4).px(20, 6, A4);
  // a reflection across the glass
  for (let k = 0; k < 6; k++) p.px(6 + k, 14 - k, B4).px(7 + k, 14 - k, B4);
  // the frame: thick, bevelled, bolted
  p.frame(3, 3, 26, 26, S1).frame(2, 2, 28, 28, S3).rect(0, 0, 32, 2, S4).rect(0, 0, 2, 32, S4).rect(0, 30, 32, 2, S2).rect(30, 0, 2, 32, S1).rect(0, 0, 32, 1, S5);
  for (const [bx, by] of [[1, 1], [29, 1], [1, 29], [29, 29], [15, 1], [15, 29]]) p.px(bx, by, S5).px(bx + 1, by + 1, S1);
  if (now) { p.line(6, 22, 14, 13, S4).line(14, 13, 18, 16, S4).line(14, 13, 13, 6, S4).px(14, 13, S5); } // cracked
  stamp4(c, p, TILE.BIG_WINDOW);
}

function bigVent(c, now) {
  const p = new Canvas(32, 32);
  panel(p, 0, 0, 32, 32, false, () => 0.9);
  p.rect(5, 5, 22, 22, S1);
  for (let y = 6; y < 26; y++) for (let x = 6; x < 26; x++) { // a round fan behind a grille: blades shaded round the hub
    const dx = x - 15.5, dy = y - 15.5, d = Math.hypot(dx, dy);
    if (d > 10) continue;
    const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2), blade = (a * 5 + d * 0.06) % 1;
    p.px(x, y, d < 2.5 ? S4 : blade < 0.45 ? (dy < 0 ? S3 : S2) : B1);
  }
  for (let y = 7; y < 26; y += 3) p.rect(6, y, 20, 1, now ? S2 : S3); // the grille's bars
  p.frame(5, 5, 22, 22, S3).rect(5, 5, 22, 1, S4);
  stamp4(c, p, TILE.BIG_VENT);
}

function single(c, now, rand) {
  const tile = (n, fn) => { const [ox, oy] = at(n), p = new Canvas(16, 16); panel(p, 0, 0, 16, 16, now, rand); fn(p); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.px(ox + x, oy + y, p.get(x, y)); };
  tile(TILE.PANEL, () => {});
  tile(TILE.LIGHT, (p) => { // a lamp: a hooded housing with a glowing lens (Now: dim amber or dead)
    p.rect(3, 4, 10, 7, S1).rect(4, 4, 8, 2, S3).rect(4, 4, 8, 1, S4).rect(5, 7, 6, 3, now ? A2 : A5).rect(6, 7, 4, 1, now ? A3 : A5);
    p.px(5, 9, now ? A1 : A4).px(10, 9, now ? A1 : A4);
  });
  tile(TILE.VENT, (p) => { p.rect(3, 3, 10, 10, B1); for (let j = 4; j < 13; j += 2) p.rect(3, j, 10, 1, B4); p.frame(2, 2, 12, 12, B2); });
  tile(TILE.WINDOW, (p) => { // a porthole
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 6.5) p.px(x, y, d > 5.2 ? (x + y < 15 ? S4 : S1) : d > 4.6 ? S2 : B1); }
    p.px(6, 6, S5).px(9, 8, S4).px(5, 9, A4);
    if (now) p.line(5, 10, 9, 5, S3);
  });
  tile(TILE.STRIPE, (p) => { for (let i = 0; i < 16; i++) for (let j = 5; j < 11; j++) p.px(i, j, ((i + j) >> 2) % 2 ? (j === 5 ? A4 : A3) : S1); p.rect(0, 4, 16, 1, S3).rect(0, 11, 16, 1, S1); });
  tile(TILE.DARK, (p) => {
    if (now) { p.rect(1, 1, 15, 15, B1); p.line(2, 4, 7, 10, S2).line(7, 10, 13, 7, S2).line(4, 13, 9, 11, A1).px(13, 7, A3); } // a hole: torn cables
    else { p.rect(3, 3, 10, 9, S1).rect(4, 4, 8, 7, B2); for (let r = 0; r < 3; r++) p.rect(5, 5 + r * 2, 3 + r * 2, 1, A4); } // a small screen
  });
  // a round pipe in front of a panel: five shades across it, a band (a joint tile has a wide collar instead)
  const pipe = (n, vertical, joint) => tile(n, (p) => {
    const shades = [S1, S2, S3, S4, S3, S2];
    for (let i = 0; i < 16; i++) for (let k = 0; k < 6; k++) p.px(vertical ? 5 + k : i, vertical ? i : 5 + k, shades[k]);
    if (joint) { p.rect(3, 5, 10, 6, S2).rect(3, 5, 10, 1, S4).rect(3, 10, 10, 1, S1).px(4, 7, S5).px(11, 7, S5); return; }
    for (let k = 0; k < 8; k++) { p.px(vertical ? 4 + k : 6, vertical ? 6 : 4 + k, k === 0 ? S4 : S2); p.px(vertical ? 4 + k : 7, vertical ? 7 : 4 + k, S1); }
    if (now) p.px(vertical ? 7 : 11, vertical ? 12 : 7, A1).px(vertical ? 7 : 11, vertical ? 13 : 8, A1);
  });
  pipe(TILE.PIPE_V, true); pipe(TILE.PIPE_H, false); pipe(TILE.JOINT, true, true);
  const rib = (n) => { // an upright strut with a lit face and a shadow
    const [ox, oy] = at(n);
    c.rect(ox, oy, 16, 16, B1).rect(ox + 4, oy, 8, 16, S3).rect(ox + 4, oy, 2, 16, S4).rect(ox + 11, oy, 1, 16, S1).rect(ox + 12, oy, 2, 16, B2);
    c.px(ox + 7, oy + 4, S5).px(ox + 8, oy + 5, S1).px(ox + 7, oy + 11, S5).px(ox + 8, oy + 12, S1);
  };
  rib(TILE.RIB);
}

export function tileset(name) {
  const now = name.endsWith("now"), rand = rng(name.length * 977);
  const c = new Canvas(SIZE, SIZE);
  for (let m = 0; m < 16; m++) wall(c, m, now, rand);
  thinFloor(c, now);
  if (now) hazard(c);
  single(c, now, rand);
  bigPanel(c, TILE.BIG, now, rand, "label");
  bigWindow(c, now, rand);
  bigVent(c, now);
  bigPanel(c, TILE.BIG_SCREEN, now, rand, "screen");
  bigPanel(c, TILE.BIG_PLAIN, now, rand, "plain");
  bigHole(c, now, rand);
  return c;
}

// The light a room adds: soft round glows and beams, five shades with ordered dither between them (a GBA look, not a smooth blur).
export function lightset() {
  const c = new Canvas(SIZE, 64);
  const paint = (n0, cols, rows, value, base) => { // value(x, y) 0..1 over the whole block of cols x rows tiles
    for (let k = 0; k < cols * rows; k++) {
      const [ox, oy] = at(n0 + k), bx = (k % cols) * 16, by = Math.floor(k / cols) * 16;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = Math.max(0, Math.min(1, value(bx + x, by + y))) * 5, lvl = Math.floor(v) + (dith(ox + x, oy + y, v - Math.floor(v)) ? 1 : 0);
        if (lvl > 0) c.px(ox + x, oy + y, base + Math.min(5, lvl) - 1);
      }
    }
  };
  // the lamp sits in the middle of the 3 x 3 block (at 24, 24); its glow fades out to the block's edge
  paint(LIGHT.GLOW, 3, 3, (x, y) => 1 - Math.hypot(x - 23.5, (y - 23.5) * 1.15) / 24, 1);
  // the beam below it: 3 wide, 2 tall, widening and fading as it falls
  paint(LIGHT.BEAM, 3, 2, (x, y) => { const half = 6 + y * 0.35, d = Math.abs(x - 23.5); return (1 - y / 34) * (d < half ? 0.75 : Math.max(0, 0.75 - (d - half) / 5)); }, 1);
  // a window's cool glow, brightest at the glass
  paint(LIGHT.WINDOW, 2, 2, (x, y) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)); return d < 12 ? 0.55 : 0.55 - (d - 12) / 5; }, 6);
  paint(LIGHT.SCREEN, 1, 1, (x, y) => 0.6 - Math.hypot(x - 7.5, y - 6) / 9, 11);
  return c;
}

// The background of a room, in 2 x 2 blocks (a big panel, sometimes a window, a fan vent or a screen), with struts, a pipe run and a
// hazard stripe just above floors (aboveFloor(r, c)); and the light: a lamp every few columns near the top, its glow and beam, and a
// glow on each window. Picked by a seed so a room looks the same every time; Then is the same layout, tidy and lit (in Now some lamps
// are dead and a few panels are holes).
export function backLayers(cols, rows, seed, aboveFloor) {
  const rand = rng(seed);
  const grid = () => Array.from({ length: rows }, () => Array(cols).fill(-1));
  const now = grid(), then = grid(), lightNow = grid(), lightThen = grid();
  const put = (r, c, v, era) => { if (r >= 0 && c >= 0 && r < rows && c < cols) { if (era !== "then") now[r][c] = v; if (era !== "now") then[r][c] = v; } };
  // struts and a pipe run take whole block columns (a strut, or a pipe, beside a small panel), so they never cut a window in half
  const special = new Map();
  for (let c = 2 + 2 * Math.floor(rand() * 2); c < cols - 2; c += 2 * (4 + Math.floor(rand() * 2))) special.set(c, "rib");
  for (let k = 0; k < Math.max(1, Math.floor(cols / 16)); k++) { const c = 2 * (2 + Math.floor(rand() * (cols / 2 - 4))); if (!special.has(c)) special.set(c, "pipe"); }
  for (let r = 0; r < rows; r += 2) for (let c = 0; c < cols; c += 2) {
    const sp = special.get(c);
    if (sp) {
      for (let y = r; y < Math.min(rows, r + 2); y++) { put(y, c, sp === "rib" ? TILE.RIB : y % 5 === 2 ? TILE.JOINT : TILE.PIPE_V); if (c + 1 < cols) put(y, c + 1, TILE.PANEL); }
      continue;
    }
    if (r + 1 >= rows || c + 1 >= cols) { for (let y = r; y < Math.min(rows, r + 2); y++) for (let x = c; x < Math.min(cols, c + 2); x++) put(y, x, TILE.PANEL); continue; }
    const v = rand(), base = v < 0.06 ? TILE.BIG_WINDOW : v < 0.12 ? TILE.BIG_VENT : v < 0.17 ? TILE.BIG_SCREEN : v < 0.21 ? TILE.BIG_HOLE : v < 0.6 ? TILE.BIG_PLAIN : TILE.BIG;
    for (let k = 0; k < 4; k++) put(r + (k >> 1), c + (k & 1), base + k);
    if (base === TILE.BIG_WINDOW) for (let k = 0; k < 4; k++) { lightNow[r + (k >> 1)][c + (k & 1)] = LIGHT.WINDOW + k; lightThen[r + (k >> 1)][c + (k & 1)] = LIGHT.WINDOW + k; }
    if (base === TILE.BIG_SCREEN) { lightThen[r][c] = LIGHT.SCREEN; } // a live screen glows a little (in Then)
  }
  // lamps along the top of the room, with their light
  for (let c = 3 + Math.floor(rand() * 3); c < cols - 2; c += 6 + Math.floor(rand() * 3)) {
    const r = 1;
    put(r, c, TILE.LIGHT);
    const dead = rand() < 0.35;
    for (let k = 0; k < 9; k++) {
      const y = r - 1 + Math.floor(k / 3), x = c - 1 + (k % 3);
      if (y < 0 || x < 0 || y >= rows || x >= cols) continue;
      lightThen[y][x] = LIGHT.GLOW + k; if (!dead) lightNow[y][x] = LIGHT.GLOW + k;
    }
    for (let k = 0; k < 6; k++) {
      const y = r + 2 + Math.floor(k / 3), x = c - 1 + (k % 3);
      if (y >= rows || x < 0 || x >= cols) continue;
      lightThen[y][x] = LIGHT.BEAM + k; if (!dead) lightNow[y][x] = LIGHT.BEAM + k;
    }
  }
  // hazard stripes just above floors (over whatever panel was there)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (aboveFloor(r, c) && (c * 7 + r) % 10 < 7) put(r, c, TILE.STRIPE);
  return { now, then, lightNow, lightThen };
}
