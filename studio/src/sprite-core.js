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

// Frames belong to animations (see "animations" below): a new frame joins the animation of the frame before it, a deleted one leaves its
// animation (an animation left with no frames goes), and a frame only moves within its own animation.
export function addFrame(s, at = s.frames.length) {
  if (s.frames.length >= MAX_FRAMES) return false;
  insertFrame(s, at, blankFrame(s.w, s.h), ownerOf(s, Math.max(0, at - 1)));
  return true;
}
export function duplicateFrame(s, f) {
  if (s.frames.length >= MAX_FRAMES) return false;
  insertFrame(s, f + 1, new Uint8ClampedArray(s.frames[f]), ownerOf(s, f));
  return true;
}
export function deleteFrame(s, f) {
  if (s.frames.length <= 1) return false;
  const owner = ownerOf(s, f);
  s.frames.splice(f, 1);
  for (const [name, a] of Object.entries(s.animations || {})) {
    if (name === owner) { a.to -= 1; if (a.to < a.from) delete s.animations[name]; }
    else if (a.from > f) { a.from -= 1; a.to -= 1; }
  }
  return true;
}
export function moveFrame(s, f, to) {
  if (to < 0 || to >= s.frames.length || f === to || ownerOf(s, f) !== ownerOf(s, to)) return false;
  const [fr] = s.frames.splice(f, 1);
  s.frames.splice(to, 0, fr);
  return true;
}
// Move a frame to the end of another animation (dragged onto it). Its own animation goes if it was its last frame. Returns where the frame
// is now, or -1 when it cannot move there.
export function moveFrameToAnimation(s, f, name) {
  const owner = ownerOf(s, f), target = s.animations && s.animations[name];
  if (!owner || !target || owner === name) return -1;
  const data = s.frames[f];
  deleteFrame(s, f);
  insertFrame(s, target.to + 1, data, name);
  return target.to;
}
// a new blank frame at the end of an animation (null: the sprite's only, unnamed one)
export function addFrameTo(s, name) {
  const a = name && s.animations && s.animations[name];
  return addFrame(s, a ? a.to + 1 : s.frames.length);
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

// ---- selection (the Select tool: mark a box, then move, copy, cut or delete the pixels in it) ----
// A box is { x, y, w, h } in pixels; lifted pixels are { w, h, data } (RGBA bytes, like a frame).

// The box between two corners (both included), kept inside the picture; null when it misses the picture.
export function boxBetween(s, a, b) {
  const x0 = Math.max(0, Math.min(a[0], b[0])), y0 = Math.max(0, Math.min(a[1], b[1]));
  const x1 = Math.min(s.w - 1, Math.max(a[0], b[0])), y1 = Math.min(s.h - 1, Math.max(a[1], b[1]));
  return x1 < x0 || y1 < y0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
export const inBox = (box, x, y) => !!box && x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h;

// A copy of the pixels in a box (outside the picture counts as see-through).
export function copyArea(s, f, box) {
  const data = new Uint8ClampedArray(box.w * box.h * 4), src = s.frames[f];
  for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
    const sx = box.x + x, sy = box.y + y;
    if (!inBounds(s, sx, sy)) continue;
    const i = (sy * s.w + sx) * 4, o = (y * box.w + x) * 4;
    data[o] = src[i]; data[o + 1] = src[i + 1]; data[o + 2] = src[i + 2]; data[o + 3] = src[i + 3];
  }
  return { w: box.w, h: box.h, data };
}
export function clearArea(s, f, box) {
  for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) setPixel(s, f, x, y, [0, 0, 0, 0]);
}
// Take the pixels out of the picture (what is left behind is see-through), to move them.
export function liftArea(s, f, box) { const b = copyArea(s, f, box); clearArea(s, f, box); return b; }
// Put lifted pixels down with their top-left at x, y. See-through pixels leave what is under them, and pixels past the edge are dropped.
export function stampArea(s, f, buf, x, y) {
  for (let yy = 0; yy < buf.h; yy++) for (let xx = 0; xx < buf.w; xx++) {
    const o = (yy * buf.w + xx) * 4;
    if (buf.data[o + 3] > 0) setPixel(s, f, x + xx, y + yy, [buf.data[o], buf.data[o + 1], buf.data[o + 2], buf.data[o + 3]]);
  }
}
// Lifted pixels mirrored left to right (a walk cycle facing the other way, a symmetric shape drawn by halves).
export function flipArea(buf) {
  const data = new Uint8ClampedArray(buf.data.length);
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    const i = (y * buf.w + x) * 4, o = (y * buf.w + (buf.w - 1 - x)) * 4;
    data[o] = buf.data[i]; data[o + 1] = buf.data[i + 1]; data[o + 2] = buf.data[i + 2]; data[o + 3] = buf.data[i + 3];
  }
  return { w: buf.w, h: buf.h, data };
}

