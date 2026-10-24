// Writes the button icons that texts show for {a}, {start}, {left} and so on: engine/gs/buttons_art.lua for the runtime and
// studio/src/buttons.js for the layout editor and the MCP server's pictures. Every icon is drawn here once, as a shape (a round face
// button, a rounded shoulder button, a pill with its word, the d-pad) with its letter on it, in two sizes: small (8 rows, beside the
// 8-row fonts) and tall (12 rows, beside the tall fonts). The styles only colour the same pixels, the way GBA-era manuals and games
// showed buttons: gba (grey), snes (the four coloured face buttons), nes (red on black) and mono (one colour, the text's own).
// Run it after changing an icon or a style: node scripts/make-buttons.mjs (then scripts/build.sh). studio/test/buttons.test.mjs
// checks it was run.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFont } from "./make-fonts.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The small icons' letters, 3 by 5: the tall icons use the small round font's own capitals instead.
const TINY = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
  E: ["###", "#..", "##.", "#..", "###"], L: ["#..", "#..", "#..", "#..", "###"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
};
function fontLetters() {
  const f = parseFont(readFileSync(join(root, "engine/fonts/round-small.txt"), "utf8"), "round-small.txt");
  const out = {};
  for (const ch of "ABCELRSTXY") {
    const g = f.glyphs[ch.charCodeAt(0) - 32];
    const rows = g.rows.map((r) => Array.from({ length: g.w }, (_, x) => (r >> x & 1 ? "#" : ".")).join(""));
    while (rows.length && !rows[rows.length - 1].includes("#")) rows.pop(); // capitals sit on rows 0-5
    out[ch] = rows;
  }
  return out;
}

// ---------- shapes: a grid of "." (nothing), "o" (outline) and "f" (fill) ----------
const grid = (w, h, inside) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (inside(x, y) ? "f" : ".")));
// the outline is every inside pixel next to the outside (or the edge), so shapes keep their size
function outlined(g) {
  const h = g.length, w = g[0].length, at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : ".");
  return g.map((row, y) => row.map((v, x) => (v === "f" && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) === ".") ? "o" : v)));
}
function disc(w, h) {
  const cx = (w - 1) / 2, cy = (h - 1) / 2, rx = w / 2, ry = h / 2;
  return outlined(grid(w, h, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.02));
}
function rounded(w, h, r) {
  return outlined(grid(w, h, (x, y) => {
    const dx = x < r ? r - x - 0.5 : x >= w - r ? x - (w - r) + 0.5 : 0, dy = y < r ? r - y - 0.5 : y >= h - r ? y - (h - r) + 0.5 : 0;
    return dx * dx + dy * dy <= r * r;
  }));
}
function cross(n, arm) {
  const a = (n - arm) / 2;
  return outlined(grid(n, n, (x, y) => (x >= a && x < a + arm) || (y >= a && y < a + arm)));
}
// a letter or a word stamped onto the middle of a shape as "l"
function stamp(g, letters, gap = 1) {
  const glyphs = [...letters].map((c) => letters.length && LETTERS[c]);
  const lw = glyphs.reduce((w, l) => w + l[0].length, 0) + gap * (glyphs.length - 1), lh = Math.max(...glyphs.map((l) => l.length));
  let x0 = Math.floor((g[0].length - lw) / 2);
  const y0 = Math.floor((g.length - lh) / 2);
  for (const l of glyphs) {
    l.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") g[y0 + y][x0 + x] = "l"; }));
    x0 += l[0].length + gap;
  }
  return g;
}
let LETTERS = TINY;
// the d-pad's arm pointing that way, darker ("l"), as if pressed
function pressed(g, dir) {
  const n = g.length, mid = (n - 1) / 2;
  return g.map((row, y) => row.map((v, x) => {
    if (v !== "f") return v;
    const on = dir === "up" ? y < mid - 1 : dir === "down" ? y > mid + 1 : dir === "left" ? x < mid - 1 : x > mid + 1;
    return on && Math.abs(dir === "up" || dir === "down" ? x - mid : y - mid) <= 1 ? "l" : v;
  }));
}
// light on the inside of the top-left edge ("h"), and a shadow row under the shape ("s")
function lit(g) {
  return g.map((row, y) => row.map((v, x) => (v === "f" && (g[y - 1] || [])[x] === "o" && (row[x - 1] === "o" || (g[y - 1] || [])[x - 1] === "o") ? "h" : v)));
}
function shadowed(g) { return [...g, g[g.length - 1].map((v) => (v === "." ? "." : "s"))]; }

// small icons are 9 rows (a pixel of room round each 3 x 5 letter, no shadow), tall ones 11 and a shadow; both start a row above the
// text's top, so they sit centred on its capitals
const SIZES = {
  small: { dy: -1, face: () => disc(9, 9), shoulder: () => rounded(9, 9, 2), pill: (w) => rounded(w + 6, 9, 4), pad: () => cross(9, 3), light: false, shadow: false },
  tall: { dy: -1, face: () => disc(11, 11), shoulder: () => rounded(11, 11, 3), pill: (w) => rounded(w + 6, 11, 5), pad: () => cross(11, 5), light: true, shadow: true },
};
export const ICONS = ["a", "b", "x", "y", "l", "r", "start", "select", "up", "down", "left", "right", "dpad"];
const GROUP = { a: "face", b: "face", x: "face", y: "face", l: "shoulder", r: "shoulder", start: "pill", select: "pill", up: "dpad", down: "dpad", left: "dpad", right: "dpad", dpad: "dpad" };

