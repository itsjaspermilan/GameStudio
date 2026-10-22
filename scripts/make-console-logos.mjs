// Writes assets/console-logos/dot.svg: "DOT" in a pixel font, pure white like the theme's other logos: the O a filled circle, shaded with negative space. Every pixel is a square (shape-rendering: crispEdges), so it stays sharp at any size. The theme multiplies a logo by white, so the colours stay.
//   node scripts/make-console-logos.mjs [preview.png] [--shaded | --colour]      (the PNG is a picture of the logo to look at, not installed anywhere)
// By default the logo is plain: white letters and a plain filled circle in one flat white like the theme's own logos (all rgb(255, 255, 255)), no shading, no pixels.
// --pixel is the pixel-font version (white, the O shaded with one gap), --shaded adds greys and a drop shadow, --colour also makes the O red.
// (dash.svg is still the plain white bar.)
import { readFileSync, writeFileSync } from "node:fs";
import { png } from "./png.mjs";

const COLOUR = process.argv.includes("--colour"), SHADED = COLOUR || process.argv.includes("--shaded"), PIXEL = SHADED || process.argv.includes("--pixel"); // default: plain white letters and a plain circle
const pal = JSON.parse(readFileSync("engine/consoles/dot.json", "utf8")).palette.colors;
const hex = (i) => pal[i];
// A bold pixel font: strokes two squares wide, so there is room for a light edge and a dark edge on each.
// ---- the default: plain white letters (a D and a T as shapes, the O a plain filled circle) in one flat white like the theme's own logos
const K = 0.5523; // a quarter circle as a cubic curve
const f = (n) => Math.round(n * 100) / 100;
const PLAIN_W = 316, PLAIN_H = 100;
const plainPath = [
  // D: the outer shape with a flat left side and a round right side, then the counter (even-odd fill makes it a hole)
  `M0 0H44C${f(44 + 50 * K)} 0 94 ${f(50 - 50 * K)} 94 50C94 ${f(50 + 50 * K)} ${f(44 + 50 * K)} 100 44 100H0Z`,
  `M22 22H42C${f(42 + 28 * K)} 22 70 ${f(50 - 28 * K)} 70 50C70 ${f(50 + 28 * K)} ${f(42 + 28 * K)} 78 42 78H22Z`,
  // O: a filled circle
  `M110 50C110 ${f(50 - 50 * K)} ${f(160 - 50 * K)} 0 160 0C${f(160 + 50 * K)} 0 210 ${f(50 - 50 * K)} 210 50C210 ${f(50 + 50 * K)} ${f(160 + 50 * K)} 100 160 100C${f(160 - 50 * K)} 100 110 ${f(50 + 50 * K)} 110 50Z`,
  // T: a bar and a stem
  "M226 0H316V22H282V100H260V22H226Z",
].join("");
const plainInside = (x, y) => {
  const d = x >= 0 && x <= 94 && y >= 0 && y <= 100 && (x <= 44 || (x - 44) ** 2 + (y - 50) ** 2 <= 2500);
  const hole = x >= 22 && x <= 70 && y >= 22 && y <= 78 && (x <= 42 || (x - 42) ** 2 + (y - 50) ** 2 <= 784);
  const o = (x - 160) ** 2 + (y - 50) ** 2 <= 2500;
  const t = (x >= 226 && x <= 316 && y >= 0 && y <= 22) || (x >= 260 && x <= 282 && y >= 0 && y <= 100);
  return (d && !hole) || o || t;
};
if (!PIXEL) {
  writeFileSync("assets/console-logos/dot.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PLAIN_W} ${PLAIN_H}" width="${PLAIN_W}" height="${PLAIN_H}">\n  <path fill="#ffffff" fill-rule="evenodd" d="${plainPath}"/>\n</svg>\n`);
  console.log(`wrote assets/console-logos/dot.svg (plain, ${PLAIN_W} x ${PLAIN_H})`);
  const preview = process.argv.slice(2).find((a) => a.endsWith(".png"));
  if (preview) { // drawn by testing points (4 x 4 per pixel), white on black
    const k = 3, w = PLAIN_W * k, h = PLAIN_H * k, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let hit = 0; for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (plainInside((x + (sx + 0.5) / 4) / k, (y + (sy + 0.5) / 4) / k)) hit++;
      const v = Math.round(255 * hit / 16), i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
    }
    writeFileSync(preview, png(w, h, data)); console.log(`wrote ${preview}`);
  }
  process.exit(0);
}

const D = ["#####..", "##..###", "##...##", "##...##", "##...##", "##...##", "##...##", "##..###", "#####.."];
const T = ["########", "########", "...##...", "...##...", "...##...", "...##...", "...##...", "...##...", "...##..."];
const COLS = 26, ROWS = 9, OX = 12, OY = 4; // the O is a circle 9 squares across, centred at (OX, OY)
const lit = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
D.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") lit[y][x] = true; }));
T.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") lit[y][18 + x] = true; }));
const disc = [];
for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 18) { lit[OY + dy][OX + dx] = true; disc.push([dx, dy]); }
const isDisc = (x, y) => disc.some(([dx, dy]) => dx + OX === x && dy + OY === y);

const cells = []; // { x, y, color }
const at = (x, y) => y >= 0 && y < ROWS && x >= 0 && x < COLS && lit[y][x];
const WHITE = "#ffffff";
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
  if (!lit[y][x]) continue;
  const darkEdge = !at(x, y + 1) || !at(x + 1, y), lightEdge = !at(x, y - 1) || !at(x - 1, y);
  if (!SHADED) {
    // Only white, like the theme's own logos. The letters are solid; the O is shaded with negative space: a one-square diagonal gap leaves a lit face and a rim
    // on the lower right, and a few squares of the face are left out near the gap to soften it (dithering).
    if (isDisc(x, y)) {
      const t = x - OX + (y - OY);
      if (t === 3) continue;                                          // the gap between the face and the rim
      if (t === 2 && (x + y) % 2 !== 0) continue;                     // the face thins out toward the gap
    }
    cells.push({ x, y, color: WHITE });
    continue;
  }
  let color;
  if (isDisc(x, y)) { // lit from the top left, with a little glint: whites and greys, or the red ramp with --colour
    const dx = x - OX, dy = y - OY, t = dx + dy, glint = (dx === -2 && dy === -3) || (dx === -3 && dy === -2) || (dx === -2 && dy === -2);
    color = COLOUR
      ? (glint ? hex(15) : t <= -3 ? hex(7) : t >= 6 ? hex(4) : t >= 3 ? hex(5) : hex(6))
      : (glint ? hex(3) : t <= -3 ? "#f2f3f8" : t >= 6 ? "#6b7088" : t >= 3 ? hex(2) : "#c8ccdc");
  } else { // letters: light on the top and left edges, dark on the bottom and right edges, grey between
    color = darkEdge ? hex(2) : lightEdge ? hex(3) : "#c8ccdc";
  }
  cells.push({ x, y, color });
}
const shade = SHADED ? cells.map((c) => ({ x: c.x + 1, y: c.y + 1, color: hex(1) })) : []; // a drop shadow only with the greys
const PAD = 1, CELL = 12, W = (COLS + 1 + 2 * PAD) * CELL, H = (ROWS + 1 + 2 * PAD) * CELL;
const draw = [...shade, ...cells];
const rects = draw.map((c) => `<rect x="${(c.x + PAD) * CELL}" y="${(c.y + PAD) * CELL}" width="${CELL}" height="${CELL}" fill="${c.color}"/>`).join("\n  ");
writeFileSync("assets/console-logos/dot.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">\n  ${rects}\n</svg>\n`);
console.log(`wrote assets/console-logos/dot.svg (${draw.length} squares, ${W} x ${H})`);

const preview = process.argv.slice(2).find((a) => a.endsWith(".png"));
if (preview) { // the same squares as a PNG, on the carousel's black, to look at
  const K = 6, w = W / CELL * K * 2, h = H / CELL * K * 2, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255;
  const rgb = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  for (const c of draw) {
    const [r, g, b] = rgb(c.color);
    for (let y = 0; y < K * 2; y++) for (let x = 0; x < K * 2; x++) { const i = (((c.y + PAD) * K * 2 + y) * w + (c.x + PAD) * K * 2 + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; }
  }
  writeFileSync(preview, png(w, h, data));
  console.log(`wrote ${preview}`);
}
