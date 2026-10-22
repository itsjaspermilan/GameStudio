// Pixel art for Panel Pop, drawn in code (see scripts/lib/canvas.mjs for the canvas). Every sprite is { w, h, frames, draw(canvas, frame) }.
// The look is a bright 16-bit one: light pastel backgrounds, white windows, glossy panels, and outlines in each thing's own darkest shade
// rather than black (only the font's shadow and the eyes use the darkest navy).
import { Canvas, R, W } from "../lib/canvas.mjs";

const NAVY = R.blue[0];

// ---------------------------------------------------------------- the font: 5x7 letters in 8x8 frames, " " to "Z" (frame 0 is the space)
// Each letter has a one pixel shadow down and to the right. Four inks: dark and coral for the white windows, white and gold for colour and
// the dark board wells.
const GLYPHS = {
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "#": [".#.#.", "#####", ".#.#.", ".#.#.", ".#.#.", "#####", ".#.#."],
  "%": ["##..#", "##..#", "...#.", "..#..", ".#...", "#..##", "#..##"],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "'": ["..#..", "..#..", ".....", ".....", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  ",": [".....", ".....", ".....", ".....", "..##.", "..#..", ".#..."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
  3: [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".#...", "#...."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "?": [".###.", "#...#", "....#", "..##.", "..#..", ".....", "..#.."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["###..", "#..#.", "#...#", "#...#", "#...#", "#..#.", "###.."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".###.", "#...#", "#....", ".###.", "....#", "#...#", ".###."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
};
const FONT_FIRST = 32, FONT_LAST = 90; // " " to "Z": the game writes in capitals
function fontSprite(ink, shadow) {
  return {
    w: 8, h: 8, frames: FONT_LAST - FONT_FIRST + 1,
    draw(c, f) {
      const g = GLYPHS[String.fromCharCode(FONT_FIRST + f)];
      if (!g) return;
      c.ascii(g, { "#": shadow }, 2, 1);
      c.ascii(g, { "#": ink }, 1, 0);
    },
  };
}
export const FONTS = [
  { id: "spr_font", ...fontSprite(NAVY, R.blue[3]) },
  { id: "spr_font_w", ...fontSprite(W, NAVY) },
  { id: "spr_font_r", ...fontSprite(R.red[2], R.red[3]) },
  { id: "spr_font_y", ...fontSprite(R.yellow[2], NAVY) },
];

// ---------------------------------------------------------------- panels (16x16)
// frames per colour: 0 normal, 1 squashed (just landed), 2 flash, 3 happy face (being cleared), 4 dim (still rising in), 5 dead (game over)
export const PANEL_STATES = 6;
function disc(n, r, cx, cy) { const m = []; for (let y = 0; y < n; y++) { let s = ""; for (let x = 0; x < n; x++) s += Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r ? "#" : "."; m.push(s); } return m; }
function moon() {
  const a = disc(10, 4.9, 5, 5), b = disc(10, 4.1, 7.2, 3.6);
  return a.map((row, y) => [...row].map((ch, x) => (ch === "#" && b[y][x] !== "#" ? "#" : ".")).join(""));
}
const SYM = {
  heart: [".##....##.", "####..####", "##########", "##########", "##########", ".########.", "..######..", "...####...", "....##...."],
  star: ["....##....", "....##....", "...####...", "##########", ".########.", "..######..", "..######..", ".###..###.", ".##....##."],
  circle: disc(9, 4.4, 4.5, 4.5),
  diamond: ["....##....", "...####...", "..######..", ".########.", "##########", ".########.", "..######..", "...####...", "....##...."],
  tri: ["....##....", "....##....", "...####...", "...####...", "..######..", "..######..", ".########.", ".########.", "##########"],
  moon: moon(),
};
export const PANEL_COLORS = [
  { id: "heart", ramp: R.red, sym: SYM.heart }, { id: "star", ramp: R.yellow, sym: SYM.star }, { id: "circle", ramp: R.green, sym: SYM.circle },
  { id: "diamond", ramp: R.teal, sym: SYM.diamond }, { id: "tri", ramp: R.blue, sym: SYM.tri }, { id: "moon", ramp: R.purple, sym: SYM.moon },
];

// A rounded, bevelled block: outline, a light rim top and left, a shaded rim bottom and right, and a soft shine in the top-left corner.
function block(c, x0, y0, w, h, { edge, fill, hi, sh, shine }) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = x < 2 ? 2 - x : x > w - 3 ? x - (w - 3) : 0, cy = y < 2 ? 2 - y : y > h - 3 ? y - (h - 3) : 0;
    if (cx + cy > 2) continue; // rounded corners
    let v = fill;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || cx + cy === 2) v = edge;
    else if (y === 1 || x === 1) v = hi;
    else if (y === h - 2 || x === w - 2) v = sh;
    c.px(x0 + x, y0 + y, v);
  }
  if (shine !== undefined) { c.rect(x0 + 2, y0 + 2, 3, 1, shine); c.px(x0 + 2, y0 + 3, shine); }
}
// shadeRows: how many bottom rows take the shade; corner: also shade the bottom-right quarter (a curved gloss on small symbols)
function symbol(c, m, x0, y0, fill, rim, shade, shadeRows = 2, corner = true) {
  const w = m[0].length, on = (x, y) => y >= 0 && y < m.length && x >= 0 && x < w && m[y][x] === "#";
  // a rim around the shape and a shadow under it, so a white symbol reads on any colour
  for (let y = -1; y <= m.length + 1; y++) for (let x = -1; x <= w; x++) {
    if (on(x, y)) continue;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x, y - 2)) c.px(x0 + x, y0 + y, rim);
  }
  for (let y = 0; y < m.length; y++) for (let x = 0; x < w; x++) if (on(x, y)) c.px(x0 + x, y0 + y, y >= m.length - shadeRows || (corner && x > w / 2 && y > m.length / 2) ? shade : fill);
}
function drawPanel(c, p, state) {
  const [dk, md, lt, wh] = state === 5 ? [R.grey[1], R.grey[2], R.grey[2], W] : p.ramp;
  let h = 16, oy = 0;
  let look = { edge: dk, fill: lt, hi: wh, sh: md, shine: W }, sf = W, sr = md, ss = wh;
  if (state === 1) { h = 14; oy = 2; }
  if (state === 2) { look = { edge: lt, fill: W, hi: W, sh: wh, shine: W }; sf = lt; sr = wh; ss = lt; }
  if (state === 4) { look = { edge: dk, fill: md, hi: md, sh: dk }; sf = lt; sr = dk; ss = lt; }
  if (state === 5) { look = { edge: R.grey[1], fill: R.grey[2], hi: R.grey[3], sh: R.grey[1] }; sf = R.grey[3]; sr = R.grey[1]; ss = R.grey[3]; }
  block(c, 0, oy, 16, h, look);
  if (state === 3) { // eyes shut tight and a big smile
    c.line(3, oy + 6, 5, oy + 4, dk); c.line(5, oy + 4, 7, oy + 6, dk); c.line(9, oy + 6, 11, oy + 4, dk); c.line(11, oy + 4, 13, oy + 6, dk);
    c.rect(5, oy + 9, 6, 1, dk); c.rect(6, oy + 10, 4, 2, dk); c.rect(7, oy + 11, 2, 1, R.red[2]);
    return;
  }
  const m = p.sym, mw = m[0].length;
  symbol(c, m, Math.floor((16 - mw) / 2), oy + Math.floor((h - m.length) / 2) - (h < 16 ? 0 : 0), sf, sr, ss);
}
export const PANELS = { w: 16, h: 16, frames: PANEL_COLORS.length * PANEL_STATES, draw(c, f) { drawPanel(c, PANEL_COLORS[Math.floor(f / PANEL_STATES)], f % PANEL_STATES); } };

