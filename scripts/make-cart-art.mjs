// Makes the pictures a game list shows for a project, with the game's own runtime (nothing is drawn by hand):
//   meta/screenshot.png  the game after a second of running, as the game looks
//   meta/box_art.png     a portrait cover: the title in big letters over the game's first sprites, in the console's palette
//   meta/logo.png        the title as a banner
// usage: node scripts/make-cart-art.mjs <project-dir> [--frames N] [--sprites a,b,c]   (needs build/gs; meta/info.json needs a title)
//   --sprites  the sprites on the cover (default: the first three by name), side by side
// scripts/push.sh sends whichever of these exist; the studio's "Game info" box art is meta/box_art.png as well.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { png, decodeBmp } from "./png.mjs";
import { writePictureCart } from "./picture-cart.mjs";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--") && !["--room", "--frames", "--sprites"].includes(args[args.indexOf(a) - 1]));
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
if (!dir) { console.error("usage: node scripts/make-cart-art.mjs <project-dir> [--frames N]"); process.exit(2); }
const info = JSON.parse(readFileSync(join(dir, "meta", "info.json"), "utf8"));
const title = (info.title || "GAME").toUpperCase();
const spec = join("engine", "consoles", `${info.console || "dot"}.json`);
const palette = ((existsSync(spec) && JSON.parse(readFileSync(spec, "utf8")).palette.colors) || ["#000000", "#3b3f55", "#8a90a2", "#ffffff"]);
const rgb = (i) => { const h = palette[Math.min(i, palette.length - 1)]; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
mkdirSync(join(dir, "meta"), { recursive: true });

// runs a game (a project folder) for a few frames and saves the last frame as a PNG
function shot(game, out, { frames = 3, env = {} } = {}) {
  const bmp = join(mkdtempSync(join(tmpdir(), "gs-art-")), "frame.bmp");
  const r = spawnSync("build/gs", [game], { encoding: "utf8", env: { ...process.env, GS_SAVE_DIR: mkdtempSync(join(tmpdir(), "gs-save-")), SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_MAX_FRAMES: String(frames), GS_DUMP_FRAME: bmp, ...env } });
  if (r.status !== 0 || !existsSync(bmp)) throw new Error(`could not run ${game}: ${r.stdout}${r.stderr}`);
  const f = decodeBmp(readFileSync(bmp)); writeFileSync(out, png(f.width, f.height, f.data));
  return f;
}

// a throwaway Lua game that draws one picture of the given logical size
function luaPicture(w, h, body, files = []) {
  const d = mkdtempSync(join(tmpdir(), "gs-lua-"));
  mkdirSync(join(d, "sprites"));
  for (const f of files) copyFileSync(join(dir, "sprites", f), join(d, "sprites", f));
  writePictureCart(d, w, h, body);
  return d;
}
// width and height from a PNG's header
const pngSize = (file) => { const b = readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
const text = (s, x, y, color, scale) => `gs.print(${JSON.stringify(s)}, ${x}, ${y}, ${color[0]}, ${color[1]}, ${color[2]}, 255, ${scale})`;
const fit = (s, width, max) => Math.max(1, Math.min(max, Math.floor(width / (s.length * 8))));

// 1. the screenshot: the game itself
const sprites = opt("--sprites") ? opt("--sprites").split(",")
  : existsSync(join(dir, "sprites")) ? readdirSync(join(dir, "sprites")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort().slice(0, 3) : [];
shot(dir, join(dir, "meta/screenshot.png"), { frames: Number(opt("--frames", 90)) });

// 2. the logo: the title as a banner
{
  const scale = fit(title, 300, 5), tw = title.length * 8 * scale, x = Math.floor((320 - tw) / 2), y = Math.floor((80 - 8 * scale) / 2);
  const body = [`gs.clear(${rgb(1).join(", ")})`, `gs.rect(0, 0, W, 4, ${rgb(6).join(", ")})`, `gs.rect(0, H - 4, W, 4, ${rgb(14).join(", ")})`,
    text(title, x + scale, y + scale, rgb(0), scale), text(title, x, y, rgb(3), scale)].join("\n");
  shot(luaPicture(320, 80, body), join(dir, "meta/logo.png"));
}

// 3. the box art: the title in big letters (a word a line) over the first sprites
{
  const words = title.split(/\s+/), scale = Math.min(...words.map((w) => fit(w, 216, 6))), lineH = 8 * scale + 6;
  const body = [`gs.clear(${rgb(1).join(", ")})`, `gs.rect(0, 0, W, 6, ${rgb(6).join(", ")})`, `gs.rect(0, 6, W, 6, ${rgb(10).join(", ")})`, `gs.rect(0, 12, W, 6, ${rgb(14).join(", ")})`];
  words.forEach((w, i) => { const x = Math.floor((240 - w.length * 8 * scale) / 2), y = 40 + i * lineH; body.push(text(w, x + 2, y + 2, rgb(0), scale), text(w, x, y, rgb(3), scale)); });
  // the sprites stand in one row, all at the same whole-number scale, as big as fits between the title and the footer
  const imgs = sprites.map((s, i) => {
    const meta = JSON.parse(readFileSync(join(dir, "sprites", `${s}.json`), "utf8"));
    const size = pngSize(join(dir, "sprites", `${s}.png`)), frames = meta.frames || 1;
    body.unshift(`local s${i} = gs.image("sprites/${s}.png")`);
    return { i, fw: Math.floor(size.w / frames), fh: size.h };
  });
  if (imgs.length) {
    const top = 40 + words.length * lineH + 12, bottom = 296, gap = 4;
    const sumW = imgs.reduce((a, m) => a + m.fw, 0), maxH = Math.max(...imgs.map((m) => m.fh));
    const k = Math.max(1, Math.min(8, Math.floor((224 - gap * (imgs.length - 1)) / sumW), Math.floor((bottom - top) / maxH)));
    let x = Math.floor((240 - (sumW * k + gap * (imgs.length - 1))) / 2);
    const base = top + Math.floor((bottom - top + maxH * k) / 2);
    for (const m of imgs) { body.push(`gs.tile(s${m.i}, 0, 0, ${m.fw}, ${m.fh}, ${x}, ${base - m.fh * k}, ${k})`); x += m.fw * k + gap; }
  }
  body.push(text("GAMESTUDIO", Math.floor((240 - 80 * 1) / 2), 304, rgb(2), 1));
  shot(luaPicture(240, 320, body.join("\n"), sprites.flatMap((s) => [`${s}.png`, `${s}.json`])), join(dir, "meta/box_art.png"));
}
console.log(`wrote ${dir}/meta/screenshot.png, logo.png, box_art.png (${title})`);
