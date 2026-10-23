// Pure sprite-editing logic (no DOM): pixel ops, frames, resize, history, strip packing.
// Frames are RGBA byte arrays of size w*h*4. A sprite is saved as one horizontal PNG strip
// (frames side by side) plus a small JSON file, matching what the runtime engine loads.

export const MAX_SIZE = 256;
export const MAX_FRAMES = 64;

export function blankFrame(w, h) {
  return new Uint8ClampedArray(w * h * 4);
}

export function createSprite(name, w = 32, h = 32) {
  return { name, w, h, frames: [blankFrame(w, h)], origin: [0, 0], mask: null, fps: 6 };
}

export function inBounds(s, x, y) {
  return x >= 0 && y >= 0 && x < s.w && y < s.h;
}

export function getPixel(s, f, x, y) {
  const i = (y * s.w + x) * 4, d = s.frames[f];
  return [d[i], d[i + 1], d[i + 2], d[i + 3]];
}

export function setPixel(s, f, x, y, rgba) {
  if (!inBounds(s, x, y)) return;
  const i = (y * s.w + x) * 4, d = s.frames[f];
  d[i] = rgba[0]; d[i + 1] = rgba[1]; d[i + 2] = rgba[2]; d[i + 3] = rgba[3];
}

const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

// Fully transparent pixels all count as equal, whatever their hidden RGB is.
const norm = (p) => (p[3] === 0 ? [0, 0, 0, 0] : p);

export function floodFill(s, f, x, y, rgba) {
  if (!inBounds(s, x, y)) return 0;
  const target = norm(getPixel(s, f, x, y)), fill = norm(rgba);
  if (same(target, fill)) return 0;
  const stack = [[x, y]];
  let n = 0;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (!inBounds(s, cx, cy) || !same(norm(getPixel(s, f, cx, cy)), target)) continue;
    setPixel(s, f, cx, cy, rgba);
    n++;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return n;
}

// Bresenham: calls plot(x, y) for each pixel from (x0,y0) to (x1,y1) inclusive.
export function line(x0, y0, x1, y1, plot) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function rect(x0, y0, x1, y1, filled, plot) {
  const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
  for (let y = t; y <= b; y++)
    for (let x = l; x <= r; x++)
      if (filled || x === l || x === r || y === t || y === b) plot(x, y);
}

// ---- frames ----

export function addFrame(s, at = s.frames.length) {
  if (s.frames.length >= MAX_FRAMES) return false;
  s.frames.splice(at, 0, blankFrame(s.w, s.h));
  return true;
}
export function duplicateFrame(s, f) {
  if (s.frames.length >= MAX_FRAMES) return false;
  s.frames.splice(f + 1, 0, new Uint8ClampedArray(s.frames[f]));
  return true;
}
export function deleteFrame(s, f) {
  if (s.frames.length <= 1) return false;
  s.frames.splice(f, 1);
  return true;
}
export function moveFrame(s, f, to) {
  if (to < 0 || to >= s.frames.length || f === to) return false;
  const [fr] = s.frames.splice(f, 1);
  s.frames.splice(to, 0, fr);
  return true;
}

// ---- size ----

// Crop or pad every frame, anchored at the top-left. Origin and mask are clamped to the new size.
export function resize(s, nw, nh, max = MAX_SIZE) {
  nw = Math.max(1, Math.min(max, Math.floor(nw)));
  nh = Math.max(1, Math.min(max, Math.floor(nh)));
  s.frames = s.frames.map((old) => {
    const nf = blankFrame(nw, nh);
    for (let y = 0; y < Math.min(s.h, nh); y++)
      for (let x = 0; x < Math.min(s.w, nw); x++) {
        const a = (y * s.w + x) * 4, b = (y * nw + x) * 4;
        nf[b] = old[a]; nf[b + 1] = old[a + 1]; nf[b + 2] = old[a + 2]; nf[b + 3] = old[a + 3];
      }
    return nf;
  });
  s.w = nw; s.h = nh;
  s.origin = [Math.min(s.origin[0], nw - 1), Math.min(s.origin[1], nh - 1)];
  if (s.mask) s.mask = clampMask(s, s.mask);
}

