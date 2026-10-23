// The painted skies of the ten sectors, in layers that scroll at different speeds (parallax): a far sky (a 256x256 picture that repeats
// seamlessly: a nebula in dithered steps, stars and the sector's own sight: beams, lightning, rings), a middle layer of a few things
// floating past (asteroids, crystals, wrecks; mostly see-through, so the handheld draws it tile by tile), and the dust of near stars,
// shared by every sector. Each sector has a tile bank of its own: a dark sky ramp, an accent for its nebula, a ramp for the floating
// things and two star colours. They stay dark so gems, shots and enemies always stand out.
import { Canvas, rng } from "../lib/canvas.mjs";
import { ramp } from "../../studio/src/palette-core.js";
import { bank, sphere, box, plane, outline, glow, shades as pick } from "../lib/paint.mjs";

const tau = Math.PI * 2, N = 256;
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const shades = (hue, sat, n, opts) => pick(ramp(hue, sat, opts), n);
// (the floating things are far, so their ramp is dim: nothing in that layer passes for an enemy)
const skyBank = ({ black, sky, accent, obj, star }) => bank({
  out: [black], sky: shades(sky[0], sky[1], 5, { lo: 0.06, hi: 0.2, shift: 10 }), accent: shades(accent[0], accent[1], 4, { lo: 0.14, hi: accent[2] ?? 0.42 }),
  obj: shades(obj[0], obj[1] * 0.8, 3, { lo: 0.08, hi: (obj[2] ?? 0.4) * 0.62 }), star: star,
});

// noise that repeats every 256 pixels both ways (smooth value noise, a few octaves)
function noise(seed, cell = 64, octaves = 4) {
  const out = new Float32Array(N * N);
  let amp = 1, total = 0, c0 = cell;
  for (let o = 0; o < octaves; o++) {
    const n = N / c0, r = rng(seed + o * 101), g = Array.from({ length: n * n }, () => r());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / c0, fy = y / c0, x0 = Math.floor(fx) % n, y0 = Math.floor(fy) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
      let tx = fx - Math.floor(fx), ty = fy - Math.floor(fy); tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      out[y * N + x] += ((g[y0 * n + x0] * (1 - tx) + g[y0 * n + x1] * tx) * (1 - ty) + (g[y1 * n + x0] * (1 - tx) + g[y1 * n + x1] * tx) * ty) * amp;
    }
    total += amp; amp *= 0.5; c0 = Math.max(4, c0 / 2);
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
const wrap = (v) => ((Math.round(v) % N) + N) % N;
const put = (c, x, y, p) => c.px(wrap(x), wrap(y), p);
// a value from 0 to 1 to a step of a ramp, with an ordered dither across each step (the way GBA skies are painted)
const step = (rmp, v, x, y) => rmp[Math.max(0, Math.min(rmp.length - 1, Math.floor(v * rmp.length + BAYER[y & 3][x & 3] / 16 - 0.5)))];

// The far sky: nebula from two noises (the sky ramp everywhere, the accent where the second one is dense), then stars, then `sight`.
function farSky(b, { seed, cell = 64, accentAt = 0.58, stars = 90, sight }) {
  const c = new Canvas(N, N), n1 = noise(seed, cell), n2 = noise(seed + 7, cell / 2, 3);
  const sky = [b.out[0], ...b.sky];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = n1[y * N + x], a = n2[y * N + x] * 0.6 + d * 0.4;
    let p = step(sky, Math.max(0, (d - 0.28) / 0.5), x, y);
    const v = (a - accentAt) / (1 - accentAt) * 1.6;
    if (v > 0.25) p = step(b.accent, v - 0.25, x, y);
    else if (v > 0 && BAYER[y & 3][x & 3] / 16 < v / 0.25) p = b.accent[0]; // the cloud's edge fades in
    c.px(x, y, p);
  }
  if (sight) sight(c, b);
  const r = rng(seed * 3 + 1);
  for (let i = 0; i < stars; i++) {
    const x = r() * N, y = r() * N, t = r();
    put(c, x, y, t < 0.85 ? b.star[0] : b.star[1]);
    if (t > 0.97) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(c, x + dx, y + dy, b.star[0]); // a twinkle
  }
  return c;
}