// ---------------------------------------------------------------- garbage blocks (16x16 pieces)
// 0..8: top-left, top, top-right, left, middle, right, bottom-left, bottom, bottom-right; 9..11: one-row left, middle, right; 12 sleepy face,
// 13 the face while it dissolves. Frames 14..27 are the same pieces in steel (chain garbage).
export const GARBAGE_PIECES = 14;
function piece(c, t, l, b, r, ramp, accent) {
  const [dk, md, lt, wh] = ramp;
  c.rect(0, 0, 16, 16, lt);
  // a quilted pattern: soft diagonal stitches
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) c.px(x, y, accent);
  if (t) { c.rect(0, 0, 16, 1, dk); c.rect(0, 1, 16, 1, wh); }
  if (b) { c.rect(0, 15, 16, 1, dk); c.rect(0, 14, 16, 1, md); }
  if (l) { c.rect(0, 0, 1, 16, dk); c.rect(1, t ? 1 : 0, 1, 16 - (t ? 1 : 0) - (b ? 1 : 0), wh); }
  if (r) { c.rect(15, 0, 1, 16, dk); c.rect(14, t ? 1 : 0, 1, 16 - (t ? 1 : 0) - (b ? 1 : 0), md); }
  const cut = (x, y) => c.px(x, y, -1);
  if (t && l) { cut(0, 0); c.px(1, 1, dk); } if (t && r) { cut(15, 0); c.px(14, 1, dk); }
  if (b && l) { cut(0, 15); c.px(1, 14, dk); } if (b && r) { cut(15, 15); c.px(14, 14, dk); }
}
function drawGarbage(c, f) {
  const steel = f >= GARBAGE_PIECES; if (steel) f -= GARBAGE_PIECES;
  const ramp = steel ? [R.grey[1], R.grey[2], R.blue[3], W] : R.purple, accent = steel ? R.grey[3] : R.purple[3];
  const e = [[1, 1, 0, 0], [1, 0, 0, 0], [1, 0, 0, 1], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 1, 1], [1, 1, 1, 0], [1, 0, 1, 0], [1, 0, 1, 1]];
  if (f < 12) { const [t, l, b, r] = e[f]; piece(c, t, l, b, r, ramp, accent); return; }
  const ink = ramp[0];
  if (f === 12) { c.rect(3, 7, 4, 1, ink); c.rect(9, 7, 4, 1, ink); c.px(3, 6, ink); c.px(12, 6, ink); c.rect(7, 10, 2, 1, ink); c.rect(2, 9, 2, 1, R.red[3]); c.rect(12, 9, 2, 1, R.red[3]); }
  else { c.rect(4, 4, 3, 4, ink); c.rect(9, 4, 3, 4, ink); c.px(4, 4, W); c.px(9, 4, W); c.rect(6, 10, 4, 3, ink); c.rect(7, 11, 2, 2, R.red[2]); }
}
export const GARBAGE = { w: 16, h: 16, frames: GARBAGE_PIECES * 2, draw: drawGarbage };