export function clampMask(s, m) {
  const x = Math.max(0, Math.min(s.w - 1, Math.floor(m[0])));
  const y = Math.max(0, Math.min(s.h - 1, Math.floor(m[1])));
  const w = Math.max(1, Math.min(s.w - x, Math.floor(m[2])));
  const h = Math.max(1, Math.min(s.h - y, Math.floor(m[3])));
  return [x, y, w, h];
}

// ---- history ----

export function snapshot(s) {
  return {
    w: s.w, h: s.h, origin: [...s.origin], mask: s.mask ? [...s.mask] : null, fps: s.fps, tile: s.tile ? [...s.tile] : null,
    bank: s.bank, banks: s.banks ? [...s.banks] : undefined,
    animations: JSON.parse(JSON.stringify(s.animations || {})),
    frames: s.frames.map((f) => new Uint8ClampedArray(f)),
  };
}
export function restore(s, snap) {
  s.w = snap.w; s.h = snap.h; s.origin = [...snap.origin]; s.mask = snap.mask ? [...snap.mask] : null;
  s.fps = snap.fps; s.frames = snap.frames.map((f) => new Uint8ClampedArray(f));
  s.animations = JSON.parse(JSON.stringify(snap.animations || {}));
  if (snap.tile) s.tile = [...snap.tile]; else delete s.tile;
  if (snap.bank) s.bank = snap.bank; else delete s.bank;
  if (snap.banks) s.banks = [...snap.banks]; else delete s.banks;
}

export class History {
  constructor(limit = 80) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
  // Call BEFORE making a change, with a snapshot of the current state.
  record(snap) {
    this.undoStack.push(snap);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
  undo(current) {
    const snap = this.undoStack.pop();
    if (!snap) return null;
    this.redoStack.push(current);
    return snap;
  }
  redo(current) {
    const snap = this.redoStack.pop();
    if (!snap) return null;
    this.undoStack.push(current);
    return snap;
  }
}

// ---- saving / loading ----

export function toJSON(s) {
  const out = {
    image: `sprites/${s.name}.png`,
    frames: s.frames.length,
    origin: [...s.origin],
    mask: s.mask ? [...s.mask] : null,
    fps: s.fps,
  };
  if (Object.keys(s.animations || {}).length) out.animations = JSON.parse(JSON.stringify(s.animations));
  if (s.bank) out.bank = s.bank; // its colour bank (palette.json), on a console with banks
  return out;
}

// ---- animations: named runs of frames ("walk" = frames 2 to 5) that an object plays with the Play an animation action ----
// Stored as {from, to, fps, loop} with 0-based frame numbers (the editor shows them from 1).

export const isValidAnimationName = (n) => /^[A-Za-z_][A-Za-z0-9_-]{0,30}$/.test(n);

// Clean up clips read from a file (or left over after frames were deleted): numbers in range, from <= to, junk dropped.
export function normalizeAnimations(raw, frameCount, defaultFps = 6) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  const last = Math.max(0, frameCount - 1), clamp = (v, d) => Math.max(0, Math.min(last, Number.isFinite(v) ? Math.floor(v) : d));
  for (const [name, a] of Object.entries(raw)) {
    if (!isValidAnimationName(name) || !a || typeof a !== "object") continue;
    const from = clamp(a.from, 0), to = clamp(a.to, last);
    out[name] = { from: Math.min(from, to), to: Math.max(from, to), fps: Number.isFinite(a.fps) ? Math.max(0, Math.min(60, a.fps)) : defaultFps, loop: a.loop !== false };
  }
  return out;
}

export function addAnimation(s, name) {
  s.animations = s.animations || {};
  if (!isValidAnimationName(name) || s.animations[name]) return false;
  s.animations[name] = { from: 0, to: s.frames.length - 1, fps: s.fps || 6, loop: true };
  return true;
}

