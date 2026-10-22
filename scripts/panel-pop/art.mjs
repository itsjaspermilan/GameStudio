// Pixel art for Panel Pop & Doc Capsule, drawn in code (see scripts/void-swarm/canvas.mjs for the canvas). Every sprite is { w, h, frames, draw(canvas, frame) }.
import { Canvas, R, K, W } from "../void-swarm/canvas.mjs";

// ---------------------------------------------------------------- panels (16x16)
// frames per colour: 0 normal, 1 squashed (just landed), 2 flash, 3 happy face (being cleared), 4 dim (still rising in), 5 dead (game over)
export const PANEL_STATES = 6;
const sym = {
  heart: ["..###..###..", ".##########.", ".##########.", ".##########.", "..########..", "...######...", "....####....", ".....##....."],
  star: ["....####....", "....####....", "############", ".##########.", "..########..", "..########..", ".####..####.", ".###....###."],
  diamond: ["....####....", "...######...", "..########..", ".##########.", ".##########.", "..########..", "...######...", "....####...."],
  tri: ["############", ".##########.", "..########..", "...######...", "....####....", ".....##....."],
  gem: ["..########..", ".##########.", "############", "############", "############", "############", ".##########.", "..########.."],
};
function circle() { const m = []; for (let y = 0; y < 9; y++) { let r = ""; for (let x = 0; x < 9; x++) r += Math.hypot(x - 4, y - 4) <= 4.3 ? "#" : "."; m.push(r); } return m; }
sym.circle = circle();
export const PANEL_COLORS = [
  { id: "heart", ramp: R.red, sym: sym.heart }, { id: "star", ramp: R.yellow, sym: sym.star }, { id: "circle", ramp: R.green, sym: sym.circle },
  { id: "diamond", ramp: R.teal, sym: sym.diamond }, { id: "tri", ramp: R.blue, sym: sym.tri }, { id: "gem", ramp: R.purple, sym: sym.gem },
];

function roundBox(c, x0, y0, w, h, edge, fill, hi, sh) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
    let v = fill;
    if (x === 0 || x === w - 1 || y === 0 || y === h - 1) v = edge;
    else if (y === 1 && x > 1 && x < w - 2) v = hi;
    else if (x === 1 && y > 1 && y < h - 2) v = hi;
    else if (y === h - 2 && x > 1) v = sh;
    else if (x === w - 2 && y > 1) v = sh;
    c.px(x0 + x, y0 + y, v);
  }
}
function face(c, ox, oy, ramp) {
  c.rect(ox + 4, oy + 5, 2, 3, ramp[0]); c.rect(ox + 10, oy + 5, 2, 3, ramp[0]);
  c.px(ox + 5, oy + 10, ramp[0]); c.px(ox + 10, oy + 10, ramp[0]); c.rect(ox + 6, oy + 11, 4, 1, ramp[0]);
}
function drawPanel(c, p, state) {
  const ramp = state === 5 ? R.grey : p.ramp;
  let h = 16, oy = 0, edge = ramp[0], fill = ramp[2], hi = ramp[3], sh = ramp[1], sc = W, ss = ramp[1];
  if (state === 1) { h = 14; oy = 2; }
  if (state === 2) { fill = W; hi = W; sh = ramp[3]; sc = ramp[2]; ss = ramp[3]; }
  if (state === 4) { fill = ramp[1]; hi = ramp[1]; sh = ramp[0]; sc = ramp[2]; ss = ramp[0]; edge = ramp[0]; }
  if (state === 5) { fill = R.grey[1]; hi = R.grey[2]; sh = R.grey[0]; edge = R.grey[0]; sc = R.grey[2]; ss = R.grey[0]; }
  roundBox(c, 0, oy, 16, h, edge, fill, hi, sh);
  if (state === 3) { face(c, 0, oy, ramp); return; }
  if (state === 5) { c.line(4, 4, 11, 11, R.grey[3]); c.line(11, 4, 4, 11, R.grey[3]); return; }
  const m = p.sym, mw = m[0].length, ox = Math.floor((16 - mw) / 2), sy = oy + Math.floor((h - m.length) / 2);
  c.ascii(m, { "#": ss }, ox + 1, sy + 1);
  c.ascii(m, { "#": sc }, ox, sy);
}
export const PANELS = {
  w: 16, h: 16, frames: PANEL_COLORS.length * PANEL_STATES,
  draw(c, f) { drawPanel(c, PANEL_COLORS[Math.floor(f / PANEL_STATES)], f % PANEL_STATES); },
};

