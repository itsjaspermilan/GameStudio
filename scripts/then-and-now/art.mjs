// The art of carts/then-and-now: Wren and Wren's shots. The rest is in sprites.mjs (enemies, things), people.mjs (echoes, portraits)
// and tiles.mjs (tilesets). Everything is drawn facing right with the light from the top left; the game mirrors sprites to face left.

// ---------- the hero (32x32, feet at the bottom middle): a station scavenger, not a spacesuit
// Messy purple hair, big teal goggles, an orange bomber jacket, a chunky salvaged blaster and a red scarf. Only the scarf's knot is
// drawn here: its tail is a little rope the game simulates (entities/hero.lua), so it streams behind on runs and dashes.
// A frame is a leg pose plus an aim. Frame numbers are listed in HERO_FRAMES and copied into the game's lib/art.lua, with each frame's
// body bob (HERO_DY) so the game knows where the neck and the gun are.
const OUT = 0, TROUSERS = 17, TROUSERS_LIGHT = 18, BOOT = 8, BOOT_LIGHT = 9, METAL = 2, SHINE = 3, GRIP = 1;
const JACKET = 10, JACKET_LIGHT = 11, JACKET_DARK = 9, SKIN = 7, SCARF = 6, SCARF_DARK = 5, SCARF_LIGHT = 6, GLOW = 22;

const HEAD = [
  "     oo  ooo    ",
  "   ooHHooHHHo   ",
  "  oHHhhHHhhhHo  ",
  " oHhhhhhhhhhhho ",
  "ohhhhhhhhhhhhhho",
  "odhhhhhhhoGGGGGo",
  "oddhhggggGlLLwlo",
  "oddhhhhhhGllllLo",
  " oddhhhhhoggggo ",
  "  oddhhoSssssso ",
  "   oddoSsssssSo ",
  "     ooooooo    ",
];
const HEAD_MAP = { o: OUT, d: 28, h: 29, H: 30, s: SKIN, S: SKIN, g: GRIP, G: 21, l: 21, L: GLOW, w: 23 }; // the goggles: a dark frame round a teal lens
const TORSO = [
  "  oooooooo  ",
  " oJJJJJJjjo ",
  "oJJjjjjjjjqo",
  "oJjjjjjjjjqo",
  "oqjjjjjjjjqo",
  "oqjjjjjjjjqo",
  "oqqjjjjjjqqo",
  "oqqqjjjjqqqo",
  "obbbbbbBbbbo",
  " oooooooooo ",
];
const TORSO_MAP = { o: OUT, J: JACKET_LIGHT, j: JACKET, q: JACKET_DARK, b: BOOT, B: 13 };

function thick(c, x0, y0, x1, y1, col, edge) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    c.rect(x - 1, y, 3, 1, col).px(x + 1, y, edge);
  }
}
function leg(c, hip, knee, foot, light) {
  const fy = Math.min(29, foot[1]);
  thick(c, hip[0], hip[1], knee[0], knee[1], TROUSERS, light ? TROUSERS_LIGHT : TROUSERS);
  thick(c, knee[0], knee[1], foot[0], fy - 1, TROUSERS, light ? TROUSERS_LIGHT : TROUSERS);
  c.rect(foot[0] - 2, fy, 5, 3, BOOT).rect(foot[0] - 2, fy, 5, 1, BOOT_LIGHT).px(foot[0] + 2, fy + 1, BOOT_LIGHT);
}

// knee and foot of each leg (absolute, facing right); dy is how far the body sits lower than standing
const POSES = {
  stand: { dy: 0, back: [[14, 25], [13, 29]], front: [[18, 25], [19, 29]] },
  breathe: { dy: 1, back: [[14, 25], [13, 29]], front: [[18, 25], [19, 29]] },
  jump: { dy: -1, back: [[13, 25], [12, 29]], front: [[21, 22], [19, 26]] },
  fall: { dy: 0, back: [[13, 24], [11, 28]], front: [[20, 24], [21, 28]] },
  crouch: { dy: 5, back: [[12, 26], [11, 29]], front: [[21, 25], [20, 29]] },
  land: { dy: 3, back: [[13, 25], [12, 29]], front: [[20, 24], [20, 29]] },
  dash: { dy: 2, back: [[10, 23], [6, 25]], front: [[20, 24], [22, 28]] },
  slide: { dy: 0, back: [[11, 22], [9, 24]], front: [[18, 25], [18, 29]] },
  hurt: { dy: 1, back: [[11, 24], [8, 28]], front: [[19, 24], [22, 27]] },
};
// a run cycle for one leg: reach and land, take the weight, push back, lift behind, swing through, knee up. The other leg is 3 behind.
const RUN = [[[21, 24], [23, 29]], [[20, 25], [19, 29]], [[17, 25], [14, 29]], [[13, 25], [9, 27]], [[15, 24], [12, 26]], [[20, 23], [18, 27]]];
for (let k = 0; k < 6; k++) {
  const b = RUN[(k + 3) % 6];
  POSES["run" + k] = { dy: [0, 1, -1, 0, 1, -1][k], front: RUN[k], back: [[b[0][0] - 3, b[0][1]], [b[1][0] - 3, b[1][1]]] };
}