export function renameAnimation(s, from, to) {
  const a = s.animations || {};
  if (!a[from] || from === to) return false;
  if (!isValidAnimationName(to) || a[to]) return false;
  const next = {};
  for (const [k, v] of Object.entries(a)) next[k === from ? to : k] = v; // keeps the order
  s.animations = next;
  return true;
}

export function removeAnimation(s, name) {
  if (!s.animations || !s.animations[name]) return false;
  delete s.animations[name];
  return true;
}

// The frame to show `t` seconds into a clip.
export function animationFrame(a, t) {
  const span = a.to - a.from + 1;
  if (a.fps <= 0 || span <= 1) return a.from;
  const n = Math.floor(t * a.fps);
  return a.from + (a.loop ? n % span : Math.min(n, span - 1));
}

export function packStrip(s) {
  const n = s.frames.length, width = s.w * n, data = new Uint8ClampedArray(width * s.h * 4);
  for (let f = 0; f < n; f++)
    for (let y = 0; y < s.h; y++) {
      const src = y * s.w * 4, dst = (y * width + f * s.w) * 4;
      data.set(s.frames[f].subarray(src, src + s.w * 4), dst);
    }
  return { width, height: s.h, data };
}

export function unpackStrip(width, height, data, frames) {
  const w = Math.floor(width / frames), out = [];
  for (let f = 0; f < frames; f++) {
    const fr = blankFrame(w, height);
    for (let y = 0; y < height; y++) {
      const src = (y * width + f * w) * 4;
      fr.set(data.subarray(src, src + w * 4), y * w * 4);
    }
    out.push(fr);
  }
  return { w, h: height, frames: out };
}

export function hexToRgba(hex, a = 255) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), a] : [0, 0, 0, a];
}
export function rgbaToHex(p) {
  return "#" + [p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function isValidName(name) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(name) && !name.startsWith(".");
}

// ---- tilesets ----
// A tileset is a single sheet image cut into a grid of tw x th tiles, numbered left to right, top to bottom.
// It is edited with the same pixel tools as a sprite: a sprite-shaped object with one frame and a `tile` size.

export const MAX_SHEET = 1024;

export function createTileset(name, tw = 16, th = 16, cols = 8, rows = 4) {
  const s = createSprite(name, tw * cols, th * rows);
  s.fps = 0;
  s.tile = [tw, th];
  return s;
}

export function tilesetCols(s) { return Math.max(1, Math.floor(s.w / s.tile[0])); }
export function tilesetRows(s) { return Math.max(1, Math.floor(s.h / s.tile[1])); }
export function tileCount(s) { return tilesetCols(s) * tilesetRows(s); }

// Tile index under a pixel of the sheet, or -1 outside the whole-tile area.
export function tileIndexAt(s, x, y) {
  const col = Math.floor(x / s.tile[0]), row = Math.floor(y / s.tile[1]);
  if (x < 0 || y < 0 || col >= tilesetCols(s) || row >= tilesetRows(s)) return -1;
  return row * tilesetCols(s) + col;
}

// Change the tile size and/or the number of tiles; existing pixels stay where they are (top-left anchored).
export function resizeSheet(s, tw, th, cols, rows) {
  tw = Math.max(1, Math.min(256, Math.floor(tw))); th = Math.max(1, Math.min(256, Math.floor(th)));
  cols = Math.max(1, Math.floor(cols)); rows = Math.max(1, Math.floor(rows));
  cols = Math.min(cols, Math.floor(MAX_SHEET / tw)); rows = Math.min(rows, Math.floor(MAX_SHEET / th));
  s.tile = [tw, th];
  resize(s, tw * cols, th * rows, MAX_SHEET);
}

export function tilesetToJSON(s) {
  const out = { image: `tilesets/${s.name}.png`, tile_w: s.tile[0], tile_h: s.tile[1] };
  if (s.banks && s.banks.length) out.banks = [...s.banks]; // the tile banks it uses; each tile keeps to one
  return out;
}

// Replace the sheet with imported pixels (RGBA, width x height). The tile size is kept.
export function importSheet(s, width, height, data) {
  s.w = Math.min(MAX_SHEET, width); s.h = Math.min(MAX_SHEET, height);
  const f = blankFrame(s.w, s.h);
  for (let y = 0; y < s.h; y++) f.set(data.subarray(y * width * 4, y * width * 4 + s.w * 4), y * s.w * 4);
  s.frames = [f];
}

// ---- palettes ----
// A palette here is a list of [r, g, b]. Pixels are either fully transparent or fully opaque in a palette-bound sprite.

// The palette colour closest to `rgb` (a "redmean" distance, which tracks how colours look better than plain RGB).
export function nearestRgb(rgb, palette) {
  let best = palette[0], bestD = Infinity;
  for (const p of palette) {
    const rm = (rgb[0] + p[0]) / 2, dr = rgb[0] - p[0], dg = rgb[1] - p[1], db = rgb[2] - p[2];
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

const key = (r, g, b) => (r << 16) | (g << 8) | b;

// Pixels (in RGBA bytes) that are not exactly a palette colour with full opacity. Transparent pixels are fine.
export function offPaletteInPixels(data, palette) {
  const ok = new Set(palette.map((p) => key(p[0], p[1], p[2])));
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    if (data[i + 3] !== 255 || !ok.has(key(data[i], data[i + 1], data[i + 2]))) n++;
  }
  return n;
}
export function offPaletteCount(s, palette) {
  return s.frames.reduce((n, f) => n + offPaletteInPixels(f, palette), 0);
}

// Move every pixel onto the palette: mostly-opaque pixels take the nearest colour, mostly-transparent ones are cleared.
// Returns how many pixels changed.
export function snapPixels(data, palette) {
  const cache = new Map();
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) { if (a !== 0 || data[i] || data[i + 1] || data[i + 2]) { data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0; changed++; } continue; }
    const k = key(data[i], data[i + 1], data[i + 2]);
    let c = cache.get(k);
    if (!c) { c = nearestRgb([data[i], data[i + 1], data[i + 2]], palette); cache.set(k, c); }
    if (a !== 255 || c[0] !== data[i] || c[1] !== data[i + 1] || c[2] !== data[i + 2]) { data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; changed++; }
  }
  return changed;
}
export function snapToPalette(s, palette) {
  return s.frames.reduce((n, f) => n + snapPixels(f, palette), 0);
}

