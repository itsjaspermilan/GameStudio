// Projectiles, effects, pickups, UI icons and planets. Things that fly face right; the game turns them.
import { Canvas, R, K, W, rng } from "./canvas.mjs";

const tau = Math.PI * 2;

export const PROJECTILES = [
  { id: "bolt", w: 8, h: 8, frames: 2, draw(c, f) {
    c.rect(1, 3, 6, 2, R.teal[2]); c.rect(3, 3, 4, 2, R.teal[3]); c.px(7, 3, W); c.px(7, 4, W); c.px(f ? 0 : 1, 3, R.blue[2]); c.px(f ? 1 : 0, 4, R.blue[2]);
    c.px(2, 2, R.teal[1]); c.px(2, 5, R.teal[1]);
  } },
  { id: "missile", w: 8, h: 8, frames: 2, draw(c, f) {
    c.rect(2, 3, 4, 2, R.grey[3]); c.rect(2, 4, 4, 1, R.grey[2]); c.rect(6, 3, 1, 2, R.red[2]); c.px(7, 3, R.red[3]); c.px(7, 4, R.red[3]);
    c.px(2, 2, R.red[2]); c.px(2, 5, R.red[2]); c.px(1, 3, f ? R.yellow[3] : R.orange[2]); c.px(1, 4, f ? R.orange[2] : R.yellow[3]); c.px(0, f ? 3 : 4, R.orange[2]);
  } },
  { id: "shard", w: 8, h: 8, frames: 4, draw(c, f) {
    const a = (f / 4) * Math.PI / 2, ca = Math.cos(a) * 3.4, sa = Math.sin(a) * 3.4;
    c.poly([[4 + ca, 4 + sa], [4 - sa * 0.5, 4 + ca * 0.5], [4 - ca, 4 - sa], [4 + sa * 0.5, 4 - ca * 0.5]], R.blue[2]);
    c.poly([[4 + ca, 4 + sa], [4 - sa * 0.3, 4 + ca * 0.3], [4, 4]], R.blue[3]);
    c.px(4, 4, W);
  } },
  { id: "mine", w: 8, h: 8, frames: 2, draw(c, f) {
    c.disc(4, 4, 2.6, R.grey[1]); c.px(3, 3, R.grey[3]); c.px(4, 3, R.grey[2]);
    [[4, 0], [4, 7], [0, 4], [7, 4], [1, 1], [6, 1], [1, 6], [6, 6]].forEach(([x, y]) => c.px(x, y, R.grey[2]));
    c.px(4, 4, f ? R.red[3] : R.red[1]); c.px(5, 4, f ? R.red[3] : R.red[1]);
  } },
  { id: "pellet", w: 8, h: 8, frames: 2, draw(c, f) {
    c.disc(4, 4, 2.2, R.orange[2]); c.px(3, 3, R.yellow[3]); c.px(4, 3, R.yellow[3]); c.px(f ? 1 : 0, 4, R.orange[1]); c.px(f ? 0 : 1, 3, R.red[2]);
  } },
  { id: "enemy_shot", w: 8, h: 8, frames: 2, draw(c, f) {
    c.disc(4, 4, 3, R.red[1]); c.disc(4, 4, 2.2 - f * 0.3, R.red[2]); c.px(3, 3, R.yellow[3]); c.px(4, 4, f ? R.orange[3] : R.yellow[3]);
  } },
  { id: "enemy_shot2", w: 8, h: 8, frames: 2, draw(c, f) {
    c.disc(4, 4, 3, R.purple[1]); c.disc(4, 4, 2.2 - f * 0.3, R.purple[2]); c.px(3, 3, W); c.px(4, 4, f ? R.purple[3] : W);
  } },
  { id: "boss_shot", w: 16, h: 16, frames: 2, draw(c, f) {
    c.disc(8, 8, 7, R.red[0]); c.disc(8, 8, 6, R.red[1]); c.disc(8, 8, 4.5 + f * 0.6, R.red[2]); c.disc(7, 7, 2.5, R.orange[3]); c.px(6, 6, W); c.px(7, 6, W);
    c.outline(K);
  } },
  { id: "ring", w: 64, h: 64, frames: 1, draw(c) {
    c.ring(32, 32, 31.5, 2, R.teal[3]); c.ring(32, 32, 29.5, 1, R.teal[2]); c.ring(32, 32, 28.5, 1, R.blue[1]);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * tau; c.px(32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27, W); }
  } },
  { id: "hole", w: 32, h: 32, frames: 4, draw(c, f) {
    c.disc(16, 16, 15, R.purple[0]);
    for (let arm = 0; arm < 3; arm++) for (let t = 0; t < 55; t++) {
      const r = 2 + t * 0.24, a = t * 0.17 + arm * (tau / 3) + (f / 4) * (tau / 3);
      c.px(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, t > 35 ? R.purple[2] : t > 18 ? R.purple[3] : W);
    }
    c.disc(16, 16, 3, K); c.ring(16, 16, 15, 1, R.purple[1]);
  } },
  { id: "meteor", w: 16, h: 16, frames: 2, draw(c, f) {
    c.poly([[0, 8], [8, 4], [8, 12]], R.orange[1]); c.poly([[1, 8], [8, 5.5], [8, 10.5]], R.yellow[2]); c.px(0, f ? 6 : 10, R.red[2]); c.px(2, f ? 10 : 6, R.orange[2]);
    c.sphere(10, 8, 5, [R.grey[0], R.grey[1], R.orange[1], R.orange[2]], -0.5, -0.5); c.px(8, 6, R.grey[2]); c.px(12, 10, R.grey[0]);
    c.outline(R.red[0]);
  } },
  { id: "reticle", w: 16, h: 16, frames: 2, draw(c, f) {
    c.ring(8, 8, 7.5, 1, f ? R.red[3] : R.red[2]); c.rect(7, 0, 2, 3, R.red[3]); c.rect(7, 13, 2, 3, R.red[3]); c.rect(0, 7, 3, 2, R.red[3]); c.rect(13, 7, 3, 2, R.red[3]); c.px(8, 8, R.yellow[3]);
  } },
  { id: "dangerzone", w: 16, h: 16, frames: 2, draw(c, f) {
    c.ring(8, 8, 7.5, 1, R.red[2]); if (f) c.ring(8, 8, 5.5, 1, R.red[1]); c.dither(3, 3, 10, 10, R.red[0], f);
  } },
];