// ---------------------------------------------------------------- garbage blocks (16x16 pieces)
// 0..8: top-left, top, top-right, left, middle, right, bottom-left, bottom, bottom-right; 9..11: one-row left, middle, right; 12 sleepy face, 13 face while it dissolves
// frames 14..27 are the same pieces in steel (chain garbage)
export const GARBAGE_PIECES = 14;
function piece(c, t, l, b, r, ramp) {
  const [dk, md, lt, wh] = ramp;
  c.rect(0, 0, 16, 16, md);
  for (let i = 0; i < 16; i += 4) for (let j = 0; j < 16; j++) { const x = (i + j) % 16; if (x % 8 === 0) c.px(x, j, lt); }
  if (t) c.rect(0, 0, 16, 1, dk); else c.rect(0, 0, 16, 1, md);
  if (b) c.rect(0, 15, 16, 1, dk);
  if (l) c.rect(0, 0, 1, 16, dk);
  if (r) c.rect(15, 0, 1, 16, dk);
  if (t) c.rect(l ? 1 : 0, 1, r ? 14 : 16, 1, wh);
  if (l) c.rect(1, t ? 2 : 0, 1, 16, wh);
  if (b) c.rect(l ? 1 : 0, 14, r ? 14 : 16, 1, dk === ramp[0] ? ramp[0] : dk);
  if (r) c.rect(14, 1, 1, 14, ramp[0]);
  const cut = (x, y) => c.px(x, y, -1);
  if (t && l) cut(0, 0); if (t && r) cut(15, 0); if (b && l) cut(0, 15); if (b && r) cut(15, 15);
}
function drawGarbage(c, f) {
  const steel = f >= GARBAGE_PIECES; if (steel) f -= GARBAGE_PIECES;
  const ramp = steel ? [K, R.grey[2], R.grey[1], W] : [R.purple[0], R.purple[1], R.purple[2], R.purple[3]];
  const e = [[1, 1, 0, 0], [1, 0, 0, 0], [1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 1, 1], [1, 1, 1, 0], [1, 0, 1, 0], [1, 0, 1, 1]];
  if (f < 12) { const [t, l, b, r] = e[f]; piece(c, t, l, b, r, ramp); return; }
  const ink = steel ? K : R.purple[0];
  if (f === 12) { c.rect(4, 6, 3, 2, ink); c.rect(9, 6, 3, 2, ink); c.rect(6, 10, 4, 1, ink); }
  else { c.rect(4, 5, 3, 3, ink); c.rect(9, 5, 3, 3, ink); c.px(5, 6, W); c.px(10, 6, W); c.rect(6, 10, 4, 2, ink); c.rect(7, 11, 2, 1, R.red[2]); }
}
export const GARBAGE = { w: 16, h: 16, frames: GARBAGE_PIECES * 2, draw: drawGarbage };

