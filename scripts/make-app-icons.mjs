// Writes the studio's app icons into studio/src-tauri/icons/: icon.icns for macOS, icon.ico for Windows, and the PNGs Tauri wants
// (Linux, the window icon, the Windows Store tiles). The picture is the TrimUI Brick (the handheld the games run on) as pixel art,
// a Glow43 scene on its screen:
//   - macOS: the Brick on Apple's app icon tile (an 824 tile on a 1024 canvas, continuous corners), an indigo night in pixel bands
//     with a hard pixel shadow, so it sits with the other icons in the Dock;
//   - Windows: the Brick alone, no tile, as tall as the square.
// Each is drawn on a 32 x 32 grid and redrawn on a 16 x 16 one for the smallest sizes, and only ever scaled by whole numbers, so every
// pixel stays square and sharp. The drawing is the code below; SVGs of it are written to studio/src-tauri/icons/source/ to look at.
//   node scripts/make-app-icons.mjs        (from the repo root; on a Mac Apple's iconutil packs the .icns)
import { writeFileSync, readFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { png } from "./png.mjs";

const ICONS = resolve("studio/src-tauri/icons"), SRC = join(ICONS, "source");

// o outline, l/m/s body light, mid and side, b bezel, G/g grey buttons dark and lit, t teal; the rest are the screen's scene.
const PAL = { o: "#2a2638", l: "#f4f4f7", m: "#d8d9e2", s: "#a6a8b8", b: "#1d1c26", G: "#7d8191", g: "#b8bbc8", t: "#3fd6b4",
  c: "#9ff0ff", C: "#5cc8f4", y: "#ffe27a", w: "#ffffff", p: "#ff7eb6", k: "#c23a7a", h: "#4fbf6a", n: "#7ee06a", d: "#a8643a",
  S: "#22185e", "*": "#ffe9a8" };

// What the Brick's screen shows, one scene per screen size (4:3 like Glow43): sky, sun, a cloud, hills and a blob hero.
const SCENES = {
  16: ["cccccccccccccccc", "ccwwccccccccyycc", "cwwwwcccccccyyyc", "cccccccccccyyyyc", "cccccckkkccyyycc", "cccccpppppcccccc",
    "CCCCCpwpwpCCCCCC", "hCCCCpppppCCCCCh", "hhCCCCkkkCCCCChh", "nnnnnnnnnnnnnnnn", "dddddddddddddddd", "dddddddddddddddd"],
  12: ["ccccccccccyc", "cwwcccccyyyc", "ccccckkkcyyc", "ccccpppppccc", "CCCCpwpwpCCC", "hCCCpppppCCh", "hhCCCkkkCChh", "nnnnnnnnnnnn", "dddddddddddd"],
  8: ["ccccccyc", "cwwccyyc", "cccppccc", "CCppppCC", "hCCkkCCh", "nnnnnnnn"],
  4: ["ccyc", "cppc", "nnnn"],
};

// The Brick on a grid of size n, its top left at x0,y0, w x h, with the parts placed by the layout L (rows and columns from its corner).
function brick(n, x0, y0, w, h, L) {
  const g = Array.from({ length: n }, () => Array(n).fill("."));
  const put = (x, y, ch) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y0 + y][x0 + x] = ch; };
  const rect = (x, y, rw, rh, ch) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) put(x + i, y + j, ch); };
  // the body: an outline with the corners cut, lit top left, a mid band low down and the side showing along the bottom
  rect(0, 0, w, h, "o");
  rect(1, 1, w - 2, h - 2, "l");
  rect(1, h - 3, w - 2, 1, "m"); rect(w - 2, 1, 1, h - 3, "m"); rect(1, h - 2, w - 2, 1, "s");
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) put(x, y, ".");
  if (L.round) for (const [x, y] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]) put(x, y, "o");
  // the screen in its bezel
  const [bx, by, bw, bh] = L.bezel;
  rect(bx, by, bw, bh, "b");
  if (L.round) for (const [x, y] of [[bx, by], [bx + bw - 1, by], [bx, by + bh - 1], [bx + bw - 1, by + bh - 1]]) put(x, y, "l");
  SCENES[L.scene].forEach((row, j) => [...row].forEach((ch, i) => put(bx + 1 + i, by + 1 + j, ch)));
  // the D-pad: a plus, with thick arms lit along their top edges on the big grid
  const [dx, dy, ds, dt] = L.dpad, a = (ds - dt) / 2;
  rect(dx + a, dy, dt, ds, "G"); rect(dx, dy + a, ds, dt, "G");
  if (dt > 1) { rect(dx + a, dy, dt, 1, "g"); rect(dx, dy + a, a, 1, "g"); rect(dx + a + dt, dy + a, a, 1, "g"); }
  // X, Y, A, B in a diamond, dots of bs pixels (lit top left) a step apart: with a gap between them, or they read as a checkerboard
  const [cx, cy, bs, step] = L.buttons;
  for (const [i, j] of [[1, 0], [0, 1], [2, 1], [1, 2]]) {
    const x = cx + i * step, y = cy + j * step;
    rect(x, y, bs, bs, "G"); if (bs > 1) put(x, y, "g");
  }
  for (const [x, y, pw] of L.pills) rect(x, y, pw, 1, "t");
  for (const [x, y, pw] of L.chin || []) rect(x, y, pw, 1, "G");
  if (L.side) put(w - 1, L.side, "t"); // the teal button on the right edge
  return g;
}