export const FX = [
  { id: "boom", w: 32, h: 32, frames: 5, draw(c, f) {
    const r = [6, 11, 14, 15, 15][f];
    if (f < 4) { c.disc(16, 16, r, [W, R.yellow[3], R.orange[2], R.red[2]][f]); if (f > 0) c.disc(16, 16, r - 3, [W, W, R.yellow[3], R.orange[2]][f]); }
    else { for (let i = 0; i < 12; i++) { const a = (i / 12) * tau; c.px(16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, i % 2 ? R.orange[1] : R.red[1]); c.px(16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, R.grey[1]); } }
    if (f > 1 && f < 4) for (let i = 0; i < 8; i++) { const a = (i / 8) * tau + f; c.px(16 + Math.cos(a) * (r + 1), 16 + Math.sin(a) * (r + 1), R.yellow[2]); }
  } },
  { id: "spark", w: 8, h: 8, frames: 3, draw(c, f) {
    if (f === 0) { c.rect(3, 3, 2, 2, W); } else if (f === 1) { c.px(1, 1, R.yellow[3]); c.px(6, 1, R.yellow[3]); c.px(1, 6, R.yellow[2]); c.px(6, 6, R.yellow[2]); c.px(3, 3, W); c.px(4, 4, W); }
    else { c.px(0, 0, R.orange[2]); c.px(7, 0, R.orange[2]); c.px(0, 7, R.orange[1]); c.px(7, 7, R.orange[1]); c.px(3, 0, R.yellow[2]); c.px(0, 4, R.yellow[2]); }
  } },
  { id: "puff", w: 8, h: 8, frames: 3, draw(c, f) {
    const r = [1.5, 2.5, 3.4][f]; c.disc(4, 4, r, R.grey[f === 2 ? 1 : 2]); if (f < 2) c.px(3, 3, W);
  } },
  { id: "pop", w: 16, h: 16, frames: 4, draw(c, f) {
    const r = [3, 5, 7, 7.5][f]; c.ring(8, 8, r, f === 3 ? 1 : 2, f < 2 ? W : R.teal[3]);
    if (f > 0) for (let i = 0; i < 6; i++) { const a = (i / 6) * tau + 0.4; c.px(8 + Math.cos(a) * (r + 0.5), 8 + Math.sin(a) * (r + 0.5), R.teal[2]); }
  } },
];

