// Writes studio/src/font8.js: the runtime's built-in 8x8 font (what gs.draw.text draws), so the studio's layout editor shows text in the
// same letters as the game. The letters are read back from the runtime itself: a tiny game prints every character from " " to "~"
// in white on black, the frame is saved (GS_DUMP_FRAME), and each 8x8 cell becomes 8 bytes (a row each, the high bit on the left).
// Run it after changing how the runtime draws text: node scripts/make-font8.mjs (needs build/gs). studio/test/font8.test.mjs checks it.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export function readFont(gs = join(root, "build/gs")) {
  const dir = mkdtempSync(join(tmpdir(), "gs-font8-"));
  mkdirSync(join(dir, "scenes"));
  writeFileSync(join(dir, "game.lua"), 'return gs.game{ title = "font", console = "glow43", start = "scenes.all" }\n');
  writeFileSync(join(dir, "scenes/all.lua"), `local All = gs.scene{}
function All:draw_ui()
  for c = 32, 126 do local i = c - 32; gs.raw.print(string.char(c), (i % 16) * 8, (i // 16) * 8, 255, 255, 255, 255, 1) end
end
return All
`);
  const shot = join(dir, "shot.bmp");
  const r = spawnSync(gs, [dir], { env: { ...process.env, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_SAVE_DIR: dir, GS_MAX_FRAMES: "3", GS_DUMP_FRAME: shot }, encoding: "utf8" });
  if (r.status !== 0) throw new Error("the runtime did not run: " + r.stderr);
  const b = readFileSync(shot);
  const off = b.readUInt32LE(10), w = b.readInt32LE(18), h = b.readInt32LE(22), bpp = b.readUInt16LE(28) / 8;
  const rowBytes = Math.ceil((w * bpp) / 4) * 4, k = w / 320; // the dump is the window, a whole number of times the screen
  const lit = (x, y) => { const yy = h > 0 ? h - 1 - y * k : y * k, i = off + yy * rowBytes + x * k * bpp; return b[i] + b[i + 1] + b[i + 2] > 384; };
  const glyphs = [];
  for (let c = 32; c <= 126; c++) {
    const i = c - 32, cx = (i % 16) * 8, cy = Math.floor(i / 16) * 8;
    let hex = "";
    for (let y = 0; y < 8; y++) { let v = 0; for (let x = 0; x < 8; x++) if (lit(cx + x, cy + y)) v |= 0x80 >> x; hex += v.toString(16).padStart(2, "0"); }
    glyphs.push(hex);
  }
  return glyphs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const glyphs = readFont();
  writeFileSync(join(root, "studio/src/font8.js"), `// The runtime's built-in 8x8 font, the letters " " to "~" (written by scripts/make-font8.mjs from the runtime itself; do not edit).
// Each letter is 16 hex digits: 8 rows of 8 pixels, the high bit on the left.
export const FONT8_FIRST = 32;
export const FONT8 = ${JSON.stringify(glyphs, null, 0).replace(/","/g, '", "')};
`);
  console.log("wrote studio/src/font8.js:", glyphs.length, "letters");
}
