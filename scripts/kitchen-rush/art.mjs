// The art of Kitchen Rush, drawn in code on Glow43's palette (see scripts/lib/canvas.mjs). Every sprite is { w, h, frames, draw(c, f) }.
// Food is 16x16 and lit from the top left; each food is one colour family with its darkest shade as the outline, so it reads on
// the light tickets and on the dark grill alike.
import { Canvas, R } from "../lib/canvas.mjs";

// ---------- food: the shelf's raw things first, then what they become on the board or the grill
function bun(c) {
  c.sphere(8, 9, 7, [9, 10, 11, 15], -0.5, -0.6, 7, 5);
  c.rect(0, 10, 16, 6, -1);
  c.rect(2, 10, 12, 1, 18);          // a frill of lettuce shows it is a sandwich bun
  c.rect(2, 11, 12, 3, 10); c.rect(2, 11, 12, 1, 11);
  [[5, 6], [8, 5], [11, 7], [7, 8]].forEach(([x, y]) => c.px(x, y, 15));
  c.outline(8);
}
function cheese(c) {
  c.poly([[1, 6], [12, 3], [15, 6], [15, 13], [1, 13]], 14);
  c.poly([[1, 6], [12, 3], [15, 6]], 15);
  c.rect(1, 11, 15, 2, 13);
  c.disc(5, 9, 1.4, 13); c.disc(11, 8.5, 1.2, 13); c.px(8, 11, 12);
  c.outline(12);
}
function lettuce(c) {
  c.sphere(8, 9, 6.5, [16, 17, 18, 19]);
  c.line(8, 4, 8, 14, 19); c.line(8, 9, 4, 6, 19); c.line(8, 10, 12, 7, 19);
  c.outline(16);
}
function tomato(c) {
  c.sphere(8, 9.5, 6, R.red);
  c.rect(6, 3, 5, 1, 17); c.px(8, 2, 18); c.px(5, 4, 17); c.px(11, 4, 17);
  c.outline(4);
}
function onion(c) {
  c.sphere(8, 10, 5.5, R.purple);
  c.px(8, 4, 30); c.px(8, 3, 31); c.px(7, 2, 30);
  c.line(6, 7, 5, 12, 31);
  c.outline(28);
}
function eggRaw(c) {
  c.sphere(8, 9, 5, [10, 11, 15, 3], -0.5, -0.6, 4.5, 6);
  c.outline(9);
}
function pattyRaw(c) {
  c.sphere(8, 9, 7, [5, 6, 7, 7], -0.5, -0.6, 7, 4.5);
  [[5, 8], [9, 7], [11, 10], [6, 11], [8, 10]].forEach(([x, y]) => c.px(x, y, 3));
  c.outline(4);
}
function fishBody(c, ramp, out) {
  c.poly([[11, 8], [15, 4], [15, 12]], ramp[1]);
  c.sphere(7, 8, 6, ramp, -0.5, -0.6, 6, 3.6);
  c.px(4, 7, 0);
  c.line(9, 6, 9, 10, ramp[0]);
  c.outline(out);
}
const fishRaw = (c) => fishBody(c, R.teal, 20);
function lettuceChopped(c) {
  [[5, 7, 3.4], [11, 6, 3.2], [8, 11, 3.6], [4, 12, 2.4], [12, 11, 2.6]].forEach(([x, y, r]) => c.sphere(x, y, r, [16, 17, 18, 19]));
  c.outline(16);
}
function tomatoSliced(c) {
  for (const [x, y] of [[6, 9], [10, 7]]) {
    c.disc(x, y, 4.6, 5); c.disc(x, y, 3.4, 6);
    c.px(x - 1, y - 1, 15); c.px(x + 1, y, 15); c.px(x, y + 1, 15); c.px(x, y, 7);
  }
  c.outline(4);
}
function onionRings(c) {
  c.ring(6, 9, 4.5, 1.6, 30); c.ring(11, 8, 4.5, 1.6, 31);
  c.px(4, 6, 31); c.px(9, 5, 3);
  c.outline(28);
}
function pattyCooked(c) {
  c.sphere(8, 9, 7, [8, 8, 9, 10], -0.5, -0.6, 7, 4.5);
  c.line(4, 10, 7, 7, 8); c.line(8, 11, 11, 8, 8);
  c.px(5, 7, 11); c.px(9, 6, 11);
  c.outline(0);
}
const fishCooked = (c) => fishBody(c, [9, 10, 11, 15], 8);
function eggFried(c) {
  c.poly([[2, 9], [4, 4], [9, 3], [14, 6], [14, 11], [10, 14], [4, 13]], 3);
  c.rect(4, 11, 8, 2, 2);
  c.sphere(8, 8, 3, [13, 14, 15, 15]);
  c.outline(2);
}
function sauce(c) {
  c.poly([[3, 10], [5, 5], [9, 3], [12, 5], [14, 9], [11, 13], [5, 13]], 5);
  c.disc(13, 13, 1.5, 5); c.disc(2, 13, 1, 5);
  c.disc(7, 7, 1.8, 6); c.px(6, 6, 7);
  c.outline(4);
}
function burnt(c) {
  c.sphere(8, 11, 6.5, [0, 1, 1, 2], -0.5, -0.6, 6.5, 4);
  c.px(6, 10, 9); c.px(10, 12, 5);
  c.px(5, 5, 2); c.px(6, 4, 2); c.px(6, 3, 3); c.px(10, 4, 2); c.px(11, 3, 2); c.px(11, 2, 3);
  c.outline(0);
}
// frame order: the shelf (1-8), then the cooked forms, sauce, burnt
const FOOD = [bun, cheese, lettuce, tomato, onion, eggRaw, pattyRaw, fishRaw, lettuceChopped, tomatoSliced, onionRings, eggFried, pattyCooked, fishCooked, sauce, burnt];
export const FOOD_IDS = ["bun", "cheese", "lettuce", "tomato", "onion", "egg", "patty", "fish", "lettuce_ready", "tomato_ready", "onion_ready", "egg_ready", "patty_ready", "fish_ready", "sauce", "burnt"];
export const SPR_FOOD = { w: 16, h: 16, frames: FOOD.length, draw: (c, f) => FOOD[f](c) };

