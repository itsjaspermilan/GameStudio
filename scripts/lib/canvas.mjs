// A tiny indexed-colour pixel canvas for drawing the Void Swarm sprites in code. Colours are indexes into the console palette (0..31);
// -1 is transparent. Every sprite is a function (canvas, frame) -> draws that frame, so animation is just maths on the frame number.
export const PAL = ["#000000", "#3b3f55", "#8a90a8", "#ffffff", "#4a1424", "#b0293a", "#ea5a4b", "#ffa38c", "#4b2a1d", "#9a5324", "#e8913a", "#ffd08a",
  "#6b5a14", "#c9a227", "#f5d94a", "#fff6a8", "#123b2a", "#2f8a3f", "#6ccf4f", "#c4f28a", "#0f3b4a", "#1f8a96", "#45d1c5", "#a6f4e6",
  "#14234f", "#2a56c4", "#4f9bf0", "#a8d4ff", "#2d1a4f", "#6a3fb5", "#a56be0", "#d9b3ff"];
// Four shades per hue, dark to light.
export const R = { grey: [0, 1, 2, 3], red: [4, 5, 6, 7], orange: [8, 9, 10, 11], yellow: [12, 13, 14, 15], green: [16, 17, 18, 19], teal: [20, 21, 22, 23], blue: [24, 25, 26, 27], purple: [28, 29, 30, 31] };
export const K = 0, W = 3, T = -1;

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Int8Array(w * h).fill(-1); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.d[y * this.w + x]; }
  px(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; return this; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); return this; }
  frame(x, y, w, h, c) { this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c); this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c); return this; }
  disc(cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c); }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, c);
    }
    return this;
  }
  ring(cx, cy, r, th, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r && d > r - th) this.px(x, y, c);
    }
    return this;
  }
  // A lit ball: `ramp` is four shades; the light comes from the top left.
  sphere(cx, cy, r, ramp, lx = -0.5, ly = -0.6, rx = r, ry = r) {
    const ll = Math.hypot(lx, ly, 0.6);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, q = dx * dx + dy * dy;
      if (q > 1) continue;
      const nz = Math.sqrt(1 - q), s = (dx * lx + dy * ly + nz * 0.6) / ll;
      this.px(x, y, ramp[s > 0.78 ? 3 : s > 0.35 ? 2 : s > -0.1 ? 1 : 0]);
    }
    return this;
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  poly(pts, c) {
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const [x, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j], py = y + 0.5, pxx = x + 0.5;
        if ((yi > py) !== (yj > py) && pxx < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.px(x, y, c);
    }
    return this;
  }
  dither(x, y, w, h, c, phase = 0) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((i + j + phase) % 2 === 0) this.px(x + i, y + j, c); return this; }
  // Draw `rows` of characters; `map` gives a palette index for each character (anything else is left alone).
  ascii(rows, map, ox = 0, oy = 0) { rows.forEach((row, j) => [...row].forEach((ch, i) => { if (map[ch] !== undefined) this.px(ox + i, oy + j, map[ch]); })); return this; }
  // A one pixel border of colour `c` around everything already drawn.
  outline(c, diag = false) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y) !== -1) continue;
      if (this.get(x - 1, y) !== -1 || this.get(x + 1, y) !== -1 || this.get(x, y - 1) !== -1 || this.get(x, y + 1) !== -1 ||
        (diag && (this.get(x - 1, y - 1) !== -1 || this.get(x + 1, y - 1) !== -1 || this.get(x - 1, y + 1) !== -1 || this.get(x + 1, y + 1) !== -1))) add.push([x, y]);
    }
    for (const [x, y] of add) this.px(x, y, c);
    return this;
  }
  // Copies the left half onto the right, mirrored (for ships and bugs).
  mirror() { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w >> 1; x++) this.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x]; return this; }
  stamp(o, x0, y0) { for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const v = o.d[y * o.w + x]; if (v !== -1) this.px(x0 + x, y0 + y, v); } return this; }
  replace(a, b) { for (let i = 0; i < this.d.length; i++) if (this.d[i] === a) this.d[i] = b; return this; }
  // the pixels as RGBA, with the colour numbers looked up in `pal` (Glow43's palette unless a console has another)
  rgba(pal = PAL) {
    const out = new Uint8ClampedArray(this.w * this.h * 4);
    this.d.forEach((v, i) => { if (v < 0 || !pal[v]) return; out[i * 4] = parseInt(pal[v].slice(1, 3), 16); out[i * 4 + 1] = parseInt(pal[v].slice(3, 5), 16); out[i * 4 + 2] = parseInt(pal[v].slice(5, 7), 16); out[i * 4 + 3] = 255; });
    return out;
  }
}

// frames side by side: [{canvas}] -> one canvas
export function strip(frames) {
  const w = frames[0].w, h = frames[0].h, s = new Canvas(w * frames.length, h);
  frames.forEach((f, i) => s.stamp(f, i * w, 0));
  return s;
}
