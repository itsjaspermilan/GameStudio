// Box art in the GBA's way: a small cover drawn in the game's own pixels with its own sprites, then enlarged twice, the same size a
// game pixel is on the handheld (640x480 shows Glow43's 320x240 at twice its size). A cover is COVER_W x COVER_H game pixels: a band
// along the top naming the console, the game's own scene, and its title along the bottom with a drop shadow, in a frame with round corners.
// The finished picture is 240x300 so that muOS, which draws box art at its own size over the right of its game list, keeps it beside the
// names and clear of its top and bottom bars (a 480x640 cover used to cover the whole list).
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { png, decodeBmp } from "../png.mjs";
import { writePictureCart } from "../picture-cart.mjs";

export const COVER_W = 120, COVER_H = 150, COVER_ZOOM = 2;

// Runs a throwaway game drawing `body` (Lua, the game's sprites and tilesets at hand, gs.draw included) at w x h and returns that frame
// at its own size: the runtime's dump is the window, a whole number of times bigger.
export function drawPicture(gameDir, w, h, body) {
  const d = mkdtempSync(join(tmpdir(), "gs-cover-"));
  for (const sub of ["sprites", "tilesets"]) {
    if (!existsSync(join(gameDir, sub))) continue;
    mkdirSync(join(d, sub));
    for (const f of readdirSync(join(gameDir, sub))) copyFileSync(join(gameDir, sub, f), join(d, sub, f));
  }
  if (existsSync(join(gameDir, "palette.json"))) copyFileSync(join(gameDir, "palette.json"), join(d, "palette.json"));
  writePictureCart(d, w, h, body);
  const bmp = join(d, "frame.bmp");
  const r = spawnSync("build/gs", [d], { encoding: "utf8", env: { ...process.env, GS_SAVE_DIR: mkdtempSync(join(tmpdir(), "gs-save-")), SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_MAX_FRAMES: "3", GS_DUMP_FRAME: bmp } });
  if (r.status !== 0 || !existsSync(bmp)) throw new Error(`the cover did not draw: ${r.stdout}${r.stderr}`);
  const f = decodeBmp(readFileSync(bmp)), k = Math.max(1, Math.round(f.width / w)), out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set(f.data.subarray(((y * k) * f.width + x * k) * 4, ((y * k) * f.width + x * k) * 4 + 4), (y * w + x) * 4);
  return { w, h, data: out };
}

// a picture enlarged by a whole number, pixel for pixel
export function enlarge({ w, h, data }, k) {
  const W = w * k, H = h * k, out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.set(data.subarray((((y / k) | 0) * w + ((x / k) | 0)) * 4, (((y / k) | 0) * w + ((x / k) | 0)) * 4 + 4), (y * W + x) * 4);
  return { w: W, h: H, data: out };
}

// The cover: `scene` (Lua) draws the game's picture over the whole cover first; then the band, the title and the frame go over it.
// accent: the colour of the band's stripe and the title ("#rrggbb"); consoleName: written in the band.
export function makeCover(gameDir, { scene, title, accent = "#f5d94a", consoleName = "Glow43" }) {
  const body = `
${scene}
  -- the band: the console's name, as GBA boxes carry theirs, and a stripe in the game's colour under it
  gs.draw.rect(0, 0, W, 12, "#101828")
  gs.draw.rect(0, 12, W, 1, "${accent}")
  gs.draw.text(${JSON.stringify(consoleName)}, 5, 2, "#ffffff", 1, { font = "bold_small", shadow = "#000000" })
  for i = 0, 2 do gs.draw.rect(W - 22 + i * 6, 4, 4, 4, ({ "#ea5a4b", "#f5d94a", "#4f9bf0" })[i + 1]) end
  -- the title on a dark strip along the bottom
  gs.draw.rect(0, H - 25, W, 25, "#101828d8")
  gs.draw.rect(0, H - 26, W, 1, "${accent}")
  gs.draw.text_centered(${JSON.stringify(title)}, H - 20, "${accent}", 1, { font = "bold_tall", shadow = "#000000" })
  -- the frame
  gs.draw.frame(0, 0, W, H, "#e8ecf4")
`;
  const pic = enlarge(drawPicture(gameDir, COVER_W, COVER_H, body), COVER_ZOOM);
  // round corners: the frame's corner pixels are cut away
  const cut = [[0, 0], [1, 0], [0, 1]];
  for (const [cx, cy] of cut) for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const gx = fx ? COVER_W - 1 - cx : cx, gy = fy ? COVER_H - 1 - cy : cy;
    for (let y = 0; y < COVER_ZOOM; y++) for (let x = 0; x < COVER_ZOOM; x++) pic.data[(((gy * COVER_ZOOM + y) * pic.w) + gx * COVER_ZOOM + x) * 4 + 3] = 0;
  }
  mkdirSync(join(gameDir, "meta"), { recursive: true });
  writeFileSync(join(gameDir, "meta", "box_art.png"), png(pic.w, pic.h, pic.data));
  return pic;
}

// The preview muOS and EmulationStation show: the game as it looks, at the handheld's own size (twice the console's screen).
export function makePreview(gameDir, frames = 90, env = {}) {
  const bmp = join(mkdtempSync(join(tmpdir(), "gs-shot-")), "frame.bmp");
  const r = spawnSync("build/gs", [gameDir], { encoding: "utf8", env: { ...process.env, GS_SAVE_DIR: mkdtempSync(join(tmpdir(), "gs-save-")), SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_MAX_FRAMES: String(frames), GS_DUMP_FRAME: bmp, ...env } });
  if (r.status !== 0 || !existsSync(bmp)) throw new Error(`could not run ${gameDir}: ${r.stdout}${r.stderr}`);
  const f = decodeBmp(readFileSync(bmp));
  // the console's own screen size, from the dump: it is a whole number of times bigger
  const spec = JSON.parse(readFileSync(join(gameDir, "game.lua"), "utf8").includes("glow169") ? readFileSync("engine/consoles/glow169.json", "utf8") : readFileSync("engine/consoles/glow43.json", "utf8"));
  const sw = spec.screen?.width || 320, k = Math.max(1, Math.round(f.width / sw)), sh = Math.round(f.height / k), out = new Uint8Array(sw * sh * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) out.set(f.data.subarray(((y * k) * f.width + x * k) * 4, ((y * k) * f.width + x * k) * 4 + 4), (y * sw + x) * 4);
  const pic = enlarge({ w: sw, h: sh, data: out }, 2);
  writeFileSync(join(gameDir, "meta", "screenshot.png"), png(pic.w, pic.h, pic.data));
  return pic;
}