// ---------------------------------------------------------------- characters (32x32): 0 idle, 1 blink, 2 happy, 3 dizzy
// Round critters lit from the top left, outlined in their own darkest shade, with feet, little arms and big glossy eyes.
const CHAR_DEFS = [
  { id: "pip", ramp: R.yellow, belly: R.yellow[3], feat: "tuft", cheek: R.red[3], foot: R.orange[2] },
  { id: "bloop", ramp: R.green, belly: R.green[3], feat: "leaf", cheek: R.red[3], foot: R.green[1] },
  { id: "fuzz", ramp: R.orange, belly: R.orange[3], feat: "ears", cheek: R.red[3], foot: R.orange[1] },
  { id: "kit", ramp: R.blue, belly: R.blue[3], feat: "cat", cheek: R.purple[3], foot: R.blue[1] },
  { id: "spike", ramp: R.purple, belly: R.purple[3], feat: "spikes", cheek: R.red[3], foot: R.purple[1] },
  { id: "puff", ramp: [R.grey[2], R.blue[3], W, W], belly: W, feat: "cloud", cheek: R.red[3], foot: R.blue[3] },
  { id: "ember", ramp: R.red, belly: R.orange[3], feat: "flame", cheek: R.yellow[3], foot: R.red[1] },
  { id: "frost", ramp: R.teal, belly: R.teal[3], feat: "ice", cheek: R.blue[3], foot: R.teal[1] },
  { id: "shade", ramp: [R.purple[0], R.purple[1], R.purple[2], R.purple[3]], belly: R.purple[1], feat: "crown", cheek: R.red[2], foot: R.purple[0] },
];
export const CHAR_IDS = CHAR_DEFS.map((d) => d.id);
function eye(c, x, y, expr) {
  if (expr === 1) { c.rect(x - 2, y + 2, 5, 1, NAVY); return; }
  if (expr === 2) { c.px(x - 2, y + 2, NAVY); c.px(x - 1, y + 1, NAVY); c.px(x, y, NAVY); c.px(x + 1, y + 1, NAVY); c.px(x + 2, y + 2, NAVY); return; }
  if (expr === 3) { c.line(x - 2, y, x + 2, y + 4, NAVY); c.line(x + 2, y, x - 2, y + 4, NAVY); return; }
  c.rect(x - 2, y - 1, 4, 6, NAVY); c.rect(x - 1, y - 2, 2, 8, NAVY);
  c.rect(x - 1, y - 1, 2, 2, W); c.px(x, y + 3, R.blue[2]);
}
function drawChar(c, d, expr) {
  const cx = 16, cy = 18, [dk, md, lt, wh] = d.ramp, f = d.feat;
  // what sits behind the body
  if (f === "cloud") for (const [x, y, r] of [[8, 15, 6], [24, 15, 6], [11, 10, 6], [21, 10, 6], [16, 8, 5]]) c.sphere(x, y, r, d.ramp);
  if (f === "ears" || f === "cat") {
    const inner = f === "cat" ? R.purple[3] : R.red[3];
    c.poly([[4, 13], [6, 2], [14, 9]], md); c.poly([[28, 13], [26, 2], [18, 9]], md);
    c.poly([[6, 11], [7, 5], [11, 9]], inner); c.poly([[26, 11], [25, 5], [21, 9]], inner);
  }
  if (f === "spikes") for (const x of [7, 11, 16, 21, 25]) c.poly([[x - 3, 12], [x, 2 + Math.abs(x - 16) / 3], [x + 3, 12]], lt);
  if (f === "ice") for (const [x, h] of [[9, 4], [16, 1], [23, 4]]) c.poly([[x - 3, 12], [x, h], [x + 3, 12]], R.teal[3]);
  if (f === "flame") {
    c.poly([[8, 12], [10, 3], [13, 8], [16, 0], [19, 8], [22, 3], [24, 12]], R.orange[2]);
    c.poly([[12, 12], [14, 6], [16, 3], [18, 6], [20, 12]], R.yellow[2]);
  }
  // feet and arms
  c.ellipse(11, 29, 4, 2, d.foot); c.ellipse(21, 29, 4, 2, d.foot);
  if (expr === 2) { c.ellipse(4, 13, 2.5, 3, md); c.ellipse(28, 13, 2.5, 3, md); }
  else { c.ellipse(4, 21, 2.5, 3, md); c.ellipse(28, 21, 2.5, 3, md); }
  c.sphere(cx, cy, 11, d.ramp, -0.5, -0.6, 12, 11);
  c.ellipse(cx, cy + 6, 7, 4, d.belly);
  if (f === "leaf") { c.line(16, 8, 16, 3, R.green[0]); c.poly([[16, 4], [23, 0], [25, 5], [18, 6]], R.green[2]); c.poly([[16, 4], [10, 1], [9, 5], [14, 6]], R.green[3]); }
  if (f === "tuft") { c.line(15, 7, 12, 2, R.orange[2]); c.line(16, 7, 16, 1, R.orange[2]); c.line(17, 7, 20, 2, R.orange[2]); }
  if (f === "crown") { c.poly([[9, 10], [10, 2], [13, 6], [16, 0], [19, 6], [22, 2], [23, 10]], R.yellow[2]); c.rect(9, 8, 15, 2, R.yellow[1]); c.px(16, 4, R.red[2]); }
  c.outline(dk);
  // the face
  eye(c, 12, 14, expr); eye(c, 20, 14, expr);
  c.rect(7, 20, 3, 2, d.cheek); c.rect(22, 20, 3, 2, d.cheek);
  if (f === "tuft") { c.rect(15, 19, 3, 2, R.orange[2]); c.px(16, 21, R.orange[1]); }
  else if (expr === 2) { c.rect(13, 20, 6, 3, NAVY); c.rect(14, 22, 4, 1, R.red[2]); }
  else if (expr === 3) { c.px(13, 22, NAVY); c.px(14, 21, NAVY); c.px(15, 22, NAVY); c.px(16, 21, NAVY); c.px(17, 22, NAVY); c.px(18, 21, NAVY); }
  else { c.px(14, 21, NAVY); c.rect(15, 22, 3, 1, NAVY); c.px(18, 21, NAVY); }
  if (f === "tuft" && expr === 2) c.rect(15, 21, 3, 1, R.red[2]);
}
export const CHARS = CHAR_DEFS.map((d) => ({ id: d.id, w: 32, h: 32, frames: 4, draw: (c, f) => drawChar(c, d, f) }));

