// Shading sprites the way GBA artists did, from flat shapes. The drawing code paints each part of a sprite in one classic palette place
// (the jacket in 10, the hair in 29, ...); here every place is a MATERIAL with a slice of a ramp in the sprite's colour bank, and each
// pixel takes a shade from where it sits in its part: light comes from the top left, so pixels near an edge facing up or left are a step
// or two lighter, pixels near an edge facing down or right darker, and the upper part of a shape is a little brighter overall.
// Edges get a COLOURED outline (the darkest shade of what is inside it) instead of black, as in Minish Cap; the bottom and right of the
// outline stay the darkest colour, which keeps sprites standing out from the background.
import { Canvas } from "../lib/canvas.mjs";

// spec: { mats: { place: [bank places, dark to light] | bank place }, outline: { place: bank place }, dark: bank place,
//         outlineFrom: [places the drawing used for its outline], alias: { place: the place it is a light or dark of },
//         shade: false for flat colours (every place to its one bank place) }
// Returns a new Canvas of bank places (1-15), -1 see-through.
export function shadeSprite(src, spec) {
  const { w, h } = src, out = new Canvas(w, h), alias = spec.alias || {};
  if (spec.shade === false) { // flat: each place to its bank place
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = src.get(x, y); if (v < 0) continue;
      const m = spec.mats[v]; if (typeof m !== "number") throw new Error(`no flat colour for classic place ${v}`);
      out.px(x, y, m);
    }
    return out;
  }
  const raw = (x, y) => src.get(x, y), get = (x, y) => { const v = raw(x, y); return v < 0 ? v : alias[v] ?? v; };
  const isOutlineIdx = new Set(spec.outlineFrom || []);
  const clear = (x, y) => raw(x, y) < 0;
  // an outline pixel: drawn with an outline place and touching see-through (a part drawn in that place inside the sprite is a material)
  const isOutline = (x, y) => isOutlineIdx.has(raw(x, y)) && (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1));
  const matOf = (x, y) => { const v = get(x, y); return v < 0 || isOutline(x, y) ? -1 : v; };
  // the box of each material, for the overall top-to-bottom light
  const box = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const m = matOf(x, y); if (m < 0) continue;
    const b = box.get(m) || { y0: y, y1: y }; b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); box.set(m, b);
  }
  // how many steps from (x, y) along (dx, dy) stay in the same material (up to 3)
  const run = (x, y, dx, dy, m) => { let k = 0; while (k < 3 && matOf(x + dx * (k + 1), y + dy * (k + 1)) === m) k++; return k; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = get(x, y);
    if (v < 0) continue;
    if (isOutline(x, y)) { // coloured outline: the darkest shade of the material beside it; the shadow side (below, right) stays dark
      let inner = -1;
      for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) { const m = matOf(x + dx, y + dy); if (m >= 0) { inner = m; break; } }
      const shadowSide = matOf(x - 1, y) >= 0 || matOf(x, y - 1) >= 0; // the material is above or to the left: this is a bottom/right edge
      out.px(x, y, shadowSide || inner < 0 ? spec.dark : (spec.outline?.[inner] ?? spec.dark));
      continue;
    }
    const mat = spec.mats[v];
    if (mat === undefined) throw new Error(`no material for classic place ${v}`);
    if (typeof mat === "number") { out.px(x, y, mat); continue; }
    const n = mat.length, up = run(x, y, 0, -1, v), left = run(x, y, -1, 0, v), down = run(x, y, 0, 1, v), right = run(x, y, 1, 0, v);
    const b = box.get(v), rel = b.y1 > b.y0 ? (y - b.y0) / (b.y1 - b.y0) : 0.5;
    let s = (n - 1) / 2 + (0.45 - rel) * 0.9;
    s += up === 0 ? 1.3 : up === 1 ? 0.5 : 0;
    s += left === 0 ? 0.6 : 0;
    s -= down === 0 ? 1.1 : down === 1 ? 0.4 : 0;
    s -= right === 0 ? 0.6 : 0;
    out.px(x, y, mat[Math.max(0, Math.min(n - 1, Math.round(s)))]);
  }
  return out;
}