// ---------------------------------------------------------------- characters (32x32): 0 idle, 1 blink, 2 happy, 3 dizzy
const CHAR_DEFS = [
  { id: "pip", name: "PIP", ramp: R.yellow, belly: R.orange[3], feat: "tuft", cheek: R.red[7] },
  { id: "bloop", name: "BLOOP", ramp: R.green, belly: R.green[3], feat: "leaf", cheek: R.yellow[3] },
  { id: "fuzz", name: "FUZZ", ramp: R.orange, belly: R.orange[3], feat: "ears", cheek: R.red[7] },
  { id: "kit", name: "KIT", ramp: R.blue, belly: R.blue[3], feat: "cat", cheek: R.purple[3] },
  { id: "spike", name: "SPIKE", ramp: R.purple, belly: R.purple[3], feat: "spikes", cheek: R.red[7] },
  { id: "puff", name: "PUFF", ramp: [R.grey[2], R.grey[2], R.grey[3], W], belly: W, feat: "cloud", cheek: R.red[7] },
  { id: "ember", name: "EMBER", ramp: R.red, belly: R.orange[3], feat: "flame", cheek: R.yellow[3] },
  { id: "frost", name: "FROST", ramp: R.teal, belly: R.teal[3], feat: "ice", cheek: R.blue[3] },
  { id: "shade", name: "SHADE", ramp: [K, R.grey[0], R.grey[1], R.purple[1]], belly: R.purple[0], feat: "ghost", cheek: R.purple[2] },
];
export { CHAR_DEFS };
function eyeAt(c, x, y, expr, ramp) {
  if (expr === 1) { c.rect(x - 2, y + 1, 5, 1, K); return; }
  if (expr === 2) { c.px(x - 2, y + 2, K); c.px(x - 1, y + 1, K); c.px(x, y, K); c.px(x + 1, y + 1, K); c.px(x + 2, y + 2, K); return; }
  if (expr === 3) { c.line(x - 2, y - 1, x + 2, y + 3, K); c.line(x + 2, y - 1, x - 2, y + 3, K); return; }
  c.rect(x - 2, y - 1, 5, 6, W); c.rect(x - 1, y - 2, 3, 8, W); c.rect(x - 1, y + 1, 3, 3, K); c.px(x - 1, y + 1, W);
}
function drawChar(c, d, expr) {
  const bob = expr === 0 ? 0 : 0, cx = 16, cy = 19 + bob, [dk, md, lt, wh] = d.ramp;
  const f = d.feat;
  if (f === "cloud") { for (const [x, y, r] of [[8, 14, 6], [24, 14, 6], [12, 9, 6], [20, 9, 6], [16, 7, 5]]) c.sphere(x, y + 2, r, d.ramp); }
  if (f === "ears" || f === "cat") {
    const inner = f === "cat" ? R.purple[3] : R.red[7];
    c.poly([[4, 12], [6, 2], [14, 8]], md); c.poly([[28, 12], [26, 2], [18, 8]], md);
    c.poly([[6, 10], [7, 5], [11, 8]], inner); c.poly([[26, 10], [25, 5], [21, 8]], inner);
  }
  if (f === "spikes") for (const x of [6, 10, 14, 18, 22, 26]) c.poly([[x - 3, 11], [x, 1 + Math.abs(x - 16) / 4], [x + 3, 11]], R.purple[0]);
  if (f === "ice") for (const [x, h] of [[9, 8], [16, 4], [23, 8]]) c.poly([[x - 3, 13], [x, h], [x + 3, 13]], R.teal[3]);
  if (f === "flame") {
    c.poly([[8, 12], [10, 3], [14, 9], [16, 0], [19, 9], [23, 3], [24, 12]], R.orange[2]);
    c.poly([[12, 12], [14, 7], [16, 4], [18, 7], [20, 12]], R.yellow[3]);
  }
  if (f === "ghost") { c.poly([[8, 26], [8, 30], [12, 27], [16, 30], [20, 27], [24, 30], [24, 26]], R.grey[1]); }
  c.sphere(cx, cy, 11, d.ramp, -0.5, -0.6, 12, 11);
  c.ellipse(cx, cy + 4, 7, 5, d.belly);
  if (f === "ghost") c.ellipse(cx, cy + 4, 7, 5, R.purple[0]);
  if (f === "leaf") { c.line(16, 9, 16, 4, R.green[0]); c.poly([[16, 5], [22, 1], [24, 6], [18, 7]], R.green[2]); c.poly([[16, 5], [10, 2], [9, 6], [14, 7]], R.green[3]); }
  if (f === "tuft") { c.line(15, 8, 13, 3, R.orange[1]); c.line(16, 8, 16, 2, R.orange[1]); c.line(17, 8, 20, 3, R.orange[1]); }
  if (f === "cat") { c.line(2, 21, 8, 20, K); c.line(2, 24, 8, 22, K); c.line(30, 21, 24, 20, K); c.line(30, 24, 24, 22, K); }
  if (f === "ghost") { c.poly([[9, 10], [10, 3], [13, 7], [16, 1], [19, 7], [22, 3], [23, 10]], R.yellow[2]); c.rect(9, 9, 14, 2, R.yellow[1]); }
  eyeAt(c, 11, 15 + bob, expr, d.ramp); eyeAt(c, 21, 15 + bob, expr, d.ramp);
  c.rect(7, 21, 3, 2, d.cheek); c.rect(22, 21, 3, 2, d.cheek);
  if (expr === 2) { c.rect(13, 21, 6, 3, K); c.rect(14, 23, 4, 1, R.red[5]); c.rect(13, 21, 6, 1, W); }
  else if (expr === 3) { c.px(13, 24, K); c.px(14, 23, K); c.px(15, 24, K); c.px(16, 23, K); c.px(17, 24, K); c.px(18, 23, K); }
  else { c.px(14, 22, K); c.px(15, 23, K); c.px(16, 23, K); c.px(17, 23, K); c.px(18, 22, K); }
  c.outline(K);
}
export const CHARS = CHAR_DEFS.map((d) => ({ id: d.id, w: 32, h: 32, frames: 4, draw: (c, f) => drawChar(c, d, f) }));

