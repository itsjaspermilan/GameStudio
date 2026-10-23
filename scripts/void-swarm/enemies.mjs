// The 24 ordinary enemies, painted with lit shapes (scripts/lib/paint.mjs) one size up from the first drawings: the small ones 24x24,
// the big ones (rockling, hive, spore, reaper, golem) 48x48, the splitling 16x16. Everything faces right (the game mirrors it when they
// walk left). They share four colour banks by family, so the whole swarm fits the console's 16 sprite banks with the pilots and bosses.
import { ramp } from "../../studio/src/palette-core.js";
import { bank, sphere, capsule, box, plane, outline, dot, shades as pick } from "../lib/paint.mjs";

const tau = Math.PI * 2;
const sin = (f, n, a = 1, p = 0) => Math.sin((f / n) * tau + p) * a;
const shades = (hue, sat, n, opts) => pick(ramp(hue, sat, opts), n);

export const ENEMY_BANKS = {
  fire: bank({ out: ["#1a0c10"], red: shades(355, 0.72, 4, { lo: 0.2, hi: 0.66 }), orange: shades(24, 0.8, 4, { lo: 0.24, hi: 0.76 }),
    yellow: shades(48, 0.9, 4, { lo: 0.42, hi: 0.92 }), steel: shades(220, 0.14, 2, { lo: 0.4, hi: 0.86 }) }),
  toxic: bank({ out: ["#0c140e"], green: shades(110, 0.55, 5, { lo: 0.14, hi: 0.78 }), yellow: shades(52, 0.8, 3, { lo: 0.45, hi: 0.9 }),
    red: shades(355, 0.7, 3, { lo: 0.25, hi: 0.62 }), steel: shades(215, 0.1, 3, { lo: 0.3, hi: 0.95 }) }),
  void: bank({ out: ["#120a1a"], purple: shades(275, 0.5, 5, { lo: 0.12, hi: 0.74 }), red: shades(350, 0.72, 4, { lo: 0.22, hi: 0.68 }),
    pale: ["#f0d880", "#fff6ea"], steel: shades(230, 0.1, 3, { lo: 0.22, hi: 0.78 }) }),
  cold: bank({ out: ["#0a121a"], teal: shades(178, 0.55, 4, { lo: 0.2, hi: 0.82 }), blue: shades(218, 0.6, 4, { lo: 0.18, hi: 0.72 }),
    steel: shades(220, 0.12, 4, { lo: 0.2, hi: 0.94 }), red: shades(355, 0.75, 2, { lo: 0.4, hi: 0.68 }) }),
};
const { fire: F, toxic: T, void: V, cold: C } = ENEMY_BANKS;
const nameOf = (b) => Object.keys(ENEMY_BANKS).find((k) => ENEMY_BANKS[k] === b);
const E = (id, size, frames, b, draw) => ({ id, w: size, h: size, frames, bank: b, bankName: nameOf(b), draw });
// an eye: a white ball with a dark pupil looking right and a glint
const eye = (c, x, y, r, white, pupil, glint) => { sphere(c, x, y, r, r, white); sphere(c, x + r * 0.35, y + r * 0.15, r * 0.55, r * 0.55, pupil); if (glint) dot(c, Math.round(x - r * 0.3), Math.round(y - r * 0.4), glint); };