// ---- sprites written as text (Help pages and the starter game carry their art this way) ----
// Each frame is a list of rows, one character a pixel: "." is see-through, 1-9 and a-f are places 1 to 15 in a colour bank (the bank's
// colours as "#rrggbb", in order). Returns the sprite's JSON text and its picture as { width, height, data } (the frames side by side).
//   spriteFromText("coin", { frames: [["..33..", ".3443."]], bank: "items", origin: [3, 1] }, colors)
export function spriteFromText(name, spec, colors) {
  const frames = spec.frames, h = frames[0].length, w = frames[0][0].length;
  const s = createSprite(name, w, h);
  s.frames = frames.map((rows, fi) => {
    if (rows.length !== h || rows.some((r) => r.length !== w)) throw new Error(`${name}: every row of every frame must be ${w} characters, and every frame ${h} rows (frame ${fi + 1})`);
    const data = blankFrame(w, h);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === "." || ch === " ") return;
      const place = parseInt(ch, 16);
      const hex = place >= 1 && colors[place - 1];
      if (!hex) throw new Error(`${name}: '${ch}' (frame ${fi + 1}, row ${y + 1}) is not a place in the bank (1-9, a-f)`);
      const i = (y * w + x) * 4, rgba = hexToRgba(hex);
      data[i] = rgba[0]; data[i + 1] = rgba[1]; data[i + 2] = rgba[2]; data[i + 3] = 255;
    }));
    return data;
  });
  s.origin = spec.origin || [w >> 1, h >> 1];
  s.mask = spec.mask || null;
  s.fps = spec.fps ?? (frames.length > 1 ? 8 : 6);
  if (spec.animations) s.animations = normalizeAnimations(spec.animations, frames.length, s.fps);
  if (spec.bank) s.bank = spec.bank;
  const json = JSON.stringify(toJSON(s), null, 2) + "\n";
  return { json, png: packStrip(s) };
}

// ---- history ----

