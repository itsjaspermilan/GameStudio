// Tilesets: each biome has a Now sheet (the wreck) and a Then sheet (as it was), with the same tile numbers so one room drawing
// fits both. 16x16 tiles, 8 to a row, 128x64:
//   0-15  wall, numbered by its open sides (1 top, 2 right, 4 bottom, 8 left) so edges get trim
//   16    thin floor (stand on it, jump up through it, Down + B drops)
//   17    hazard (hurts; Now: sparking cable, Then: never used)
//   24-31 background: panel, panel with a light, vent, window, pipe down, pipe across, stripe, dark (broken) panel
import { Canvas, rng } from "../lib/canvas.mjs";

export const TILE = { THIN: 16, HAZARD: 17, PANEL: 24, LIGHT: 25, VENT: 26, WINDOW: 27, PIPE_V: 28, PIPE_H: 29, STRIPE: 30, DARK: 31 };

// A theme: colours (palette places) for walls, trim, the background and its lights, and how broken it is.
const THEMES = {
  hangar_now: { base: 1, plate: 1, seam: 0, rivet: 2, top: 2, topLight: 3, accent: 9, side: 2, under: 0,
    back: 24, backSeam: 0, light: 10, window: 0, star: 2, pipe: 1, pipeLight: 2, stripeA: 12, stripeB: 0, rust: 8, broken: 0.35 },
  hangar_then: { base: 2, plate: 2, seam: 1, rivet: 3, top: 3, topLight: 3, accent: 26, side: 3, under: 1,
    back: 25, backSeam: 24, light: 15, window: 24, star: 3, pipe: 2, pipeLight: 3, stripeA: 14, stripeB: 0, rust: -1, broken: 0 },
};

function wall(c, ox, oy, open, th, rand) {
  c.rect(ox, oy, 16, 16, th.base);
  c.frame(ox + 3, oy + 3, 10, 10, th.seam);
  c.px(ox + 4, oy + 4, th.rivet).px(ox + 11, oy + 4, th.rivet).px(ox + 4, oy + 11, th.rivet).px(ox + 11, oy + 11, th.rivet);
  if (th.rust >= 0) for (let i = 0; i < 6; i++) c.px(ox + 1 + Math.floor(rand() * 14), oy + 1 + Math.floor(rand() * 14), th.rust);
  if (open & 8) c.rect(ox, oy, 2, 16, th.side).rect(ox, oy, 1, 16, th.topLight);
  if (open & 2) c.rect(ox + 14, oy, 2, 16, th.under);
  if (open & 4) c.rect(ox, oy + 14, 16, 2, th.under);
  if (open & 1) {
    c.rect(ox, oy, 16, 3, th.top).rect(ox, oy, 16, 1, th.topLight).rect(ox, oy + 3, 16, 1, th.accent);
    // the wreck's edges are chipped
    if (th.broken) for (let x = 0; x < 16; x++) if (rand() < th.broken * 0.4) c.px(ox + x, oy, -1);
  }
}

