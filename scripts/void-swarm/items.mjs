// Projectiles, effects, pickups, UI icons and planets, one size up from the first drawings (shots 12, big shots and pops 24, blasts 48,
// pickups 18, icons 24, planets 96) and painted with lit shapes (scripts/lib/paint.mjs). Things that fly face right; the game turns them.
// Shots, blasts and pops are light rather than solids (glow()): the game draws them with blend "add", so they glow over the sky and each
// other. Everything here shares two colour banks, hot and cold.
import { ramp } from "../../studio/src/palette-core.js";
import { bank, sphere, capsule, box, plane, outline, dot, ring, glow, shades as pick } from "../lib/paint.mjs";

const tau = Math.PI * 2;
const shades = (hue, sat, n, opts) => pick(ramp(hue, sat, opts), n);
export const ITEM_BANKS = {
  items_hot: bank({ out: ["#140a0e"], red: shades(355, 0.75, 3, { lo: 0.24, hi: 0.64 }), orange: shades(22, 0.82, 3, { lo: 0.32, hi: 0.72 }),
    yellow: shades(46, 0.92, 3, { lo: 0.55, hi: 0.9 }), steel: shades(222, 0.12, 3, { lo: 0.24, hi: 0.8 }), white: ["#fff8ec"] }),
  items_cold: bank({ out: ["#0a0c18"], teal: shades(176, 0.62, 3, { lo: 0.3, hi: 0.82 }), blue: shades(215, 0.66, 3, { lo: 0.24, hi: 0.72 }),
    purple: shades(275, 0.55, 4, { lo: 0.14, hi: 0.76 }), steel: shades(222, 0.12, 2, { lo: 0.3, hi: 0.76 }), white: ["#f4fbff"] }),
};
const { items_hot: H, items_cold: C } = ITEM_BANKS;
const nameOf = (b) => Object.keys(ITEM_BANKS).find((k) => ITEM_BANKS[k] === b);
const I = (id, w, frames, b, draw, extra = {}) => ({ id, w, h: w, frames, bank: b, bankName: nameOf(b), draw, ...extra });
const HOT_LIGHT = [H.red[0], H.red[1], H.orange[1], H.orange[2], H.yellow[2], H.white[0]];
const COLD_LIGHT = [C.purple[0], C.blue[0], C.teal[0], C.teal[1], C.teal[2], C.white[0]];