// ---------- the chef: 32x32, facing you. Frames 0-1 stand (breathing), 2-3 chop, 4 at the grill, 5 serve (arms up), 6 oops.
function chef(c, f) {
  const bob = f === 1 ? 1 : 0;
  const skin = [9, 10, 11, 11];
  // legs and shoes
  c.rect(12, 27, 3, 4, 1); c.rect(17, 27, 3, 4, 1);
  c.rect(11, 30, 4, 2, 0); c.rect(17, 30, 4, 2, 0);
  // coat, with the light side on the left, and a blue apron
  const by = 17 + bob;
  c.rect(10, by, 12, 11 - bob, 3); c.rect(19, by, 3, 11 - bob, 2);
  c.rect(12, by + 4, 8, 7 - bob, 25); c.rect(12, by + 4, 8, 1, 26); c.rect(18, by + 5, 2, 6 - bob, 24);
  c.px(14, by + 1, 2); c.px(14, by + 3, 2);
  c.rect(13, by, 6, 2, 5);            // neckerchief
  // arms
  const arm = (x0, y0, x1, y1) => { c.line(x0, y0, x1, y1, 3); c.line(x0 + 1, y0, x1 + 1, y1, 2); c.disc(x1 + 0.5, y1 + 1, 1.6, 11); };
  if (f <= 1) { arm(8, by + 1, 8, by + 8); arm(22, by + 1, 22, by + 8); }
  else if (f === 2) { arm(8, by + 1, 8, by + 8); arm(22, by + 1, 25, by - 6); c.rect(25, by - 12, 2, 5, 2); c.px(25, by - 12, 3); }
  else if (f === 3) { arm(8, by + 1, 8, by + 8); arm(22, by + 1, 26, by + 6); c.rect(27, by + 5, 4, 2, 2); }
  else if (f === 4) { arm(8, by + 1, 4, by + 5); c.rect(0, by + 5, 5, 1, 2); c.rect(0, by + 4, 3, 1, 2); arm(22, by + 1, 22, by + 8); }
  else if (f === 5) { arm(8, by + 1, 4, by - 6); arm(22, by + 1, 26, by - 6); }
  else { arm(8, by + 1, 10, by + 5); arm(22, by + 1, 20, by + 5); }
  // head: face, eyes, smile, a moustache
  const hy = 12 + bob;
  c.sphere(16, hy, 5, skin);
  c.px(14, hy - 1, 0); c.px(18, hy - 1, 0);
  c.px(12, hy + 1, 7); c.px(20, hy + 1, 7);
  c.rect(14, hy + 2, 5, 1, 8);
  if (f === 6) { c.px(15, hy + 4, 8); c.px(16, hy + 3, 8); c.px(17, hy + 4, 8); }
  else c.rect(15, hy + 4, 3, 1, 4);
  // the tall white hat
  const ty = 1 + bob;
  c.rect(11, ty + 5, 10, 3, 3); c.rect(11, ty + 7, 10, 1, 2);
  c.disc(13, ty + 4, 3, 3); c.disc(19, ty + 4, 3, 3); c.disc(16, ty + 3, 3.6, 3);
  c.px(13, ty + 2, 3); c.px(20, ty + 5, 2); c.px(18, ty + 6, 2);
  c.outline(1);
}
export const SPR_CHEF = { w: 32, h: 32, frames: 7, draw: chef };