// Windows: the Brick as tall as the square.
const WIN32 = brick(32, 5, 1, 22, 30, { round: true, bezel: [2, 2, 18, 14], scene: 16, dpad: [2, 18, 7, 3], buttons: [12, 17, 2, 3],
  pills: [[8, 17, 2], [11, 17, 2]], chin: [[6, 26, 2], [10, 26, 2], [14, 26, 2]], side: 9 });
const WIN16 = brick(16, 2, 0, 12, 16, { bezel: [1, 1, 10, 8], scene: 8, dpad: [1, 10, 3, 1], buttons: [8, 10, 1, 1], pills: [[5, 10, 2]],
  chin: [[4, 13, 1], [7, 13, 1]] });
// macOS: a smaller Brick inside the tile (its screen nearly as wide as the body, as on the real one), and a hard shadow one pixel down
// and right.
const MAC32 = brick(32, 8, 5, 16, 21, { round: true, bezel: [1, 1, 14, 11], scene: 12, dpad: [1, 13, 5, 1], buttons: [9, 13, 1, 2],
  pills: [[7, 13, 2]], side: 6 });
const MAC16 = brick(16, 4, 2, 8, 11, { bezel: [1, 1, 6, 5], scene: 4, dpad: [1, 6, 3, 1], buttons: [4, 6, 1, 1], pills: [] });
function shadowAndStars(g, stars) {
  const n = g.length;
  for (let y = n - 1; y > 0; y--) for (let x = n - 1; x > 0; x--) if (g[y][x] === "." && g[y - 1][x - 1] !== "." && g[y - 1][x - 1] !== "S") g[y][x] = "S";
  for (const [x, y] of stars) g[y][x] = "*";
  return g;
}
shadowAndStars(MAC32, [[6, 7], [26, 6], [5, 18], [26, 23]]);
shadowAndStars(MAC16, []);

// the tile: night in four bands, inside a superellipse close to Apple's continuous corners (at 45 degrees it meets a 185 px corner
// radius on the 824 tile), with a soft shadow under it as in Apple's template
const BANDS = ["#5a44c8", "#4a36b0", "#3b2a96", "#2c1f78"];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const inTile = (u, v) => Math.abs((u - 0.5) / 0.4023) ** 5 + Math.abs((v - 0.5) / 0.4023) ** 5 <= 1; // u, v in 0..1 of the canvas

// Draws a grid at size px: scaled by the largest whole number that fits, centred; on the tile for macOS.
function raster(grid, size, tile) {
  const n = grid.length, k = Math.max(1, Math.floor(size / n)), off = Math.floor((size - n * k) / 2), d = new Uint8ClampedArray(size * size * 4);
  const SS = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = (y * size + x) * 4;
    if (tile) {
      let cover = 0, shade = 0;
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
        const u = (x + (i + 0.5) / SS) / size, v = (y + (j + 0.5) / SS) / size;
        if (inTile(u, v)) cover++; else if (inTile(u, v - 0.012)) shade++;
      }
      const band = hex(BANDS[Math.min(3, Math.max(0, Math.floor(((y + 0.5) / size - 0.1) / 0.8 * 4)))]);
      const a = cover / (SS * SS), sa = (shade / (SS * SS)) * 0.3 * (1 - a);
      if (a + sa > 0) d.set([...band.map((c) => (c * a) / (a + sa)), Math.round((a + sa) * 255)], o);
    }
    const gx = Math.floor((x - off) / k), gy = Math.floor((y - off) / k);
    const ch = gx >= 0 && gy >= 0 && gx < n && gy < n ? grid[gy][gx] : ".";
    if (ch !== "." && (!tile || d[o + 3] > 0)) d.set([...hex(PAL[ch]), tile ? d[o + 3] : 255], o);
  }
  return png(size, size, d);
}

