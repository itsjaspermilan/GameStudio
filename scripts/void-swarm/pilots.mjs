// The ten pilots: 24x24 (a hero is about a tenth of Glow43's screen height), drawn at that size pixel for pixel. Eight frames each: 0-1 idle (breathing),
// 2-7 a walk cycle. They stand three-quarters turned to the right (the game mirrors them when they walk left): a shared little spacesuit body
// whose legs stride, arms swing against the legs and body bobs, with a different helmet and extras per pilot.
import { R, K, W } from "../lib/canvas.mjs";

export const FRAMES = 8;
export const CLIPS = { idle: { from: 0, to: 1, fps: 3, loop: true }, walk: { from: 2, to: 7, fps: 12, loop: true } };

// Where the moving parts are in frame f. A walk frame's phase goes once round a circle over the six frames; the near leg leads at phase 0.
function pose(f) {
  if (f < 2) return { bob: f, near: [0, 0], far: [0, 0], armNear: 0, armFar: 0 };
  const p = ((f - 2) / 6) * Math.PI * 2;
  // a foot travelling forward (cos > 0 for the near one) is the one in the air
  const foot = (ph) => [Math.round(Math.sin(ph) * 2.6), Math.max(0, Math.round(Math.cos(ph) * 1.6))];
  return {
    bob: (f - 2) % 3 === 0 ? -1 : 0, // up while the legs pass each other, down when they are apart
    near: foot(p), far: foot(p + Math.PI),
    armNear: Math.round(-Math.sin(p) * 2), armFar: Math.round(Math.sin(p) * 2),
  };
}

// a 2 pixel wide limb from (x0, y0) down to (x1, y1)
function limb(c, x0, y0, x1, y1, col) {
  const n = Math.max(1, y1 - y0);
  for (let i = 0; i <= n; i++) c.rect(Math.round(x0 + ((x1 - x0) * i) / n), y0 + i, 2, 1, col);
}

function leg(c, hx, [dx, lift], S, T, dark) {
  const fy = 21 - lift, fx = hx + dx;
  limb(c, hx, 18, fx, fy, dark ? S[0] : S[1]);
  c.px(hx, 18, dark ? S[1] : S[2]);
  c.rect(fx, fy + 1, 3, 2, dark ? T[0] : T[1]); // boot, toe forward
  c.px(fx + 2, fy + 1, dark ? T[1] : T[2]);
}

function arm(c, sx, sy, dx, S, T, dark) {
  limb(c, sx, sy, sx + dx, sy + 4, dark ? S[0] : S[1]);
  if (!dark) c.px(sx, sy, S[2]);
  c.rect(sx + dx, sy + 5, 2, 1, dark ? T[1] : T[2]); // glove
}

// The shared body. Returns the helmet's centre for this frame: { x, y, bob }.
function body(c, f, o) {
  const { bob, near, far, armNear, armFar } = pose(f);
  const S = o.suit, T = o.trim, wide = o.wide ? 1 : 0;
  const top = 12 + bob;
  leg(c, 9, far, S, T, true);
  arm(c, 7 - wide, top + 1, armFar, S, T, true);
  // torso: the light comes from the top left, the right side is in shade
  c.rect(8 - wide, top, 8 + wide * 2, 6 - bob, S[1]);
  c.rect(8 - wide, top, 8 + wide * 2, 1, S[2]); c.rect(8 - wide, top, 2, 5 - bob, S[2]);
  c.rect(14 + wide, top + 1, 2, 5 - bob, S[0]);
  c.rect(8 - wide, 17, 8 + wide * 2, 1, T[0]); c.px(12, 17, T[3]); // belt and buckle
  c.rect(11, top + 2, 3, 2, T[1]); c.px(11, top + 2, T[2]); // chest panel
  leg(c, 12, near, S, T, false);
  arm(c, 15 + wide, top + 1, armNear, S, T, false);
  return { x: 12, y: 6.5 + bob, bob };
}

// A round helmet with the visor turned towards the right.
function helmet(c, h, glass, ramp = R.grey, r = 6) {
  c.sphere(h.x, h.y, r, ramp);
  c.ellipse(h.x + 1.5, h.y + 0.8, r - 2.2, r - 3.2, glass[0]);
  c.px(h.x - 0.5, h.y - 0.8, glass[1]); c.px(h.x + 0.5, h.y - 1.5, glass[1]);
}
function eyes(c, h, col, dy = 1) { c.px(h.x + 1, h.y + dy, col); c.px(h.x + 4, h.y + dy, col); c.px(h.x + 1, h.y + dy + 1, col); c.px(h.x + 4, h.y + dy + 1, col); }

