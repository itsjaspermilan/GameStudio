// node tests/same-frames.mjs a.bmp b.bmp [tolerance]: exit 0 when two frame dumps (GS_DUMP_FRAME) are the same size and every channel of
// every pixel is within the tolerance (default 0). Blending rounds a little differently from plain rectangles, so blend tests allow 2.
import { readFileSync } from "node:fs";
import { decodeBmp } from "../scripts/png.mjs";
const [a, b] = process.argv.slice(2, 4).map((f) => decodeBmp(readFileSync(f))), tol = Number(process.argv[4] || 0);
if (a.width !== b.width || a.height !== b.height) { console.log(`different sizes: ${a.width}x${a.height} and ${b.width}x${b.height}`); process.exit(1); }
for (let i = 0; i < a.data.length; i++) {
  if (Math.abs(a.data[i] - b.data[i]) > tol) {
    const p = i >> 2;
    console.log(`pixel ${p % a.width},${Math.floor(p / a.width)} differs: ${[...a.data.slice(p * 4, p * 4 + 3)]} and ${[...b.data.slice(p * 4, p * 4 + 3)]}`);
    process.exit(1);
  }
}
