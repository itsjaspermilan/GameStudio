// Writes the survivors bench's pictures (run from studio/: node ../tests/survivors/make-art.mjs): a 16x16 grass tileset, a 16x16 hero,
// a 16x16 bat, an 8x8 bolt and an 8x8 gem. Generated so the bench needs no hand-drawn art.
import { writeFileSync } from "node:fs";
import { png } from "../../scripts/png.mjs";
const here = new URL(".", import.meta.url).pathname;
function picture(w, h, f) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(f(x, y), (y * w + x) * 4);
  return png(w, h, d);
}
const disc = (cx, cy, r, c) => (x, y) => (Math.hypot(x - cx, y - cy) < r ? c : [0, 0, 0, 0]);
writeFileSync(here + "tilesets/grass.png", picture(64, 16, (x, y) => {
  const t = x >> 4, n = ((x * 7 + y * 13 + t * 5) % 11) < 2;
  return n ? [40 + t * 10, 90, 50, 255] : [30 + t * 6, 70 + t * 4, 40, 255];
}));
writeFileSync(here + "tilesets/grass.json", JSON.stringify({ image: "tilesets/grass.png", tile_w: 16, tile_h: 16 }) + "\n");
const sprites = { hero: [16, 16, disc(7.5, 7.5, 7, [240, 220, 120, 255])], bat: [32, 16, (x, y) => disc(7.5 + (x >> 4) * 16, 7.5, 6 + (x >> 4), [170, 60, 200, 255])(x, y)],
  bolt: [8, 8, disc(3.5, 3.5, 3, [255, 255, 200, 255])], gem: [8, 8, disc(3.5, 3.5, 3, [80, 200, 255, 255])] };
for (const [n, [w, h, f]] of Object.entries(sprites)) {
  writeFileSync(here + `sprites/${n}.png`, picture(w, h, f));
  const fw = n === "bat" ? 16 : w;
  writeFileSync(here + `sprites/${n}.json`, JSON.stringify({ image: `sprites/${n}.png`, frames: w / fw, fps: 6, origin: [fw >> 1, h >> 1] }) + "\n");
}