export function tileset(name) {
  const th = THEMES[name], rand = rng(name.length * 977);
  const c = new Canvas(128, 64);
  for (let m = 0; m < 16; m++) wall(c, (m % 8) * 16, Math.floor(m / 8) * 16, m, th, rand);
  // thin floor: a grating on struts
  let ox = 0, oy = 32;
  c.rect(ox, oy, 16, 4, th.top).rect(ox, oy, 16, 1, th.topLight).rect(ox, oy + 3, 16, 1, th.under);
  for (let x = 1; x < 16; x += 3) c.px(ox + x, oy + 1, th.under).px(ox + x, oy + 2, th.under);
  c.rect(ox + 2, oy + 4, 2, 3, th.pipe).rect(ox + 12, oy + 4, 2, 3, th.pipe);
  if (th.broken) c.px(ox + 7, oy, -1).px(ox + 8, oy, -1);
  // hazard: a torn cable throwing sparks over a scorched floor strip
  ox = 16;
  c.rect(ox, oy + 13, 16, 3, 4).rect(ox + 1, oy + 14, 14, 1, 5);
  c.line(ox, oy + 12, ox + 5, oy + 9, 1).line(ox + 5, oy + 9, ox + 9, oy + 12, 1).line(ox + 9, oy + 12, ox + 15, oy + 10, 1);
  for (const [x, y] of [[4, 7], [6, 5], [9, 8], [12, 6], [7, 10], [11, 4]]) c.px(ox + x, oy + y, 15);
  c.px(ox + 5, oy + 8, 14).px(ox + 10, oy + 9, 14);
  // background
  const back = (n, fn) => {
    const bx = (n % 8) * 16, by = Math.floor(n / 8) * 16;
    c.rect(bx, by, 16, 16, th.back).rect(bx, by, 16, 1, th.backSeam).rect(bx, by, 1, 16, th.backSeam);
    fn(bx, by);
  };
  back(TILE.PANEL, () => {});
  back(TILE.LIGHT, (x, y) => c.rect(x + 6, y + 6, 4, 4, th.backSeam).rect(x + 7, y + 7, 2, 2, th.light));
  back(TILE.VENT, (x, y) => { for (let j = 4; j < 13; j += 2) c.rect(x + 3, y + j, 10, 1, th.backSeam); });
  back(TILE.WINDOW, (x, y) => {
    c.rect(x + 2, y + 2, 12, 12, th.pipe).rect(x + 3, y + 3, 10, 10, th.window);
    c.px(x + 5, y + 5, th.star).px(x + 10, y + 7, th.star).px(x + 7, y + 11, 27);
    if (th.broken) c.line(x + 3, y + 4, x + 9, y + 12, 1).line(x + 9, y + 12, x + 12, y + 9, 1);
  });
  back(TILE.PIPE_V, (x, y) => c.rect(x + 5, y, 6, 16, th.pipe).rect(x + 6, y, 1, 16, th.pipeLight).rect(x + 5, y + 7, 6, 2, th.backSeam));
  back(TILE.PIPE_H, (x, y) => c.rect(x, y + 5, 16, 6, th.pipe).rect(x, y + 6, 16, 1, th.pipeLight).rect(x + 7, y + 5, 2, 6, th.backSeam));
  back(TILE.STRIPE, (x, y) => { for (let i = 0; i < 16; i++) for (let j = 6; j < 10; j++) c.px(x + i, y + j, ((i + j) >> 2) % 2 ? th.stripeA : th.stripeB); });
  back(TILE.DARK, (x, y) => {
    if (th.broken) { c.rect(x + 1, y + 1, 15, 15, 0); c.line(x + 2, y + 3, x + 7, y + 9, th.back).line(x + 7, y + 9, x + 13, y + 6, th.back); }
    else c.rect(x + 4, y + 4, 8, 8, th.backSeam).rect(x + 5, y + 5, 6, 6, th.light);
  });
  return c;
}

// The background of a room: panels everywhere with lights, vents, windows, pipe runs and a hazard stripe just above floors (aboveFloor(r, c)),
// picked by a seed so a room looks the same every time; the Then version is the same layout, tidy and lit.
export function backLayers(cols, rows, seed, aboveFloor) {
  const rand = rng(seed);
  const now = [], then = [];
  for (let r = 0; r < rows; r++) {
    const a = [], b = [];
    for (let c = 0; c < cols; c++) {
      const v = rand();
      let t = v < 0.05 ? TILE.WINDOW : v < 0.11 ? TILE.LIGHT : v < 0.16 ? TILE.VENT : TILE.PANEL;
      if (aboveFloor(r, c) && v < 0.7) t = TILE.STRIPE;
      a.push(t !== TILE.STRIPE && rand() < 0.05 ? TILE.DARK : t);
      b.push(t);
    }
    now.push(a); then.push(b);
  }
  for (let k = 0; k < Math.max(1, Math.floor(cols / 14)); k++) {
    const c = 3 + Math.floor(rand() * (cols - 6));
    for (let r = 0; r < rows; r++) { now[r][c] = TILE.PIPE_V; then[r][c] = TILE.PIPE_V; }
  }
  return { now, then };
}
