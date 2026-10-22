// The menus' panels and bars as tiles (tilesets/ts_panel.png, used by the scenes' layouts): 8x8 tiles, eight 3x3 blocks side by side,
// block b starting at tile b * 3. The layouts' panels stretch a block: corners as drawn, edges and middle repeated.
//   0 panel, teal edge, 190 of 255 solid    3 the same, 200    6 the same, 215    9 header bar (teal line along the bottom), 200
//   12 footer bar, 210    15 results panel, gold edge, 225    18 the same, red edge    21 a teal rule (the top row's first line only)
const T = 8;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const teal = hex("#45d1c5"), gold = hex("#f5d94a"), red = hex("#b0293a");
const BLOCKS = [
  { alpha: 190, edge: teal }, { alpha: 200, edge: teal }, { alpha: 215, edge: teal },
  { alpha: 200, line: teal }, { alpha: 210 }, { alpha: 225, edge: gold }, { alpha: 225, edge: red }, { rule: teal },
];

export function panelTiles() {
  const w = BLOCKS.length * 3 * T, h = 3 * T, rgba = new Uint8Array(w * h * 4);
  const set = (x, y, [r, g, b], a) => rgba.set([r, g, b, a], (y * w + x) * 4);
  BLOCKS.forEach((b, k) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < 3 * T; x++) {
      const X = k * 3 * T + x;
      if (b.rule) { if (y === 0) set(X, y, b.rule, 255); continue; }
      if (b.edge && (x === 0 || y === 0 || x === 3 * T - 1 || y === h - 1)) set(X, y, b.edge, 255);
      else if (b.line && y === h - 1) set(X, y, b.line, 255);
      else set(X, y, [0, 0, 0], b.alpha);
    }
  });
  return { w, h, rgba, tile: T };
}
