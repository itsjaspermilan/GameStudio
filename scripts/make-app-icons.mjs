// Writes the studio's app icons into studio/src-tauri/icons/: icon.icns for macOS, icon.ico for Windows, and the PNGs Tauri wants
// (Linux, the window icon, the Windows Store tiles). The picture is a d-pad, a game controller's cross of arrows, as pixel art: a raised
// plus in light grey with its side showing, lit along its top edges, an arrow on each arm and a dimple in the middle:
//   - macOS: the d-pad on Apple's app icon tile (an 824 tile on a 1024 canvas, continuous corners), an indigo night in pixel bands
//     with a hard pixel shadow, so it sits with the other icons in the Dock;
//   - Windows: the d-pad alone, no tile, as big as the square.
// Each is drawn on a 32 x 32 grid and redrawn on a 16 x 16 one for the smallest sizes, and only ever scaled by whole numbers, so every
// pixel stays square and sharp. The drawing is the code below; SVGs of it are written to studio/src-tauri/icons/source/ to look at.
//   node scripts/make-app-icons.mjs        (from the repo root; on a Mac Apple's iconutil packs the .icns)
import { writeFileSync, readFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { png } from "./png.mjs";

const ICONS = resolve("studio/src-tauri/icons"), SRC = join(ICONS, "source");

// o outline, l lit edge, m face, s side (the pad's depth), a arrows, d the dimple, S the shadow on the tile.
const PAL = { o: "#211d30", l: "#ffffff", m: "#dfe0ea", s: "#8e91a6", a: "#9da0b4", d: "#c3c5d3", S: "#22185e" };

// A d-pad on a grid of n: a plus `size` across with arms `arm` thick (size - arm even), its top left at x0, y0, standing `depth`
// pixels proud of what is under it, in a one-pixel outline.
function dpad(n, x0, y0, size, arm, depth) {
  const g = Array.from({ length: n }, () => Array(n).fill("."));
  const a = (size - arm) / 2;
  const plus = (x, y) => x >= 0 && y >= 0 && x < size && y < size && ((x >= a && x < a + arm) || (y >= a && y < a + arm));
  const put = (x, y, ch) => { const gx = x0 + x, gy = y0 + y; if (gx >= 0 && gy >= 0 && gx < n && gy < n) g[gy][gx] = ch; };
  // the side first, the plus shifted down by each step of its depth, then the face over it
  for (let d = depth; d >= 1; d--) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (plus(x, y)) put(x, y + d, "s");
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (plus(x, y)) put(x, y, plus(x, y - 1) && plus(x - 1, y) ? "m" : "l");
  // the outline: every empty pixel beside the pad
  const filled = (x, y) => { const gx = x0 + x, gy = y0 + y; return gx >= 0 && gy >= 0 && gx < n && gy < n && g[gy][gx] !== "." && g[gy][gx] !== "o"; };
  for (let y = -1; y <= size + depth; y++) for (let x = -1; x <= size; x++)
    if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) put(x, y, "o");
  // an arrow on each arm, pointing out, two rows deep where the arm is thick enough
  if (arm >= 6) {
    const mid = size / 2, tip = Math.max(1, Math.floor(a / 2) - 1);
    for (const [w, r] of [[2, 0], [4, 1]]) {
      for (let i = 0; i < w; i++) {
        const c = mid - w / 2 + i;
        put(c, tip + r, "a"); put(c, size - 1 - tip - r, "a"); // up, down
        put(tip + r, c, "a"); put(size - 1 - tip - r, c, "a"); // left, right
      }
    }
  }
  // the dimple where the arms cross
  const ds = arm >= 6 ? 4 : 2, d0 = (size - ds) / 2;
  for (let y = 0; y < ds; y++) for (let x = 0; x < ds; x++) {
    const corner = ds === 4 && (x === 0 || x === 3) && (y === 0 || y === 3);
    if (!corner) put(d0 + x, d0 + y, y < ds / 2 ? "s" : "d");
  }
  return g;
}

// Windows: the d-pad as big as the square (outline and depth included).
const WIN32 = dpad(32, 2, 1, 28, 10, 2);
const WIN16 = dpad(16, 1, 1, 14, 6, 1);
// macOS: a smaller d-pad inside the tile, and a hard shadow one pixel down and right.
const MAC32 = dpad(32, 7, 6, 18, 6, 2);
const MAC16 = dpad(16, 3, 2, 10, 4, 1);
function shadow(g) {
  const n = g.length;
  for (let y = n - 1; y > 0; y--) for (let x = n - 1; x > 0; x--) if (g[y][x] === "." && g[y - 1][x - 1] !== "." && g[y - 1][x - 1] !== "S") g[y][x] = "S";
  return g;
}
shadow(MAC32);
shadow(MAC16);

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
