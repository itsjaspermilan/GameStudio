// The ten sector bosses, 48x48. Frames are small animations (pulse, blink, flicker).
import { R, K, W } from "./canvas.mjs";

const tau = Math.PI * 2;

export const BOSSES = [
  { id: "rockking", w: 48, h: 48, frames: 2, draw(c, f) {
    c.sphere(24, 27, 19, [R.grey[0], R.grey[1], R.orange[0], R.orange[1]], -0.5, -0.5, 20, 18);
    [[14, 20, 3], [32, 36, 4], [34, 18, 2.5], [18, 38, 2.5], [25, 12, 2]].forEach(([x, y, r]) => { c.disc(x, y, r, R.grey[0]); c.disc(x - 0.5, y - 0.5, r - 1, R.grey[1]); });
    for (let i = 0; i < 5; i++) { const x = 9 + i * 7.5; c.poly([[x, 12 + Math.abs(i - 2) * 2], [x + 3.5, 3 + Math.abs(i - 2) * 2 + (i === 2 ? -2 : 0)], [x + 7, 12 + Math.abs(i - 2) * 2]], R.yellow[2]); c.px(x + 3, 6 + Math.abs(i - 2) * 2, R.yellow[3]); }
    c.rect(10, 11, 28, 3, R.yellow[1]);
    c.rect(14, 22, 7, 5, K); c.rect(27, 22, 7, 5, K);
    c.rect(15, 23, 5, 3, f ? R.orange[3] : R.orange[2]); c.rect(28, 23, 5, 3, f ? R.orange[3] : R.orange[2]); c.px(16, 23, W); c.px(29, 23, W);
    c.rect(14, 34, 20, 4, K); for (let i = 0; i < 5; i++) c.rect(15 + i * 4, 34, 2, 2, R.grey[3]);
    c.rect(4, 26, 5, 9, R.grey[1]); c.rect(39, 26, 5, 9, R.grey[1]);
    c.outline(K);
  } },
  { id: "stormeye", w: 48, h: 48, frames: 3, draw(c, f) {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * tau + f * 0.2; c.poly([[24 + Math.cos(a - 0.2) * 17, 24 + Math.sin(a - 0.2) * 17], [24 + Math.cos(a) * 23, 24 + Math.sin(a) * 23], [24 + Math.cos(a + 0.2) * 17, 24 + Math.sin(a + 0.2) * 17]], i % 2 ? R.yellow[2] : R.blue[3]); }
    c.sphere(24, 24, 17, [R.grey[2], R.grey[3], W, W], -0.5, -0.5);
    c.sphere(24, 25, 10, [R.blue[0], R.blue[1], R.blue[2], R.blue[3]], -0.4, -0.5);
    const p = 3 + (f === 1 ? 1 : 0) + (f === 2 ? -1 : 0);
    c.disc(24, 25, p + 1.5, K); c.disc(21, 21, 2, W); c.px(27, 28, R.blue[3]);
    for (let i = 0; i < 6; i++) c.line(24 + Math.cos(i * 1.3) * 12, 24 + Math.sin(i * 1.3) * 12, 24 + Math.cos(i * 1.3 + 0.3) * 16, 24 + Math.sin(i * 1.3 + 0.3) * 16, R.red[2]);
    c.outline(R.blue[0]);
  } },
  { id: "lunarmaw", w: 48, h: 48, frames: 2, draw(c, f) {
    c.sphere(24, 24, 21, [R.grey[0], R.grey[1], R.grey[2], R.grey[3]], -0.5, -0.5);
    [[12, 12, 4], [36, 14, 3], [38, 34, 3.5], [10, 33, 3]].forEach(([x, y, r]) => { c.disc(x, y, r, R.grey[1]); c.disc(x + 0.5, y + 0.5, r - 1, R.grey[0]); });
    c.rect(14, 15, 6, 6, R.red[2]); c.rect(28, 15, 6, 6, R.red[2]); c.rect(16, 16, 3, 3, R.yellow[3]); c.rect(30, 16, 3, 3, R.yellow[3]); c.px(16, 16, W); c.px(30, 16, W);
    const o = f ? 5 : 2;
    c.ellipse(24, 33, 13, 4 + o, K); c.ellipse(24, 33 + o, 8, 3, R.red[1]);
    for (let i = 0; i < 6; i++) { const x = 13 + i * 4.4; c.poly([[x, 33 - 4 - o + 1], [x + 3, 33 - 4 - o + 1], [x + 1.5, 33 - 4 - o + 6]], W); c.poly([[x, 33 + 4 + o - 1], [x + 3, 33 + 4 + o - 1], [x + 1.5, 33 + 4 + o - 6]], R.grey[3]); }
    c.outline(K);
  } },
  { id: "crystalmother", w: 48, h: 48, frames: 2, draw(c, f) {
    const shard = (x, y, ang, len, wid, ramp) => { const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca; c.poly([[x + px * wid, y + py * wid], [x + ca * len, y + sa * len], [x - px * wid, y - py * wid]], ramp[1]); c.poly([[x + px * wid, y + py * wid], [x + ca * len, y + sa * len], [x, y]], ramp[2]); };
    for (let i = 0; i < 9; i++) { const a = (i / 9) * tau + 0.3; shard(24, 26, a, 21 + (i % 3) * 2, 5, i % 2 ? R.purple : R.blue); }
    c.poly([[24, 4], [38, 18], [34, 40], [14, 40], [10, 18]], R.teal[1]); c.poly([[24, 4], [10, 18], [14, 40], [22, 40], [22, 18]], R.teal[2]); c.poly([[24, 4], [22, 18], [30, 14]], R.teal[3]);
    c.disc(24, 26, 6 + f, R.yellow[2]); c.disc(24, 26, 3 + f, W);
    c.rect(15, 22, 3, 2, K); c.rect(30, 22, 3, 2, K);
    c.outline(R.blue[0]);
  } },
  { id: "scraptitan", w: 48, h: 48, frames: 2, draw(c, f) {
    const a = f ? 2 : 0;
    c.rect(8, 36, 10, 10, R.grey[1]); c.rect(30, 36, 10, 10, R.grey[1]); c.rect(6, 44, 14, 3, R.grey[2]); c.rect(28, 44, 14, 3, R.grey[2]);
    c.rect(12, 18, 24, 20, R.grey[2]); c.rect(12, 18, 24, 3, R.grey[3]); c.rect(30, 21, 6, 17, R.grey[1]); c.rect(15, 28, 18, 3, R.orange[2]); c.rect(15, 28, 18, 1, R.orange[3]);
    c.rect(14, 6, 20, 13, R.grey[2]); c.rect(14, 6, 20, 2, R.grey[3]); c.rect(28, 8, 6, 11, R.grey[1]);
    c.rect(17, 10, 14, 5, K); c.rect(19, 11, 10, 3, R.red[2]); c.rect(f ? 22 : 20, 11, 3, 3, R.red[3]);
    c.rect(2, 20 + a, 9, 6, R.orange[2]); c.rect(0, 26 + a, 5, 10, R.grey[1]); c.rect(38, 20 - a + 2, 9, 6, R.orange[2]); c.rect(43, 26 - a + 2, 5, 10, R.grey[1]);
    c.poly([[0, 36 + a], [5, 36 + a], [3, 42 + a]], R.grey[3]); c.poly([[43, 38 - a], [48, 38 - a], [46, 44 - a]], R.grey[3]);
    c.rect(22, 2, 4, 5, R.grey[1]); c.px(23, 1, f ? R.yellow[3] : R.red[2]);
    for (let i = 0; i < 4; i++) c.px(15 + i * 6, 22, R.yellow[1]);
    c.outline(K);
  } },
  { id: "pulsar", w: 48, h: 48, frames: 3, draw(c, f) {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * tau + f * 0.12, l = i % 2 ? 22 : 18; c.poly([[24 + Math.cos(a - 0.2) * 14, 24 + Math.sin(a - 0.2) * 14], [24 + Math.cos(a) * l, 24 + Math.sin(a) * l], [24 + Math.cos(a + 0.2) * 14, 24 + Math.sin(a + 0.2) * 14]], i % 2 ? R.orange[2] : R.yellow[2]); }
    c.sphere(24, 24, 14, [R.orange[1], R.orange[2], R.yellow[2], R.yellow[3]], -0.4, -0.4);
    c.rect(17, 20, 5, 4, K); c.rect(27, 20, 5, 4, K); c.rect(18, 21, 3, 2, R.red[2]); c.rect(28, 21, 3, 2, R.red[2]); c.px(18, 21, W); c.px(28, 21, W);
    c.rect(19, 29, 11, 2, K); c.ring(24, 24, 20 + (f % 2), 1, R.yellow[3]);
    c.outline(R.red[1]);
  } },
  { id: "hivequeen", w: 48, h: 48, frames: 2, draw(c, f) {
    const w = f ? 3 : 0;
    c.poly([[8, 10 + w], [22, 18], [20, 28], [4, 22 + w]], R.teal[3]); c.poly([[40, 10 + w], [26, 18], [28, 28], [44, 22 + w]], R.teal[3]); c.poly([[10, 12 + w], [20, 18], [19, 24], [7, 20 + w]], R.teal[2]); c.poly([[38, 12 + w], [28, 18], [29, 24], [41, 20 + w]], R.teal[2]);
    c.sphere(24, 36, 11, [R.orange[1], R.orange[2], R.yellow[2], R.yellow[3]], -0.5, -0.5, 10, 11);
    for (let i = 0; i < 3; i++) c.rect(15, 33 + i * 4, 18, 2, R.orange[0]);
    c.rect(22, 45, 4, 3, R.red[2]);
    c.sphere(24, 18, 9, R.green, -0.5, -0.6); c.rect(17, 14, 5, 4, K); c.rect(27, 14, 5, 4, K); c.rect(18, 15, 3, 2, R.yellow[3]); c.rect(28, 15, 3, 2, R.yellow[3]);
    c.poly([[17, 22], [20, 28], [22, 22]], W); c.poly([[31, 22], [28, 28], [26, 22]], W);
    c.line(19, 9, 14, 3, R.green[3]); c.line(29, 9, 34, 3, R.green[3]); c.px(14, 2, R.yellow[3]); c.px(34, 2, R.yellow[3]);
    c.outline(R.green[0]);
  } },
  { id: "horizon", w: 48, h: 48, frames: 3, draw(c, f) {
    const band = (e, x, y, front) => {
      const sw = ((Math.atan2(y - 24, x - 24) / tau) * 12 + f * 1.3) % 2, sp = Math.floor(sw + 4) % 2 === 0;
      if (e < 0.3) return sp ? W : R.yellow[3];
      if (e < 0.55) return sp ? R.yellow[3] : R.orange[2];
      if (e < 0.8) return sp ? R.orange[2] : R.red[2];
      return sp ? R.purple[2] : R.purple[1];
    };
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const dx = (x + 0.5 - 24) / 23, dy = (y + 0.5 - 24) / 9, e = dx * dx + dy * dy;
      if (e <= 1 && e > 0.08) c.px(x, y, band(e, x, y));
    }
    c.disc(24, 24, 10, K); c.ring(24, 24, 10.5, 1, R.purple[3]); c.disc(24, 24, 9, K);
    for (let y = 25; y < 48; y++) for (let x = 0; x < 48; x++) {
      const dx = (x + 0.5 - 24) / 23, dy = (y + 0.5 - 24) / 9, e = dx * dx + dy * dy;
      if (e <= 1 && e > 0.08 && Math.hypot(x + 0.5 - 24, y + 0.5 - 24) > 4) c.px(x, y, band(e, x, y));
    }
    c.rect(18, 20, 4, 3, R.purple[2]); c.rect(27, 20, 4, 3, R.purple[2]); c.px(19, 20, W); c.px(28, 20, W); c.rect(21, 26, 7, 1, R.purple[0]);
    c.outline(R.purple[0]);
  } },
  { id: "dread", w: 48, h: 48, frames: 2, draw(c, f) {
    c.poly([[2, 24], [10, 14], [36, 12], [46, 24], [36, 36], [10, 34]], R.grey[1]); c.poly([[4, 24], [11, 16], [36, 14], [44, 24], [16, 24]], R.grey[2]); c.poly([[11, 16], [36, 14], [34, 18], [13, 19]], R.grey[3]);
    c.rect(12, 21, 26, 6, R.blue[1]); c.rect(12, 21, 26, 1, R.blue[3]);
    c.rect(16, 6, 10, 8, R.grey[2]); c.rect(16, 6, 10, 2, R.grey[3]); c.rect(18, 3, 2, 4, R.grey[1]); c.px(19, 2, f ? R.red[3] : R.red[2]);
    c.rect(16, 34, 10, 8, R.grey[2]); c.rect(16, 40, 10, 2, R.grey[1]);
    c.rect(36, 19, 10, 3, R.grey[3]); c.rect(36, 26, 10, 3, R.grey[3]); c.px(46, 20, f ? W : R.orange[3]); c.px(46, 27, f ? R.orange[3] : W);
    for (let i = 0; i < 6; i++) c.px(8 + i * 5, 30, i % 2 === f ? R.yellow[3] : R.red[2]);
    c.rect(0, 20, 3, 3, f ? R.orange[3] : R.orange[2]); c.rect(0, 26, 3, 3, f ? R.orange[2] : R.orange[3]);
    c.disc(30, 24, 3, K); c.px(30, 24, R.red[3]);
    c.outline(K);
  } },
  { id: "voidheart", w: 48, h: 48, frames: 3, draw(c, f) {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * tau + 0.5; c.line(24, 24, 24 + Math.cos(a) * 22, 24 + Math.sin(a) * 22, R.grey[1]); c.line(24 + 1, 24, 24 + 1 + Math.cos(a) * 22, 24 + Math.sin(a) * 22, R.grey[2]); c.disc(24 + Math.cos(a) * 22, 24 + Math.sin(a) * 22, 2.4, R.purple[2]); c.px(24 + Math.cos(a) * 22, 24 + Math.sin(a) * 22, R.purple[3]); }
    const r = 14 + (f === 1 ? 1.5 : f === 2 ? 0.5 : 0);
    c.sphere(24, 24, r, [R.purple[0], R.red[1], R.red[2], R.red[3]], -0.4, -0.5);
    c.ring(24, 24, r + 3, 2, R.grey[2]); c.ring(24, 24, r + 3, 1, R.grey[3]);
    c.ellipse(24, 24, 9, 4.5, K); c.ellipse(24, 24, 7, 3, R.purple[3]); c.ellipse(24, 24, 2, 3, K); c.px(23, 22, W);
    c.px(22, 25, R.yellow[3]);
    c.outline(R.purple[0]);
  } },
];