export const PROJECTILES = [
  I("bolt", 12, 2, C, (c, f) => {
    glow(c, 6, 6, 6, 3, COLD_LIGHT.slice(1), { core: 0.3 });
    capsule(c, 4, 6, 10, 6, 1.1, [C.white[0]]);
    dot(c, f ? 1 : 2, 5, C.blue[1]); dot(c, f ? 2 : 1, 7, C.blue[1]);
  }, { glow: true }),
  I("missile", 12, 2, H, (c, f) => {
    glow(c, 2.5, 6, 2.5 + f * 0.6, 1.8, [H.red[1], H.orange[2], H.yellow[2]], { core: 0.2 });
    plane(c, [[3.5, 3], [6, 5], [3.5, 5]], H.red, 0.5); plane(c, [[3.5, 9], [6, 7], [3.5, 7]], H.red, -0.3); // fins
    capsule(c, 4, 6, 8.5, 6, 1.7, H.steel);
    plane(c, [[8.5, 4.2], [11.5, 6], [8.5, 7.8]], H.red, 0.4);
    outline(c, H);
  }),
  I("shard", 12, 4, C, (c, f) => {
    const a = (f / 4) * (Math.PI / 2), ca = Math.cos(a) * 5.2, sa = Math.sin(a) * 5.2;
    plane(c, [[6 + ca, 6 + sa], [6 - sa * 0.8, 6 + ca * 0.8], [6 - ca, 6 - sa], [6 + sa * 0.8, 6 - ca * 0.8]], [C.blue[1], C.blue[2]], -0.4);
    plane(c, [[6 + ca, 6 + sa], [6 + sa * 0.8, 6 - ca * 0.8], [6 - ca, 6 - sa]], [C.teal[2], C.white[0]], 0.2);
    dot(c, 6, 6, C.white[0]);
  }, { glow: true }),
  I("blade", 24, 4, C, (c, f) => {
    // a curved steel blade round a hub; four frames turn it a quarter, so it spins as it orbits
    const a0 = (f / 4) * (Math.PI / 2);
    for (let arm = 0; arm < 2; arm++) {
      const a = a0 + arm * Math.PI, pt = (r, da) => [12 + Math.cos(a + da) * r, 12 + Math.sin(a + da) * r];
      plane(c, [pt(3, -0.9), pt(11.1, -0.15), pt(11.4, 0.25), pt(6.8, 0.7), pt(3, 0.9)], [C.steel[0], C.steel[1]], -0.2);
      plane(c, [pt(3, -0.9), pt(11.1, -0.15), pt(6.9, -0.05)], [C.steel[1], C.white[0]], 0.6);
    }
    sphere(c, 12, 12, 3.4, 3.4, C.blue, { spec: C.white[0] });
    outline(c, C);
  }),
  I("mine", 12, 2, H, (c, f) => {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * tau; capsule(c, 6, 6, 6 + Math.cos(a) * 5.2, 6 + Math.sin(a) * 5.2, 0.6, [H.steel[1]]); }
    sphere(c, 6, 6, 3.9, 3.9, H.steel, { spec: H.white[0] });
    box(c, 5, 5.5, 2, 1.5, f ? [H.yellow[2]] : [H.red[1]], { round: 0 });
    outline(c, H);
  }),
  I("pellet", 12, 2, H, (c, f) => {
    glow(c, 6, 6, 4.5, 4.5, HOT_LIGHT.slice(1), { core: 0.25 + f * 0.1 });
  }, { glow: true }),
  I("enemy_shot", 12, 2, H, (c, f) => {
    glow(c, 6, 6, 5.5, 5.5, HOT_LIGHT.slice(0, 5), { core: 0.4 - f * 0.1 });
    sphere(c, 6, 6, 1.6, 1.6, [H.yellow[2]]);
  }, { glow: true }),
  I("enemy_shot2", 12, 2, C, (c, f) => {
    glow(c, 6, 6, 5.5, 5.5, [C.purple[0], C.purple[1], C.purple[2], C.purple[3], C.white[0]], { core: 0.4 - f * 0.1 });
    sphere(c, 6, 6, 1.6, 1.6, [C.white[0]]);
  }, { glow: true }),
  I("boss_shot", 24, 2, H, (c, f) => {
    glow(c, 12, 12, 11 + f * 0.6, 11 + f * 0.6, HOT_LIGHT, { core: 0.25 });
    ring(c, 12, 12, 9 + f, 10 + f, [H.orange[1]]);
  }, { glow: true }),
  I("ring", 96, 1, C, (c) => {
    ring(c, 48, 48, 44.5, 47.5, [C.teal[0], C.teal[1], C.teal[2]]); ring(c, 48, 48, 42, 44, [C.blue[0], C.blue[1]]);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * tau; sphere(c, 48 + Math.cos(a) * 40, 48 + Math.sin(a) * 40, 1, 1, [C.white[0]]); }
  }, { glow: true }),
  I("hole", 48, 4, C, (c, f) => {
    sphere(c, 24, 24, 22.5, 22.5, [C.purple[0], C.out[0]], { dither: false });
    for (let arm = 0; arm < 3; arm++) for (let t = 0; t < 80; t++) {
      const r = 3 + t * 0.245, a = t * 0.12 + arm * (tau / 3) + (f / 4) * (tau / 3);
      dot(c, 24 + Math.cos(a) * r, 24 + Math.sin(a) * r, t > 55 ? C.purple[1] : t > 30 ? C.purple[2] : t > 12 ? C.purple[3] : C.white[0]);
    }
    sphere(c, 24, 24, 4.5, 4.5, [C.out[0]]); ring(c, 24, 24, 21.5, 23, [C.purple[1], C.purple[2]]);
  }),
  I("meteor", 24, 2, H, (c, f) => {
    glow(c, 8, 12, 8, 4.2, [H.red[0], H.red[1], H.orange[1], H.yellow[1]], { core: 0.15 });
    dot(c, 1, f ? 9 : 15, H.orange[1]); dot(c, 3, f ? 15 : 9, H.red[2]);
    sphere(c, 15, 12, 7.5, 7.5, [H.out[0], H.steel[0], H.red[1], H.orange[1], H.orange[2]], { spec: H.yellow[2] });
    sphere(c, 13, 10, 1.8, 1.8, [H.steel[0], H.red[1]], { dither: false }); sphere(c, 18, 15, 1.4, 1.4, [H.out[0], H.steel[0]], { dither: false });
    outline(c, H);
  }),
  I("reticle", 24, 2, H, (c, f) => {
    ring(c, 12, 12, 9.8, 11.5, [f ? H.red[2] : H.red[1]]);
    for (const [x, y, w, h] of [[10.5, 0, 3, 4.5], [10.5, 19.5, 3, 4.5], [0, 10.5, 4.5, 3], [19.5, 10.5, 4.5, 3]]) box(c, x, y, w, h, [H.red[2]], { round: 0 });
    sphere(c, 12, 12, 1.2, 1.2, [H.yellow[2]]);
  }),
  I("dangerzone", 24, 2, H, (c, f) => {
    ring(c, 12, 12, 10, 11.5, [H.red[2]]); if (f) ring(c, 12, 12, 7, 8.2, [H.red[1]]);
    for (let y = 4; y < 20; y++) for (let x = 4; x < 20; x++) if (Math.hypot(x + 0.5 - 12, y + 0.5 - 12) < 6.5 && (x + y + f) % 2 === 0) dot(c, x, y, H.red[0]);
  }),
];

