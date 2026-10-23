// Writes the console logos: assets/console-logos/<id>.svg (for the Knulli theme) and <id>.png (muOS's folder picture, and to look at),
// for Glow43 and Glow169, in the style of the GBA era (the Game Boy Advance logo, Metroid Fusion, Minish Cap): smooth bold letters
// leaning forward, "GLOW" in chrome (a sky reflected above a hard horizon line, the ground below), the number in the console's own colour
// (Glow43 amber, Glow169 cyan) with the same horizon, a thick dark outline, a solid drop shadow, and a swoosh of the colour underneath.
// The letters are strokes along a centre line (round ends), so the SVG is a few paths and the PNG is drawn from the same shapes here
// (distance to the nearest stroke, with smooth edges).
//   node scripts/make-console-logos.mjs [preview.png]      (the preview shows both logos on the menus' dark colour)
import { writeFileSync } from "node:fs";
import { png } from "./png.mjs";

const R = 12, OUT = 6, SLANT = 0.22; // stroke radius, outline width, lean (x moves this much per unit up)
const SHADOW = [5, 7];               // the drop shadow's offset

// Each glyph: its width and its strokes, centre lines in a 100-high box (y down). curve() smooths a list of points into a line.
const ell = (cx, cy, rx, ry, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [cx + rx * Math.cos(a), cy - ry * Math.sin(a)]; });
function curve(pts, steps = 8) { // Catmull-Rom through the points
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const SIX = [[44, 17], [26, 12], [11, 30], [9, 58], [15, 82], [30, 89], [45, 78], [46, 61], [31, 50], [12, 58]];
const GLYPHS = {
  G: { w: 70, strokes: [[...ell(36, 50, 28, 38, 40, 360), [42, 50]]] },
  L: { w: 52, strokes: [[[12, 12], [12, 88], [50, 88]]] },
  O: { w: 70, strokes: [ell(35, 50, 25, 38, 0, 360, 48)] },
  W: { w: 84, strokes: [[[8, 12], [23, 88], [42, 42], [61, 88], [76, 12]]] },
  1: { w: 40, strokes: [[[10, 28], [25, 12], [25, 88]]] },
  3: { w: 56, strokes: [curve([[8, 20], [28, 12], [45, 25], [36, 45], [22, 49], [40, 53], [48, 70], [34, 88], [8, 82]])] },
  4: { w: 58, strokes: [[[40, 88], [40, 12], [6, 63], [55, 63]]] },
  6: { w: 56, strokes: [curve(SIX)] },
  9: { w: 56, strokes: [curve(SIX.map(([x, y]) => [55 - x, 100 - y]))] },
};
const CONSOLES = {
  glow43: { number: "43", accent: [[0, "#fff4c8"], [0.45, "#ffc444"], [0.5, "#c24a1a"], [0.62, "#e8782c"], [1, "#ffd46e"]], swoosh: ["#ff9a2e", "#ffe08a"], dark: "#1e0f14" },
  glow169: { number: "169", accent: [[0, "#e8fdff"], [0.45, "#72e2ff"], [0.5, "#1a52a8"], [0.62, "#2c8ee0"], [1, "#8ee8ff"]], swoosh: ["#1e86e0", "#a0f0ff"], dark: "#0a1020" },
};
// chrome: a bright sky getting a little darker toward the horizon, a hard dark line, then the ground getting lighter again
const CHROME = [[0, "#f8fbff"], [0.45, "#c2cee4"], [0.5, "#3a4872"], [0.6, "#7688b2"], [1, "#dce6f6"]];
const GAP = 10, NUM_GAP = 18, MARGIN = 14;

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function grad(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [t0, a] = stops[i - 1], [t1, b] = stops[i], k = (t - t0) / (t1 - t0), A = rgb(a), B = rgb(b);
    return A.map((v, j) => v + (B[j] - v) * k);
  }
  return rgb(stops[stops.length - 1][1]);
}

// the whole logo: strokes (each { pts, chrome }) placed side by side, the swoosh, and the size
function layout(id) {
  const c = CONSOLES[id], strokes = [];
  let x = MARGIN + 8;
  [..."GLOW", ...c.number].forEach((ch, i) => {
    if (i === 4) x += NUM_GAP - GAP;
    const g = GLYPHS[ch];
    for (const s of g.strokes) strokes.push({ pts: s.map(([px, py]) => [x + px, py + MARGIN]), chrome: i < 4 });
    x += g.w + GAP;
  });
  const w = x - GAP + MARGIN + 30, h = 100 + MARGIN * 2 + 22;
  // a swoosh from under the G to past the number, thin at both ends and thickest under the middle
  const sw = Array.from({ length: 61 }, (_, i) => { const t = i / 60; return { x: MARGIN - 4 + t * (w - MARGIN * 2 + 10), y: MARGIN + 104 + Math.sin(t * Math.PI) * 10 - t * 26, r: 1.5 + Math.sin(t * Math.PI) ** 1.5 * 6 }; });
  return { w, h, strokes, sw, c };
}
const lean = (x, y, top) => x + (top + 100 - y) * SLANT; // the letters lean forward round their baseline

// distance from (x, y) to a stroke line
function dist(px, py, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L)) : 0, ex = x0 + t * dx - px, ey = y0 + t * dy - py;
    best = Math.min(best, ex * ex + ey * ey);
  }
  return Math.sqrt(best);
}

