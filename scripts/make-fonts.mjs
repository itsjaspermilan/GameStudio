// Writes the built-in fonts for the runtime (runtime/fonts.h) and the studio (studio/src/fonts.js) from the letters drawn in
// engine/fonts/*.txt. Every style comes in a small size (8 rows, for scores and labels) and a tall one (12 rows, for talking and
// menus). Round and square are drawn by hand (round-*.txt, square-*.txt); bold is made from round the way GBA games often made their
// variants, each stroke thickened by a pixel to the right.
// Run it after editing the letters: node scripts/make-fonts.mjs (then scripts/build.sh). studio/test/fonts.test.mjs checks it was run.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIRST = 32, LAST = 126;
// the space between two letters, and how far apart lines of text sit (talk boxes, menus, wrapped text)
const GAP = 1, LINE = { 8: 10, 12: 14 };

// A drawing is { h, glyphs: [{ w, rows }] }: a row is a number, bit 0 the leftmost pixel. Glyphs run from " " to "~", then the
// "unknown" box drawn for any other character.
export function parseFont(text, file = "font") {
  let h = 0, cur = null;
  const byName = new Map();
  for (const [n, raw] of text.split("\n").entries()) {
    const line = raw.trimEnd();
    if (!line || line.startsWith("#") && !/^[.#]+$/.test(line)) continue;
    if (line.startsWith("height ")) { h = Number(line.slice(7)); continue; }
    if (line.startsWith("= ")) { cur = { name: line.slice(2), lines: [], at: n + 1 }; byName.set(cur.name, cur); continue; }
    if (!/^[.#]+$/.test(line) || !cur) throw new Error(`${file}:${n + 1}: a row is only . and #`);
    cur.lines.push(line);
  }
  const glyphs = [];
  const names = [];
  for (let c = FIRST; c <= LAST; c++) names.push(c === 32 ? "space" : String.fromCharCode(c));
  names.push("unknown");
  for (const name of names) {
    const g = byName.get(name);
    if (!g) throw new Error(`${file}: the letter "${name}" is missing`);
    const w = g.lines[0].length;
    if (g.lines.some((l) => l.length !== w)) throw new Error(`${file}:${g.at}: the rows of "${name}" are not all as wide`);
    if (g.lines.length > h) throw new Error(`${file}:${g.at}: "${name}" is taller than ${h} rows`);
    const rows = Array.from({ length: h }, (_, y) => { const l = g.lines[y] || ""; let v = 0; for (let x = 0; x < l.length; x++) if (l[x] === "#") v |= 1 << x; return v; });
    glyphs.push({ w, rows });
  }
  return { h, glyphs };
}

const on = (g, x, y) => x >= 0 && x < g.w && y >= 0 && y < g.rows.length && (g.rows[y] >> x & 1) === 1;
// Thickening would close a one-pixel gap between two strokes (the middle of an m), so such a gap is made two wide first.
function bolded(g) {
  const cols = [];
  for (let x = 0; x < g.w; x++) {
    cols.push(x);
    if (g.rows.some((_, y) => on(g, x - 1, y) && !on(g, x, y) && on(g, x + 1, y))) cols.push(x);
  }
  const rows = g.rows.map((_, y) => { let v = 0; cols.forEach((x, i) => { if (on(g, x, y)) v |= 1 << i; }); return v | v << 1; });
  return { w: cols.length + 1, rows };
}

export function buildFonts() {
  const fonts = {};
  for (const size of ["small", "tall"]) {
    const round = parseFont(readFileSync(join(root, `engine/fonts/round-${size}.txt`), "utf8"), `round-${size}.txt`);
    fonts[`round_${size}`] = round;
    fonts[`square_${size}`] = parseFont(readFileSync(join(root, `engine/fonts/square-${size}.txt`), "utf8"), `square-${size}.txt`);
    fonts[`bold_${size}`] = { h: round.h, glyphs: round.glyphs.map(bolded) };
  }
  // the order the runtime numbers them in: round_small (0) is what text is drawn in when no font is named
  const order = ["round_small", "round_tall", "square_small", "square_tall", "bold_small", "bold_tall"];
  return order.map((name) => ({ name, h: fonts[name].h, line: LINE[fonts[name].h], glyphs: fonts[name].glyphs }));
}

export function headerText(fonts) {
  const out = [`/* The built-in fonts gs.print draws with (written by scripts/make-fonts.mjs from the letters in engine/fonts; do not edit).
 * ${fonts.length} fonts of ${fonts[0].glyphs.length} glyphs each: " " to "~", then the box for any other character. A glyph is its width, then
 * one number a row, bit 0 the leftmost pixel. Letters are ${GAP} pixel apart. */
#ifndef GS_FONTS_H
#define GS_FONTS_H
#define GS_FONT_FIRST ${FIRST}
#define GS_FONT_GLYPHS ${fonts[0].glyphs.length}
#define GS_FONT_GAP ${GAP}
typedef struct { const char *name; int h, line; const unsigned char *w; const unsigned short *rows; } GsFont;`];
  for (const f of fonts) {
    out.push(`static const unsigned char gs_font_${f.name}_w[] = { ${f.glyphs.map((g) => g.w).join(", ")} };`);
    out.push(`static const unsigned short gs_font_${f.name}_rows[] = {\n${f.glyphs.map((g) => "    " + g.rows.join(", ") + ",").join("\n")}\n};`);
  }
  out.push(`static const GsFont gs_fonts[] = {\n${fonts.map((f) => `    { "${f.name}", ${f.h}, ${f.line}, gs_font_${f.name}_w, gs_font_${f.name}_rows },`).join("\n")}\n};`);
  out.push(`#define GS_FONTS ${fonts.length}\n#endif\n`);
  return out.join("\n");
}

export function studioText(fonts) {
  return `// The runtime's built-in fonts, so the layout editor shows text in the game's own letters (written by scripts/make-fonts.mjs from
// engine/fonts/*.txt; do not edit). A glyph is [width, row, row, ...], bit 0 of a row the leftmost pixel, from " " (FONT_FIRST) to "~",
// then the box drawn for any other character. Letters are FONT_GAP pixel apart.
export const FONT_FIRST = ${FIRST};
export const FONT_GAP = ${GAP};
export const FONTS = {
${fonts.map((f) => `  ${f.name}: { h: ${f.h}, line: ${f.line}, glyphs: ${JSON.stringify(f.glyphs.map((g) => [g.w, ...g.rows]))} },`).join("\n")}
};
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fonts = buildFonts();
  writeFileSync(join(root, "runtime/fonts.h"), headerText(fonts));
  writeFileSync(join(root, "studio/src/fonts.js"), studioText(fonts));
  console.log(`wrote runtime/fonts.h and studio/src/fonts.js: ${fonts.length} fonts (${fonts.map((f) => f.name).join(", ")})`);
}