// The middle layer: `count` things from `thing(c, b, x, y, size, r)`, kept 24 pixels from the edges so none needs wrapping.
function midLayer(b, { seed, count, thing, min = 3, max = 9 }) {
  const c = new Canvas(N, N), r = rng(seed * 5 + 3), placed = [];
  for (let tries = 0; placed.length < count && tries < 400; tries++) {
    const s = min + r() * (max - min), x = 24 + r() * (N - 48), y = 24 + r() * (N - 48);
    if (placed.some(([px, py, ps]) => Math.hypot(px - x, py - y) < ps + s + 18)) continue;
    placed.push([x, y, s]); thing(c, b, x, y, s, r);
  }
  outline(c, b, { dark: true });
  return c;
}
const rock = (c, b, x, y, s, r) => { sphere(c, x, y, s, s * (0.7 + r() * 0.3), b.obj); if (s > 5) sphere(c, x + s * 0.3, y + s * 0.2, s * 0.25, s * 0.25, b.obj.slice(0, 2), { dither: false }); };
const crystal = (c, b, x, y, s) => { plane(c, [[x, y - s * 1.6], [x + s * 0.6, y], [x, y + s * 0.8], [x - s * 0.6, y]], b.obj, -0.3); plane(c, [[x, y - s * 1.6], [x, y + s * 0.8], [x - s * 0.6, y]], b.obj, 0.6); };
const plate = (c, b, x, y, s, r) => { box(c, x - s, y - s * 0.6, s * 2, s * 1.2, b.obj, { round: 1 }); if (r() < 0.5) box(c, x - s * 0.4, y - s * 1.1, s * 0.8, s * 0.6, b.obj, { round: 0, bias: -0.2 }); };
const ember = (c, b, x, y, s) => glow(c, x, y, s * 0.5, s * 0.5, [b.accent[0], b.accent[1], b.accent[2]]);
const spore = (c, b, x, y, s) => { sphere(c, x, y, s * 0.7, s * 0.7, b.obj); sphere(c, x - s * 0.2, y - s * 0.2, s * 0.2, s * 0.2, [b.accent[2]]); };
const wreck = (c, b, x, y, s, r) => { const l = s * 2.4; plane(c, [[x - l, y - s * 0.4], [x + l * 0.7, y - s * 0.5], [x + l, y], [x + l * 0.7, y + s * 0.5], [x - l, y + s * 0.4]], b.obj, 0); box(c, x - s * 0.4, y - s, s, s * 0.6, b.obj, { round: 0 }); if (r() < 0.7) c.px(Math.round(x + l * 0.6), Math.round(y), b.accent[3]); };
const chip = (c, b, x, y, s) => { box(c, x - s, y - s, s * 2, s * 2, b.obj, { round: 1 }); box(c, x - s * 0.5, y - s * 0.5, s, s, [b.accent[2]], { round: 0 }); };

// sights in the far sky (drawn with wrap, so they stay seamless)
const beams = (c, b) => { for (let i = 0; i < 10; i++) { const a = (i / 10) * tau + 0.2; for (let t = 12; t < 120; t += 0.7) { const w = Math.max(0, 1 - t / 120); if ((Math.round(t) + i) % 2 === 0 || w > 0.6) put(c, 128 + Math.cos(a) * t, 128 + Math.sin(a) * t, w > 0.75 ? b.accent[2] : w > 0.4 ? b.accent[1] : b.accent[0]); } }
  glow(c, 128, 128, 14, 14, [b.accent[1], b.accent[2], b.accent[3], b.star[1]]); };
const bolts = (c, b) => { const r = rng(9); for (let i = 0; i < 7; i++) { let x = r() * N, y = r() * N; for (let k = 0; k < 26; k++) { put(c, x, y, k % 4 ? b.accent[2] : b.accent[3]); x += (r() - 0.5) * 4; y += 1.6; } } };
const lens = (c, b) => { for (let k = 1; k <= 5; k++) for (let a = 0; a < 600; a++) { const t = (a / 600) * tau, r0 = 20 * k + Math.sin(t * 3 + k) * 3; if ((a + k) % (k + 1)) put(c, 128 + Math.cos(t) * r0, 128 + Math.sin(t) * r0 * 0.55, k < 3 ? b.accent[1] : b.accent[0]); }
  sphere(c, 128, 128, 13, 13, [b.out[0]]); for (let a = 0; a < 200; a++) { const t = (a / 200) * tau; put(c, 128 + Math.cos(t) * 14, 128 + Math.sin(t) * 14, b.accent[3]); } };
const hexes = (c, b) => { for (let row = 0; row < 12; row++) for (let col = 0; col < 12; col++) { const cx = col * (N / 12) + (row % 2) * (N / 24), cy = row * (N / 12) * 0.98; if ((row * 5 + col * 3) % 4) continue;
  for (let a = 0; a < 6; a++) { const t1 = (a / 6) * tau, t2 = ((a + 1) / 6) * tau; for (let k = 0; k < 10; k++) put(c, cx + (Math.cos(t1) + (Math.cos(t2) - Math.cos(t1)) * (k / 10)) * 9, cy + (Math.sin(t1) + (Math.sin(t2) - Math.sin(t1)) * (k / 10)) * 9, b.accent[0]); } } };