export const FX = [
  I("boom", 48, 5, H, (c, f) => {
    const r = [9, 16.5, 21, 22.5, 22.5][f];
    const fade = [[H.yellow[2], H.white[0]], [H.orange[1], H.orange[2], H.yellow[2], H.white[0]], HOT_LIGHT.slice(0, 5), [H.red[0], H.red[1], H.orange[1]]][f];
    if (f < 4) glow(c, 24, 24, r, r, fade, { core: [0.5, 0.3, 0.2, 0.1][f] });
    else for (let i = 0; i < 12; i++) { const a = (i / 12) * tau; sphere(c, 24 + Math.cos(a) * 20, 24 + Math.sin(a) * 20, 1.2, 1.2, [i % 2 ? H.orange[0] : H.red[0]]); dot(c, 24 + Math.cos(a + 0.3) * 15, 24 + Math.sin(a + 0.3) * 15, H.steel[0]); }
    if (f > 1 && f < 4) for (let i = 0; i < 8; i++) { const a = (i / 8) * tau + f; sphere(c, 24 + Math.cos(a) * (r + 1), 24 + Math.sin(a) * (r + 1), 0.9, 0.9, [H.yellow[1]]); }
  }, { glow: true }),
  I("spark", 12, 3, H, (c, f) => {
    if (f === 0) glow(c, 6, 6, 3, 3, [H.yellow[1], H.white[0]], { core: 0.4 });
    else if (f === 1) { for (const [x, y] of [[2, 2], [9, 2], [2, 9], [9, 9]]) dot(c, x, y, H.yellow[2]); capsule(c, 4.5, 4.5, 7.5, 7.5, 0.9, [H.white[0]]); capsule(c, 7.5, 4.5, 4.5, 7.5, 0.6, [H.yellow[1]]); }
    else { for (const [x, y] of [[0, 0], [11, 0], [0, 11], [11, 11]]) dot(c, x, y, H.orange[1]); dot(c, 5, 0, H.yellow[1]); dot(c, 0, 6, H.yellow[1]); dot(c, 11, 5, H.orange[2]); }
  }, { glow: true }),
  I("puff", 12, 3, H, (c, f) => {
    const r = [2.2, 3.7, 5.1][f];
    sphere(c, 6, 6, r, r, f === 2 ? H.steel.slice(0, 2) : H.steel.slice(1), { dither: false });
  }),
  I("pop", 24, 4, C, (c, f) => {
    const r = [4.5, 7.5, 10.5, 11.3][f], th = f === 3 ? 1.5 : 3;
    ring(c, 12, 12, r - th, r, f < 2 ? [C.teal[2], C.white[0]] : [C.teal[0], C.teal[1]]);
    if (f > 0) for (let i = 0; i < 6; i++) { const a = (i / 6) * tau + 0.4; sphere(c, 12 + Math.cos(a) * (r + 0.6), 12 + Math.sin(a) * (r + 0.6), 0.9, 0.9, [C.teal[2]]); }
  }, { glow: true }),
];