// ---------- customers on the tickets: four faces, each happy, waiting and cross (frame = face * 3 + mood)
const FACES = [
  { skin: [9, 10, 11, 11], hair: [8, 9], style: "bob" },
  { skin: [8, 9, 10, 11], hair: [0, 1], style: "spiky" },
  { skin: [10, 11, 15, 15], hair: [12, 13], style: "pony" },
  { skin: [9, 10, 11, 11], hair: [28, 29], style: "cap" },
];
function face(c, f) {
  const fc = FACES[Math.floor(f / 3)], mood = f % 3;
  c.sphere(8, 9, 6, fc.skin);
  const [h0, h1] = fc.hair;
  if (fc.style === "bob") { c.rect(2, 3, 12, 3, h1); c.rect(2, 4, 2, 7, h1); c.rect(12, 4, 2, 7, h1); c.rect(3, 3, 6, 1, h0); }
  else if (fc.style === "spiky") { for (let x = 3; x <= 12; x += 3) c.poly([[x, 6], [x + 1.5, 1], [x + 3, 6]], h1); c.rect(3, 4, 10, 2, h1); }
  else if (fc.style === "pony") { c.rect(3, 3, 10, 3, h1); c.disc(13, 6, 2.5, h1); c.rect(3, 3, 4, 1, h0 + 2); }
  else { c.rect(2, 3, 12, 3, h1); c.rect(1, 5, 14, 1, h0); c.rect(5, 2, 6, 1, h1); }
  c.px(6, 9, 0); c.px(10, 9, 0);
  if (mood === 0) { c.px(5, 11, 7); c.px(11, 11, 7); c.px(6, 12, 4); c.rect(7, 13, 3, 1, 4); c.px(10, 12, 4); }
  else if (mood === 1) { c.rect(7, 12, 3, 1, 8); }
  else { c.px(5, 7, 0); c.px(11, 7, 0); c.px(6, 13, 4); c.rect(7, 12, 3, 1, 4); c.px(10, 13, 4); c.px(4, 11, 6); c.px(12, 11, 6); }
  c.outline(fc.skin[0] === 10 ? 9 : 8);
}
export const SPR_FACE = { w: 16, h: 16, frames: 12, draw: face };