// ---------------------------------------------------------------- the logo: one letter on a big panel per frame (P A N E L O), the letters
// being the font's, three times as big
const LOGO = [["P", R.red], ["A", R.yellow], ["N", R.green], ["E", R.teal], ["L", R.blue], ["O", R.purple]];
export const LOGO_LETTERS = LOGO.map((l) => l[0]).join("");
export const LOGOS = {
  w: 32, h: 32, frames: LOGO.length,
  draw(c, f) {
    const [ch, ramp] = LOGO[f], [dk, md, lt, wh] = ramp;
    block(c, 1, 1, 30, 30, { edge: dk, fill: lt, hi: wh, sh: md, shine: W });
    const g = GLYPHS[ch], big = g.flatMap((row) => { const r = [...row].map((p) => p.repeat(3)).join(""); return [r, r, r]; });
    symbol(c, big, 9, 6, W, dk, wh, 3, false);
  },
};

// ---------------------------------------------------------------- small things
// the board cursor: brackets around two cells (40x24, drawn 4 pixels up and left of the left cell), two frames that breathe
export const CURSOR = {
  w: 40, h: 24, frames: 2,
  draw(c, f) {
    const i = f === 0 ? 2 : 1, w = 40 - i * 2, h = 24 - i * 2, L = 7;
    // an L in each corner; the right and bottom ones grow back from the far edge
    const rect = (x, y, w2, h2) => c.rect(Math.min(x, x + w2), Math.min(y, y + h2), Math.abs(w2), Math.abs(h2), W);
    const corner = (x, y, sx, sy) => { rect(x, y, L * sx, 2 * sy); rect(x, y, 2 * sx, L * sy); };
    corner(i, i, 1, 1); corner(i + w, i, -1, 1); corner(i, i + h, 1, -1); corner(i + w, i + h, -1, -1);
    c.outline(NAVY);
  },
};
// a twinkle for popping panels: 4 frames, big to small
export const SPARK = {
  w: 8, h: 8, frames: 4,
  draw(c, f) {
    const s = [3, 3, 2, 1][f], col = f < 2 ? W : R.yellow[3];
    c.rect(4 - s, 3, s * 2, 2, col); c.rect(3, 4 - s, 2, s * 2, col);
    if (f === 0) { c.px(3, 3, R.yellow[2]); c.px(4, 4, R.yellow[2]); }
  },
};
export const ICONS = [
  { id: "arrow", w: 8, h: 8, frames: 2, draw(c, f) { c.ascii(["#.....", "##....", "###...", "####..", "###...", "##....", "#....."], { "#": f ? R.yellow[3] : R.yellow[2] }, 1 + f, 0); c.outline(R.orange[0]); } },
  { id: "star", w: 8, h: 8, frames: 2, draw(c, f) { c.ascii(["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", ".#...#."], { "#": f ? R.yellow[3] : R.yellow[2] }, 0, 0); c.outline(R.orange[1]); } },
];