function gun(c, aim, dy) {
  if (aim === "fwd") {
    c.rect(15, 15 + dy, 6, 3, JACKET).rect(15, 15 + dy, 6, 1, JACKET_LIGHT);           // sleeve
    c.rect(19, 14 + dy, 9, 4, METAL).rect(19, 14 + dy, 9, 1, SHINE).rect(19, 17 + dy, 9, 1, GRIP);
    c.rect(21, 15 + dy, 3, 1, 14).rect(28, 15 + dy, 2, 2, METAL).px(28, 15 + dy, SHINE).px(30, 15 + dy, GLOW).px(30, 16 + dy, GLOW);
    c.rect(21, 18 + dy, 2, 2, GRIP).rect(19, 16 + dy, 2, 2, SKIN);                      // grip, hand
  } else if (aim === "up") {
    thick(c, 17, 15 + dy, 21, 11 + dy, JACKET, JACKET_LIGHT);
    c.rect(23, 1 + dy, 4, 9, METAL).rect(23, 1 + dy, 1, 9, SHINE).rect(26, 1 + dy, 1, 9, GRIP);
    c.rect(24, 4 + dy, 1, 3, 14).px(24, 0 + dy, GLOW).px(25, 0 + dy, GLOW).rect(21, 9 + dy, 2, 2, SKIN);
  } else {
    c.rect(16, 16 + dy, 3, 4, JACKET).rect(16, 16 + dy, 1, 4, JACKET_LIGHT);
    c.rect(16, 21 + dy, 4, 8, METAL).rect(16, 21 + dy, 1, 8, SHINE).rect(19, 21 + dy, 1, 8, GRIP);
    c.rect(17, 23 + dy, 1, 3, 14).px(17, 29 + dy, GLOW).px(18, 29 + dy, GLOW).rect(16, 20 + dy, 3, 1, SKIN);
  }
}

function hero(c, poseName, aim) {
  const P = POSES[poseName], dy = P.dy;
  leg(c, [14, 21 + dy], P.back[0], P.back[1], false);
  c.ascii(TORSO, TORSO_MAP, 10, 12 + dy);
  leg(c, [17, 21 + dy], P.front[0], P.front[1], true);
  c.ascii(HEAD, HEAD_MAP, 8, 1 + dy);
  c.rect(11, 12 + dy, 9, 3, SCARF).rect(11, 12 + dy, 9, 1, SCARF_LIGHT).rect(11, 14 + dy, 9, 1, SCARF_DARK);   // the scarf's knot
  gun(c, aim, dy);
  c.outline(OUT);
}

// [pose, aim] for every frame, in order
const HERO_LIST = [
  ["stand", "fwd"], ["breathe", "fwd"],
  ...[0, 1, 2, 3, 4, 5].map((k) => ["run" + k, "fwd"]),
  ["jump", "fwd"], ["fall", "fwd"], ["crouch", "fwd"], ["dash", "fwd"], ["slide", "fwd"], ["land", "fwd"],
  ["stand", "up"], ["breathe", "up"],
  ...[0, 1, 2, 3, 4, 5].map((k) => ["run" + k, "up"]),
  ["jump", "up"], ["fall", "up"], ["jump", "down"], ["fall", "down"],
  ["hurt", "fwd"],
];
export const HERO_FRAMES = {
  idle: 0, run: 2, jump: 8, fall: 9, crouch: 10, dash: 11, slide: 12, land: 13,
  idle_up: 14, run_up: 16, jump_up: 22, fall_up: 23, jump_down: 24, fall_down: 25, hurt: 26,
};
export const HERO_DY = HERO_LIST.map(([p]) => POSES[p].dy);
export const SPR_HERO = { w: 32, h: 32, frames: HERO_LIST.length, draw: (c, f) => hero(c, ...HERO_LIST[f]) };

// ---------- shots (8x8, centred): 0 blaster bolt, 1 charged shot, 2 missile. All point right; the game turns them.
export const SPR_SHOT = {
  w: 8, h: 8, frames: 3, draw(c, f) {
    if (f === 0) c.rect(1, 3, 6, 2, 13).rect(2, 3, 5, 1, 15).px(7, 3, 3);
    else if (f === 1) c.disc(4, 4, 3.6, 21).disc(4, 4, 2.3, 22).disc(4.5, 3.5, 1.2, 23);
    else c.rect(1, 3, 5, 2, METAL).rect(1, 4, 5, 1, BOOT).rect(6, 3, 1, 2, 6).px(1, 2, 5).px(1, 5, 5).rect(0, 3, 1, 2, 10);
  },
};