// The distinct opaque colours a sprite uses, over all its frames (for a "limited" palette's counter).
export function usedColors(s) {
  const used = new Set();
  for (const f of s.frames)
    for (let i = 0; i < f.length; i += 4) if (f[i + 3] > 0) used.add(key(f[i], f[i + 1], f[i + 2]));
  return used;
}
export const colorKey = (rgba) => key(rgba[0], rgba[1], rgba[2]);

// May this colour be drawn with, given a limit on distinct colours? (A colour already in use is always fine.)
export function colorAllowed(s, rgba, limit) {
  if (!limit) return true;
  const used = usedColors(s);
  return used.has(colorKey(rgba)) || used.size < limit;
}

// ---------- size guide (Help > Sprite and tile sizes; design section 10) ----------
// What to draw at which size on a 320x240 screen: the new-sprite dialog offers these, and the editor shows the sprite beside squares of
// the same sizes on a mock screen.
export const SIZE_GUIDE = [
  { id: "hero", label: "Hero or main character", w: 24, h: 24, note: "24×24 or 32×32: room for a face and a walk" },
  { id: "enemy", label: "Common enemy", w: 16, h: 16, note: "16×16 to 24×24: readable in a crowd" },
  { id: "big", label: "Big enemy", w: 32, h: 32, note: "32×32 to 48×48: clearly bigger than the crowd" },
  { id: "boss", label: "Boss", w: 48, h: 48, note: "48×48 to 64×64 (64 is the limit)" },
  { id: "small", label: "Bullet, pickup, particle", w: 8, h: 8, note: "8×8, up to 16×16" },
  { id: "icon", label: "Icon", w: 16, h: 16, note: "16×16" },
];
export const REFERENCE_SIZES = [16, 24, 32, 48];