export const PICKUPS = [
  { id: "gem", w: 8, h: 8, frames: 6, draw(c, f) {
    const kind = f >> 1, tw = f & 1, ramp = [R.teal, R.green, R.purple][kind];
    if (kind === 0) { c.poly([[4, 1], [6.5, 4], [4, 7], [1.5, 4]], ramp[1]); c.poly([[4, 1], [4, 7], [1.5, 4]], ramp[2]); c.px(3, 3, ramp[3]); }
    else if (kind === 1) { c.poly([[4, 0.5], [7, 4], [4, 7.5], [1, 4]], ramp[1]); c.poly([[4, 0.5], [4, 7.5], [1, 4]], ramp[2]); c.px(3, 2, ramp[3]); c.px(3, 3, ramp[3]); }
    else { c.poly([[4, 0], [8, 4], [4, 8], [0, 4]], ramp[1]); c.poly([[4, 0], [4, 8], [0, 4]], ramp[2]); c.rect(2, 2, 2, 2, ramp[3]); }
    if (tw) { c.px(kind === 2 ? 6 : 5, 2, W); }
    c.outline(ramp[0]);
  } },
  { id: "coin", w: 8, h: 8, frames: 4, draw(c, f) {
    const w = [3, 2, 1, 2][f];
    c.ellipse(4, 4, w, 3.4, R.yellow[2]); c.ellipse(4, 4, Math.max(0.6, w - 1), 2.4, R.yellow[3]); if (w > 1) c.px(4, 4, R.yellow[1]);
    c.outline(R.yellow[0]);
  } },
  { id: "heart", w: 8, h: 8, frames: 2, draw(c, f) {
    c.poly([[1, 2], [3, 1], [4, 2.5], [5, 1], [7, 2], [7, 4], [4, 7.5], [1, 4]], R.red[2]); c.px(2, 2, R.red[3]); c.px(2, 3, R.red[3]); if (f) c.px(3, 2, W);
    c.outline(R.red[0]);
  } },
  { id: "magnet", w: 8, h: 8, frames: 2, draw(c, f) {
    c.rect(1, 1, 2, 5, R.red[2]); c.rect(5, 1, 2, 5, R.red[2]); c.rect(1, 5, 6, 2, R.red[1]); c.rect(1, 1, 2, 1, W); c.rect(5, 1, 2, 1, W); if (f) { c.px(3, 0, R.yellow[3]); c.px(4, 0, R.yellow[3]); }
    c.outline(R.red[0]);
  } },
  { id: "bomb", w: 8, h: 8, frames: 2, draw(c, f) {
    c.sphere(4, 5, 3, R.grey, -0.5, -0.5); c.px(6, 1, f ? R.yellow[3] : R.orange[2]); c.line(5, 2, 6, 1, R.grey[3]); c.px(3, 4, W);
    c.outline(K);
  } },
];

