// The ten pilots: 32x32 (a hero is 13% of Glow43's screen height), painted with lit shapes from scripts/lib/paint.mjs. Eight frames each:
// 0-1 idle (breathing), 2-7 a walk cycle. They stand three-quarters turned to the right (the game mirrors them when they walk left): a
// shared little spacesuit body whose legs stride, arms swing against the legs and body bobs, with a different helmet and extras per
// pilot. Two pilots share each colour bank (the console has 16 sprite banks for everything), so a bank is the ramps both of them need.
import { ramp } from "../../studio/src/palette-core.js";
import { bank, sphere, capsule, box, plane, outline, dot } from "../lib/paint.mjs";
import { drawNova, WALK_CLIPS } from "./hand.mjs";

export const FRAMES = 8;
export const CLIPS = { idle: { from: 0, to: 1, fps: 3, loop: true }, walk: { from: 2, to: 7, fps: 12, loop: true } };

// n shades of a five-step ramp, spread from dark to light
const shades = (hue, sat, n, opts) => { const r = ramp(hue, sat, opts); return n >= 5 ? r : Array.from({ length: n }, (_, i) => r[Math.round((i * 4) / (n - 1))]); };
const BANKS = {
  nova_lancer: bank({ out: ["#12101c"], blue: shades(220, 0.62, 4, { lo: 0.18, hi: 0.72 }), grey: shades(225, 0.14, 4, { lo: 0.3, hi: 0.95 }),
    red: shades(355, 0.7, 3, { lo: 0.25, hi: 0.62 }), teal: shades(185, 0.6, 2, { lo: 0.3, hi: 0.68 }), flame: ["#f0902c"] }),
  bulwark_vex: bank({ out: ["#160e10"], grey: shades(220, 0.12, 4, { lo: 0.2, hi: 0.86 }), orange: shades(28, 0.75, 4, { lo: 0.22, hi: 0.78 }),
    red: shades(355, 0.75, 2, { lo: 0.35, hi: 0.65 }), teal: shades(180, 0.6, 2, { lo: 0.3, hi: 0.78 }), gold: shades(48, 0.85, 2, { lo: 0.5, hi: 0.85 }) }),
  zephyr_sparks: bank({ out: ["#10140e"], green: shades(115, 0.5, 4, { lo: 0.18, hi: 0.72 }), yellow: shades(48, 0.8, 4, { lo: 0.3, hi: 0.86 }),
    orange: shades(26, 0.75, 3, { lo: 0.3, hi: 0.72 }), grey: shades(220, 0.12, 2, { lo: 0.35, hi: 0.8 }), blue: shades(215, 0.7, 1, { lo: 0.6, hi: 0.6 }) }),
  gravis_kuro: bank({ out: ["#120c1a"], purple: shades(270, 0.48, 5, { lo: 0.12, hi: 0.72 }), teal: shades(178, 0.6, 3, { lo: 0.3, hi: 0.8 }),
    red: shades(352, 0.72, 3, { lo: 0.25, hi: 0.62 }), grey: shades(230, 0.1, 3, { lo: 0.1, hi: 0.6 }) }),
  mira_halo: bank({ out: ["#160e14"], red: shades(355, 0.62, 4, { lo: 0.22, hi: 0.72 }), teal: shades(180, 0.55, 4, { lo: 0.2, hi: 0.76 }),
    grey: shades(225, 0.1, 3, { lo: 0.4, hi: 0.95 }), gold: shades(46, 0.85, 3, { lo: 0.45, hi: 0.9 }) }),
};
export const PILOT_BANKS = BANKS;

// Where the moving parts are in frame f. The walk is keyed by hand the way GBA walks are, not swung on a sine: over six frames each foot
// lands in front (contact), takes the weight as the body dips a pixel (down), pushes back, lifts with a bent knee and swings forward
// under the body. The far leg is the same three frames later. Arms swing against the legs.
const STEP = [[3.5, 0], [1.5, 0], [-1, 0], [-3.5, 0.6], [-1.2, 2.6], [2, 1.6]]; // the near foot: forward of the hip, how high
const BOB = [0, 1, 0, 0, 1, 0];                                                   // the body dips when a foot takes the weight
function pose(f) {
  if (f < 2) return { bob: f, near: [0.5, 0], far: [-0.5, 0], armNear: 0, armFar: 0 };
  const k = f - 2, near = STEP[k], far = STEP[(k + 3) % 6];
  return { bob: BOB[k], near, far, armNear: -near[0] * 0.75, armFar: -far[0] * 0.75 };
}