const circuits = (c, b) => { const r = rng(37); for (let i = 0; i < 22; i++) { let x = Math.floor(r() * 32) * 8, y = Math.floor(r() * 32) * 8, dir = Math.floor(r() * 4); for (let k = 0; k < 30; k++) { put(c, x, y, k % 7 === 0 ? b.accent[2] : b.accent[1]); if (r() < 0.12) dir = Math.floor(r() * 4); x += [1, 0, -1, 0][dir]; y += [0, 1, 0, -1][dir]; } put(c, x, y, b.accent[3]); } };
const aurora = (c, b) => { for (let x = 0; x < N; x++) { const h = 30 + Math.sin((x / N) * tau * 3) * 14 + Math.sin((x / N) * tau * 7) * 6, y0 = 100 + Math.sin((x / N) * tau * 2) * 30; for (let y = 0; y < h; y++) if ((x + y) % 3 && BAYER[y & 3][x & 3] / 16 < 1 - y / h) put(c, x, y0 + y, y < h * 0.3 ? b.accent[1] : b.accent[0]); } };
const craters = (c, b) => { const r = rng(12); for (let i = 0; i < 9; i++) { const x = r() * N, y = r() * N, rad = 6 + r() * 12; for (let a = 0; a < 120; a++) { const t = (a / 120) * tau; put(c, x + Math.cos(t) * rad, y + Math.sin(t) * rad, a < 60 ? b.accent[1] : b.sky[0]); } } };

export const SECTORS = {
  belt: { bank: skyBank({ black: "#06060c", sky: [235, 0.25], accent: [24, 0.4, 0.36], obj: [20, 0.22, 0.42], star: ["#6a6f88", "#d8dcec"] }), seed: 11, mid: { count: 9, thing: rock, max: 10 } },
  ion: { bank: skyBank({ black: "#040612", sky: [228, 0.45], accent: [192, 0.7, 0.5], obj: [275, 0.45], star: ["#5a6aa0", "#e0f0ff"] }), seed: 22, cell: 128, sight: bolts, mid: { count: 6, thing: ember, min: 5, max: 8 } },
  moon: { bank: skyBank({ black: "#050508", sky: [240, 0.1], accent: [225, 0.15, 0.36], obj: [230, 0.08, 0.44], star: ["#6a6c78", "#e6e6ee"] }), seed: 33, accentAt: 0.62, sight: craters, mid: { count: 7, thing: rock, max: 8 } },
  reef: { bank: skyBank({ black: "#030a0e", sky: [200, 0.45], accent: [172, 0.6, 0.45], obj: [180, 0.55, 0.5], star: ["#4a8a90", "#e0fff8"] }), seed: 44, cell: 128, sight: aurora, mid: { count: 8, thing: crystal, min: 3, max: 7 } },
  junk: { bank: skyBank({ black: "#05060a", sky: [222, 0.2], accent: [30, 0.45, 0.36], obj: [215, 0.12, 0.42], star: ["#606678", "#e0e2ea"] }), seed: 55, mid: { count: 10, thing: plate, min: 3, max: 8 } },
  pulsar: { bank: skyBank({ black: "#0c040a", sky: [330, 0.4], accent: [14, 0.75, 0.5], obj: [40, 0.8, 0.5], star: ["#8a5a6a", "#fff0e0"] }), seed: 66, cell: 128, sight: beams, mid: { count: 7, thing: ember, min: 4, max: 7 } },
  hive: { bank: skyBank({ black: "#040804", sky: [125, 0.35], accent: [64, 0.5, 0.3], obj: [95, 0.45, 0.4], star: ["#5a7a50", "#f0ffd8"] }), seed: 77, cell: 128, sight: hexes, mid: { count: 9, thing: spore, min: 3, max: 7 } },
  horizon: { bank: skyBank({ black: "#030208", sky: [268, 0.45], accent: [292, 0.55, 0.5], obj: [255, 0.3], star: ["#6a5a90", "#fff2d8"] }), seed: 88, cell: 128, accentAt: 0.64, sight: lens, mid: { count: 6, thing: rock, max: 6 } },
  fleet: { bank: skyBank({ black: "#03050c", sky: [222, 0.45], accent: [208, 0.6, 0.4], obj: [220, 0.14, 0.42], star: ["#50608a", "#e8f0ff"] }), seed: 99, mid: { count: 5, thing: wreck, min: 5, max: 8 } },
  core: { bank: skyBank({ black: "#08030c", sky: [288, 0.4], accent: [345, 0.7, 0.5], obj: [300, 0.3, 0.38], star: ["#7a5080", "#ffe0f0"] }), seed: 111, cell: 128, sight: circuits, mid: { count: 8, thing: chip, min: 3, max: 6 } },
};
export const BACKGROUNDS = Object.keys(SECTORS).map((id) => ({ id }));
export const DUST_BANK = bank({ dust: ["#3a3e58", "#6a7090", "#a8b0d0"] });
export const skyFar = (id) => { const s = SECTORS[id]; return farSky(s.bank, s); };
export const skyMid = (id) => { const s = SECTORS[id]; return midLayer(s.bank, { seed: s.seed, ...s.mid }); };

// A see-through layer of a few dim near stars that scrolls faster than the rest (256x256, so it repeats rarely).
export function dustTile() {
  const c = new Canvas(N, N), r = rng(777), d = DUST_BANK.dust;
  for (let i = 0; i < 40; i++) { const x = Math.floor(r() * N), y = Math.floor(r() * N), t = r(); c.px(x, y, t < 0.7 ? d[0] : t < 0.95 ? d[1] : d[2]); }
  return c;
}