// 18x18: easy to spot in a crowd at a glance
export const PICKUPS = [
  I("gem", 18, 6, C, (c, f) => {
    // small, medium and large experience gems, each with a sparkle frame
    const kind = f >> 1, tw = f & 1, rmp = [C.teal, C.blue, C.purple.slice(1)][kind], r = [5.4, 6.9, 8.4][kind];
    plane(c, [[9, 9 - r], [9 + r * 0.8, 9], [9, 9 + r], [9 - r * 0.8, 9]], rmp, -0.5);
    plane(c, [[9, 9 - r], [9, 9 + r], [9 - r * 0.8, 9]], rmp, 0.3);
    plane(c, [[9, 9 - r], [9 - r * 0.8, 9], [9 - r * 0.25, 9 - r * 0.2]], rmp, 1);
    if (tw) { const x = Math.round(9 + r * 0.5), y = Math.round(9 - r * 0.6); dot(c, x, y, C.white[0]); dot(c, x + 1, y, rmp[2]); dot(c, x, y - 1, rmp[2]); dot(c, x - 1, y, rmp[2]); }
    outline(c, C);
  }),
  I("coin", 18, 4, H, (c, f) => {
    const w = [6.9, 4.5, 1.8, 4.5][f]; // spinning: full face, turning, edge on, turning back
    sphere(c, 9, 9, w, 7.5, [H.orange[1], H.yellow[0], H.yellow[1], H.yellow[2]], { spec: H.white[0] });
    if (w > 3) { sphere(c, 9, 9, w - 2, 5.4, [H.yellow[0], H.yellow[1], H.yellow[2]], { bias: -0.2, dither: false }); box(c, 8, 5.5, 2, 7, [H.yellow[2]], { round: 0 }); }
    outline(c, H);
  }),
  I("heart", 18, 2, H, (c, f) => {
    const k = f ? 0.6 : 0; // a slow beat
    plane(c, [[2 - k, 8.2], [16 + k, 8.2], [9, 16.2 + k]], H.red, -0.2);
    sphere(c, 5.8 - k * 0.4, 6.8, 4.2 + k, 4.2 + k, H.red); sphere(c, 12.2 + k * 0.4, 6.8, 4.2 + k, 4.2 + k, H.red, { bias: -0.1 });
    box(c, 4, 4, 3, 2, [H.white[0]], { round: 0 });
    outline(c, H);
  }),
  I("magnet", 18, 2, H, (c, f) => {
    // a U with a wide gap (the outline must not close it), steel tips, and a spark between them
    box(c, 1.5, 4.5, 5, 8, H.red, { round: 1 }); box(c, 11.5, 4.5, 5, 8, H.red, { round: 1, bias: -0.15 }); box(c, 1.5, 10.5, 15, 5, H.red, { round: 2 });
    box(c, 1.5, 1.5, 5, 3.5, H.steel, { round: 1 }); box(c, 11.5, 1.5, 5, 3.5, H.steel, { round: 1, bias: -0.15 });
    outline(c, H);
    if (f) { dot(c, 8, 3, H.yellow[2]); dot(c, 9, 4, H.white[0]); dot(c, 9, 2, H.yellow[1]); }
  }),
  I("bomb", 18, 2, H, (c, f) => {
    capsule(c, 11, 4, 13.5, 1.5, 0.8, [H.orange[1]]);
    box(c, 8, 2.5, 4, 3.5, H.steel, { round: 1 });
    sphere(c, 8.2, 10.5, 6.6, 6.6, H.steel, { spec: H.white[0] });
    outline(c, H);
    dot(c, 15, 0, f ? H.yellow[2] : H.orange[2]); dot(c, 14, 0, f ? H.white[0] : H.yellow[1]); if (f) dot(c, 15, 1, H.orange[2]);
  }),
];