// A leg is a thigh and a shin meeting at a knee that bends forward, thick like a GBA hero's (not a stick), with a boot whose toe points
// ahead. The knee is found from the hip and the foot: two bones of the same length.
const BONE = 3.4;
function leg(c, hx, [dx, lift], suit, trim, far, hipY = 22.5) {
  const fy = 28.2 - lift, fx = hx + dx, d = Math.min(Math.hypot(fx - hx, fy - hipY), BONE * 2 - 0.01);
  const mx = (hx + fx) / 2, my = (hipY + fy) / 2, h = Math.sqrt(Math.max(0, BONE * BONE - (d / 2) ** 2));
  const ux = (fx - hx) / (d || 1), uy = (fy - hipY) / (d || 1);
  const kx = mx + uy * h, ky = my - ux * h; // the side of the hip-foot line that points forward
  // the far leg is a clear step darker and the near one outlined, so the two never read as one shape
  const bias = far ? -0.45 : 0;
  capsule(c, hx, hipY, kx, ky, 2.1, suit, { bias, edge: true });   // thigh
  capsule(c, kx, ky, fx, fy - 1, 1.9, suit, { bias, edge: true });  // shin
  box(c, Math.round(fx - 2), Math.round(fy - 1), 6, 3, trim, { round: 1, bias: far ? -0.4 : 0 }); // boot
}
function arm(c, sx, sy, dx, suit, trim, far) {
  capsule(c, sx, sy, sx + dx, sy + 5.5, 1.7, suit, { bias: far ? -0.2 : 0, edge: !far });
  sphere(c, sx + dx, sy + 6.6, 1.6, 1.5, trim, { bias: far ? -0.2 : 0 }); // glove
}

// The shared body. Returns the helmet's centre for this frame: { x, y, bob }.
function body(c, f, { suit, trim, buckle, wide = 0 }) {
  const { bob, near, far, armNear, armFar } = pose(f), top = 15 + bob;
  leg(c, 13, far, suit, trim, true);
  arm(c, 10.5 - wide, top + 1.5, armFar, suit, trim, true);
  box(c, 11 - wide, top, 10 + wide * 2, 9 - bob, suit, { round: 3 });          // torso
  box(c, 11 - wide, 23, 10 + wide * 2, 2, trim, { round: 1, slope: 0 });        // belt
  dot(c, 16, 23, buckle); dot(c, 16, 24, buckle);
  box(c, 14, top + 2, 4, 3, trim, { round: 1 });                                // chest panel
  leg(c, 18, near, suit, trim, false);
  arm(c, 21 + wide, top + 1.5, armNear, suit, trim, false);
  return { x: 16, y: 8.5 + bob, bob };
}
// a round helmet with the visor turned toward the right
function helmet(c, h, shell, glass, r = 7.5) {
  sphere(c, h.x, h.y, r, r, shell, { edge: true });
  sphere(c, h.x + 2.2, h.y + 1, r - 3, r - 4.2, glass, { bias: -0.15, spec: glass[glass.length - 1] });
}
const eyes = (c, h, col, dy = 1) => { for (const ex of [2, 5]) { dot(c, h.x + ex, h.y + dy, col); dot(c, h.x + ex, h.y + dy + 1, col); } };

const P = (id, b, draw) => ({ id, w: 32, h: 32, frames: FRAMES, bank: b, bankName: Object.keys(BANKS).find((k) => BANKS[k] === b), draw });
const { nova_lancer: NL, bulwark_vex: BV, zephyr_sparks: ZS, gravis_kuro: GK, mira_halo: MH } = BANKS;