// UI icons, 16x16, one frame
const ICON_BG = (c, ramp) => { c.disc(8, 8, 7.5, ramp[0]); c.disc(8, 8, 6.5, ramp[1]); };
export const ICONS = [
  { id: "w_pulse", draw(c) { ICON_BG(c, R.teal); c.rect(3, 7, 7, 2, R.teal[3]); c.rect(9, 6, 3, 4, W); c.px(12, 7, W); c.px(12, 8, W); c.px(2, 6, R.teal[2]); c.px(2, 9, R.teal[2]); } },
  { id: "w_shards", draw(c) { ICON_BG(c, R.blue); c.ring(8, 8, 5, 1, R.blue[2]); [[8, 3], [13, 8], [8, 13], [3, 8]].forEach(([x, y]) => { c.disc(x, y, 1.6, R.blue[3]); }); c.px(8, 8, W); c.disc(8, 8, 1.5, R.yellow[2]); } },
  { id: "w_nova", draw(c) { ICON_BG(c, R.purple); c.ring(8, 8, 6, 1, R.purple[3]); c.ring(8, 8, 3.5, 1, W); c.px(8, 8, R.yellow[3]); c.px(8, 7, R.yellow[3]); } },
  { id: "w_missiles", draw(c) { ICON_BG(c, R.red); c.rect(3, 9, 7, 2, R.grey[3]); c.poly([[10, 9], [13, 10], [10, 11]], R.red[3]); c.rect(1, 10, 2, 1, R.orange[3]); c.rect(5, 5, 6, 2, R.grey[3]); c.poly([[11, 5], [13.5, 6], [11, 7]], R.red[3]); c.rect(3, 6, 2, 1, R.orange[3]); } },
  { id: "w_arc", draw(c) { ICON_BG(c, R.yellow); c.poly([[9, 1.5], [4, 9], [7.5, 9], [6, 14.5], [12, 6.5], [8.5, 6.5]], R.yellow[3]); c.poly([[8.5, 3.5], [6, 8], [8, 8]], W); } },
  { id: "w_lance", draw(c) { ICON_BG(c, R.green); c.rect(1, 7, 14, 2, R.green[3]); c.rect(1, 7, 14, 1, W); c.disc(3, 8, 2, R.yellow[2]); c.px(3, 8, W); c.px(13, 6, R.green[2]); c.px(14, 10, R.green[2]); } },
  { id: "w_mines", draw(c) { ICON_BG(c, R.orange); c.disc(8, 8, 3.2, R.grey[1]); c.px(7, 7, R.grey[3]); [[8, 3], [8, 13], [3, 8], [13, 8], [4, 4], [12, 4], [4, 12], [12, 12]].forEach(([x, y]) => c.px(x, y, R.grey[3])); c.px(8, 8, R.red[3]); c.px(9, 8, R.red[3]); } },
  { id: "w_well", draw(c) { ICON_BG(c, R.purple); for (let t = 0; t < 40; t++) { const r = 1.5 + t * 0.13, a = t * 0.3; c.px(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, t > 25 ? R.purple[2] : R.purple[3]); } c.disc(8, 8, 1.8, K); } },
  { id: "w_scatter", draw(c) { ICON_BG(c, R.orange); [[11, 4], [12, 8], [11, 12], [8, 6], [8, 10]].forEach(([x, y]) => c.disc(x, y, 1.2, R.yellow[3])); c.rect(2, 7, 4, 2, R.grey[3]); c.rect(2, 7, 4, 1, W); c.px(6, 8, R.orange[3]); } },
  { id: "w_comet", draw(c) { ICON_BG(c, R.orange); c.poly([[2, 3], [10, 9], [8, 11]], R.orange[2]); c.poly([[1, 6], [9, 10], [8, 11]], R.red[2]); c.disc(11, 10, 3, R.yellow[3]); c.px(10, 9, W); c.px(12, 3, W); c.px(14, 6, R.yellow[2]); } },
  { id: "p_power", draw(c) { ICON_BG(c, R.red); c.rect(6, 3, 4, 10, R.yellow[2]); c.rect(4, 5, 8, 6, R.yellow[2]); c.rect(7, 4, 2, 8, W); c.rect(5, 7, 6, 2, W); } },
  { id: "p_haste", draw(c) { ICON_BG(c, R.blue); c.ring(8, 8, 5, 1, W); c.line(8, 8, 8, 4, W); c.line(8, 8, 11, 9, R.yellow[3]); c.px(2, 4, R.blue[3]); c.px(14, 4, R.blue[3]); } },
  { id: "p_reach", draw(c) { ICON_BG(c, R.teal); c.ring(8, 8, 5, 2, R.teal[3]); c.px(8, 8, W); c.px(8, 2, W); c.px(8, 14, W); c.px(2, 8, W); c.px(14, 8, W); } },
  { id: "p_thrust", draw(c) { ICON_BG(c, R.orange); c.poly([[3, 4], [13, 8], [3, 12], [5, 8]], R.grey[3]); c.rect(1, 7, 3, 2, R.yellow[3]); c.px(0, 8, R.orange[2]); } },
  { id: "p_plating", draw(c) { ICON_BG(c, R.grey); c.poly([[8, 2], [13, 4], [13, 9], [8, 14], [3, 9], [3, 4]], R.grey[3]); c.poly([[8, 4], [11, 5], [11, 9], [8, 12], [5, 9], [5, 5]], R.blue[2]); c.rect(7, 5, 2, 6, W); } },
  { id: "p_magnet", draw(c) { ICON_BG(c, R.purple); c.rect(3, 3, 3, 8, R.red[2]); c.rect(10, 3, 3, 8, R.red[2]); c.rect(3, 10, 10, 3, R.red[1]); c.rect(3, 3, 3, 2, W); c.rect(10, 3, 3, 2, W); } },
  { id: "p_repair", draw(c) { ICON_BG(c, R.green); c.rect(7, 3, 2, 10, W); c.rect(3, 7, 10, 2, W); c.px(3, 3, R.green[3]); c.px(12, 12, R.green[3]); } },
  { id: "p_scholar", draw(c) { ICON_BG(c, R.blue); c.poly([[8, 3], [14, 8], [8, 13], [2, 8]], R.teal[2]); c.poly([[8, 3], [8, 13], [2, 8]], R.teal[3]); c.px(6, 7, W); c.px(7, 6, W); } },
  { id: "s_hull", draw(c) { ICON_BG(c, R.red); c.poly([[8, 2], [13, 4], [13, 9], [8, 14], [3, 9], [3, 4]], R.red[3]); c.poly([[8, 4], [11, 5], [11, 9], [8, 12], [5, 9], [5, 5]], R.red[2]); c.px(7, 6, W); c.px(7, 7, W); } },
  { id: "s_engine", draw(c) { ICON_BG(c, R.orange); c.poly([[2, 5], [10, 5], [14, 8], [10, 11], [2, 11]], R.grey[2]); c.rect(1, 6, 2, 4, R.yellow[3]); c.rect(4, 7, 6, 2, R.blue[3]); } },
  { id: "s_tactics", draw(c) { ICON_BG(c, R.teal); c.ring(8, 8, 5.5, 1, W); c.rect(7, 1, 2, 4, W); c.rect(7, 11, 2, 4, W); c.rect(1, 7, 4, 2, W); c.rect(11, 7, 4, 2, W); c.px(8, 8, R.red[3]); } },
  { id: "s_salvage", draw(c) { ICON_BG(c, R.yellow); c.ellipse(8, 8, 4.5, 5, R.yellow[2]); c.ellipse(8, 8, 3, 3.8, R.yellow[3]); c.rect(7, 5, 2, 6, R.yellow[1]); c.px(6, 5, W); } },
  { id: "lock", draw(c) { c.rect(4, 7, 8, 7, R.grey[2]); c.rect(4, 7, 8, 1, R.grey[3]); c.ring(8, 6, 3.5, 1.5, R.grey[3]); c.rect(7, 9, 2, 3, K); c.outline(R.grey[0]); } },
  { id: "star", draw(c) { c.poly([[8, 1], [10, 6], [15, 6], [11, 9.5], [12.5, 15], [8, 11.5], [3.5, 15], [5, 9.5], [1, 6], [6, 6]], R.yellow[2]); c.poly([[8, 1], [10, 6], [8, 8], [6, 6]], R.yellow[3]); c.outline(R.yellow[0]); } },
  { id: "arrow", w: 8, h: 8, frames: 2, draw(c, f) { c.poly([[0.5, 0.5], [7.5, 4], [0.5, 7.5], [2.5, 4]], f ? R.red[3] : R.red[2]); c.px(3, 4, W); c.outline(R.red[0]); } },
  { id: "cursor", w: 8, h: 8, frames: 2, draw(c, f) { c.poly([[1 + f, 0], [7 + f, 4], [1 + f, 8]], R.yellow[3]); c.poly([[1 + f, 1.5], [5 + f, 4], [1 + f, 6.5]], R.yellow[2]); c.outline(K); } },
];

