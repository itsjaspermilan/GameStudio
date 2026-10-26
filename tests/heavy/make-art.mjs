// Writes the heavy screen's pictures (run from studio/: node ../tests/heavy/make-art.mjs): a full-screen background, a full-screen soft glow
// and a 32x32 star sprite. Generated so the bench needs no hand-drawn art.
import { writeFileSync } from "node:fs";
import { png } from "../../scripts/png.mjs";
const here = new URL(".", import.meta.url).pathname;
function picture(w, h, f) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(f(x, y), (y * w + x) * 4);
  return png(w, h, d);
}
writeFileSync(here + "sprites/back.png", picture(256, 192, (x, y) => [20 + (x >> 3) * 2, 30 + (y >> 3) * 3, 60 + ((x ^ y) & 31), 255]));
writeFileSync(here + "sprites/glow.png", picture(256, 192, (x, y) => {
  const d = Math.hypot(x - 128, y - 96) / 140, a = Math.max(0, 1 - d);
  return [255, 180, 80, Math.round(a * 255)];
}));
writeFileSync(here + "sprites/star.png", picture(32, 32, (x, y) => {
  const d = Math.abs(x - 15.5) + Math.abs(y - 15.5);
  return d < 14 ? [255, 230 - d * 8, 120 + d * 6, 255] : [0, 0, 0, 0];
}));
for (const [n, w, h] of [["back", 256, 192], ["glow", 256, 192], ["star", 32, 32]])
  writeFileSync(here + `sprites/${n}.json`, JSON.stringify({ image: `sprites/${n}.png`, frames: 1, origin: [w >> 1, h >> 1] }) + "\n");