function raster(l, scale, bg) {
  const W = Math.round(l.w * scale), H = Math.round(l.h * scale), d = new Uint8ClampedArray(W * H * 4);
  const put = (i, col, a) => { if (a <= 0) return; const o = i * 4, k = Math.min(1, a), ba = d[o + 3] / 255, na = k + ba * (1 - k);
    for (let j = 0; j < 3; j++) d[o + j] = na ? (col[j] * k + d[o + j] * ba * (1 - k)) / na : 0; d[o + 3] = na * 255; };
  if (bg) for (let i = 0; i < W * H; i++) { d.set(bg, i * 4); d[i * 4 + 3] = 255; }
  const top = MARGIN, dark = rgb(l.c.dark);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const X = (px + 0.5) / scale, Y = (py + 0.5) / scale, i = py * W + px;
    // the swoosh (no lean), under everything but the shadow
    let sd = Infinity, st = 0;
    for (let k = 0; k < l.sw.length - 1; k++) {
      const a = l.sw[k], b = l.sw[k + 1], q = dist(X, Y, [[a.x, a.y], [b.x, b.y]]) - (a.r + b.r) / 2;
      if (q < sd) { sd = q; st = k / (l.sw.length - 1); }
    }
    // undo the lean to find the point in letter space, for the shadow and for the letters
    const unl = (x, y) => x - (top + 100 - y) * SLANT;
    let ds = Infinity, dl = Infinity, chrome = true;
    for (const s of l.strokes) {
      ds = Math.min(ds, dist(unl(X - SHADOW[0], Y - SHADOW[1]), Y - SHADOW[1], s.pts));
      const q = dist(unl(X, Y), Y, s.pts);
      if (q < dl) { dl = q; chrome = s.chrome; }
    }
    put(i, dark.map((v) => v * 0.6), (R + OUT - ds) * scale + 0.5);                     // drop shadow
    put(i, dark, (2.5 - sd) * scale + 0.5);                                              // the swoosh's outline
    put(i, grad([[0, l.c.swoosh[0]], [1, l.c.swoosh[1]]], st), (-sd) * scale + 0.5);     // the swoosh
    put(i, dark, (R + OUT - dl) * scale + 0.5);                                          // outline
    const t = (Y - top) / 100;
    put(i, grad(chrome ? CHROME : l.c.accent, t), (R - dl) * scale + 0.5);              // the letter
    if (dl < R && t < 0.4) put(i, [255, 255, 255], Math.max(0, (R * 0.45 - dl)) / (R * 0.45) * 0.35 * (1 - t / 0.4)); // a gleam along the top
  }
  return { W, H, d };
}

function svg(l) {
  const stop = (stops) => stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("");
  const top = MARGIN, path = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L");
  const skew = `matrix(1 0 ${-SLANT} 1 ${(top + 100) * SLANT} 0)`; // x + (top + 100 - y) * SLANT
  const letters = (stroke, width, extra = "") => l.strokes.map((s) => `<path d="${path(s.pts)}" fill="none" stroke="${typeof stroke === "function" ? stroke(s) : stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`).join("");
  // the swoosh as a filled shape: its edge on each side
  const side = (sgn) => l.sw.map((p, k) => { const q = l.sw[Math.min(k + 1, l.sw.length - 1)], o = l.sw[Math.max(k - 1, 0)], dx = q.x - o.x, dy = q.y - o.y, n = Math.hypot(dx, dy) || 1; return [p.x - dy / n * p.r * sgn, p.y + dx / n * p.r * sgn]; });
  const swoosh = path([...side(1), ...side(-1).reverse()]) + "Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l.w} ${l.h}" width="${l.w * 2}" height="${l.h * 2}">` +
    `<defs><linearGradient id="chrome" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${top + 100}">${stop(CHROME)}</linearGradient>` +
    `<linearGradient id="accent" gradientUnits="userSpaceOnUse" x1="0" y1="${top}" x2="0" y2="${top + 100}">${stop(l.c.accent)}</linearGradient>` +
    `<linearGradient id="swoosh" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${l.w}" y2="0"><stop offset="0" stop-color="${l.c.swoosh[0]}"/><stop offset="1" stop-color="${l.c.swoosh[1]}"/></linearGradient></defs>` +
    `<g transform="translate(${SHADOW[0]} ${SHADOW[1]}) ${skew}" opacity="0.85">${letters(l.c.dark, 2 * (R + OUT))}</g>` +
    `<path d="${swoosh}" fill="url(#swoosh)" stroke="${l.c.dark}" stroke-width="2.5"/>` +
    `<g transform="${skew}">${letters(l.c.dark, 2 * (R + OUT))}${letters((s) => (s.chrome ? "url(#chrome)" : "url(#accent)"), 2 * R)}</g>` +
    `</svg>\n`;
}

const made = {};
for (const id of Object.keys(CONSOLES)) {
  const l = layout(id);
  writeFileSync(`assets/console-logos/${id}.svg`, svg(l));
  const r = raster(l, 1);
  writeFileSync(`assets/console-logos/${id}.png`, png(r.W, r.H, r.d));
  made[id] = l;
  console.log(`wrote assets/console-logos/${id}.svg and .png (${r.W} x ${r.H})`);
}
const out = process.argv[2];
if (out) {
  const parts = Object.values(made).map((l) => raster(l, 1, [0x14, 0x16, 0x22]));
  const W = Math.max(...parts.map((p) => p.W)) + 32, H = parts.reduce((n, p) => n + p.H + 16, 16), d = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) d.set([0x14, 0x16, 0x22, 255], i * 4);
  let y = 16;
  for (const p of parts) { for (let yy = 0; yy < p.H; yy++) d.set(p.d.subarray(yy * p.W * 4, (yy + 1) * p.W * 4), ((y + yy) * W + 16) * 4); y += p.H + 16; }
  writeFileSync(out, png(W, H, d));
  console.log(`wrote ${out}`);
}