export const PLANETS = [
  { id: "planet_a", w: 64, h: 64, frames: 1, draw(c) {
    c.ellipse(32, 32, 31, 8, R.blue[1]); // ring behind
    c.sphere(32, 32, 20, [R.blue[0], R.blue[1], R.teal[1], R.teal[2]], -0.55, -0.55);
    for (let y = 18; y < 48; y += 5) for (let x = 12; x < 52; x++) { const a = Math.sin(x * 0.3 + y) > 0.2; if (c.get(x, y) >= 0 && a) c.px(x, y, c.get(x, y) === R.teal[2] ? R.teal[3] : R.blue[2]); }
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const dx = (x + 0.5 - 32) / 31, dy = (y + 0.5 - 32) / 8, e = dx * dx + dy * dy; if (e <= 1 && e > 0.55 && y > 32) c.px(x, y, e > 0.8 ? R.blue[2] : R.blue[3]); }
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const dx = (x + 0.5 - 32) / 31, dy = (y + 0.5 - 32) / 8, e = dx * dx + dy * dy; if (e <= 1 && e > 0.55 && y <= 32 && Math.hypot(x - 32, y - 32) > 20) c.px(x, y, e > 0.8 ? R.blue[2] : R.blue[3]); }
  } },
  { id: "planet_b", w: 64, h: 64, frames: 1, draw(c) {
    c.sphere(32, 32, 28, [R.red[0], R.red[1], R.orange[1], R.orange[2]], -0.6, -0.5);
    [[20, 22, 5], [40, 18, 3], [44, 40, 6], [24, 44, 4], [34, 32, 2.5]].forEach(([x, y, r]) => { c.disc(x, y, r, R.red[0]); c.disc(x - 0.7, y - 0.7, r - 1.2, R.red[1]); });
  } },
];

