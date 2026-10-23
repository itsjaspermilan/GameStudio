// A painting kit for sprites in colour banks (GBA style). Shapes are lit as solid forms with the light from the top left: a sphere for
// round things, a capsule (a rounded tube) for limbs, tails and pipes, a rounded box for bodies and plates. With { edge: true } a shape
// gets a line of its own darkest shade round it, which keeps it apart from a part of the same colour behind it (an arm over a body). Each pixel takes a step of
// the shape's ramp from how much it faces the light, with an ordered dither between steps (only near the step's edge, so surfaces stay
// clean), and outline() adds a coloured outline: the darkest shade of the part it surrounds, darker still on the shadow side.
//   const b = bank({ suit: ["#..", ...5], metal: [...], glow: [...] })   ramps of up to 5 shades, dark to light, 15 colours in all
//   const c = new Canvas(32, 32); sphere(c, 16, 10, 7, 7, b.suit); capsule(c, 10, 18, 9, 26, 1.5, b.metal); outline(c, b)
//   c.rgba(b.pal)   -> the picture; b.colors -> the bank for palette.json
import { quantize } from "../../studio/src/palette-core.js";

const L = (() => { const v = [-0.55, -0.7, 0.45], n = Math.hypot(...v); return v.map((x) => x / n); })(); // toward the light
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

// A bank from named ramps (each a list of hex colours, dark to light). Places are given in order: the first ramp's darkest is place 1.
export function bank(ramps) {
  const colors = [], out = { colors, pal: null, rampOf: new Map() };
  for (const [name, list] of Object.entries(ramps)) {
    const places = list.map((h) => { colors.push(quantize(h)); return colors.length; });
    out[name] = places;
    for (const p of places) out.rampOf.set(p, places);
  }
  if (colors.length > 15) throw new Error(`a bank holds 15 colours, these ramps need ${colors.length}`);
  out.pal = [null, ...colors];
  out.darkest = 1; // the first ramp's darkest: the shadow-side outline
  return out;
}

// light (0 dark .. 1 lit) to a place of the ramp, dithered near the step's edge; `bias` lifts or darkens the whole shape
function shadeAt(ramp, light, x, y, bias = 0, dither = true) {
  const n = ramp.length, v = Math.max(0, Math.min(0.999, light + bias)) * n, lo = Math.floor(v), f = v - lo;
  const up = dither && n > 2 && f > 0.72 && BAYER[y & 3][x & 3] / 16 < (f - 0.72) / 0.28 * 0.5; // (a two-shade ramp stays crisp)
  return ramp[Math.min(n - 1, lo + (up ? 1 : 0))];
}
const lit = (nx, ny, nz) => Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) * 0.85 + 0.15; // a little light reaches the dark side

// An ellipse lit as a sphere (rx, ry radii). opts: { bias, spec: a highlight place, dither, clip(x, y) -> false to skip a pixel }
export function sphere(c, cx, cy, rx, ry, ramp, opts = {}) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1 || (opts.clip && !opts.clip(x, y))) continue;
    const nz = Math.sqrt(1 - d), l = lit(nx, ny, nz);
    if (opts.edge && Math.sqrt(d) > 1 - 1 / Math.min(rx, ry) && (nx > -0.3 || ny > -0.3)) { c.px(x, y, ramp[0]); continue; }
    c.px(x, y, opts.spec && l > 0.93 && d < 0.5 ? opts.spec : shadeAt(ramp, l, x, y, opts.bias, opts.dither !== false));
  }
}

// A rounded tube from (x0, y0) to (x1, y1) with radius r, lit across its width (and capped round at both ends).
export function capsule(c, x0, y0, x1, y1, r, ramp, opts = {}) {
  const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1;
  for (let y = Math.floor(Math.min(y0, y1) - r - 1); y <= Math.ceil(Math.max(y0, y1) + r + 1); y++)
    for (let x = Math.floor(Math.min(x0, x1) - r - 1); x <= Math.ceil(Math.max(x0, x1) + r + 1); x++) {
      const px = x + 0.5, py = y + 0.5, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / len2));
      const ox = px - (x0 + t * dx), oy = py - (y0 + t * dy), d = Math.hypot(ox, oy);
      if (d > r) continue;
      if (opts.edge && d > r - 0.9) { c.px(x, y, ramp[0]); continue; }
      const nx = ox / r, ny = oy / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      c.px(x, y, shadeAt(ramp, lit(nx, ny, nz), x, y, opts.bias, opts.dither !== false));
    }
}