export const PILOTS = [
  { ...P("nova", NL, (c, f) => drawNova(c, f, NL)), clips: WALK_CLIPS }, // drawn by hand (hand.mjs), with its own walk
  P("lancer", NL, (c, f) => {
    const h = body(c, f, { suit: NL.grey, trim: NL.blue, buckle: NL.red[2] });
    const sw = f % 2;
    capsule(c, 15, 0.8 + h.bob, 9 - sw, 2.5 + h.bob, 1.3, NL.red);                                        // plume streams back
    helmet(c, h, NL.grey, [NL.out[0], NL.grey[0]]);
    box(c, 12, 8 + h.bob, 12, 2, [NL.out[0]], { round: 0 }); box(c, 18, 8 + h.bob, 3, 6, [NL.out[0]], { round: 0 }); // T visor
    capsule(c, 27, 3 + h.bob, 27, 24 + h.bob, 0.9, NL.blue); dot(c, 27, 2 + h.bob, NL.grey[3]);           // lance
    outline(c, NL);
  }),
  P("bulwark", BV, (c, f) => {
    const h = body(c, f, { suit: BV.grey, trim: BV.orange, buckle: BV.gold[1], wide: 1 });
    box(c, 5, 14 + h.bob, 6, 5, BV.orange, { round: 2 }); box(c, 21, 14 + h.bob, 6, 5, BV.orange, { round: 2, bias: -0.08 }); // shoulder plates
    box(c, 8, 1 + h.bob, 16, 13, BV.grey, { round: 3 });                                                  // a square helmet
    box(c, 12, 6 + h.bob, 12, 4, [BV.out[0]], { round: 1 });
    box(c, 16 + (f % 2), 6 + h.bob, 5, 4, BV.red, { round: 1 });                                          // visor slit, scanning
    box(c, 13, 0 + h.bob, 6, 2, BV.orange, { round: 1 });
    outline(c, BV);
  }),
  P("vex", BV, (c, f) => {
    const bob = pose(f).bob;
    sphere(c, 7.5, 19 + bob, 3.6, 4.2, BV.orange, { bias: -0.2 });                                        // sack on the back
    const h = body(c, f, { suit: BV.orange, trim: BV.grey, buckle: BV.gold[1] });
    helmet(c, h, BV.orange, [BV.out[0], BV.teal[0]]);
    for (const gx of [13.5, 20.5]) sphere(c, gx, h.y + 0.5, 2.6, 2.6, BV.teal, { spec: BV.teal[1] });   // goggles
    box(c, 15, 0 + h.bob, 4, 2, BV.gold, { round: 1 });
    sphere(c, 26, 28, 2, 2, BV.gold, { spec: BV.gold[1] });                                               // a coin
    outline(c, BV);
  }),
  P("zephyr", ZS, (c, f) => {
    const h = body(c, f, { suit: ZS.green, trim: ZS.yellow, buckle: ZS.orange[2] });
    capsule(c, 9, 23 + h.bob, 4, 21 + h.bob + (f % 2), 1.8, ZS.orange);                                   // tail
    plane(c, [[8, 7 + h.bob], [8, -0.5 + h.bob], [13, 3 + h.bob]], ZS.orange, 0.3);                       // ears
    plane(c, [[19, 3 + h.bob], [25, -0.5 + h.bob], [24, 7 + h.bob]], ZS.orange, -0.2);
    dot(c, 9, 3 + h.bob, ZS.orange[0]); dot(c, 23, 3 + h.bob, ZS.orange[0]);
    helmet(c, h, ZS.orange, [ZS.green[0], ZS.green[2]]);
    eyes(c, h, ZS.yellow[3]);
    outline(c, ZS);
  }),
  P("sparks", ZS, (c, f) => {
    const h = body(c, f, { suit: ZS.yellow, trim: ZS.grey, buckle: ZS.blue[0] });
    capsule(c, 16, -0.5 + h.bob, 16, 2 + h.bob, 0.7, ZS.grey);                                            // antenna
    helmet(c, h, ZS.yellow, [ZS.out[0], ZS.yellow[1]]);
    eyes(c, h, ZS.yellow[3]);
    const sp = f % 2 ? ZS.grey[1] : ZS.yellow[3];
    dot(c, 16, -1 + h.bob + 1, sp); dot(c, f % 2 ? 13 : 19, 0 + h.bob, sp); dot(c, f % 2 ? 19 : 13, 1 + h.bob, ZS.blue[0]);
    plane(c, [[16, 16 + h.bob], [14, 19.5 + h.bob], [16, 19.5 + h.bob], [15, 22 + h.bob], [18, 18 + h.bob], [16, 18 + h.bob]], ZS.blue, 0.5); // a bolt
    outline(c, ZS);
  }),
  P("gravis", GK, (c, f) => {
    const h = body(c, f, { suit: GK.purple, trim: GK.teal, buckle: GK.teal[2], wide: 1 });
    const ring = (front) => { for (let x = 0; x < 32; x++) for (let dy = -3; dy <= 3; dy++) { // a ring round the helmet, half behind, half in front
      const y = Math.round(h.y + dy), q = ((x + 0.5 - 16) / 14.5) ** 2 + ((y + 0.5 - h.y) / 2.8) ** 2, inner = ((x + 0.5 - 16) / 10.5) ** 2 + ((y + 0.5 - h.y) / 1.4) ** 2;
      if (q <= 1 && inner > 1 && (y + 0.5 >= h.y) === front) c.px(x, y, front ? (x < 14 ? GK.teal[2] : GK.teal[1]) : GK.teal[0]);
    } };
    ring(false);
    helmet(c, h, GK.purple, [GK.purple[0], GK.purple[3]], 8);
    eyes(c, h, GK.teal[2], 0);
    ring(true);
    outline(c, GK);
  }),
  P("kuro", GK, (c, f) => {
    const h = body(c, f, { suit: GK.purple, trim: GK.red, buckle: GK.red[2] });
    const sc = f % 2;
    capsule(c, 12, 16 + h.bob, 5, 19 + h.bob + sc, 1.3, GK.red, { bias: -0.1 });                          // scarf tails behind
    capsule(c, 12, 17 + h.bob, 4, 21 + h.bob + sc, 1, GK.red, { bias: -0.2 });
    sphere(c, h.x, h.y, 7.5, 7.5, GK.grey);                                                                // a dark hood
    box(c, 11, 7 + h.bob, 13, 4, [GK.out[0]], { round: 1 });                                               // mask band
    for (const ex of [18, 21]) { dot(c, ex, 8 + h.bob, GK.purple[4]); dot(c, ex - 1, 8 + h.bob, GK.purple[2]); }
    capsule(c, 11, 15.5 + h.bob, 20, 15.5 + h.bob, 1.2, GK.red);
    outline(c, GK);
  }),
  P("mira", MH, (c, f) => {
    const h = body(c, f, { suit: MH.red, trim: MH.grey, buckle: MH.gold[2] });
    sphere(c, 6.5, 5 + h.bob, 3.6, 3.6, MH.gold, { bias: -0.1 }); sphere(c, 25.5, 5 + h.bob, 3.6, 3.6, MH.gold, { bias: -0.2 }); // hair buns
    helmet(c, h, MH.grey, [MH.red[0], MH.red[3]]);
    eyes(c, h, MH.gold[2]);
    plane(c, [[16, 16 + h.bob], [17, 18 + h.bob], [19, 18.4 + h.bob], [17.4, 19.6 + h.bob], [18, 22 + h.bob], [16, 20.6 + h.bob], [14, 22 + h.bob], [14.6, 19.6 + h.bob], [13, 18.4 + h.bob], [15, 18 + h.bob]], MH.gold, 0.6); // a star
    outline(c, MH);
  }),
  P("halo", MH, (c, f) => {
    const flap = f % 2, bob = pose(f).bob;
    plane(c, [[10, 15 + bob - flap], [2, 12 + bob - flap], [3, 17 + bob - flap], [9, 20 + bob]], MH.grey, 0.7); // a wing behind
    const h = body(c, f, { suit: MH.teal, trim: MH.gold, buckle: MH.gold[2] });
    helmet(c, h, MH.grey, [MH.teal[0], MH.teal[3]]);
    eyes(c, h, MH.grey[2]);
    const hv = (f >> 1) % 2;
    for (let x = 8; x < 25; x++) for (let y = -1; y < 3; y++) { // the halo, a bright ring floating over the helmet
      const q = ((x + 0.5 - 16.5) / 7.5) ** 2 + ((y + 0.5 - 1 - hv) / 1.7) ** 2, inner = ((x + 0.5 - 16.5) / 4.6) ** 2 + ((y + 0.5 - 1 - hv) / 0.7) ** 2;
      if (q <= 1 && inner > 1) c.px(x, y, y + 0.5 < 1 + hv ? MH.gold[2] : MH.gold[1]);
    }
    outline(c, MH);
  }),
];