// ---------------------------------------------------------------- Doc Capsule: capsules, viruses (12x12 in 16x16 frames), big viruses, the doctor
export const DM_COLORS = [R.red, R.yellow, R.blue]; // red, yellow, blue
// frames per colour: 0 single, 1 left half, 2 right half, 3 top half, 4 bottom half, 5 popping
function pillShape(c, ramp, kind) {
  const [dk, md, lt, wh] = ramp;
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    const dx = x + 0.5 - 6, dy = y + 0.5 - 6, round = Math.hypot(dx, dy) <= 6;
    let inside;
    if (kind === 0) inside = round;
    else if (kind === 1) inside = x < 6 ? round : true;
    else if (kind === 2) inside = x >= 6 ? round : true;
    else if (kind === 3) inside = y < 6 ? round : true;
    else inside = y >= 6 ? round : true;
    if (!inside) continue;
    c.px(x, y, md);
  }
  // outline, then light from the top left
  const keep = new Canvas(12, 12); keep.stamp(c, 0, 0);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
    if (keep.get(x, y) === -1) continue;
    const edge = keep.get(x - 1, y) === -1 || keep.get(x + 1, y) === -1 || keep.get(x, y - 1) === -1 || keep.get(x, y + 1) === -1;
    if (edge) { c.px(x, y, dk); continue; }
    const inner = keep.get(x - 2, y) === -1 || keep.get(x, y - 2) === -1;
    const inner2 = keep.get(x + 2, y) === -1 || keep.get(x, y + 2) === -1;
    if (inner && (x + y) % 1 === 0 && !inner2) c.px(x, y, lt);
    else if (inner2) c.px(x, y, ramp[1]);
  }
  const hx = kind === 2 ? 3 : 2, hy = kind === 4 ? 3 : 2;
  c.px(hx + 1, hy + 1, wh);
}
function pillPop(c, ramp) {
  const pts = [[6, 1], [6, 10], [1, 6], [10, 6], [2, 2], [9, 2], [2, 9], [9, 9]];
  for (const [x, y] of pts) { c.rect(x - 1, y - 1, 2, 2, ramp[2]); c.px(x, y, W); }
  c.px(6, 6, W); c.px(5, 5, ramp[3]); c.px(6, 5, ramp[3]); c.px(5, 6, ramp[3]);
}
export const PILLS = { w: 16, h: 16, frames: 18, draw(c, f) { const col = DM_COLORS[Math.floor(f / 6)], k = f % 6; if (k === 5) pillPop(c, col); else pillShape(c, col, k); } };

