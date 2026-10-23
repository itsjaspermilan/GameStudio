// The ten sector bosses, 72x72 (one size up from the first 48x48 drawings), painted with lit shapes (scripts/lib/paint.mjs). Frames are
// small animations (pulse, blink, flicker). They share three colour banks: warm, cold and cosmic.
import { ramp } from "../../studio/src/palette-core.js";
import { bank, sphere, capsule, box, plane, outline, dot, ring, shades as pick } from "../lib/paint.mjs";

const tau = Math.PI * 2;
const shades = (hue, sat, n, opts) => pick(ramp(hue, sat, opts), n);
export const BOSS_BANKS = {
  boss_warm: bank({ out: ["#160c0e"], orange: shades(24, 0.78, 4, { lo: 0.2, hi: 0.74 }), yellow: shades(46, 0.9, 4, { lo: 0.4, hi: 0.92 }),
    red: shades(355, 0.75, 3, { lo: 0.25, hi: 0.64 }), steel: shades(222, 0.12, 3, { lo: 0.2, hi: 0.78 }) }),
  boss_cold: bank({ out: ["#0a0e18"], steel: shades(220, 0.12, 5, { lo: 0.14, hi: 0.94 }), blue: shades(215, 0.62, 4, { lo: 0.16, hi: 0.74 }),
    red: shades(355, 0.75, 3, { lo: 0.25, hi: 0.66 }), pale: ["#f2d06a", "#fff6e0"] }),
  boss_cosmic: bank({ out: ["#100a18"], purple: shades(275, 0.5, 4, { lo: 0.14, hi: 0.72 }), teal: shades(178, 0.55, 3, { lo: 0.25, hi: 0.82 }),
    blue: shades(218, 0.6, 2, { lo: 0.3, hi: 0.66 }), red: shades(355, 0.72, 3, { lo: 0.25, hi: 0.66 }), gold: ["#f0b43c", "#fff2b8"] }),
};
const { boss_warm: W, boss_cold: C, boss_cosmic: X } = BOSS_BANKS;
const nameOf = (b) => Object.keys(BOSS_BANKS).find((k) => BOSS_BANKS[k] === b);
const B = (id, frames, b, draw) => ({ id, w: 72, h: 72, frames, bank: b, bankName: nameOf(b), draw });
export const BOSSES = [
  B("rockking", 2, W, (c, f) => {
    box(c, 5, 39, 8, 14, W.steel, { round: 3 }); box(c, 59, 39, 8, 14, W.steel, { round: 3, bias: -0.2 });          // fists of stone
    sphere(c, 36, 40.5, 30, 27, [W.out[0], W.steel[0], W.steel[1], W.orange[0], W.orange[1]], { spec: W.orange[2] });
    for (const [x, y, r] of [[21, 30, 4.5], [48, 54, 6], [51, 27, 3.8], [27, 57, 3.8], [37, 18, 3]]) sphere(c, x, y, r, r, [W.out[0], W.steel[0], W.steel[1]], { bias: -0.2 });
    for (let i = 0; i < 5; i++) { const x = 13 + i * 11.3, d = Math.abs(i - 2) * 3; plane(c, [[x, 18 + d], [x + 5.3, 4 + d - (i === 2 ? 3 : 0)], [x + 10.5, 18 + d]], W.yellow, i < 2 ? 0.6 : i === 2 ? 0.3 : -0.2); } // the crown
    box(c, 15, 16, 42, 5, W.yellow, { round: 2 });
    for (const ex of [21, 41]) { box(c, ex, 33, 11, 8, [W.out[0]], { round: 2 }); box(c, ex + 1.5, 34.5, 8, 5, f ? W.yellow : W.orange, { round: 1 }); dot(c, ex + 2, 35, W.yellow[3]); }
    box(c, 21, 51, 30, 6, [W.out[0]], { round: 2 }); for (let i = 0; i < 5; i++) box(c, 23 + i * 6, 51, 3, 3, W.steel, { round: 0, bias: 0.4 });
    outline(c, W);
  }),
  B("stormeye", 3, C, (c, f) => {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * tau + f * 0.2; plane(c, [[36 + Math.cos(a - 0.2) * 25, 36 + Math.sin(a - 0.2) * 25], [36 + Math.cos(a) * 34.5, 36 + Math.sin(a) * 34.5], [36 + Math.cos(a + 0.2) * 25, 36 + Math.sin(a + 0.2) * 25]], i % 2 ? C.pale : C.blue, Math.cos(a + 2.4) * 0.7); } // lightning spikes
    sphere(c, 36, 36, 25.5, 25.5, C.steel, { spec: C.pale[1], edge: true });
    sphere(c, 36, 37.5, 15, 15, C.blue, { spec: C.blue[3] });
    const p = 4.5 + (f === 1 ? 1.5 : 0) + (f === 2 ? -1.5 : 0);
    sphere(c, 36, 37.5, p + 2.2, p + 2.2, [C.out[0]]); sphere(c, 31.5, 31.5, 3, 3, [C.pale[1]]);
    for (let i = 0; i < 6; i++) capsule(c, 36 + Math.cos(i * 1.3) * 18, 36 + Math.sin(i * 1.3) * 18, 36 + Math.cos(i * 1.3 + 0.3) * 24, 36 + Math.sin(i * 1.3 + 0.3) * 24, 0.8, C.red); // veins
    outline(c, C);
  }),
  B("lunarmaw", 2, C, (c, f) => {
    sphere(c, 36, 36, 31.5, 31.5, C.steel, { spec: C.steel[4] });
    for (const [x, y, r] of [[18, 18, 6], [54, 21, 4.5], [57, 51, 5.2], [15, 50, 4.5]]) sphere(c, x, y, r, r, C.steel, { bias: -0.35 }); // craters
    for (const ex of [21, 42]) { box(c, ex, 22, 9, 9, C.red, { round: 2 }); box(c, ex + 2.5, 24, 4.5, 4.5, C.pale, { round: 1 }); dot(c, ex + 3, 24, C.pale[1]); }
    const o = f ? 7.5 : 3;
    sphere(c, 36, 49.5, 19.5, 6 + o, [C.out[0]]); sphere(c, 36, 49.5 + o, 12, 4.5, C.red);              // the maw
    for (let i = 0; i < 6; i++) { const x = 19.5 + i * 6.6; plane(c, [[x, 44.5 - o], [x + 4.5, 44.5 - o], [x + 2.2, 52 - o]], C.pale, 0.7); plane(c, [[x, 54.5 + o], [x + 4.5, 54.5 + o], [x + 2.2, 47 + o]], C.steel, 0.4); }
    outline(c, C);
  }),
  B("crystalmother", 2, X, (c, f) => {
    const shard = (ang, len, wid, rmp) => { const ca = Math.cos(ang), sa = Math.sin(ang), px = -sa, py = ca;
      plane(c, [[36 + px * wid, 39 + py * wid], [36 + ca * len, 39 + sa * len], [36 - px * wid, 39 - py * wid]], rmp, -0.2);
      plane(c, [[36 + px * wid, 39 + py * wid], [36 + ca * len, 39 + sa * len], [36, 39]], rmp, 0.6); };
    for (let i = 0; i < 9; i++) shard((i / 9) * tau + 0.3, 31 + (i % 3) * 3, 7.5, i % 2 ? X.purple : X.blue);
    plane(c, [[36, 6], [57, 27], [51, 60], [21, 60], [15, 27]], X.teal, 0); plane(c, [[36, 6], [15, 27], [21, 60], [33, 60], [33, 27]], X.teal, 0.7);
    plane(c, [[36, 6], [33, 27], [45, 21]], X.teal, 1);
    sphere(c, 36, 39, 9 + f * 1.5, 9 + f * 1.5, X.gold, { spec: X.gold[1] }); sphere(c, 36, 39, 4.5 + f * 1.5, 4.5 + f * 1.5, [X.gold[1]]); // the heart crystal
    box(c, 22, 33, 5, 3, [X.out[0]], { round: 0 }); box(c, 45, 33, 5, 3, [X.out[0]], { round: 0 });
    outline(c, X);
  }),
  B("scraptitan", 2, W, (c, f) => {
    const a = f ? 3 : 0;
    box(c, 12, 54, 15, 15, W.steel, { round: 2 }); box(c, 45, 54, 15, 15, W.steel, { round: 2, bias: -0.2 });
    box(c, 9, 66, 21, 5, W.steel, { round: 1 }); box(c, 42, 66, 21, 5, W.steel, { round: 1, bias: -0.1 });
    box(c, 18, 27, 36, 30, W.steel, { round: 4 });                                                          // the chest
    box(c, 22, 42, 27, 5, W.orange, { round: 1 });
    box(c, 21, 9, 30, 20, W.steel, { round: 4 });                                                           // the head
    box(c, 25, 15, 21, 8, [W.out[0]], { round: 1 }); box(c, 28, 16.5, 15, 5, W.red, { round: 1 }); box(c, f ? 33 : 30, 16.5, 5, 5, [W.red[2]], { round: 1 });
    box(c, 3, 30 + a, 14, 9, W.orange, { round: 3 }); box(c, 0, 39 + a, 8, 15, W.steel, { round: 2 });        // arms of scrap
    box(c, 56, 33 - a, 14, 9, W.orange, { round: 3, bias: -0.15 }); box(c, 64, 42 - a, 8, 15, W.steel, { round: 2, bias: -0.2 });
    plane(c, [[0, 54 + a], [8, 54 + a], [4, 63 + a]], W.steel, 0.6); plane(c, [[64, 57 - a], [72, 57 - a], [69, 66 - a]], W.steel, 0.2); // claws
    box(c, 33, 3, 6, 7, W.steel, { round: 1 }); dot(c, 35, 1, f ? W.yellow[3] : W.red[2]);
    for (let i = 0; i < 4; i++) sphere(c, 24 + i * 9, 33, 1.3, 1.3, W.yellow);                              // rivets
    outline(c, W);
  }),
  B("pulsar", 3, W, (c, f) => {
    for (let i = 0; i < 12; i++) { const a = (i / 12) * tau + f * 0.12, l = i % 2 ? 33 : 27; plane(c, [[36 + Math.cos(a - 0.2) * 21, 36 + Math.sin(a - 0.2) * 21], [36 + Math.cos(a) * l, 36 + Math.sin(a) * l], [36 + Math.cos(a + 0.2) * 21, 36 + Math.sin(a + 0.2) * 21]], i % 2 ? W.orange : W.yellow, Math.cos(a + 2.4) * 0.6); }
    sphere(c, 36, 36, 21, 21, [W.orange[1], W.orange[2], W.yellow[1], W.yellow[2], W.yellow[3]], { spec: W.yellow[3] });
    for (const ex of [25, 40]) { box(c, ex, 30, 8, 6, [W.out[0]], { round: 1 }); box(c, ex + 1.5, 31.5, 5, 3, W.red, { round: 0 }); dot(c, ex + 2, 31, W.yellow[3]); }
    box(c, 28, 43.5, 17, 3, [W.out[0]], { round: 1 });
    ring(c, 36, 36, 29.5 + (f % 2), 31 + (f % 2), W.yellow);                                                // a pulse ring
    outline(c, W);
  }),
  B("hivequeen", 2, X, (c, f) => {
    const w = f ? 4.5 : 0;
    plane(c, [[12, 15 + w], [33, 27], [30, 42], [6, 33 + w]], X.teal, 0.6); plane(c, [[60, 15 + w], [39, 27], [42, 42], [66, 33 + w]], X.teal, -0.2); // wings
    plane(c, [[15, 18 + w], [30, 27], [28.5, 36], [10.5, 30 + w]], X.teal, 1); plane(c, [[57, 18 + w], [42, 27], [43.5, 36], [61.5, 30 + w]], X.teal, 0.3);
    sphere(c, 36, 54, 16.5, 16.5, [X.red[0], X.red[1], X.gold[0], X.gold[1]], { spec: X.gold[1] });                // the abdomen
    for (let i = 0; i < 3; i++) box(c, 22, 49.5 + i * 6, 28, 2, [X.red[0]], { round: 0 });
    box(c, 33, 67, 6, 5, X.red, { round: 1 });                                                                     // the stinger
    sphere(c, 36, 27, 13.5, 13.5, X.teal, { spec: X.teal[2] });                                                     // the head
    for (const ex of [25, 40]) { box(c, ex, 21, 8, 6, [X.out[0]], { round: 1 }); box(c, ex + 1.5, 22.5, 5, 3, [X.gold[1]], { round: 0 }); }
    plane(c, [[25, 33], [30, 42], [33, 33]], [X.gold[1]], 0); plane(c, [[47, 33], [42, 42], [39, 33]], [X.gold[1]], 0); // mandibles
    capsule(c, 28, 13.5, 21, 4.5, 0.8, X.teal); capsule(c, 44, 13.5, 51, 4.5, 0.8, X.teal); dot(c, 21, 3, X.gold[1]); dot(c, 51, 3, X.gold[1]);
    outline(c, X);
  }),
  B("horizon", 3, X, (c, f) => {
    const band = (e, x, y) => {
      const sw = ((Math.atan2(y - 36, x - 36) / tau) * 12 + f * 1.3) % 2, sp = Math.floor(sw + 4) % 2 === 0;
      if (e < 0.3) return sp ? X.gold[1] : X.gold[0];
      if (e < 0.55) return sp ? X.gold[0] : X.red[2];
      if (e < 0.8) return sp ? X.red[2] : X.red[1];
      return sp ? X.purple[2] : X.purple[1];
    };
    const disk = (front) => { for (let y = 0; y < 72; y++) for (let x = 0; x < 72; x++) {
      const dx = (x + 0.5 - 36) / 34.5, dy = (y + 0.5 - 36) / 13.5, e = dx * dx + dy * dy;
      if (e <= 1 && e > 0.08 && (!front || (y >= 37 && Math.hypot(x + 0.5 - 36, y + 0.5 - 36) > 6))) c.px(x, y, band(e, x, y));
    } };
    disk(false);
    sphere(c, 36, 36, 15, 15, [X.out[0]]); ring(c, 36, 36, 15, 16.5, X.purple);                              // the hole and its glow
    disk(true);
    for (const ex of [27, 40]) { box(c, ex, 30, 6, 4, X.purple, { round: 1, bias: 0.3 }); dot(c, ex + 1, 30, X.gold[1]); }
    box(c, 31, 39, 11, 1, [X.purple[0]], { round: 0 });
    outline(c, X);
  }),
  B("dread", 2, C, (c, f) => {
    plane(c, [[3, 36], [15, 21], [54, 18], [69, 36], [54, 54], [15, 51]], C.steel, -0.3);                      // the hull
    plane(c, [[6, 36], [16.5, 24], [54, 21], [66, 36], [24, 36]], C.steel, 0.4); plane(c, [[16.5, 24], [54, 21], [51, 27], [19.5, 28.5]], C.steel, 0.95);
    box(c, 18, 31.5, 39, 9, C.blue, { round: 2 });                                                             // the bridge windows
    box(c, 24, 9, 15, 12, C.steel, { round: 2 }); box(c, 27, 4.5, 3, 6, C.steel, { round: 1, bias: -0.2 }); dot(c, 28, 3, f ? C.red[2] : C.red[1]); // the tower
    box(c, 24, 51, 15, 12, C.steel, { round: 2, bias: -0.2 });
    box(c, 54, 28.5, 15, 4.5, C.steel, { round: 1 }); box(c, 54, 39, 15, 4.5, C.steel, { round: 1, bias: -0.15 }); // the guns
    dot(c, 69, 30, f ? C.pale[1] : C.red[2]); dot(c, 69, 40, f ? C.red[2] : C.pale[1]);
    for (let i = 0; i < 6; i++) sphere(c, 12 + i * 7.5, 45, 1.2, 1.2, i % 2 === f ? C.pale : C.red);           // running lights
    box(c, 0, 30, 5, 5, f ? C.pale : C.red, { round: 1 }); box(c, 0, 39, 5, 5, f ? C.red : C.pale, { round: 1 }); // the engines
    sphere(c, 45, 36, 4.5, 4.5, [C.out[0]]); dot(c, 45, 36, C.red[2]);
    outline(c, C);
  }),
  B("voidheart", 3, X, (c, f) => {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * tau + 0.5, ex = 36 + Math.cos(a) * 33, ey = 36 + Math.sin(a) * 33;
      capsule(c, 36, 36, ex, ey, 1.4, X.teal, { bias: -0.2 }); sphere(c, ex, ey, 3.6, 3.6, X.purple, { spec: X.purple[3] }); } // tethers
    const r = 21 + (f === 1 ? 2.2 : f === 2 ? 0.8 : 0);
    sphere(c, 36, 36, r, r, [X.purple[0], X.red[0], X.red[1], X.red[2]], { spec: X.gold[1] });
    ring(c, 36, 36, r + 3, r + 5.5, X.teal);
    sphere(c, 36, 36, 13.5, 6.8, [X.out[0]]); sphere(c, 36, 36, 10.5, 4.5, X.purple, { bias: 0.3 }); sphere(c, 36, 36, 3, 4.5, [X.out[0]]); // an eye
    dot(c, 34, 33, X.gold[1]);
    outline(c, X);
  }),
];