// A box with rounded edges (`round` pixels of curve on each side), lit as a slab: flat on top, curving away at the edges.
export function box(c, x, y, w, h, ramp, opts = {}) {
  const r = opts.round ?? Math.min(3, Math.floor(Math.min(w, h) / 2));
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    if (opts.clip && !opts.clip(px, py)) continue;
    const ex = px + 0.5 < x + r ? (px + 0.5 - (x + r)) / r : px + 0.5 > x + w - r ? (px + 0.5 - (x + w - r)) / r : 0;
    const ey = py + 0.5 < y + r ? (py + 0.5 - (y + r)) / r : py + 0.5 > y + h - r ? (py + 0.5 - (y + h - r)) / r : 0;
    if (ex * ex + ey * ey > 1.05 && opts.corners !== false) continue; // rounded corners
    const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, ex * ex + ey * ey)));
    const l = lit(ex * 0.9, ey * 0.9, Math.max(nz, 0.45)) + (opts.slope ?? 0.15) * (0.5 - (py - y) / h); // the top a touch lighter
    c.px(px, py, shadeAt(ramp, l, px, py, opts.bias, opts.dither !== false));
  }
}

// A filled polygon lit as one plane facing `facing` (0 = straight at the viewer, 1 = toward the light, -1 = away).
export function plane(c, pts, ramp, facing = 0) {
  const ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= y + 0.5) !== (by <= y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x < Math.ceil(xs[k + 1] - 0.5); x++) {
      const l = 0.55 + facing * 0.35 + 0.12 * (0.5 - (y - y0) / Math.max(1, y1 - y0));
      c.px(x, y, shadeAt(ramp, l, x, y, 0, false)); // a flat face is one clean step or two, never dithered
    }
  }
}

// A coloured outline round everything drawn: each see-through pixel next to the picture takes the darkest shade of the part beside it;
// on the shadow side (the part is above or to the left of it) it takes the bank's darkest colour.
export function outline(c, b, opts = {}) {
  const w = c.w, h = c.h, src = c.d.slice(), at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : src[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (at(x, y) >= 0) continue;
    const up = at(x, y - 1), left = at(x - 1, y), down = at(x, y + 1), right = at(x + 1, y);
    const inner = [down, right, up, left].find((v) => v >= 0);
    if (inner === undefined) continue;
    const shadow = up >= 0 || left >= 0;
    const ramp = b.rampOf.get(inner);
    c.px(x, y, shadow || !ramp || opts.dark ? b.darkest : ramp[0]);
  }
}

// a single pixel or a small run in a place (eyes, rivets, sparkles)
export const dot = (c, x, y, place) => c.px(x, y, place);

// n shades of a starter-style ramp (palette-core's ramp), picked evenly from its five: a part that needs only two or three steps
export const shades = (ramp5, n) => (n >= 5 ? ramp5 : Array.from({ length: n }, (_, i) => ramp5[Math.round((i * 4) / (n - 1))]));

// A ring between two radii round (cx, cy) (ry squashes it), lit top left: a halo, a rim, a pulse.
export function ring(c, cx, cy, r0, r1, ramp, ry = 1) {
  for (let y = Math.floor(cy - r1 * ry); y <= cy + r1 * ry; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
    const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) / ry);
    if (d <= r1 && d >= r0) c.px(x, y, ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(((cx - x) + (cy - y)) / (r1 * 2) * (ramp.length - 1) + (ramp.length - 1) / 2)))]);
  }
}

// Light rather than a solid: a disc that is brightest in the middle and fades out through the ramp (dark to light) toward its edge,
// dithered between steps. Drawn with blend "add" in the game, the dark outer steps become a soft halo.
export function glow(c, cx, cy, rx, ry, ramp, { core = 0.35 } = {}) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (d > 1) continue;
    const v = Math.min(1, (1 - d) / (1 - core)) * ramp.length, k = Math.floor(v), f = v - k;
    const up = ramp.length > 2 && f > 0.6 && BAYER[y & 3][x & 3] / 16 < (f - 0.6) / 0.4 * 0.5;
    c.px(x, y, ramp[Math.min(ramp.length - 1, k + (up ? 1 : 0))]);
  }
}