// ---------------------------------------------------------------- tilesets
// ts_sky: six soft backgrounds, each a 4x4 block of 16x16 tiles that repeats (64x64), four across and two down (pattern p starts at
// tile (p // 4) * 64 + (p % 4) * 4; the game's lib/ui.lua knows this). Light and low in contrast so the panels stand out.
export const SKY_LOOKS = [
  { name: "blue", base: R.blue[3], soft: W, dot: R.blue[2], kind: "checker" },
  { name: "mint", base: R.teal[3], soft: W, dot: R.teal[2], kind: "dots" },
  { name: "lilac", base: R.purple[3], soft: W, dot: R.purple[2], kind: "stripes" },
  { name: "lemon", base: R.yellow[3], soft: W, dot: R.orange[3], kind: "diamonds" },
  { name: "peach", base: R.orange[3], soft: R.yellow[3], dot: R.red[3], kind: "dots" },
  { name: "lime", base: R.green[3], soft: R.yellow[3], dot: R.green[2], kind: "checker" },
];
function skyPattern(c, ox, oy, look) {
  const { base, soft, dot, kind } = look;
  c.rect(ox, oy, 64, 64, base);
  const dith = (x, y) => (x + y) % 2 === 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    let on = false;
    if (kind === "checker") on = ((x >> 5) + (y >> 5)) % 2 === 0 && dith(x, y);
    if (kind === "stripes") on = ((x + y) % 32) < 12 && dith(x, y);
    if (kind === "dots") { const dx = (x % 32) - 16, dy = (y % 32) - 16; on = Math.hypot(dx + 0.5, dy + 0.5) < 9 && dith(x, y); }
    if (kind === "diamonds") { const dx = Math.abs((x % 32) - 15.5), dy = Math.abs((y % 32) - 15.5); on = dx + dy < 12 && dith(x, y); }
    if (on) c.px(ox + x, oy + y, soft);
  }
  // little four-point twinkles
  for (const [x, y] of [[8, 8], [40, 40], [24 + 16, 10], [10, 44]]) {
    c.px(ox + x, oy + y, dot); c.px(ox + x - 1, oy + y, soft); c.px(ox + x + 1, oy + y, soft); c.px(ox + x, oy + y - 1, soft); c.px(ox + x, oy + y + 1, soft);
  }
}
export function skyTileset() {
  const c = new Canvas(256, 128);
  SKY_LOOKS.forEach((l, i) => skyPattern(c, (i % 4) * 64, Math.floor(i / 4) * 64, l));
  return c;
}