// ---- backgrounds: seamless 128x128 tiles --------------------------------------------------------------------------
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
function tileNoise(seed, cell = 32, size = 128, octaves = 3) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, c0 = cell;
  for (let o = 0; o < octaves; o++) {
    const n = size / c0, r = rng(seed + o * 101), g = Array.from({ length: n * n }, () => r());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / c0, fy = y / c0, x0 = Math.floor(fx) % n, y0 = Math.floor(fy) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
      let tx = fx - Math.floor(fx), ty = fy - Math.floor(fy); tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const v = (g[y0 * n + x0] * (1 - tx) + g[y0 * n + x1] * tx) * (1 - ty) + (g[y1 * n + x0] * (1 - tx) + g[y1 * n + x1] * tx) * ty;
      out[y * size + x] += v * amp;
    }
    total += amp; amp *= 0.5; c0 = Math.max(4, c0 / 2);
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
// Colour a noise field with a few palette colours, dithered, so clouds look like pixel art.
function cloud(c, seed, colours, lo = 0.45, hi = 0.8, cell = 32) {
  const n = tileNoise(seed, cell);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const v = (n[y * 128 + x] - lo) / (hi - lo) + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.35;
    const k = Math.floor(v * colours.length);
    if (k >= 0) c.px(x, y, colours[Math.min(colours.length - 1, k)]);
  }
}
const wrapPx = (c, x, y, v) => c.px(((Math.round(x) % 128) + 128) % 128, ((Math.round(y) % 128) + 128) % 128, v);
function stars(c, seed, count, cols) { const r = rng(seed); for (let i = 0; i < count; i++) wrapPx(c, r() * 128, r() * 128, cols[Math.floor(r() * cols.length)]); }
function wdisc(c, cx, cy, rad, v) { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad + 0.5) wrapPx(c, cx + x, cy + y, v); }