export const PILOTS = [
  { id: "nova", draw(c, f) {
    c.rect(4, 12 + pose(f).bob, 3, 5, R.grey[1]); c.rect(4, 12 + pose(f).bob, 3, 1, R.grey[2]); c.px(5, 17 + pose(f).bob, R.orange[2 + (f % 2)]); // jet pack
    const h = body(c, f, { suit: R.blue, trim: R.grey });
    helmet(c, h, [R.teal[0], R.teal[3]]);
    eyes(c, h, W);
    c.rect(8, 12 + h.bob, 8, 1, R.red[2]); c.rect(6, 13 + h.bob, 2, 2, R.red[1]); c.px(5, 14 + h.bob + (f % 2), R.red[2]); // scarf, its end flutters behind
    c.outline(R.blue[0]);
  } },
  { id: "bulwark", draw(c, f) {
    const h = body(c, f, { suit: R.grey, trim: R.orange, wide: true });
    c.rect(4, 11 + h.bob, 4, 4, R.orange[1]); c.rect(4, 11 + h.bob, 4, 1, R.orange[3]); // shoulder plates
    c.rect(16, 11 + h.bob, 4, 4, R.orange[2]); c.rect(16, 11 + h.bob, 4, 1, R.orange[3]); c.px(19, 14 + h.bob, R.orange[0]);
    c.rect(6, 1 + h.bob, 12, 10, R.grey[2]); c.rect(6, 1 + h.bob, 12, 1, R.grey[3]); c.rect(6, 1 + h.bob, 1, 10, R.grey[3]); c.rect(15, 2 + h.bob, 3, 9, R.grey[1]);
    c.rect(9, 5 + h.bob, 9, 3, K); c.rect(12 + (f % 2), 5 + h.bob, 4, 3, R.red[2]); c.px(13 + (f % 2), 5 + h.bob, R.red[3]); // visor slit
    c.rect(10, 0 + h.bob, 4, 1, R.orange[2]);
    c.outline(R.grey[0]);
  } },
  { id: "zephyr", draw(c, f) {
    const h = body(c, f, { suit: R.green, trim: R.yellow });
    c.px(6, 19 + (f % 2), R.orange[2]); c.rect(4, 17 + h.bob, 3, 2, R.orange[2]); c.px(3, 16 + h.bob + (f % 2), R.orange[3]); // tail
    c.poly([[6, 6 + h.bob], [6, -0.5 + h.bob], [10, 2 + h.bob]], R.orange[2]); c.poly([[15, 2 + h.bob], [19, -0.5 + h.bob], [18, 6 + h.bob]], R.orange[2]); // ears
    c.px(7, 2 + h.bob, R.red[2]); c.px(17, 2 + h.bob, R.red[2]);
    helmet(c, h, [R.green[0], R.green[3]], R.orange);
    eyes(c, h, R.yellow[3]);
    c.outline(R.green[0]);
  } },
  { id: "sparks", draw(c, f) {
    const h = body(c, f, { suit: R.yellow, trim: R.grey });
    c.rect(12, 0 + h.bob, 1, 2, R.grey[2]); // antenna
    helmet(c, h, [K, R.yellow[2]], R.yellow);
    eyes(c, h, R.yellow[3]);
    const sp = f % 2 ? W : R.yellow[3]; c.px(12, -1 + h.bob + 1, sp); c.px(f % 2 ? 10 : 14, 0 + h.bob, sp); c.px(f % 2 ? 14 : 10, 1 + h.bob, R.teal[3]);
    c.px(12, 13 + h.bob, R.blue[2]); c.px(11, 14 + h.bob, R.blue[3]); c.px(12, 14 + h.bob, R.blue[3]); c.px(11, 15 + h.bob, R.blue[2]); // bolt
    c.outline(R.yellow[0]);
  } },
  { id: "gravis", draw(c, f) {
    const h = body(c, f, { suit: R.purple, trim: R.teal, wide: true });
    // a ring round the helmet: its back half behind, its front half over the glass
    const ring = (front) => { for (let x = 0; x < 24; x++) for (let dy = -2; dy <= 2; dy++) {
      const y = Math.round(h.y + dy), q = ((x + 0.5 - 12) / 11) ** 2 + ((y + 0.5 - h.y) / 2.2) ** 2, inner = ((x + 0.5 - 12) / 8) ** 2 + ((y + 0.5 - h.y) / 1.1) ** 2;
      if (q <= 1 && inner > 1 && (y + 0.5 >= h.y) === front) c.px(x, y, front ? R.teal[2] : R.teal[1]);
    } };
    ring(false);
    helmet(c, h, [R.purple[0], R.purple[3]], R.purple, 6.5);
    eyes(c, h, R.teal[3], 0);
    ring(true);
    c.outline(R.purple[0]);
  } },
  { id: "mira", draw(c, f) {
    const h = body(c, f, { suit: R.red, trim: R.grey });
    c.disc(5, 4 + h.bob, 3, R.orange[3]); c.disc(19, 4 + h.bob, 3, R.orange[2]); c.px(5, 4 + h.bob, R.red[2]); c.px(18, 4 + h.bob, R.red[2]); // hair buns
    helmet(c, h, [R.red[0], R.red[3]], R.grey);
    eyes(c, h, R.yellow[3]);
    c.px(12, 13 + h.bob, R.yellow[3]); c.rect(11, 14 + h.bob, 3, 1, R.yellow[2]); c.px(12, 14 + h.bob, R.yellow[3]); c.px(12, 15 + h.bob, R.yellow[2]); // star
    c.outline(R.red[0]);
  } },
  { id: "vex", draw(c, f) {
    c.rect(3, 13 + pose(f).bob, 4, 5, R.orange[0]); c.rect(4, 12 + pose(f).bob, 2, 1, R.orange[1]); // sack on the back
    const h = body(c, f, { suit: R.orange, trim: R.grey });
    helmet(c, h, [K, R.teal[2]], R.orange);
    c.rect(9, 5 + h.bob, 9, 4, R.teal[1]); c.rect(10, 5 + h.bob, 3, 4, R.teal[3]); c.rect(15, 5 + h.bob, 3, 4, R.teal[3]); c.px(11, 6 + h.bob, R.teal[2]); c.px(16, 6 + h.bob, R.teal[2]); // goggles
    c.rect(11, 0 + h.bob, 3, 2, R.yellow[2]); c.px(12, 0 + h.bob, W);
    c.disc(19, 21, 1.6, R.yellow[2 + ((f >> 1) % 2)]); // coin
    c.outline(R.orange[0]);
  } },
  { id: "lancer", draw(c, f) {
    const h = body(c, f, { suit: R.grey, trim: R.blue });
    const sw = f % 2;
    c.rect(10, 0 + h.bob, 3, 2, R.red[2]); c.rect(7 - sw, 1 + h.bob, 3, 1, R.red[1]); c.px(6 - sw, 2 + h.bob, R.red[1]); // plume streams back
    helmet(c, h, [K, R.grey[2]], R.grey);
    c.rect(9, 6 + h.bob, 9, 1, K); c.rect(14, 6 + h.bob, 2, 5, K); // T visor
    c.rect(20, 3 + h.bob, 1, 15, R.blue[3]); c.px(20, 2 + h.bob, W); c.px(20, 1 + h.bob, R.blue[2]); // lance
    c.outline(R.grey[0]);
  } },
  { id: "halo", draw(c, f) {
    const flap = f % 2;
    c.rect(3, 12 + pose(f).bob - flap, 4, 3, W); c.rect(2, 11 + pose(f).bob - flap, 2, 2, W); c.px(2, 11 + pose(f).bob - flap, R.teal[3]); // wing behind
    const h = body(c, f, { suit: R.teal, trim: R.yellow });
    helmet(c, h, [R.teal[0], R.teal[3]], R.grey);
    eyes(c, h, W);
    const hv = (f >> 1) % 2;
    c.ellipse(12.5, 0.8 + hv, 5.5, 1.3, R.yellow[3]); c.ellipse(12.5, 0.8 + hv, 3.2, 0.5, -1);
    c.outline(R.teal[0]);
  } },
  { id: "kuro", draw(c, f) {
    const h = body(c, f, { suit: R.purple, trim: R.red });
    const sc = f % 2;
    c.rect(4, 12 + h.bob, 5, 2, R.red[2]); c.rect(2, 14 + h.bob + sc, 3, 1, R.red[1]); c.px(1, 15 + h.bob + sc, R.red[2]); // scarf tails behind
    c.sphere(h.x, h.y, 6, [K, R.grey[1], R.purple[0], R.purple[1]]);
    c.rect(8, 6 + h.bob, 10, 3, R.purple[0]); c.rect(9, 6 + h.bob, 9, 3, K); // mask band
    c.px(13, 7 + h.bob, R.purple[3]); c.px(16, 7 + h.bob, R.purple[3]); c.px(12, 7 + h.bob, R.purple[2]); c.px(17, 7 + h.bob, R.purple[2]);
    c.rect(8, 12 + h.bob, 8, 1, R.red[2]);
    c.outline(R.purple[2]);
  } },
].map((p) => ({ ...p, w: 24, h: 24, frames: FRAMES }));
