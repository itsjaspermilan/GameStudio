// Contact sheet for looking at sprites while drawing them: node scripts/void-swarm/preview.mjs out.png ./module.mjs EXPORT [scale] [columns]
import { writeFileSync } from "node:fs";
import { png } from "../png.mjs";
import { Canvas, strip } from "./canvas.mjs";

export function sheet(list, scale = 4, cols = 4, bg = 1) {
  const cellW = Math.max(...list.map((s) => s.w * s.frames)) + 2, cellH = Math.max(...list.map((s) => s.h)) + 2;
  const cw = cellW * Math.min(cols, list.length), rows = Math.ceil(list.length / cols), ch = cellH * rows;
  const big = new Canvas(cw, ch); big.d.fill(bg);
  list.forEach((s, i) => {
    const fr = []; for (let f = 0; f < s.frames; f++) { const c = new Canvas(s.w, s.h); s.draw(c, f); fr.push(c); }
    big.stamp(strip(fr), (i % cols) * cellW + 1, Math.floor(i / cols) * cellH + 1);
  });
  const w = cw * scale, h = ch * scale, rgba = big.rgba(), out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (Math.floor(y / scale) * cw + Math.floor(x / scale)) * 4, d = (y * w + x) * 4; out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = 255; }
  return { w, h, out };
}
if (process.argv[4]) {
  const [out, mod, exp, scale, cols] = process.argv.slice(2);
  const m = await import(new URL(mod, import.meta.url));
  const list = m[exp].map((s) => ({ w: s.w || 16, h: s.h || 16, frames: s.frames || 1, draw: s.draw }));
  const r = sheet(list, Number(scale) || 4, Number(cols) || 4);
  writeFileSync(out, png(r.w, r.h, r.out));
}