export const ENEMIES = [
  E("grub", 24, 2, T, (c, f) => {
    const sq = f ? 1.2 : 0;
    for (const x of [6, 15]) box(c, x, 18, 3, 3, T.green, { round: 1, bias: -0.2 });                     // feet
    sphere(c, 12, 13.5 + sq, 9.2, 7.8 - sq, T.green, { spec: T.green[4] });
    eye(c, 12, 12 + sq, 3.8, T.steel, T.red, T.steel[2]);
    outline(c, T);
  }),
  E("gnat", 24, 2, F, (c, f) => {
    const up = f === 0;
    for (const [x0, x1, y1] of [[8, 4, up ? 4 : 18], [9, 12, up ? 4 : 18], [10, 14, up ? 6 : 16]]) capsule(c, x0, 12, x1, y1, 1.3, F.steel, { bias: 0.15 }); // wings
    sphere(c, 12, 13.5, 6.8, 4.6, F.red, { spec: F.red[3] });
    sphere(c, 18, 13, 2.6, 2.6, F.orange); dot(c, 19, 12, F.out[0]);                                   // head
    capsule(c, 3, 14, 6, 14, 1, F.red, { bias: -0.2 }); dot(c, 21, 14, F.yellow[3]);                    // tail, stinger
    outline(c, F);
  }),
  E("rockling", 48, 4, F, (c, f) => {
    // a boulder on stubby legs: four steps, the fists swing against the legs
    const st = [0, 1.5, 0, -1.5][f], bob = f % 2 ? 0 : 1.5;
    box(c, 13, 34 - Math.max(0, st), 8, 10 + Math.max(0, st), F.steel, { round: 2 }); box(c, 27, 34 - Math.max(0, -st), 8, 10 + Math.max(0, -st), F.steel, { round: 2, bias: -0.15 });
    box(c, 12 + st, 43, 11, 4, F.steel, { round: 1 }); box(c, 26 - st, 43, 11, 4, F.steel, { round: 1, bias: -0.1 });
    sphere(c, 6, 30 + bob - st, 5.2, 5.2, F.orange, { bias: -0.1 }); sphere(c, 42, 30 + bob + st, 5.2, 5.2, F.orange, { bias: -0.15 }); // fists
    sphere(c, 24, 22.5 + bob, 17, 16.5, F.orange, { spec: F.orange[3] });
    for (const [x, y, r] of [[13, 12, 2.4], [33, 30, 3.2], [15, 31, 2], [36, 13, 1.8], [24, 37, 1.8]]) sphere(c, x, y + bob, r, r, F.orange, { bias: -0.35 }); // craters
    for (const ex of [16, 29]) { box(c, ex - 1, 17 + bob, 8, 5, [F.out[0]], { round: 1 }); box(c, ex, 17 + bob, 5, 3, F.yellow, { round: 1 }); dot(c, ex + 1, 17 + bob, F.yellow[3]); }
    box(c, 14, 15 + bob, 9, 2, F.orange, { round: 1, bias: -0.4 }); box(c, 27, 15 + bob, 9, 2, F.orange, { round: 1, bias: -0.4 }); // brows
    box(c, 18, 28 + bob, 13, 3, [F.out[0]], { round: 1 }); for (const tx of [20, 24, 28]) dot(c, tx, 28 + bob, F.steel[1]);
    outline(c, F);
  }),
  E("jelly", 24, 4, C, (c, f) => {
    for (let i = 0; i < 4; i++) { const x = 6 + i * 4; capsule(c, x, 13, x + sin(f, 4, 1.8, i), 22, 1, C.teal, { bias: i % 2 ? -0.1 : 0.1 }); } // tentacles
    sphere(c, 12, 10.5, 8.5, 7.5 + sin(f, 4, 0.7), C.teal, { spec: C.teal[3] });
    box(c, 3, 12, 18, 3, C.teal, { round: 1, bias: -0.25 });
    eye(c, 9, 9, 1.8, C.steel, [C.out[0]]); eye(c, 15, 9, 1.8, C.steel, [C.out[0]]);
    outline(c, C);
  }),
  E("ringdrone", 24, 4, C, (c, f) => {
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { const d = Math.hypot(x + 0.5 - 12, y + 0.5 - 12); if (d < 10.5 && d > 7.5) { const top = x + y < 22; c.px(x, y, d > 9.5 ? C.blue[top ? 1 : 0] : top ? C.blue[3] : C.blue[2]); } }
    for (let i = 0; i < 4; i++) { const a = (f / 4) * (tau / 4) + i * (tau / 4); capsule(c, 12 + Math.cos(a) * 3, 12 + Math.sin(a) * 3, 12 + Math.cos(a) * 8, 12 + Math.sin(a) * 8, 0.8, C.blue); }
    sphere(c, 12, 12, 3.8, 3.8, C.teal, { spec: C.steel[3] });
    outline(c, C);
  }),
  E("rammer", 24, 2, F, (c, f) => {
    plane(c, [[2, 4], [15, 7], [23, 12], [15, 17], [2, 20], [6, 12]], F.red, 0);                          // the hull
    plane(c, [[4, 7], [15, 9], [19, 12], [8, 12]], F.red, 0.8);
    plane(c, [[21, 12], [15, 9.5], [15, 14.5]], F.steel, 0.6);                                           // the ram
    box(c, 9, 10, 5, 3, F.yellow, { round: 1 }); dot(c, 10, 10, F.yellow[3]);
    plane(c, [[2, 5], [6, 9], [2, 9]], F.steel, 0.4); plane(c, [[2, 19], [6, 15], [2, 15]], F.steel, -0.3);
    if (f) box(c, 0, 10, 3, 4, F.yellow, { round: 1 }); else { dot(c, 0, 12, F.yellow[3]); dot(c, 1, 11, F.orange[3]); } // thrust
    outline(c, F);
  }),
  E("saucer", 24, 3, C, (c, f) => {
    sphere(c, 12, 8, 5.4, 5, C.teal, { spec: C.steel[3] }); dot(c, 12, 8, C.out[0]); dot(c, 14, 8, C.out[0]); // dome and pilot
    sphere(c, 12, 14.5, 11, 4.4, C.steel, { spec: C.steel[3] });
    for (let i = 0; i < 3; i++) sphere(c, 6 + i * 6, 15.5, 1.2, 1.2, i === f ? C.red : [C.steel[0]]);
    box(c, 9, 18, 6, 2, C.steel, { round: 1, bias: -0.3 }); dot(c, 12, 20, C.red[1]);
    outline(c, C);
  }),
  E("amoeba", 24, 2, V, (c, f) => {
    const s = f ? 1 : 0;
    sphere(c, 12, 13, 9.5 - s, 9 + s, V.purple, { spec: V.purple[4] });
    sphere(c, 9, 12, 2.7, 2.7, V.purple, { bias: 0.35 }); sphere(c, 15.5, 15, 2.1, 2.1, V.purple, { bias: 0.35 }); // nuclei
    dot(c, 9, 12, V.red[2]); dot(c, 15, 15, V.red[2]);
    outline(c, V);
  }),
  E("splitling", 16, 2, V, (c, f) => {
    sphere(c, 8, 9, 5.2 - f * 0.5, 4.6 + f * 0.5, V.purple, { spec: V.purple[4] });
    dot(c, 6, 8, V.pale[1]); dot(c, 10, 8, V.pale[1]); dot(c, 6, 9, V.out[0]); dot(c, 10, 9, V.out[0]);
    outline(c, V);
  }),
  E("boomer", 24, 4, F, (c, f) => {
    const armed = f >= 2, lit = armed && f === 3;
    sphere(c, 12, 13.5, 9, 9, lit ? F.yellow : F.orange, { spec: lit ? F.yellow[3] : F.orange[3] });
    for (const [x0, y0, x1, y1] of [[7, 10, 12, 15], [12, 15, 10, 20], [17, 9, 13, 12]]) capsule(c, x0, y0, x1, y1, 0.7, lit ? F.red : [F.orange[0]]); // cracks
    box(c, 10, 1, 4, 4, F.steel, { round: 1 }); dot(c, 12, 0, armed ? (lit ? F.steel[1] : F.yellow[3]) : F.red[2]);
    if (armed) { dot(c, 9, 0, F.yellow[3]); dot(c, 15, 1, F.orange[3]); }                                // the fuse sparks
    for (const ex of [8, 14]) { box(c, ex, 12, 3, 3, [F.out[0]], { round: 0 }); dot(c, ex, 12, armed ? F.yellow[3] : F.red[2]); }
    outline(c, F);
  }),
  E("imp", 24, 2, V, (c, f) => {
    const w = f ? 3 : 0;
    plane(c, [[2, 6 + w], [9, 10], [9, 16], [3, 18 - w]], V.purple, 0.2); plane(c, [[22, 6 + w], [15, 10], [15, 16], [21, 18 - w]], V.purple, -0.3); // wings
    sphere(c, 12, 12, 6, 6, V.red, { spec: V.red[3] });
    plane(c, [[7, 3], [9, 7], [6, 7]], V.red, 0.5); plane(c, [[17, 3], [18, 7], [15, 7]], V.red, 0);    // horns
    box(c, 8, 10, 3, 2, V.pale, { round: 0 }); box(c, 13, 10, 3, 2, V.pale, { round: 0 });              // eyes
    box(c, 9, 15, 6, 2, [V.out[0]], { round: 0 }); dot(c, 9, 15, V.pale[1]); dot(c, 14, 15, V.pale[1]); // a grin
    capsule(c, 12, 18, 13, 22, 1.2, V.red, { bias: -0.1 });                                              // tail
    outline(c, V);
  }),
  E("medic", 24, 2, T, (c, f) => {
    sphere(c, 12, 13.5, 8.3, 8.3, T.steel, { spec: T.steel[2] });
    box(c, 10, 8, 4, 11, T.green, { round: 1, bias: 0.25 }); box(c, 7, 11, 10, 4, T.green, { round: 1, bias: 0.25 }); // the cross
    box(c, f ? 4 : 6, 2, f ? 16 : 12, 2, T.steel, { round: 1 }); box(c, 11, 4, 2, 2, T.steel, { round: 0, bias: -0.3 }); // spinning rotor
    dot(c, 3, 18, T.green[3]); dot(c, 20, 20, T.green[4]);                                              // healing sparkles
    outline(c, T);
  }),
  E("hive", 48, 3, F, (c, f) => {
    sphere(c, 24, 24, 19.5, 20, [F.orange[0], F.orange[1], F.orange[2], F.yellow[1], F.yellow[2]], { spec: F.yellow[3] });
    for (let y = 9; y < 42; y += 7) for (let x = 4; x < 45; x++) if (c.get(x, y) >= 0) c.px(x, y, F.orange[0]); // comb rings
    const holes = [[15, 16], [32, 16], [24, 27], [13, 32], [35, 32], [23, 10]];
    holes.forEach(([x, y], i) => {
      sphere(c, x, y, 4, 4, [F.out[0]]); sphere(c, x, y + 0.8, 2.6, 2.6, [F.orange[0]]);
      const lit = i % 3 === f;
      sphere(c, x + 0.5, y, 1.5, 1.5, lit ? F.yellow : [F.red[0], F.red[1]]);                            // a bug peeks out
      if (lit) { dot(c, x - 1, y - 3, F.yellow[3]); dot(c, x + 2, y - 3, F.yellow[3]); }
    });
    box(c, 19, 42, 10, 5, F.orange, { round: 1, bias: -0.2 }); box(c, 13, 4, 5, 3, F.yellow, { round: 1 });
    outline(c, F);
  }),
  E("minelayer", 24, 2, T, (c, f) => {
    plane(c, [[3, 7], [18, 9], [21, 12], [18, 15], [3, 17]], T.green, 0); plane(c, [[4, 9], [17, 10], [18, 12], [4, 12]], T.green, 0.8);
    box(c, 6, 12, 9, 5, T.steel, { round: 1 }); box(c, 7, 15, 7, 3, T.steel, { round: 1, bias: -0.2 });
    sphere(c, 10.5, 19.5, 2.4, 2.4, [T.out[0], T.steel[0]]); dot(c, 10, 19, f ? T.red[2] : T.red[0]);   // the mine
    box(c, 15, 9, 3, 3, T.yellow, { round: 1 });
    box(c, 0, 9, 4, 1, T.yellow, { round: 0 }); box(c, 0, 15, 4, 1, f ? T.yellow : T.red, { round: 0 });
    outline(c, T);
  }),
  E("wraith", 24, 3, C, (c, f) => {
    sphere(c, 12, 9.5, 8.2, 7.5, C.teal, { bias: 0.3, spec: C.steel[3] }); box(c, 4, 10, 16, 8, C.teal, { round: 2, bias: 0.2 });
    for (let i = 0; i < 5; i++) box(c, 4 + i * 3.3, 17, 3, 3 + ((i + f) % 3), C.teal, { round: 1, bias: 0.1 }); // a ragged hem
    sphere(c, 9, 9, 2, 3, [C.blue[0]]); sphere(c, 15.5, 9, 2, 3, [C.blue[0]]); dot(c, 9, 9, C.blue[3]); dot(c, 15, 9, C.blue[3]);
    sphere(c, 12.5, 15, 2.2, 1.8, [C.blue[0]]);                                                          // a moan
    outline(c, C);
  }),
  E("comet", 24, 3, F, (c, f) => {
    plane(c, [[0, 12 - (f % 2)], [15, 6], [15, 18]], F.orange, 0); plane(c, [[3, 12], [15, 8], [15, 16]], F.orange, 0.7); // the tail
    capsule(c, 0, 9 + f, 12, 9, 0.8, F.red); capsule(c, 0, 15 - f, 12, 15, 0.8, F.red);
    sphere(c, 16.5, 12, 6.3, 6.3, F.yellow, { spec: F.steel[1] });
    outline(c, F);
  }),
  E("leech", 24, 4, F, (c, f) => {
    for (let i = 6; i >= 0; i--) { const x = 2 + i * 2.7, y = 13.5 + sin(f, 4, 3, i * 0.9); sphere(c, x + 1.5, y, 3.6 - i * 0.18, 3.6 - i * 0.18, F.red, { bias: i % 2 ? -0.1 : 0.05 }); }
    const hy = 12 + sin(f, 4, 1.5, 0);
    sphere(c, 21, hy, 3.9, 3.9, F.red, { spec: F.red[3] }); box(c, 18, hy, 6, 2, [F.out[0]], { round: 0 }); // a sucker mouth
    dot(c, 19, hy + 1, F.steel[1]); dot(c, 22, hy + 1, F.steel[1]); dot(c, 20, hy - 3, F.yellow[3]);
    outline(c, F);
  }),
  E("sentinel", 24, 2, C, (c, f) => {
    box(c, 9, 13, 6, 9, C.steel, { round: 2 }); box(c, 6, 20, 12, 3, C.steel, { round: 1, bias: -0.1 });
    box(c, 3, 8, 3, 4, C.steel, { round: 1, bias: -0.1 }); box(c, 18, 8, 3, 4, C.steel, { round: 1, bias: -0.2 });
    sphere(c, 12, 9, 6.9, 6.9, C.steel, { edge: true });
    sphere(c, 12, 9, 3.6, 3.6, [C.red[0], C.red[1]], { spec: f ? C.steel[3] : C.red[1] });               // the eye, blinking
    capsule(c, 12, 0.5, 12, 2, 0.6, C.steel); dot(c, 12, 0, f ? C.red[1] : C.teal[3]);
    outline(c, C);
  }),
  E("knight", 24, 2, C, (c, f) => {
    const b = f ? 1 : 0;
    box(c, 7, 16, 3, 5 - b, C.blue, { round: 1, bias: -0.2 }); box(c, 13, 16, 3, 4 + b, C.blue, { round: 1, bias: -0.2 }); box(c, 6, 21 - b, 5, 2, C.steel, { round: 1 });
    box(c, 7, 9 + b, 11, 9, C.blue, { round: 3 });                                                        // armour
    sphere(c, 12, 6 + b, 5.4, 5.4, C.steel, { edge: true }); box(c, 9, 6 + b, 8, 2, [C.out[0]], { round: 0 });
    dot(c, 11, 6 + b, C.red[1]); dot(c, 15, 6 + b, C.red[1]); box(c, 11, 0 + b, 3, 2, C.red, { round: 1 }); // eyes, plume
    plane(c, [[0, 9 + b], [7, 8 + b], [7, 20 + b], [3, 21 + b], [0, 17 + b]], C.steel, 0.5);               // a shield
    dot(c, 4, 13 + b, C.red[1]);
    capsule(c, 20, 4 + b, 20, 16 + b, 0.7, C.steel); dot(c, 20, 3 + b, C.steel[3]); box(c, 18, 15 + b, 5, 1, C.blue, { round: 0 }); // a sword
    outline(c, C);
  }),
  E("vortex", 24, 4, V, (c, f) => {
    sphere(c, 12, 12, 10.5, 10.5, [V.out[0], V.purple[0]]);
    for (let arm = 0; arm < 3; arm++) for (let t = 0; t < 34; t++) {
      const r = 1.5 + t * 0.28, a = t * 0.3 + arm * (tau / 3) + (f / 4) * (tau / 3);
      c.px(Math.round(12 + Math.cos(a) * r), Math.round(12 + Math.sin(a) * r), t > 22 ? V.purple[2] : t > 10 ? V.purple[3] : V.pale[1]);
    }
    sphere(c, 12, 12, 2, 2, [V.out[0]]); dot(c, 12, 12, V.red[2]);
    outline(c, V);
  }),
  E("spore", 48, 3, T, (c, f) => {
    const blobs = [[24, 24, 15.5], [13.5, 28.5, 9.5], [34.5, 28.5, 9.5], [18, 13.5, 9], [30, 13.5, 9], [24, 36, 8]];
    blobs.forEach(([x, y, r], i) => sphere(c, x + sin(f, 3, 1.2, i), y + sin(f, 3, 1.2, i * 2), r, r, T.green, { spec: T.green[4] }));
    [[12, 21], [36, 19], [19, 37], [31, 37], [24, 7]].forEach(([x, y]) => sphere(c, x, y, 1.8, 1.8, T.yellow));
    for (const ex of [18, 30]) { sphere(c, ex, 22.5, 4.5, 4.5, [T.out[0]]); sphere(c, ex + 0.8, 23.2, 2.1, 2.1, T.yellow); }
    box(c, 18, 31, 12, 3, [T.out[0]], { round: 1 }); dot(c, 20, 32, T.green[2]); dot(c, 27, 32, T.green[2]);
    [[6, 7], [40, 10], [7, 40], [42, 39], [24, 1]].forEach(([x, y], i) => dot(c, x, y + ((f + i) % 3) - 1, T.yellow[2])); // drifting spores
    outline(c, T);
  }),
  E("reaper", 48, 3, V, (c, f) => {
    const w = f % 3;
    const hem = [[32, 44 + (w === 0)], [26, 45 - (w === 1)], [19, 44 + (w === 2)], [13, 45 - (w === 0)], [9, 42 + (w === 1)]];
    plane(c, [[22, 3], [36, 15], [37, 41], ...hem, [7, 15]], V.purple, 0);                                 // the robe
    plane(c, [[22, 4], [18, 15], [16, 41], [11, 41], [11, 16]], V.purple, 0.8); plane(c, [[22, 15], [34, 16], [34, 39], [24, 41]], V.purple, -0.8);
    sphere(c, 22, 16.5, 8, 9, [V.out[0]]); sphere(c, 22, 19.5, 6, 6, [V.purple[0]]); sphere(c, 22, 18, 5.4, 5.4, [V.out[0]]); // the hood
    for (const ex of [18, 25]) { box(c, ex, 16, 3, 3, V.red, { round: 0 }); dot(c, ex, 16, V.pale[1]); }
    box(c, 36, 25, 6, 5, V.purple, { round: 2 }); sphere(c, 40, 28, 2, 2, V.steel);                       // a hand on the scythe
    capsule(c, 42, 3, 42, 45, 1.1, V.steel);
    plane(c, [[43, 3], [28, 6 + (w % 2)], [24, 12 + (w % 2)], [31, 9], [39, 9]], V.steel, 0.7);            // the blade
    capsule(c, 28, 7.5 + (w % 2), 39, 6, 0.6, V.red); dot(c, 42, 3, V.pale[1]);
    outline(c, V);
  }),
  E("sniper", 24, 2, C, (c, f) => {
    plane(c, [[0, 9], [12, 9], [16, 10.5], [16, 13.5], [12, 15], [0, 15]], C.teal, 0); box(c, 3, 10, 10, 2, C.teal, { round: 1, bias: 0.3 });
    box(c, 16, 10.5, 8, 3, C.steel, { round: 1 }); dot(c, 23, 12, f ? C.red[1] : C.out[0]);                // the barrel
    box(c, 4, 4, 3, 5, C.teal, { round: 1 }); box(c, 4, 15, 3, 5, C.teal, { round: 1, bias: -0.2 });       // fins
    sphere(c, 10.5, 12, 2.4, 2.4, C.red, { spec: f ? C.steel[3] : C.red[1] });                              // the scope's eye
    box(c, 0, 10, 2, 4, f ? C.teal : C.red, { round: 0 });
    outline(c, C);
  }),
  E("golem", 48, 4, C, (c, f) => {
    // a crystal giant that stomps: four steps, the crystal arms swing against the legs
    const st = [0, 1.5, 0, -1.5][f], bob = f % 2 ? 0 : 1.5;
    box(c, 12 + st, 36 - Math.max(0, st), 10, 11 + Math.max(0, st), C.blue, { round: 2 }); box(c, 26 - st, 36 - Math.max(0, -st), 10, 11 + Math.max(0, -st), C.blue, { round: 2, bias: -0.2 });
    plane(c, [[24, 1.5 + bob], [39, 15 + bob], [37, 39], [11, 39], [9, 15 + bob]], C.blue, 0);              // the crystal body
    plane(c, [[24, 1.5 + bob], [9, 15 + bob], [11, 39], [19, 39], [21, 15 + bob]], C.blue, 0.75);
    plane(c, [[24, 1.5 + bob], [21, 15 + bob], [28, 12 + bob]], C.teal, 0.9);
    capsule(c, 21, 15 + bob, 19, 39, 0.5, [C.teal[3]]); capsule(c, 28, 12 + bob, 30, 37, 0.5, [C.blue[0]]);  // facets
    plane(c, [[1, 21 + st + bob], [9, 15 + bob], [10, 31], [4, 34 + st]], C.teal, 0.5); plane(c, [[47, 21 - st + bob], [39, 15 + bob], [37, 31], [43, 34 - st]], C.teal, -0.4);
    plane(c, [[7, 12 + bob], [13, 3 + bob], [16, 15 + bob]], C.teal, 0.8); plane(c, [[41, 12 + bob], [35, 3 + bob], [32, 15 + bob]], C.teal, 0.1);
    for (const ex of [15, 27]) { box(c, ex, 19 + bob, 6, 4, [C.out[0]], { round: 0 }); box(c, ex + 1, 19 + bob, 4, 3, C.steel, { round: 1, bias: 0.4 }); }
    box(c, 19, 28 + bob, 11, 2, [C.blue[0]], { round: 0 });
    outline(c, C);
  }),
];
