// The menus' panels and bars as tiles (tilesets/ts_panel.png, used by the scenes' layouts): 8x8 tiles, eight 3x3 blocks side by side,
// block b starting at tile b * 3. The layouts' panels stretch a block: corners as drawn, edges and middle repeated.
//   0 panel, teal edge, 190 of 255 solid    3 the same, 200    6 the same, 215    9 header bar (teal line along the bottom), 200
//   12 footer bar, 210    15 results panel, gold edge, 225    18 the same, red edge    21 a teal rule (the top row's first line only)
// Drawn the way GBA menus are: a bevelled double border (light on the top and left, dark on the bottom and right, a black line inside),
// rounded corners and a deep blue body with a sheen along the top.
const T = 8, S = 3 * T;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const EDGES = { teal: [hex("#7aeede"), hex("#2b8f94")], gold: [hex("#ffe27a"), hex("#b8862c")], red: [hex("#f0706a"), hex("#86202e")] };
const BODY = hex("#0a1024"), SHEEN = hex("#18234a"), BLACK = [0, 0, 0];
const BLOCKS = [
  { alpha: 190, edge: "teal" }, { alpha: 200, edge: "teal" }, { alpha: 215, edge: "teal" },
  { alpha: 200, bar: "bottom" }, { alpha: 210, bar: "top" }, { alpha: 225, edge: "gold" }, { alpha: 225, edge: "red" }, { rule: true },
];

export function panelTiles() {
  const w = BLOCKS.length * S, h = S, rgba = new Uint8Array(w * h * 4);
  BLOCKS.forEach((b, k) => {
    const set = (x, y, [r, g, bl], a) => rgba.set([r, g, bl, a], (y * w + k * S + x) * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const [lt, dk] = EDGES[b.edge || "teal"], last = S - 1;
      if (b.rule) { if (y === 0) set(x, y, x < 2 || x > last - 2 ? dk : lt, 255); else if (y === 1) set(x, y, BLACK, 160); continue; }
      if (b.bar) {
        // a bar across the screen: the deep body, and a bevelled teal line on the side that meets the play area
        const edgeY = b.bar === "bottom" ? last : 0, inner = b.bar === "bottom" ? last - 1 : 1, shadow = b.bar === "bottom" ? last - 2 : 2;
        if (y === edgeY) set(x, y, dk, 255); else if (y === inner) set(x, y, lt, 255); else if (y === shadow) set(x, y, BLACK, 255);
        else set(x, y, (b.bar === "bottom" ? y < 4 : y > last - 4) ? SHEEN : BODY, b.alpha);
        continue;
      }
      const cx = Math.min(x, last - x), cy = Math.min(y, last - y);
      if (cx + cy < 2) continue;                                                       // the rounded corner
      if (cx === 0 || cy === 0 || cx + cy === 2) {                                     // the border: lit on the top and the left
        const top = y < S / 2 && (cy === 0 || cx + cy === 2), left = x < S / 2 && (cx === 0 || cx + cy === 2);
        set(x, y, top || left ? lt : dk, 255);
      }
      else if (cx === 1 || cy === 1) set(x, y, BLACK, 255);                            // the black line inside the border
      else set(x, y, y >= 2 && y <= 4 ? SHEEN : BODY, b.alpha);                        // a sheen along the top
    }
  });
  return { w, h, rgba, tile: T };
}