function svg(grid, tile) {
  const n = grid.length;
  let out = "";
  if (tile) {
    const pts = Array.from({ length: 240 }, (_, i) => { const t = (i / 240) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
      return [n / 2 + n * 0.4023 * Math.sign(c) * Math.abs(c) ** 0.4, n / 2 + n * 0.4023 * Math.sign(s) * Math.abs(s) ** 0.4]; });
    out += `<clipPath id="t"><path d="M${pts.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join("L")}Z"/></clipPath><g clip-path="url(#t)">` +
      BANDS.map((c, i) => `<rect x="0" y="${n * (0.1 + i * 0.2)}" width="${n}" height="${n * 0.2}" fill="${c}"/>`).join("");
  }
  grid.forEach((row, y) => row.forEach((ch, x) => { if (ch !== ".") out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[ch]}"/>`; }));
  if (tile) out += "</g>";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${n * 16}" height="${n * 16}" shape-rendering="crispEdges">${out}</svg>\n`;
}

// ---------- packing ----------

// .icns: on a Mac, Apple's iconutil packs an .iconset folder (it stores 16 and 32 px the old way, which macOS reads more reliably
// than PNG in those slots). Elsewhere: a header, then one PNG per slot, leaving out the 1x 16 and 32 px slots.
function icns(mac, tmp) {
  if (process.platform === "darwin") {
    const set = join(tmp, "icon.iconset"), out = join(tmp, "icon.icns");
    mkdirSync(set);
    for (const s of [16, 32, 128, 256, 512]) { writeFileSync(join(set, `icon_${s}x${s}.png`), mac(s)); writeFileSync(join(set, `icon_${s}x${s}@2x.png`), mac(s * 2)); }
    execFileSync("iconutil", ["-c", "icns", "-o", out, set]);
    return readFileSync(out);
  }
  const entries = [["ic07", 128], ["ic08", 256], ["ic09", 512], ["ic10", 1024], ["ic11", 32], ["ic12", 64], ["ic13", 256], ["ic14", 512]].map(([t, s]) => [t, mac(s)]);
  const parts = entries.map(([type, data]) => { const h = Buffer.alloc(8); h.write(type, 0, "ascii"); h.writeUInt32BE(data.length + 8, 4); return Buffer.concat([h, data]); });
  const head = Buffer.alloc(8); head.write("icns", 0, "ascii"); head.writeUInt32BE(8 + parts.reduce((n, p) => n + p.length, 0), 4);
  return Buffer.concat([head, ...parts]);
}
// .ico: a directory of PNG images (Windows Vista and later read PNG inside .ico at every size)
function ico(images) {
  const dir = Buffer.alloc(6 + 16 * images.length);
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(images.length, 4);
  let off = dir.length;
  images.forEach(([size, data], i) => {
    const e = 6 + i * 16;
    dir[e] = size >= 256 ? 0 : size; dir[e + 1] = size >= 256 ? 0 : size;
    dir.writeUInt16LE(1, e + 4); dir.writeUInt16LE(32, e + 6); dir.writeUInt32LE(data.length, e + 8); dir.writeUInt32LE(off, e + 12);
    off += data.length;
  });
  return Buffer.concat([dir, ...images.map(([, d]) => d)]);
}

// the grid that draws biggest at a size (the 16 px drawing tripled beats the 32 px one at 48)
const pick = (small, big, size) => (16 * Math.floor(size / 16) > 32 * Math.floor(size / 32) ? small : big);
const mac = (s) => raster(s < 32 ? MAC16 : MAC32, s, true);
const win = (s) => raster(pick(WIN16, WIN32, s), s, false);

mkdirSync(SRC, { recursive: true });
for (const [name, grid, tile] of [["mac", MAC32, true], ["mac-16", MAC16, true], ["windows", WIN32, false], ["windows-16", WIN16, false]])
  writeFileSync(join(SRC, `${name}.svg`), svg(grid, tile));
const tmp = mkdtempSync(join(tmpdir(), "gs-icons-"));
try {
  writeFileSync(join(ICONS, "icon.icns"), icns(mac, tmp));
  writeFileSync(join(ICONS, "icon.ico"), ico([16, 32, 48, 64, 128, 256].map((s) => [s, win(s)])));
  // PNGs for Linux, the window icon on Linux, and the Windows Store tiles
  const pngs = { "32x32.png": 32, "64x64.png": 64, "128x128.png": 128, "128x128@2x.png": 256, "icon.png": 512, "StoreLogo.png": 50 };
  for (const s of [30, 44, 71, 89, 107, 142, 150, 284, 310]) pngs[`Square${s}x${s}Logo.png`] = s;
  for (const [name, s] of Object.entries(pngs)) writeFileSync(join(ICONS, name), win(s));
  console.log(`wrote ${ICONS}/icon.icns, icon.ico and ${Object.keys(pngs).length} PNGs; the drawings are in ${SRC}`);
} finally { rmSync(tmp, { recursive: true, force: true }); }