// UI icons, 24x24 (the lock, star, arrow and cursor stay small: they only mark things), one frame. Each sits on a dark round badge.
const badge = (c, rmp) => { sphere(c, 12, 12, 11.2, 11.2, [rmp[0], rmp[1]], { dither: false }); ring(c, 12, 12, 10, 11.2, [rmp[1], rmp[rmp.length - 1]]); };
const icon = (id, b, base, draw) => I(id, 24, 1, b, (c) => { badge(c, base); draw(c); outline(c, b); });
const S = 1.5; // the old 16x16 icon coordinates, one size up
const P = (pts) => pts.map(([x, y]) => [x * S, y * S]);
const bx = (c, x, y, w, h, rmp, o) => box(c, x * S, y * S, w * S, h * S, rmp, { round: 1, ...o });
const ball = (c, x, y, r, rmp, o) => sphere(c, x * S, y * S, r * S, r * S, rmp, o);
const rim = (c, x, y, r0, r1, rmp) => ring(c, x * S, y * S, r0 * S, r1 * S, rmp);
const bar = (c, x0, y0, x1, y1, w, rmp) => capsule(c, x0 * S, y0 * S, x1 * S, y1 * S, w, rmp);
const WH = [C.white[0]], WHH = [H.white[0]];
export const ICONS = [
  icon("w_pulse", C, C.teal, (c) => { capsule(c, 5, 12, 14, 12, 1.6, [C.teal[1], C.teal[2]]); bx(c, 9, 6, 3, 4, [C.teal[2], C.white[0]]); glow(c, 18, 12, 2.6, 2.6, [C.teal[2], C.white[0]]); }),
  icon("w_shards", C, C.blue, (c) => { rim(c, 8, 8, 4.4, 5, [C.blue[2]]); for (const [x, y] of [[8, 3], [13, 8], [8, 13], [3, 8]]) ball(c, x, y, 1.6, [C.teal[1], C.teal[2]]); ball(c, 8, 8, 1.6, WH); }),
  icon("w_nova", C, C.purple, (c) => { rim(c, 8, 8, 5.2, 6, [C.purple[3]]); rim(c, 8, 8, 2.8, 3.6, WH); ball(c, 8, 8, 1, [C.teal[2]]); }),
  icon("w_missiles", H, H.red, (c) => { for (const [y, x] of [[9, 3], [5, 5]]) { plane(c, P([[x + 7, y], [x + 10, y + 1], [x + 7, y + 2]]), H.red, 0.5); bx(c, x, y, 7, 2, H.steel, { round: 1 }); bx(c, x - 2, y + 0.5, 2, 1, [H.yellow[2]], { round: 0 }); } }),
  icon("w_arc", H, H.orange, (c) => { plane(c, P([[9, 1.5], [4, 9], [7.5, 9], [6, 14.5], [12, 6.5], [8.5, 6.5]]), [H.yellow[1], H.yellow[2]], 0.3); plane(c, P([[8.5, 3.5], [6, 8], [8, 8]]), WHH, 0); }),
  icon("w_lance", C, C.teal, (c) => { capsule(c, 3, 12, 21, 12, 1.7, [C.teal[2], C.white[0]]); glow(c, 4.5, 12, 3.2, 3.2, [C.teal[1], C.teal[2], C.white[0]]); }),
  icon("w_mines", H, H.orange, (c) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * tau; bar(c, 8, 8, 8 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 0.7, [H.steel[2]]); } ball(c, 8, 8, 3.2, H.steel, { spec: H.white[0] }); bx(c, 7.5, 7.5, 1.5, 1, [H.red[2]], { round: 0 }); }),
  icon("w_well", C, C.purple, (c) => { for (let t = 0; t < 60; t++) { const r = (1.5 + t * 0.09) * S, a = t * 0.2; dot(c, 12 + Math.cos(a) * r, 12 + Math.sin(a) * r, t > 38 ? C.purple[2] : C.purple[3]); } ball(c, 8, 8, 1.8, [C.out[0]]); }),
  icon("w_scatter", H, H.orange, (c) => { for (const [x, y] of [[11, 4], [12, 8], [11, 12], [8, 6], [8, 10]]) ball(c, x, y, 1.2, [H.yellow[1], H.yellow[2]]); bx(c, 2, 7, 4, 2, H.steel, { round: 1 }); }),
  icon("w_comet", H, H.orange, (c) => { glow(c, 9, 9, 7.5, 3.2, [H.red[1], H.orange[1], H.orange[2]]); ball(c, 11, 10, 3, [H.orange[2], H.yellow[1], H.yellow[2]], { spec: H.white[0] }); dot(c, 18, 4, H.white[0]); }),
  icon("p_power", H, H.red, (c) => { bx(c, 6, 3, 4, 10, [H.yellow[1], H.yellow[2]], { round: 0 }); bx(c, 3, 6, 10, 4, [H.yellow[1], H.yellow[2]], { round: 0 }); bx(c, 7, 4, 2, 8, WHH, { round: 0 }); }),
  icon("p_haste", C, C.blue, (c) => { rim(c, 8, 8, 4.3, 5.1, WH); bar(c, 8, 8, 8, 4.5, 0.8, WH); bar(c, 8, 8, 10.8, 9, 0.8, [C.teal[2]]); }),
  icon("p_reach", C, C.teal, (c) => { rim(c, 8, 8, 3.8, 5.2, [C.teal[2]]); ball(c, 8, 8, 0.9, WH); for (const [x, y] of [[8, 1.8], [8, 14.2], [1.8, 8], [14.2, 8]]) ball(c, x, y, 0.9, WH); }),
  icon("p_thrust", H, H.orange, (c) => { glow(c, 4, 12, 4, 2.6, [H.orange[1], H.yellow[1], H.white[0]]); plane(c, P([[4, 4], [13.5, 8], [4, 12], [6, 8]]), H.steel, 0.3); }),
  icon("p_plating", C, C.steel, (c) => { plane(c, P([[8, 2], [13, 4], [13, 9], [8, 14], [3, 9], [3, 4]]), [C.steel[1], C.white[0]], 0.2); plane(c, P([[8, 4], [11, 5], [11, 9], [8, 12], [5, 9], [5, 5]]), C.blue, 0.1); bx(c, 7.3, 5, 1.4, 6, WH, { round: 0 }); }),
  icon("p_magnet", H, H.steel, (c) => { bx(c, 3, 3, 3, 8, H.red); bx(c, 10, 3, 3, 8, H.red, { bias: -0.15 }); bx(c, 3, 10, 10, 3, H.red); bx(c, 3, 2.5, 3, 2, WHH, { round: 0 }); bx(c, 10, 2.5, 3, 2, WHH, { round: 0 }); }),
  icon("p_repair", C, C.teal, (c) => { bx(c, 6.8, 3, 2.4, 10, [C.teal[2], C.white[0]], { round: 0 }); bx(c, 3, 6.8, 10, 2.4, [C.teal[2], C.white[0]], { round: 0 }); }),
  icon("p_scholar", C, C.blue, (c) => { plane(c, P([[8, 3], [14, 8], [8, 13], [2, 8]]), C.teal, -0.3); plane(c, P([[8, 3], [8, 13], [2, 8]]), C.teal, 0.7); dot(c, 9, 10, C.white[0]); dot(c, 10, 9, C.white[0]); }),
  icon("s_hull", H, H.red, (c) => { plane(c, P([[8, 2], [13, 4], [13, 9], [8, 14], [3, 9], [3, 4]]), H.red, 0.6); plane(c, P([[8, 4], [11, 5], [11, 9], [8, 12], [5, 9], [5, 5]]), H.red, -0.2); bx(c, 6.5, 5.5, 1.5, 2, WHH, { round: 0 }); }),
  icon("s_engine", H, H.orange, (c) => { plane(c, P([[3, 5], [10, 5], [14, 8], [10, 11], [3, 11]]), H.steel, 0.2); glow(c, 3.5, 12, 3, 4.5, [H.orange[2], H.yellow[2], H.white[0]]); bx(c, 5, 7, 5, 2, [H.yellow[1], H.yellow[2]], { round: 0 }); }),
  icon("s_tactics", C, C.teal, (c) => { rim(c, 8, 8, 4.8, 5.6, WH); for (const [x, y, w, h] of [[7.2, 1.5, 1.6, 3.5], [7.2, 11, 1.6, 3.5], [1.5, 7.2, 3.5, 1.6], [11, 7.2, 3.5, 1.6]]) bx(c, x, y, w, h, WH, { round: 0 }); ball(c, 8, 8, 0.9, [C.purple[3]]); }),
  icon("s_salvage", H, H.orange, (c) => { sphere(c, 12, 12, 6.8, 7.5, [H.yellow[0], H.yellow[1], H.yellow[2]], { spec: H.white[0] }); box(c, 11, 8, 2, 8, [H.yellow[0]], { round: 0 }); }),
  I("lock", 16, 1, H, (c) => { ring(c, 8, 6.5, 2.5, 4, H.steel); box(c, 3.5, 7, 9, 7, H.steel, { round: 1 }); box(c, 7, 9, 2, 3, [H.out[0]], { round: 0 }); outline(c, H); }),
  I("star", 16, 1, H, (c) => { plane(c, [[8, 1], [10, 6], [15, 6], [11, 9.5], [12.5, 15], [8, 11.5], [3.5, 15], [5, 9.5], [1, 6], [6, 6]], H.yellow, -0.2); plane(c, [[8, 1], [10, 6], [8, 8.5], [6, 6]], H.yellow, 1); plane(c, [[1, 6], [6, 6], [8, 8.5], [5, 9.5]], H.yellow, 0.6); outline(c, H); }),
  I("arrow", 8, 2, H, (c, f) => { plane(c, [[0.5, 0.5], [7.5, 4], [0.5, 7.5], [2.5, 4]], f ? [H.red[2]] : [H.red[1]], 0); dot(c, 3, 4, H.white[0]); outline(c, H); }),
  I("cursor", 8, 2, H, (c, f) => { plane(c, [[1 + f, 0], [7 + f, 4], [1 + f, 8]], [H.yellow[2]], 0); plane(c, [[1 + f, 1.5], [5 + f, 4], [1 + f, 6.5]], [H.yellow[1]], 0); outline(c, H, { dark: true }); }),
];