// ts_ui: 8x8 tiles in 3x3 blocks for the layout's panels (windows, menu rows, bars), four blocks across and two down. Block b starts at tile
// (b // 4) * 36 + (b % 4) * 3; the names below are what lib/ui.lua calls them.
export const UI_BLOCKS = [
  { name: "window", fill: W, edge: R.blue[1], hi: W, sh: R.blue[3] },
  { name: "selected", fill: R.yellow[3], edge: R.orange[1], hi: W, sh: R.yellow[2] },
  { name: "bar", fill: R.blue[1], edge: R.blue[0], hi: R.blue[2], sh: R.blue[0] },
  { name: "inset", fill: R.blue[3], edge: R.blue[2], hi: R.blue[2], sh: W },
  { name: "go", fill: R.green[2], edge: R.green[0], hi: R.green[3], sh: R.green[1] },
  { name: "pink", fill: R.red[3], edge: R.red[1], hi: W, sh: R.red[2] },
  { name: "lilac", fill: R.purple[3], edge: R.purple[1], hi: W, sh: R.purple[2] },
  { name: "mint", fill: R.teal[3], edge: R.teal[1], hi: W, sh: R.teal[2] },
];
export function uiTileset() {
  const c = new Canvas(96, 48);
  UI_BLOCKS.forEach((b, i) => {
    const ox = (i % 4) * 24, oy = Math.floor(i / 4) * 24;
    block(c, ox, oy, 24, 24, { edge: b.edge, fill: b.fill, hi: b.hi, sh: b.sh });
  });
  return c;
}