// ---------- the kitchen things
export const SPR_PLATE = { w: 40, h: 16, frames: 1, draw(c) {
  c.ellipse(20, 8, 19, 6.5, 2); c.ellipse(20, 7.5, 18, 5.5, 3); c.ellipse(20, 8, 12, 3.5, 2); c.ellipse(20, 8.5, 11, 3, 3);
  c.rect(14, 14, 12, 1, 1);
  c.outline(1);
} };
export const SPR_BIN = { w: 16, h: 24, frames: 1, draw(c) {
  c.rect(2, 7, 12, 16, 2); c.rect(2, 7, 4, 16, 3);
  for (const x of [5, 8, 11]) c.rect(x, 9, 1, 12, 1);
  c.rect(1, 4, 14, 3, 2); c.rect(1, 4, 14, 1, 3); c.rect(6, 2, 4, 2, 1);
  c.outline(1);
} };
export const SPR_BELL = { w: 16, h: 16, frames: 1, draw(c) {
  c.sphere(8, 12, 7, R.yellow, -0.5, -0.6, 7, 8); c.rect(0, 12, 16, 4, -1);
  c.rect(0, 12, 16, 3, 2); c.rect(0, 12, 16, 1, 3); c.rect(7, 2, 2, 2, 1);
  c.outline(1);
} };
export const SPR_COIN = { w: 8, h: 8, frames: 1, draw(c) { c.sphere(4, 4, 3.5, R.yellow); c.rect(4, 2, 1, 4, 12); c.outline(12); } };
export const SPR_HEART = { w: 8, h: 8, frames: 2, draw(c, f) {
  const col = f ? 1 : 6;
  c.disc(2.5, 3, 2, col); c.disc(5.5, 3, 2, col); c.poly([[0.5, 3.5], [7.5, 3.5], [4, 7.5]], col);
  if (!f) c.px(2, 2, 7);
  c.outline(f ? 0 : 4);
} };
export const SPR_STAR = { w: 16, h: 16, frames: 2, draw(c, f) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7.2; pts.push([8 + Math.cos(a) * r, 8.6 + Math.sin(a) * r]); }
  c.poly(pts, f ? 1 : 14);
  if (!f) { c.px(6, 6, 15); c.px(7, 5, 15); c.rect(5, 11, 6, 1, 13); }
  c.outline(f ? 0 : 12);
} };

// ---------- the kitchen tileset (16x16): 0 and 1 the tiled wall (a checker of two), 2 the steel counter top, 3 the wooden counter front,
// 4 the shelf's back, 5 a dark wall below the ticket rail
export function kitchenTileset() {
  const tiles = [
    (c) => { c.rect(0, 0, 16, 16, 21); c.rect(0, 15, 16, 1, 20); c.rect(15, 0, 1, 16, 20); c.rect(0, 0, 15, 1, 22); },
    (c) => { c.rect(0, 0, 16, 16, 20); c.rect(0, 15, 16, 1, 24); c.rect(15, 0, 1, 16, 24); c.rect(0, 0, 15, 1, 21); },
    (c) => { c.rect(0, 0, 16, 16, 2); c.rect(0, 0, 16, 2, 3); c.rect(0, 13, 16, 3, 1); c.px(5, 6, 3); c.px(12, 9, 3); },
    (c) => { c.rect(0, 0, 16, 16, 9); c.rect(0, 0, 16, 1, 10); c.rect(0, 7, 16, 1, 8); c.rect(0, 15, 16, 1, 8); c.rect(5, 1, 1, 6, 8); c.rect(12, 8, 1, 7, 8); },
    (c) => { c.rect(0, 0, 16, 16, 8); c.rect(0, 0, 1, 16, 4); c.rect(0, 12, 16, 4, 9); c.rect(0, 12, 16, 1, 10); },
    (c) => { c.rect(0, 0, 16, 16, 24); c.rect(0, 0, 16, 1, 20); c.dither(0, 8, 16, 8, 20, 0); },
  ];
  const out = new Canvas(16 * tiles.length, 16);
  tiles.forEach((t, i) => { const c = new Canvas(16, 16); t(c); out.stamp(c, i * 16, 0); });
  return out;
}
export const TILE = { wall_a: 0, wall_b: 1, counter: 2, front: 3, shelf: 4, dark: 5 };
