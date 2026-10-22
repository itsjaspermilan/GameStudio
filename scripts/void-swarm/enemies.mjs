// The 24 ordinary enemies. Everything faces right (the game mirrors it when they walk left). Frames: see `frames`.
import { R, K, W } from "./canvas.mjs";

const tau = Math.PI * 2;
const sin = (f, n, a = 1, p = 0) => Math.sin((f / n) * tau + p) * a;

export const ENEMIES = [
  { id: "grub", w: 16, h: 16, frames: 2, draw(c, f) {
    const sq = f ? 0.8 : 0;
    c.rect(4, 12, 2, 2, R.green[0]); c.rect(10, 12, 2, 2, R.green[0]);
    c.sphere(8, 9 + sq, 6, R.green, -0.5, -0.6, 6.2, 5.2 - sq);
    c.disc(8, 8 + sq, 2.6, W); c.disc(8.5, 8.5 + sq, 1.4, R.red[1]); c.px(8, 8 + sq, K);
    c.px(4, 11 + sq, R.green[0]); c.px(12, 11 + sq, R.green[0]);
    c.outline(R.green[0]);
  } },
  { id: "gnat", w: 16, h: 16, frames: 2, draw(c, f) {
    const up = f === 0;
    c.line(5, 8, up ? 3 : 4, up ? 3 : 12, R.blue[3]); c.line(6, 8, up ? 8 : 9, up ? 3 : 12, R.blue[3]); c.line(7, 8, up ? 9 : 10, up ? 4 : 11, R.blue[2]);
    c.ellipse(8, 9, 4.5, 3, R.red[1]); c.ellipse(7, 8.5, 2.5, 1.5, R.red[2]); c.px(6, 8, R.red[3]);
    c.rect(11, 8, 2, 2, R.orange[2]); c.px(12, 8, K); c.px(13, 9, R.yellow[3]); // head and stinger
    c.rect(3, 9, 2, 1, R.red[0]);
    c.outline(R.red[0]);
  } },
  { id: "rockling", w: 32, h: 32, frames: 4, draw(c, f) {
    // a boulder on stubby legs: four steps, the arms swing against the legs
    const st = [0, 1, 0, -1][f], bob = f % 2 ? 0 : 1;
    const S = [R.orange[0], R.orange[1], R.orange[2], R.orange[3]];
    c.rect(9, 23 - Math.max(0, st), 5, 7 + Math.max(0, st), R.grey[2]); c.rect(18, 23 - Math.max(0, -st), 5, 7 + Math.max(0, -st), R.grey[1]);
    c.rect(8 + st, 29, 7, 2, R.grey[1]); c.rect(17 - st, 29, 7, 2, R.grey[1]); c.rect(8 + st, 29, 7, 1, R.grey[2]);
    c.sphere(4, 20 + bob - st, 3.5, S); c.sphere(28, 20 + bob + st, 3.5, S); // fists
    c.sphere(16, 15 + bob, 11.5, S, -0.5, -0.55, 11.5, 11);
    for (const [x, y, r] of [[9, 8, 1.6], [22, 20, 2.2], [10, 21, 1.4], [24, 9, 1.2], [16, 25, 1.2]]) { c.disc(x, y + bob, r, R.orange[0]); c.px(x - 0.5, y + bob - r + 0.5, R.orange[3]); }
    c.rect(10, 12 + bob, 5, 3, K); c.rect(18, 12 + bob, 5, 3, K); c.rect(11, 12 + bob, 3, 2, R.orange[3]); c.rect(19, 12 + bob, 3, 2, R.orange[3]); c.px(12, 12 + bob, W); c.px(20, 12 + bob, W);
    c.rect(9, 10 + bob, 6, 1, R.orange[0]); c.rect(18, 10 + bob, 6, 1, R.orange[0]); // brow
    c.rect(12, 19 + bob, 9, 2, K); c.px(13, 19 + bob, R.orange[3]); c.px(16, 19 + bob, R.orange[3]); c.px(19, 19 + bob, R.orange[3]);
    c.outline(R.orange[0]);
  } },
  { id: "jelly", w: 16, h: 16, frames: 4, draw(c, f) {
    for (let i = 0; i < 4; i++) { const x = 4 + i * 2.7; for (let y = 9; y < 15; y++) c.px(x + sin(f, 4, 1.2, y * 0.8 + i), y, i % 2 ? R.teal[2] : R.teal[3]); }
    c.sphere(8, 7, 5.5, R.teal, -0.5, -0.6, 6, 5 + sin(f, 4, 0.5));
    c.rect(2, 8, 12, 2, R.teal[1]); c.rect(3, 9, 10, 1, R.teal[0]);
    c.disc(6, 6, 1, W); c.disc(10, 6, 1, W); c.px(6, 6, K); c.px(10, 6, K);
    c.outline(R.teal[0]);
  } },
  { id: "ringdrone", w: 16, h: 16, frames: 4, draw(c, f) {
    c.ring(8, 8, 7, 2, R.blue[1]); c.ring(8, 8, 7, 1, R.blue[3]);
    for (let i = 0; i < 4; i++) { const a = (f / 4 + i) * (tau / 4) * 0.5 + i * (tau / 4) / 1; c.line(8 + Math.cos(a) * 2, 8 + Math.sin(a) * 2, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, R.blue[2]); }
    c.sphere(8, 8, 2.6, R.yellow);
    c.outline(R.blue[0]);
  } },
  { id: "rammer", w: 16, h: 16, frames: 2, draw(c, f) {
    c.poly([[1, 3], [10, 5], [15, 8], [10, 11], [1, 13], [4, 8]], R.red[1]);
    c.poly([[3, 5], [10, 6], [13, 8], [6, 8]], R.red[2]); c.poly([[14, 8], [10, 6.5], [10, 9.5]], R.grey[3]);
    c.rect(6, 7, 3, 2, R.yellow[2]); c.px(7, 7, W);
    c.poly([[1, 4], [4, 6], [1, 6]], R.grey[2]); c.poly([[1, 12], [4, 10], [1, 10]], R.grey[2]);
    if (f) { c.rect(0, 7, 2, 2, R.orange[3]); } else { c.px(0, 8, R.yellow[3]); c.px(1, 7, R.orange[2]); }
    c.outline(R.red[0]);
  } },
  { id: "saucer", w: 16, h: 16, frames: 3, draw(c, f) {
    c.ellipse(8, 5.5, 3.6, 3.4, R.teal[2]); c.ellipse(7.5, 4.5, 2, 2, R.teal[3]); c.px(8, 5, R.green[2]); c.px(9, 5, R.green[2]);
    c.ellipse(8, 9.5, 7.5, 3, R.grey[2]); c.rect(2, 9, 12, 2, R.grey[1]); c.rect(3, 8, 6, 1, R.grey[3]);
    for (let i = 0; i < 3; i++) c.px(4 + i * 4 + 0, 10, (i === f) ? R.yellow[3] : R.red[1]);
    c.rect(6, 12, 4, 1, R.grey[0]); c.px(8, 13, R.yellow[2]);
    c.outline(R.grey[0]);
  } },
  { id: "amoeba", w: 16, h: 16, frames: 2, draw(c, f) {
    const s = f ? 1 : 0;
    c.sphere(8, 8.5, 6.3, R.purple, -0.5, -0.6, 6.8 - s * 0.7, 6 + s * 0.7);
    c.disc(6, 8, 1.8, R.purple[3]); c.disc(10.5, 10, 1.4, R.purple[3]); c.px(6, 8, R.red[2]); c.px(10, 10, R.red[2]);
    c.px(11, 5, R.purple[3]); c.px(4, 11, R.purple[0]); c.px(12 + s, 12, R.purple[2]);
    c.outline(R.purple[0]);
  } },
  { id: "splitling", w: 8, h: 8, frames: 2, draw(c, f) {
    c.sphere(4, 4.5, 3, R.purple, -0.5, -0.6, 3.2 - f * 0.3, 2.8 + f * 0.3); c.px(3, 4, W); c.px(5, 4, W);
    c.outline(R.purple[0]);
  } },
  { id: "boomer", w: 16, h: 16, frames: 4, draw(c, f) {
    const armed = f >= 2, lit = armed && f === 3;
    c.sphere(8, 9, 6, lit ? [R.red[1], R.red[2], R.yellow[3], W] : R.orange, -0.5, -0.6);
    c.line(5, 7, 8, 10, lit ? R.red[1] : R.orange[0]); c.line(8, 10, 7, 13, lit ? R.red[1] : R.orange[0]); c.line(11, 6, 9, 8, lit ? R.red[1] : R.orange[0]);
    c.rect(7, 1, 2, 3, R.grey[2]); c.px(8, 0, armed ? (lit ? W : R.yellow[3]) : R.red[2]); if (armed) { c.px(6, 0, R.yellow[3]); c.px(10, 1, R.orange[3]); }
    c.rect(5, 8, 2, 2, K); c.rect(9, 8, 2, 2, K); c.px(5, 8, armed ? R.yellow[3] : R.red[2]); c.px(9, 8, armed ? R.yellow[3] : R.red[2]);
    c.outline(R.red[0]);
  } },
  { id: "imp", w: 16, h: 16, frames: 2, draw(c, f) {
    const w = f ? 2 : 0;
    c.poly([[1, 4 + w], [6, 7], [6, 11], [2, 12 - w]], R.purple[1]); c.poly([[15, 4 + w], [10, 7], [10, 11], [14, 12 - w]], R.purple[1]);
    c.poly([[3, 5 + w], [6, 8], [3, 10 - w]], R.purple[2]); c.poly([[13, 5 + w], [10, 8], [13, 10 - w]], R.purple[2]);
    c.sphere(8, 8, 4, R.red, -0.5, -0.6); c.rect(5, 7, 2, 1, R.yellow[3]); c.rect(9, 7, 2, 1, R.yellow[3]);
    c.poly([[5, 2], [6, 5], [4, 5]], R.red[0]); c.poly([[11, 2], [12, 5], [10, 5]], R.red[0]);
    c.rect(6, 10, 4, 1, K); c.px(6, 10, W); c.px(9, 10, W);
    c.rect(7, 12, 2, 3, R.red[1]); c.px(8, 15, R.red[3]);
    c.outline(R.purple[0]);
  } },
  { id: "medic", w: 16, h: 16, frames: 2, draw(c, f) {
    c.sphere(8, 9, 5.5, [R.grey[1], R.grey[2], W, W]);
    c.rect(7, 6, 2, 6, R.green[2]); c.rect(5, 8, 6, 2, R.green[2]); c.rect(7, 7, 2, 4, R.green[3]); c.rect(6, 8, 4, 2, R.green[3]);
    c.rect(f ? 3 : 4, 2, f ? 10 : 8, 1, R.grey[2]); c.rect(7, 3, 2, 1, R.grey[1]);
    c.px(2, 12, R.green[2]); c.px(13, 13, R.green[3]);
    c.outline(R.grey[0]);
  } },
  { id: "hive", w: 32, h: 32, frames: 3, draw(c, f) {
    const S = [R.orange[0], R.orange[1], R.yellow[1], R.yellow[2]];
    c.sphere(16, 16, 13, S, -0.5, -0.5, 13, 13.5);
    for (let y = 6; y < 28; y += 5) for (let x = 3; x < 30; x++) if (c.get(x, y) !== -1 && c.get(x, y) !== S[3]) c.px(x, y, R.orange[0]); // comb rings
    const holes = [[10, 11], [21, 11], [16, 18], [9, 21], [23, 21], [15, 7]];
    holes.forEach(([x, y], i) => {
      c.disc(x, y, 2.8, K); c.disc(x, y + 0.5, 1.7, R.orange[0]);
      const lit = i % 3 === f; c.px(x, y, lit ? R.green[3] : R.green[1]); c.px(x + 1, y, lit ? R.green[2] : R.green[0]);
      if (lit) c.px(x - 1, y - 2, R.green[3]); // a bug peeks out
    });
    c.rect(13, 28, 6, 3, R.orange[0]); c.rect(14, 28, 4, 1, R.orange[1]); c.rect(9, 3, 3, 2, R.yellow[3]); c.px(8, 4, R.yellow[3]);
    c.outline(R.orange[0]);
  } },
  { id: "minelayer", w: 16, h: 16, frames: 2, draw(c, f) {
    c.poly([[2, 5], [12, 6], [14, 8], [12, 10], [2, 11]], R.green[1]); c.poly([[3, 6], [11, 6.5], [12, 8], [3, 8]], R.green[2]);
    c.rect(4, 8, 6, 3, R.grey[1]); c.rect(5, 10, 4, 2, R.grey[2]); c.disc(7, 13, 1.6, K); c.px(7, 13, f ? R.red[3] : R.red[1]);
    c.rect(10, 6, 2, 2, R.yellow[2]);
    c.rect(0, 6, 3, 1, R.orange[2]); c.rect(0, 10, 3, 1, f ? R.yellow[3] : R.orange[2]);
    c.outline(R.green[0]);
  } },
  { id: "wraith", w: 16, h: 16, frames: 3, draw(c, f) {
    c.ellipse(8, 6.5, 5.5, 5, R.teal[3]); c.rect(3, 7, 10, 5, R.teal[3]);
    for (let i = 0; i < 5; i++) c.rect(3 + i * 2.2, 12, 2, 2 + ((i + f) % 3), R.teal[3]);
    c.ellipse(6, 6, 1.4, 2, R.blue[0]); c.ellipse(10.5, 6, 1.4, 2, R.blue[0]); c.px(6, 6, R.blue[3]); c.px(10, 6, R.blue[3]); c.ellipse(8.5, 10, 1.5, 1.2, R.blue[0]);
    c.rect(3, 8, 3, 3, R.teal[2]); c.px(4, 4, W); c.px(5, 3, W);
    c.outline(R.teal[1]);
  } },
  { id: "comet", w: 16, h: 16, frames: 3, draw(c, f) {
    c.poly([[0, 8 - f % 2], [10, 4], [10, 12]], R.orange[1]); c.poly([[2, 8], [10, 5.5], [10, 10.5]], R.orange[2]);
    c.line(0, 6 + f, 8, 6, R.red[2]); c.line(0, 10 - f, 8, 10, R.red[2]);
    c.sphere(11, 8, 4.2, R.yellow, -0.4, -0.5); c.px(12, 7, W);
    c.outline(R.red[0]);
  } },
  { id: "leech", w: 16, h: 16, frames: 4, draw(c, f) {
    for (let i = 0; i < 7; i++) { const x = 1 + i * 1.8, y = 9 + sin(f, 4, 2, i * 0.9); c.disc(x + 1, y, 2.4 - i * 0.12, i % 2 ? R.red[1] : R.red[2]); }
    c.disc(14, 8 + sin(f, 4, 1, 0), 2.6, R.red[2]); c.rect(12, 8 + sin(f, 4, 1, 0), 4, 1, K); c.px(13, 9, W); c.px(15, 9, W); c.px(13, 6 + sin(f, 4, 1, 0), R.yellow[3]);
    c.outline(R.red[0]);
  } },
  { id: "sentinel", w: 16, h: 16, frames: 2, draw(c, f) {
    c.rect(6, 9, 4, 6, R.grey[1]); c.rect(4, 14, 8, 2, R.grey[2]); c.rect(6, 9, 2, 6, R.grey[2]);
    c.sphere(8, 6, 4.6, [R.grey[0], R.grey[1], R.grey[2], R.grey[3]]);
    c.disc(8, 6, 2.4, R.red[0]); c.disc(8, 6, 1.6, f ? R.red[3] : R.red[2]); c.px(7, 5, W);
    c.line(8, 1, 8, 0, R.grey[2]); c.px(8, 0, f ? R.red[3] : R.yellow[3]);
    c.rect(2, 6, 2, 2, R.grey[1]); c.rect(12, 6, 2, 2, R.grey[1]);
    c.outline(R.grey[0]);
  } },
  { id: "knight", w: 16, h: 16, frames: 2, draw(c, f) {
    const b = f ? 1 : 0;
    c.rect(5, 11, 2, 3 - b, R.blue[1]); c.rect(9, 11, 2, 3 - (1 - b), R.blue[1]); c.rect(4, 14 - b, 3, 1, R.grey[2]);
    c.rect(5, 6 + b, 7, 6, R.blue[2]); c.rect(5, 6 + b, 3, 6, R.blue[3]); c.rect(10, 7 + b, 2, 5, R.blue[1]);
    c.sphere(8, 4 + b, 3.6, R.grey); c.rect(6, 4 + b, 5, 1, K); c.px(7, 4 + b, R.red[3]); c.px(10, 4 + b, R.red[3]); c.rect(7, 0 + b, 2, 2, R.red[2]);
    c.poly([[0, 6 + b], [5, 5 + b], [5, 13 + b], [2, 14 + b], [0, 11 + b]], R.grey[2]); c.rect(1, 7 + b, 2, 5, R.grey[3]); c.px(3, 9 + b, R.yellow[2]);
    c.rect(13, 3 + b, 1, 8, R.grey[3]); c.px(13, 2 + b, W); c.rect(12, 10 + b, 3, 1, R.yellow[1]);
    c.outline(R.blue[0]);
  } },
  { id: "vortex", w: 16, h: 16, frames: 4, draw(c, f) {
    c.disc(8, 8, 7, R.purple[0]);
    for (let arm = 0; arm < 3; arm++) for (let t = 0; t < 22; t++) {
      const r = 1 + t * 0.3, a = t * 0.34 + arm * (tau / 3) + (f / 4) * (tau / 3);
      c.px(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, t > 14 ? R.purple[2] : t > 6 ? R.purple[3] : W);
    }
    c.disc(8, 8, 1.4, K); c.px(8, 8, R.red[2]);
    c.outline(R.purple[1]);
  } },
  { id: "spore", w: 32, h: 32, frames: 3, draw(c, f) {
    const blobs = [[16, 16, 10.5], [9, 19, 6.5], [23, 19, 6.5], [12, 9, 6], [20, 9, 6], [16, 24, 5.5]];
    blobs.forEach(([x, y, r], i) => c.sphere(x + sin(f, 3, 0.8, i), y + sin(f, 3, 0.8, i * 2), r, R.green, -0.5, -0.6));
    [[8, 14], [24, 13], [13, 25], [21, 25], [16, 5]].forEach(([x, y]) => { c.disc(x, y, 1.2, R.green[3]); });
    c.disc(12, 15, 3, K); c.disc(20, 15, 3, K); c.disc(12.5, 15.5, 1.4, R.yellow[2]); c.disc(20.5, 15.5, 1.4, R.yellow[2]); c.px(12, 14, R.yellow[3]); c.px(20, 14, R.yellow[3]);
    c.rect(12, 21, 8, 2, K); c.px(13, 22, R.green[2]); c.px(18, 22, R.green[2]);
    [[4, 5], [27, 7], [5, 27], [28, 26], [16, 1]].forEach(([x, y], i) => c.px(x, y + ((f + i) % 3) - 1, R.green[3]));
    c.outline(R.green[0]);
  } },
  { id: "reaper", w: 32, h: 32, frames: 3, draw(c, f) {
    const w = f % 3;
    // the robe's hem ripples from frame to frame
    const hem = [[21, 29 + (w === 0)], [17, 30 - (w === 1)], [13, 29 + (w === 2)], [9, 30 - (w === 0)], [6, 28 + (w === 1)]];
    c.poly([[15, 2], [24, 10], [25, 27], ...hem, [5, 10]], R.purple[1]);
    c.poly([[15, 3], [12, 10], [11, 27], [7, 27], [7, 11]], R.purple[2]); c.poly([[15, 10], [23, 11], [23, 26], [16, 27]], R.purple[0]);
    c.ellipse(15, 11, 5.5, 6, K); c.ellipse(15, 13, 4, 4, R.purple[0]); c.ellipse(15, 12, 3.6, 3.6, K);
    c.rect(12, 11, 2, 2, R.red[3]); c.rect(17, 11, 2, 2, R.red[3]); c.px(12, 11, W); c.px(18, 11, W);
    c.rect(24, 17, 4, 3, R.purple[1]); c.rect(26, 18, 2, 2, R.grey[3]); // hand on the scythe
    c.line(28, 2, 28, 30, R.grey[2]); c.line(29, 2, 29, 30, R.grey[1]);
    c.poly([[29, 2], [19, 4 + w % 2], [16, 8 + w % 2], [21, 6], [26, 6]], R.grey[3]); c.line(19, 5 + w % 2, 26, 4, R.red[2]); c.px(28, 2, W);
    c.outline(R.purple[0]);
  } },
  { id: "sniper", w: 16, h: 16, frames: 2, draw(c, f) {
    c.poly([[0, 6], [8, 6], [11, 7], [11, 9], [8, 10], [0, 10]], R.teal[1]); c.rect(2, 7, 7, 1, R.teal[3]); c.rect(3, 8, 5, 1, R.teal[2]);
    c.rect(11, 7, 5, 2, R.grey[2]); c.rect(11, 7, 5, 1, R.grey[3]); c.px(15, 8, f ? R.yellow[3] : K);
    c.rect(3, 3, 2, 3, R.teal[2]); c.rect(3, 10, 2, 3, R.teal[2]); c.disc(7, 8, 1.6, R.red[1]); c.px(7, 8, f ? W : R.red[3]);
    c.rect(0, 7, 1, 2, f ? R.orange[3] : R.red[2]);
    c.outline(R.teal[0]);
  } },
  { id: "golem", w: 32, h: 32, frames: 4, draw(c, f) {
    // a crystal giant that stomps: four steps, the crystal arms swing against the legs
    const st = [0, 1, 0, -1][f], bob = f % 2 ? 0 : 1;
    c.rect(8 + st, 24 - Math.max(0, st), 7, 7 + Math.max(0, st), R.blue[1]); c.rect(17 - st, 24 - Math.max(0, -st), 7, 7 + Math.max(0, -st), R.blue[0]);
    c.rect(8 + st, 24 - Math.max(0, st), 2, 7, R.blue[2]);
    c.poly([[16, 1 + bob], [26, 10 + bob], [25, 26], [7, 26], [6, 10 + bob]], R.blue[1]);
    c.poly([[16, 1 + bob], [6, 10 + bob], [7, 26], [13, 26], [14, 10 + bob]], R.blue[2]); c.poly([[16, 1 + bob], [14, 10 + bob], [19, 8 + bob]], R.blue[3]);
    c.line(14, 10 + bob, 13, 26, R.blue[3]); c.line(19, 8 + bob, 20, 25, R.blue[0]);
    c.poly([[1, 14 + st + bob], [6, 10 + bob], [7, 21], [3, 23 + st]], R.teal[2]); c.poly([[1, 14 + st + bob], [6, 10 + bob], [4, 17 + st]], R.teal[3]);
    c.poly([[31, 14 - st + bob], [26, 10 + bob], [25, 21], [29, 23 - st]], R.teal[1]); c.poly([[31, 14 - st + bob], [26, 10 + bob], [28, 17 - st]], R.teal[2]);
    c.poly([[5, 8 + bob], [9, 2 + bob], [11, 10 + bob]], R.teal[3]); c.poly([[27, 8 + bob], [23, 2 + bob], [21, 10 + bob]], R.teal[2]);
    c.rect(10, 13 + bob, 4, 3, K); c.rect(18, 13 + bob, 4, 3, K); c.rect(11, 13 + bob, 3, 2, R.yellow[3]); c.rect(19, 13 + bob, 3, 2, R.yellow[3]); c.px(11, 13 + bob, W); c.px(19, 13 + bob, W);
    c.rect(13, 19 + bob, 7, 1, R.blue[0]);
    c.outline(R.blue[0]);
  } },
];