export const BACKGROUNDS = [
  { id: "belt", base: R.grey[0], draw(c) { // 1 asteroid belt
    cloud(c, 11, [R.orange[0], R.orange[0]], 0.62, 0.9, 32);
    stars(c, 1, 60, [R.grey[1], R.grey[2], R.orange[1]]);
    const r = rng(5); for (let i = 0; i < 16; i++) { const x = r() * 128, y = r() * 128, s = 1 + Math.floor(r() * 3); wdisc(c, x, y, s, R.grey[1]); wrapPx(c, x - 1, y - 1, R.grey[2]); wrapPx(c, x + s - 1, y + 1, R.orange[0]); }
  } },
  { id: "ion", base: R.blue[0], draw(c) { // 2 ion nebula
    cloud(c, 22, [R.blue[0], R.purple[0], R.blue[1]], 0.35, 0.85, 64);
    stars(c, 2, 70, [R.blue[2], R.blue[3], R.purple[2], W]);
    const r = rng(9); for (let i = 0; i < 6; i++) { let x = r() * 128, y = r() * 128; for (let k = 0; k < 9; k++) { wrapPx(c, x, y, R.teal[3]); x += (r() - 0.5) * 5; y += 3; } }
  } },
  { id: "moon", base: R.grey[0], draw(c) { // 3 dead moon
    cloud(c, 33, [K, R.grey[0], K], 0.45, 1.0, 32);
    stars(c, 3, 40, [R.grey[2], R.grey[3]]);
    const r = rng(12); for (let i = 0; i < 12; i++) { const x = r() * 128, y = r() * 128, rad = 3 + Math.floor(r() * 7); wdisc(c, x, y, rad, R.grey[0]); for (let a = 0; a < 40; a++) { const t = (a / 40) * tau; wrapPx(c, x + Math.cos(t) * (rad + 1), y + Math.sin(t) * (rad + 1), a < 20 ? R.grey[1] : R.grey[0]); } }
  } },
  { id: "reef", base: R.teal[0], draw(c) { // 4 crystal reef
    cloud(c, 44, [R.teal[0], R.blue[0], R.teal[0]], 0.4, 0.9, 64);
    stars(c, 4, 40, [R.teal[2], R.teal[3]]);
    const r = rng(17); for (let i = 0; i < 18; i++) { const x = r() * 128, y = r() * 128, h = 4 + Math.floor(r() * 9); for (let k = 0; k < h; k++) { wrapPx(c, x + (k % 2) * 0, y - k, k > h * 0.6 ? R.teal[3] : R.teal[2]); wrapPx(c, x + 1, y - k, R.teal[1]); if (k < h * 0.5) wrapPx(c, x - 1, y - k, R.teal[2]); } }
  } },
  { id: "junk", base: R.grey[0], draw(c) { // 5 junkyard
    cloud(c, 55, [R.grey[0], R.grey[1], R.grey[0]], 0.5, 0.95, 32);
    stars(c, 5, 30, [R.grey[2], R.orange[2]]);
    const r = rng(23); for (let i = 0; i < 20; i++) { const x = r() * 128, y = r() * 128, w = 3 + Math.floor(r() * 9), h = 2 + Math.floor(r() * 5); for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) wrapPx(c, x + k, y + j, j === 0 ? R.grey[2] : (k === w - 1 ? R.grey[0] : R.grey[1])); if (r() < 0.4) wrapPx(c, x + 1, y + 1, R.orange[2]); if (r() < 0.3) wrapPx(c, x + w - 2, y + 1, R.red[2]); }
  } },
  { id: "pulsar", base: R.red[0], draw(c) { // 6 pulsar rim
    cloud(c, 66, [R.red[0], R.purple[0], R.red[0]], 0.45, 0.9, 64);
    stars(c, 6, 60, [R.red[2], R.orange[3], R.purple[3], W]);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * tau; for (let t = 10; t < 60; t++) if ((t + i) % 3) wrapPx(c, 64 + Math.cos(a) * t, 64 + Math.sin(a) * t, t < 30 ? R.orange[1] : R.red[1]); }
    wdisc(c, 64, 64, 3, R.yellow[2]); wdisc(c, 64, 64, 1, W);
  } },
  { id: "hive", base: R.green[0], draw(c) { // 7 hive moon
    cloud(c, 77, [R.green[0], R.orange[0], R.green[0]], 0.4, 0.95, 64);
    stars(c, 7, 30, [R.yellow[2], R.green[2]]);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) { const x = col * 16 + (row % 2) * 8, y = row * 16; for (let a = 0; a < 6; a++) { const t1 = (a / 6) * tau, t2 = ((a + 1) / 6) * tau; for (let k = 0; k < 8; k++) wrapPx(c, x + Math.cos(t1) * 7 + (Math.cos(t2) - Math.cos(t1)) * 7 * (k / 8), y + Math.sin(t1) * 7 + (Math.sin(t2) - Math.sin(t1)) * 7 * (k / 8), (row + col) % 3 === 0 ? R.yellow[1] : R.green[1]); } }
  } },
  { id: "horizon", base: K, draw(c) { // 8 black hole rim
    cloud(c, 88, [K, R.purple[0], K], 0.4, 0.9, 64);
    stars(c, 8, 50, [R.purple[2], R.purple[3], W]);
    for (let k = 1; k < 5; k++) for (let a = 0; a < 200; a++) { const t = (a / 200) * tau, r = 14 * k + Math.sin(t * 3) * 2; wrapPx(c, 64 + Math.cos(t) * r, 64 + Math.sin(t) * r, k < 3 ? R.purple[1] : R.purple[0]); }
    wdisc(c, 64, 64, 5, R.purple[0]);
  } },
  { id: "fleet", base: R.blue[0], draw(c) { // 9 dark fleet
    cloud(c, 99, [R.blue[0], R.grey[0], R.blue[0]], 0.45, 0.9, 64);
    stars(c, 9, 50, [R.blue[2], R.grey[2], W]);
    const r = rng(31); for (let i = 0; i < 5; i++) { const x = r() * 128, y = r() * 128, l = 10 + Math.floor(r() * 12); for (let k = 0; k < l; k++) { const h = Math.max(1, Math.round(3 - Math.abs(k - l * 0.45) / 4)); for (let j = -h; j <= h; j++) wrapPx(c, x + k, y + j, R.grey[1]); wrapPx(c, x + k, y - h, R.grey[2]); } wrapPx(c, x + 1, y, R.red[2]); wrapPx(c, x + 2, y + 1, R.red[2]); }
  } },
  { id: "core", base: R.purple[0], draw(c) { // 10 the core
    cloud(c, 111, [R.purple[0], R.red[0], R.purple[0]], 0.4, 0.9, 64);
    stars(c, 10, 40, [R.red[2], R.purple[3]]);
    const r = rng(37); for (let i = 0; i < 14; i++) { let x = Math.floor(r() * 16) * 8, y = Math.floor(r() * 16) * 8; let dir = Math.floor(r() * 4); for (let k = 0; k < 14; k++) { wrapPx(c, x, y, k % 5 === 0 ? R.red[3] : R.red[2]); if (r() < 0.25) dir = Math.floor(r() * 4); x += [1, 0, -1, 0][dir]; y += [0, 1, 0, -1][dir]; } wdisc(c, x, y, 1, R.yellow[2]); }
  } },
];