function virusSmall(c, col, f) {
  const ramp = DM_COLORS[col], [dk, md, lt, wh] = ramp, up = f === 1;
  if (f === 2) { // cleared: a sad flat blob
    c.ellipse(6, 8, 5, 3, md); c.outline(dk); c.px(4, 8, K); c.px(8, 8, K); return;
  }
  const bob = up ? -1 : 0;
  c.sphere(6, 6.5 + bob, 5, ramp);
  if (col === 0) { c.poly([[2, 3 + bob], [3, 0], [5, 3 + bob]], dk); c.poly([[7, 3 + bob], [9, 0], [10, 3 + bob]], dk); }
  if (col === 1) { for (const x of [2, 5, 8]) c.px(x, 0 + (up ? 1 : 0), dk); c.px(6, 11, dk); c.px(2, 10, dk); c.px(9, 10, dk); }
  if (col === 2) { c.px(6, 0, dk); c.px(6, 1 + bob, dk); c.px(5, 0, md); c.px(7, 0, md); c.px(0, 6 + (up ? -2 : 1), dk); c.px(11, 6 + (up ? -2 : 1), dk); }
  c.outline(dk);
  if (col === 2) { c.rect(4, 5 + bob, 4, 3, W); c.rect(5, 6 + bob, 2, 2, K); }
  else { c.rect(3, 5 + bob, 2, 3, W); c.rect(7, 5 + bob, 2, 3, W); c.px(4, 6 + bob, K); c.px(8, 6 + bob, K); }
  c.rect(4, 9 + bob, 4, 1, dk);
  if (up) c.px(3, 9 + bob, dk), c.px(8, 9 + bob, dk);
}
export const VIRUSES = { w: 16, h: 16, frames: 9, draw: (c, f) => virusSmall(c, Math.floor(f / 3), f % 3) };

// big viruses for the magnifier: 0/1 dance, 2 laugh, 3 sad
function virusBig(c, col, f) {
  const ramp = DM_COLORS[col], [dk, md, lt, wh] = ramp, dance = f === 1 ? -2 : 0, laugh = f === 2, sad = f === 3;
  const y0 = 17 + dance;
  c.sphere(16, y0, 12, ramp, -0.5, -0.6);
  if (col === 0) { c.poly([[6, y0 - 8], [8, 1 + dance], [13, y0 - 10]], dk); c.poly([[19, y0 - 10], [24, 1 + dance], [26, y0 - 8]], dk); }
  if (col === 1) { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.line(16 + Math.cos(a) * 11, y0 + Math.sin(a) * 11, 16 + Math.cos(a) * 15, y0 + Math.sin(a) * 15, dk); } }
  if (col === 2) { c.line(16, y0 - 12, 16, 2, dk); c.disc(16, 2, 2, lt); c.line(3, y0, 0, y0 - 6 - (f === 1 ? 4 : 0), dk); c.line(29, y0, 31, y0 - 6 - (f === 1 ? 4 : 0), dk); }
  c.outline(dk);
  if (col === 2) { c.ellipse(16, y0 - 2, 6, 5, W); c.disc(16 + (sad ? 0 : 1), y0 - 2, 2.5, K); }
  else { c.ellipse(11, y0 - 2, 3.5, 4.5, W); c.ellipse(21, y0 - 2, 3.5, 4.5, W); c.disc(sad ? 11 : 12, y0 - 1, 1.7, K); c.disc(sad ? 21 : 22, y0 - 1, 1.7, K); }
  if (laugh) { c.ellipse(16, y0 + 7, 6, 4, K); c.ellipse(16, y0 + 9, 4, 2, R.red[6]); c.rect(11, y0 + 3, 10, 2, W); }
  else if (sad) { c.px(12, y0 + 9, dk); c.line(11, y0 + 9, 14, y0 + 7, dk); c.line(14, y0 + 7, 18, y0 + 7, dk); c.line(18, y0 + 7, 21, y0 + 9, dk); }
  else { c.line(11, y0 + 6, 14, y0 + 8, dk); c.line(14, y0 + 8, 18, y0 + 8, dk); c.line(18, y0 + 8, 21, y0 + 6, dk); }
}
export const BIG_VIRUSES = { w: 32, h: 32, frames: 12, draw: (c, f) => virusBig(c, Math.floor(f / 4), f % 4) };