function drawIcon(size, name) {
  const s = SIZES[size];
  let g;
  const word = name === "start" ? "START" : name === "select" ? "SELECT" : name.toUpperCase();
  if (GROUP[name] === "face") g = stamp(s.face(), word);
  else if (GROUP[name] === "shoulder") g = stamp(s.shoulder(), word);
  else if (GROUP[name] === "pill") {
    const lw = [...word].reduce((w, c) => w + LETTERS[c][0].length, 0) + word.length - 1;
    g = stamp(s.pill(lw), word);
  } else g = name === "dpad" ? s.pad() : pressed(s.pad(), name);
  if (s.light) g = lit(g);
  return (s.shadow ? shadowed(g) : g).map((row) => row.join(""));
}

// ---------- styles: a colour for each kind of pixel, by the kind of button (null: nothing drawn) ----------
const SHADOW = "#00000048";
export const STYLES = {
  gba: { tint: false, base: { o: "#282830", s: SHADOW },
    face: { f: "#d0d0d8", h: "#ffffff", l: "#383848" }, shoulder: { f: "#a0a0b0", h: "#d8d8e0", l: "#282830" },
    pill: { f: "#585868", h: "#8888a0", l: "#e8e8f0" }, dpad: { f: "#484858", h: "#686878", l: "#b0b0c0" } },
  snes: { tint: false, base: { o: "#202028", s: SHADOW },
    face: { l: "#ffffff" }, a: { f: "#c83030", h: "#f07070" }, b: { f: "#e0b020", h: "#f8e080" }, x: { f: "#3060c8", h: "#80a8f0" }, y: { f: "#30a048", h: "#80d890" },
    shoulder: { f: "#b8b8c8", h: "#e0e0e8", l: "#303038" }, pill: { f: "#9090a8", h: "#b8b8c8", l: "#202028" }, dpad: { f: "#383840", h: "#585860", l: "#c0c0c8" } },
  nes: { tint: false, base: { o: "#101010", s: SHADOW },
    face: { f: "#c82828", h: "#f06060", l: "#f8f8f8" }, shoulder: { f: "#909090", h: "#c0c0c0", l: "#101010" },
    pill: { f: "#383838", h: "#585858", l: "#e84848" }, dpad: { f: "#202020", h: "#404040", l: "#a0a0a0" } },
  // one colour, given when it is drawn (the text's): the letters are left see-through
  mono: { tint: true, base: { o: "#ffffff", f: "#ffffff", h: "#ffffff", l: null, s: null } },
};
const colours = (style, name) => ({ o: null, f: null, h: null, l: null, s: null, ...style.base, ...style[GROUP[name]], ...style[name] });

export function buildButtons() {
  const sizes = {};
  for (const size of Object.keys(SIZES)) {
    LETTERS = size === "tall" ? fontLetters() : TINY;
    const icons = {};
    for (const name of ICONS) { const rows = drawIcon(size, name); icons[name] = { w: rows[0].length, rows }; }
    sizes[size] = { dy: SIZES[size].dy, icons };
  }
  const styles = {};
  for (const [k, st] of Object.entries(STYLES)) styles[k] = { tint: st.tint, colours: Object.fromEntries(ICONS.map((n) => [n, colours(st, n)])) };
  return { sizes, styles, order: ICONS };
}

const lua = (v, ind = "") => {
  if (v === null) return "false";
  if (Array.isArray(v)) return `{ ${v.map((x) => lua(x, ind)).join(", ")} }`;
  if (typeof v === "object") return `{\n${Object.entries(v).map(([k, x]) => `${ind}  ${/^[a-z_]\w*$/.test(k) ? k : `["${k}"]`} = ${lua(x, ind + "  ")},`).join("\n")}\n${ind}}`;
  return typeof v === "string" ? JSON.stringify(v) : String(v);
};
export function luaText(b) {
  return `-- The button icons texts show for {a}, {start}, {left} ... (written by scripts/make-buttons.mjs; do not edit). Each icon is rows of
-- "." (nothing), "o" outline, "f" fill, "h" light, "l" letter and "s" shadow; a style gives each its colour (false: not drawn).
return ${lua(b)}
`;
}
export function studioText(b) {
  return `// The button icons texts show for {a}, {start}, {left} ... so the layout editor draws them as the game does (written by
// scripts/make-buttons.mjs; do not edit). Each icon is rows of "." (nothing), "o" outline, "f" fill, "h" light, "l" letter and "s" shadow;
// a style gives each its colour (null: not drawn).
export const BUTTONS = ${JSON.stringify(b)};
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const b = buildButtons();
  writeFileSync(join(root, "engine/gs/buttons_art.lua"), luaText(b));
  writeFileSync(join(root, "studio/src/buttons.js"), studioText(b));
  for (const size of Object.keys(b.sizes)) {
    console.log(`${size}:`);
    for (const n of ["a", "start", "l", "left"]) console.log(`  ${n}\n` + b.sizes[size].icons[n].rows.map((r) => "    " + r).join("\n"));
  }
}