export function snapshot(s) {
  return {
    w: s.w, h: s.h, origin: [...s.origin], mask: s.mask ? [...s.mask] : null, fps: s.fps, tile: s.tile ? [...s.tile] : null,
    bank: s.bank, banks: s.banks ? [...s.banks] : undefined, kinds: s.kinds ? JSON.parse(JSON.stringify(s.kinds)) : undefined,
    solid_kinds: s.solid_kinds ? [...s.solid_kinds] : undefined,
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
  if (snap.kinds) s.kinds = JSON.parse(JSON.stringify(snap.kinds)); else delete s.kinds;
  if (snap.solid_kinds) s.solid_kinds = [...snap.solid_kinds]; else delete s.solid_kinds;
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

// ---- animations: named runs of frames ("walk" = frames 2 to 5) that an entity plays with self:play("walk") ----
// Stored as {from, to, fps, loop} with 0-based frame numbers (the editor shows them from 1). A sprite with none is one unnamed animation:
// every frame, looping at the sprite's fps. Once one is named, every frame belongs to exactly one animation and the animations follow each
// other in the strip (idle 0-1, walk 2-5, jump 6-7); the first is what an entity shows until it plays another. The file format is the
// same either way, so games and the engine read old and new sprites alike.

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

const byStart = (anims) => Object.entries(anims || {}).sort((x, y) => x[1].from - y[1].from || (x[0] < y[0] ? -1 : 1));
// the animation a frame belongs to, or null when none is named
export function ownerOf(s, f) {
  for (const [name, a] of Object.entries(s.animations || {})) if (f >= a.from && f <= a.to) return name;
  return null;
}
// Put a frame in at `at`; the animation `owner` gets one frame longer and the animations after it move along.
function insertFrame(s, at, data, owner) {
  s.frames.splice(at, 0, data);
  for (const [name, a] of Object.entries(s.animations || {})) {
    if (name === owner) a.to += 1;
    else if (a.from >= at) { a.from += 1; a.to += 1; }
  }
}
// The animations in the order of the strip, as the editor groups the frames: [{ name, from, to, fps, loop }]; one with name null when
// none is named.
export function animationGroups(s) {
  const list = byStart(s.animations);
  if (!list.length) return [{ name: null, from: 0, to: s.frames.length - 1, fps: s.fps, loop: true }];
  return list.map(([name, a]) => ({ name, ...a }));
}
// Do the animations follow each other, covering every frame once?
export function animationsTidy(anims, frameCount) {
  const list = byStart(anims);
  if (!list.length) return true;
  let next = 0;
  for (const [, a] of list) { if (a.from !== next || a.to < a.from) return false; next = a.to + 1; }
  return next === frameCount;
}
// Older sprites could share frames between animations or leave frames out. Make them tidy: each animation gets its own copy of its frames,
// in order, and frames no animation used become an animation called "frames". Returns true when the sprite changed.
export function tidyAnimations(s) {
  if (animationsTidy(s.animations, s.frames.length)) return false;
  const frames = [], anims = {}, used = new Set();
  for (const [name, a] of byStart(s.animations)) {
    const from = frames.length;
    for (let i = a.from; i <= a.to; i++) { frames.push(new Uint8ClampedArray(s.frames[i])); used.add(i); }
    anims[name] = { ...a, from, to: frames.length - 1 };
  }
  const rest = s.frames.map((_, i) => i).filter((i) => !used.has(i));
  if (rest.length) {
    let name = "frames", n = 2;
    while (anims[name]) name = "frames" + n++;
    const from = frames.length;
    for (const i of rest) frames.push(new Uint8ClampedArray(s.frames[i]));
    anims[name] = { from, to: frames.length - 1, fps: s.fps || 6, loop: true };
  }
  s.frames = frames; s.animations = anims;
  return true;
}

// Name an animation. The first one takes every frame the sprite has; after that a new one starts with one blank frame at the end.
export function addAnimation(s, name) {
  s.animations = s.animations || {};
  if (!isValidAnimationName(name) || s.animations[name]) return false;
  if (!Object.keys(s.animations).length) { s.animations[name] = { from: 0, to: s.frames.length - 1, fps: s.fps || 6, loop: true }; return true; }
  if (s.frames.length >= MAX_FRAMES) return false;
  s.frames.push(blankFrame(s.w, s.h));
  s.animations[name] = { from: s.frames.length - 1, to: s.frames.length - 1, fps: s.fps || 6, loop: true };
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

// Delete an animation and its frames. The last one only loses its name: its frames stay and loop as the whole sprite, at its speed.
export function removeAnimation(s, name) {
  const anims = s.animations || {}, a = anims[name];
  if (!a) return false;
  if (Object.keys(anims).length === 1) { s.fps = a.fps; delete anims[name]; return true; }
  const n = a.to - a.from + 1;
  s.frames.splice(a.from, n);
  delete anims[name];
  for (const b of Object.values(anims)) if (b.from > a.from) { b.from -= n; b.to -= n; }
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
  if (s.kinds && Object.keys(s.kinds).length) out.kinds = JSON.parse(JSON.stringify(s.kinds));
  // only the wall kinds some tile still has: the list stays as short as what the tileset uses
  const walls = (s.solid_kinds || []).filter((k) => s.kinds && s.kinds[k]);
  if (walls.length) out.solid_kinds = walls;
  return out;
}

// ---- tile kinds ----
// What a tile is on a layer marked solid (engine/gs/world.lua, Entity:slide): every tile is "solid" unless the tileset's kinds give it
// another one: "oneway" (a platform stood on from above), or any name the game asks about ("spike", "ice"). Kept as the engine reads it,
// { oneway: [8, 9], spike: [20] }, tile numbers in order, no empty lists, and nothing for "solid".
export const TILE_KINDS = ["solid", "oneway", "spike", "ice", "water", "ladder"];
export function tileKind(s, index) {
  for (const [kind, list] of Object.entries(s.kinds || {})) if (list.includes(index)) return kind;
  return "solid";
}
// A named kind can still stop things like "solid" (ice, crates: walls the game wants to tell apart), listed in solid_kinds.
export function isWallKind(s, kind) { return kind === "solid" || (s.solid_kinds || []).includes(kind); }
export function setWallKind(s, kind, on) {
  if (kind === "solid" || kind === "oneway") return;
  const now = (s.solid_kinds || []).filter((k) => k !== kind);
  if (on) now.push(kind);
  if (now.length) s.solid_kinds = now.sort(); else delete s.solid_kinds;
}
export function setTileKind(s, index, kind) {
  kind = String(kind || "solid").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_") || "solid";
  const kinds = s.kinds || {};
  for (const k of Object.keys(kinds)) {
    kinds[k] = kinds[k].filter((i) => i !== index);
    if (!kinds[k].length) delete kinds[k];
  }
  if (kind !== "solid") kinds[kind] = [...(kinds[kind] || []), index].sort((a, b) => a - b);
  if (Object.keys(kinds).length) s.kinds = kinds; else delete s.kinds;
  return kind;
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
// What to draw at which size on a 256x192 screen: the new-sprite dialog offers these, and the editor shows the sprite beside squares of
// the same sizes on a mock screen.
// The sizes are GBA proportions on Glow43's taller screen: a GBA hero of about 16x24 is 15% of its 160 lines, which is about 29 on 192,
// so 32 is the nearest multiple of 8.
export const SIZE_GUIDE = [
  { id: "hero", label: "Hero or main character", w: 32, h: 32, note: "32×32, up to 48×48: room for a face, shading and a walk" },
  { id: "enemy", label: "Common enemy", w: 24, h: 24, note: "24×24 to 32×32: readable in a crowd" },
  { id: "big", label: "Big enemy", w: 48, h: 48, note: "48×48 to 64×64: clearly bigger than the crowd" },
  { id: "boss", label: "Boss", w: 96, h: 96, note: "64×64 to 128×128 (128 is the limit)" },
  { id: "small", label: "Bullet, pickup, particle", w: 8, h: 8, note: "8×8, up to 16×16" },
  { id: "icon", label: "Icon", w: 16, h: 16, note: "16×16" },
];
export const REFERENCE_SIZES = [16, 32, 48, 64];