// the doctor: 0 idle, 1 arm up (about to throw), 2 throw, 3 cheer, 4 sulk
function drawDoc(c, f) {
  const skin = R.orange[3], hair = R.orange[0], coat = W, shade = R.grey[2], teal = R.teal[1];
  // body
  c.poly([[8, 31], [9, 17], [23, 17], [24, 31]], coat); c.rect(9, 17, 3, 14, shade); c.line(16, 18, 16, 31, shade);
  c.rect(11, 20, 2, 2, R.red[5]); c.rect(19, 20, 2, 2, teal);
  c.poly([[14, 17], [18, 17], [16, 22]], R.red[6]);
  // arms
  const arm = (x0, y0, x1, y1) => { c.line(x0, y0, x1, y1, coat); c.line(x0 + 1, y0, x1 + 1, y1, coat); c.line(x0 + 2, y0, x1 + 2, y1, coat); c.disc(x1 + 1, y1, 2, skin); };
  if (f === 0) { arm(7, 18, 5, 27); arm(23, 18, 25, 27); }
  if (f === 1) { arm(7, 18, 5, 27); arm(23, 18, 26, 8); }
  if (f === 2) { arm(7, 18, 5, 27); arm(23, 18, 28, 20); }
  if (f === 3) { arm(7, 18, 3, 8); arm(23, 18, 28, 8); }
  if (f === 4) { arm(7, 18, 9, 26); arm(23, 18, 21, 26); }
  // head
  c.disc(16, 10, 8, skin); c.rect(8, 6, 16, 3, hair);
  c.poly([[7, 7], [9, 2], [23, 2], [25, 7]], W); c.rect(7, 7, 18, 2, shade);
  c.disc(16, 4, 3, R.red[6]); c.rect(15, 3, 2, 2, W);
  if (f === 3) { c.px(11, 11, K); c.px(12, 10, K); c.px(13, 11, K); c.px(19, 11, K); c.px(20, 10, K); c.px(21, 11, K); c.rect(13, 14, 6, 2, K); }
  else if (f === 4) { c.line(11, 10, 13, 12, K); c.line(13, 10, 11, 12, K); c.line(19, 10, 21, 12, K); c.line(21, 10, 19, 12, K); c.line(13, 16, 19, 15, K); }
  else { c.rect(11, 10, 2, 3, K); c.rect(19, 10, 2, 3, K); c.rect(14, 15, 4, 1, K); }
  c.rect(8, 11, 2, 2, R.red[7]); c.rect(22, 11, 2, 2, R.red[7]);
  c.outline(K);
}
export const DOC = { w: 32, h: 32, frames: 5, draw: drawDoc };

// ---------------------------------------------------------------- backgrounds (64x64 tiles that repeat) and a few small icons
export function bgTile(hue, variant) {
  // dark and quiet: the game is drawn over it, and one opaque tile layer costs one screen of drawing (the boards use most of the budget)
  const c = new Canvas(64, 64), base = hue[0], md = K;
  c.rect(0, 0, 64, 64, base);
  if (variant % 3 === 0) { for (let y = 0; y < 64; y += 16) for (let x = 0; x < 64; x += 16) if (((x + y) / 16) % 2 === 0) c.rect(x, y, 16, 16, md); }
  else if (variant % 3 === 1) { for (let i = -64; i < 64; i += 16) for (let t = 0; t < 8; t++) { c.line(i, 0 + t, i + 64, 64 + t, md); } }
  else { for (let y = 8; y < 64; y += 32) for (let x = 8; x < 64; x += 32) { c.disc(x + 8, y + 8, 8, md); c.disc(x + 8, y + 8, 4, base); } }
  return c;
}
export const ICONS = [
  { id: "arrow", w: 8, h: 8, frames: 1, draw(c) { c.ascii(["..##....", "..###...", "..####..", "..#####.", "..####..", "..###...", "..##....", "........"], { "#": W }); c.outline(K); } },
  { id: "star", w: 8, h: 8, frames: 2, draw(c, f) { c.ascii(["...##...", "...##...", "########", ".######.", "..####..", ".##..##.", ".#....#.", "........"], { "#": f ? R.yellow[3] : R.yellow[2] }); } },
  { id: "spark", w: 8, h: 8, frames: 3, draw(c, f) { const s = [1, 2, 3][f]; c.rect(4 - s, 4, s * 2, 1, W); c.rect(4, 4 - s, 1, s * 2, W); } },
];
