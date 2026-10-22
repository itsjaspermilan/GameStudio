// Writes assets/console-art/<id>.png: the picture the Knulli theme (art-book-next) shows for a console on the home carousel, a 454 x 1080 slanted panel
// drawn in 6-pixel blocks from the console's own palette. Dot is a field of dots with a big white one, Dash a field of dashes.
//   node scripts/make-console-art.mjs [dot|dash ...]      (default: both)
// The slant is the stock panel's: its left edge runs from x = 112 at the top to x = 0 at the bottom, and it is 342 pixels wide.
import { readFileSync, writeFileSync } from "node:fs";
import { png } from "./png.mjs";

const W = 454, H = 1080, BLOCK = 6, COLS = Math.ceil(W / BLOCK), ROWS = H / BLOCK;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function draw(id) {
  const con = JSON.parse(readFileSync(`engine/consoles/${id}.json`, "utf8"));
  const pal = con.palette.colors.map(hex);
  const cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const put = (x, y, c) => { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) cells[y][x] = c; };
  const base = pal[1]; // the console's dark blue-grey
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) cells[y][x] = ((x + y) & 1) && ((x >> 2) + (y >> 2)) % 5 === 0 ? pal[2] : base; // a faint texture
  const ramp = [6, 10, 14, 18, 22, 26, 30].map((i) => pal[i]), light = [7, 11, 15, 19, 23, 27, 31].map((i) => pal[i]);
  if (id === "dot") {
    for (let r = 0, cy = 7; cy < ROWS; r++, cy += 10) for (let cx = r % 2 ? 6 : 1; cx < COLS + 4; cx += 12) {
      const k = (r + (cx >> 2)) % ramp.length;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) put(cx + dx, cy + dy, dx + dy < -2 ? light[k] : ramp[k]);
    }
    const cx = 36, cy = 90;
    for (let dy = -22; dy <= 22; dy++) for (let dx = -22; dx <= 22; dx++) {
      const d = dx * dx + dy * dy;
      if (d <= 22 * 22) put(cx + dx, cy + dy, d > 19 * 19 ? pal[2] : pal[3]);
    }
    for (let dy = -22; dy <= 22; dy++) for (let dx = -22; dx <= 22; dx++) if (dx * dx + dy * dy <= 22 * 22 && (dx + 5) * (dx + 5) + (dy + 5) * (dy + 5) > 21 * 21) put(cx + dx, cy + dy, pal[2]); // a crescent of shade on the lower right
  } else {
    for (let r = 0, cy = 6; cy < ROWS; r++, cy += 9) for (let cx = r % 2 ? -6 : 2; cx < COLS + 4; cx += 22) {
      const k = (r + (cx >> 3)) % ramp.length;
      for (let dy = -2; dy <= 2; dy++) for (let dx = 0; dx < 14; dx++) {
        const round = (dx === 0 || dx === 13) && Math.abs(dy) === 2;
        if (!round) put(cx + dx, cy + dy, dy < 0 ? light[k] : ramp[k]);
      }
    }
    const cx = 12, cy = 90;
    for (let dy = -7; dy <= 7; dy++) for (let dx = 0; dx < 50; dx++) if (!((dx < 3 || dx > 46) && Math.abs(dy) > 5 - (dx < 3 ? dx : 49 - dx))) put(cx + dx, cy + dy, dy > 4 ? pal[2] : pal[3]);
  }
  // the pixels, then the slanted panel
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const left = Math.round(112 * (1 - y / (H - 1))), right = left + 341;
    for (let x = left; x <= right && x < W; x++) {
      const c = cells[Math.min(ROWS - 1, Math.floor(y / BLOCK))][Math.min(COLS - 1, Math.floor(x / BLOCK))], i = (y * W + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return data;
}

for (const id of process.argv.slice(2).length ? process.argv.slice(2) : ["dot", "dash"]) {
  writeFileSync(`assets/console-art/${id}.png`, png(W, H, draw(id)));
  console.log(`wrote assets/console-art/${id}.png`);
}