// A transparent layer of a few dim near stars that scrolls faster than the background (256x256, so it repeats rarely).
export function dustTile() {
  const c = new Canvas(256, 256); const r = rng(777);
  for (let i = 0; i < 40; i++) { const x = Math.floor(r() * 256), y = Math.floor(r() * 256), t = r(); c.px(x, y, t < 0.7 ? R.grey[1] : t < 0.95 ? R.grey[2] : R.blue[2]); }
  return c;
}
// The backgrounds are meant to sit quietly behind the action: only the darkest colour of each hue (and black) is kept, thinned out, so
// gems, coins, shots and enemies always stand out. The 128x128 drawing is then laid out 2x2, mirrored, so the repeat is 256 wide
// and four times less obvious (mirroring keeps the edges seamless).
const TINT = [2, 6, 0, 5, 0, 7, 4, 7, 6, 7]; // the colour ramp each sector keeps (0: only greys)
export function backgroundTile(i) {
  const bg = BACKGROUNDS[i], c = new Canvas(128, 128); c.d.fill(0); bg.draw(c);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const v = c.d[y * 128 + x]; if (v <= 0) continue;
    const r = v >> 2, sh = v & 3;
    let out = 0;
    if (r === 0) out = sh === 3 ? R.grey[2] : sh === 2 ? R.grey[1] : (((x + y) % 3) === 0 ? R.grey[1] : 0); // greys: dim stars and rocks
    else if (r === TINT[i] && sh <= 1) out = r * 4; // the sector's own colour stays, solid and dark
    else if (sh >= 2 && (x * 7 + y * 13) % 11 === 0) out = R.grey[2]; // an occasional dim star
    else if (sh === 1 && (x + y) % 3 === 0) out = R.grey[1];
    c.d[y * 128 + x] = out;
  }
  const q = new Canvas(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const sx = x < 128 ? x : 255 - x, sy = y < 128 ? y : 255 - y;
    q.d[y * 256 + x] = c.d[sy * 128 + sx];
  }
  return q;
}