export const PLANETS = [
  I("planet_a", 96, 1, C, (c) => {
    // a ringed blue world: the ring's far half, the planet, then the near half across its face
    const band = (front) => { for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      const dx = (x + 0.5 - 48) / 46.5, dy = (y + 0.5 - 48) / 12, e = dx * dx + dy * dy;
      if (e > 1 || e < 0.55 || (front ? y < 48 : y >= 48 && Math.hypot(x + 0.5 - 48, y + 0.5 - 48) < 30)) continue;
      dot(c, x, y, e > 0.8 ? (x < 48 ? C.blue[2] : C.blue[1]) : x < 48 ? C.teal[1] : C.blue[2]);
    } };
    band(false);
    sphere(c, 48, 48, 30, 30, [C.out[0], C.blue[0], C.blue[1], C.teal[0], C.teal[1], C.teal[2]], { spec: C.white[0] });
    for (let y = 20; y < 78; y += 7) for (let x = 18; x < 78; x++) if (c.get(x, y) >= 0 && Math.sin(x * 0.2 + y) > 0.3) { const v = c.get(x, y); dot(c, x, y, v === C.teal[2] ? C.white[0] : v === C.teal[1] ? C.teal[2] : v === C.teal[0] ? C.teal[1] : v); } // cloud bands
    band(true);
  }),
  I("planet_b", 96, 1, H, (c) => {
    sphere(c, 48, 48, 42, 42, [H.out[0], H.red[0], H.red[1], H.orange[0], H.orange[1], H.orange[2]], { spec: H.yellow[1] });
    for (const [x, y, r] of [[30, 33, 7.5], [60, 27, 4.5], [66, 60, 9], [36, 66, 6], [51, 48, 3.8]]) { sphere(c, x, y, r, r, [H.red[0], H.red[1]], { dither: false }); sphere(c, x + 1, y + 1, r - 1.8, r - 1.8, [H.red[0]], { dither: false }); } // craters
  }),
];
