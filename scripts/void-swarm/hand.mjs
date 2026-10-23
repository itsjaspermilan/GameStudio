// Hand-drawn pilots: every pixel placed in a text grid, as GBA sprites were made, instead of painted from shapes (pilots.mjs paints the
// rest). A pilot is drawn in parts the way GBA artists built a walk: the helmet, scarf, torso and jet pack are drawn once and move with
// the body's dip; the arm has three poses and the legs one drawing per frame. Frames 3 to 5 of the walk use frames 0 to 2's legs with the
// two legs' shading swapped (the lighter, near leg is the one in front), which is how many GBA walks were drawn.
//
// In a grid "." is clear and "#" the outline; other letters are places of the pilot's colour bank, given per pilot. In the leg grids
// A B C are one leg (light, mid, dark) and D E F its boot; a b c and d e f are the other leg and boot.

// ---------------------------------------------------------------- Nova
const NOVA_HELMET = [ // 16 x 14, at (8, 1): a round dome lit from the top left, the visor turned to the right with two eyes behind it
  ".....######.....",
  "...##hhhhgg##...",
  "..#hhhhhhgggg#..",
  ".#hhhhhhgggggf#.",
  ".#hhhhg#######f#",
  "#hhhg#vvvhhhv#f#",
  "#hhhg#vvavvav#f#",
  "#hhgg#uvauvau#f#",
  "#hggg#uuuuuuu#f#",
  "#gggf##auuuu##f#",
  ".#ggff######ff#.",
  ".#ffffffffeeee#.",
  "..#effffffeee#..",
  "....########....",
];
const NOVA_TORSO = [ // 12 x 8, at (10, 17): the suit, a grey chest light, a belt with a gold buckle
  ".#dddcccbb#.",
  "#ddccgggcba#",
  "#dcccfhfbba#",
  "#dcccgggbba#",
  "#dccccbbbba#",
  "#effgyygffe#",
  "#bccccbbbaa#",
  ".##########.",
];
const NOVA_SCARF = [ // 13 x 3, at (9, 15): wrapped round the neck, a fold where it is knotted at the front
  "#ttttsstssr##",
  "#sssrrsrrrr#r",
  ".#########.##",
];
const NOVA_TAIL = [ // 8 x 5, at (2, 14): the scarf's end, fluttering up and down
  ["....###.", ".##stttt", "#rssss#.", ".#rr##..", "........"],
  ["........", "....####", ".###sttt", "#rsssss#", ".###rr#."],
];
const NOVA_PACK = [ // 6 x 8, at (5, 17): the jet pack on the back, kept dull so the eye goes to the pilot
  ".####.",
  "#gfee#",
  "#fffe#",
  "#feee#",
  "#gfee#",
  "#feee#",
  "#ffee#",
  ".####.",
];
const NOVA_FLAME = [ // at (5, 26)
  [".yy.", ".y..", "...."],
  ["yyy.", ".y..", "..y."],
];
const NOVA_ARM = { // 7 x 6, at (19, 18): the near arm, swinging against the near leg
  back: [".###...", "#dcb#..", "#cbb#..", "#cb#...", "#hf#...", ".##...."],
  mid: [".###...", "#dcb#..", "#ccb#..", "#cba#..", "#hgf#..", ".###..."],
  fwd: [".###...", "#dcb#..", "#ccbb#.", ".#cbbb#", "..#hgf#", "...###."],
};

// ---------------------------------------------------------------- the legs, shared by every hand-drawn pilot: 16 x 6 at (8, 25)
const LEGS = {
  stand: [
    "...#ABC##abc#...",
    "...#ABC##abc#...",
    "...#ABC##abc#...",
    "..#DDEF##ddef#..",
    "..#EEFF##eeff#..",
    "...####..####...",
  ],
  contact: [ // one foot lands in front, the other pushes off behind
    "...#ABC##abc#...",
    "..#ABC#..#abc#..",
    ".#ABC#....#abc#.",
    "#DDEF#....#ddef#",
    "#EEFF#....#eeff#",
    ".####......####.",
  ],
  down: [ // the front foot takes the weight, the back one kicks up behind
    "...#ABC##abc#...",
    "..#ABC#..#abc#..",
    "#DDEF#...#abc#..",
    "#EEFF#..#ddef#..",
    ".####...#eeff#..",
    ".........####...",
  ],
  pass: [ // the back foot swings through under the body, lifted
    "...#ABC##abc#...",
    "...#ABC##abc#...",
    "....#DDEF#abc#..",
    ".....####ddef#..",
    "........#eeff#..",
    ".........####...",
  ],
};
// frame by frame: the legs, whether the legs swap shading, the body's dip, the arm
const WALK = [
  { legs: "stand", swap: false, bob: 0, arm: "mid" }, { legs: "stand", swap: false, bob: 1, arm: "mid" }, // idle, breathing
  { legs: "contact", swap: false, bob: 0, arm: "back" }, { legs: "down", swap: false, bob: 1, arm: "mid" }, { legs: "pass", swap: false, bob: 0, arm: "fwd" },
  { legs: "contact", swap: true, bob: 0, arm: "fwd" }, { legs: "down", swap: true, bob: 1, arm: "mid" }, { legs: "pass", swap: true, bob: 0, arm: "back" },
];

// a grid onto the canvas: letters through `map` (bank places), "." left clear
function put(c, rows, map, ox, oy) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== "." && map[ch] !== undefined) c.px(ox + x, oy + y, map[ch]); }));
}

// Nova, frame f (0-1 idle, 2-7 walk). b: the colour bank (nova_lancer).
export function drawNova(c, f, b) {
  const map = { "#": b.out[0], a: b.blue[0], b: b.blue[1], c: b.blue[2], d: b.blue[3], e: b.grey[0], f: b.grey[1], g: b.grey[2], h: b.grey[3],
    r: b.red[0], s: b.red[1], t: b.red[2], u: b.teal[0], v: b.teal[1], y: b.flame[0] };
  const w = WALK[f], bob = w.bob;
  // the near leg is a step lighter than the far one; a swapped frame draws the drawing's left leg light
  const near = { 1: b.blue[3], 2: b.blue[2], 3: b.blue[1], 4: b.grey[3], 5: b.grey[2], 6: b.grey[1] };
  const far = { 1: b.blue[2], 2: b.blue[1], 3: b.blue[0], 4: b.grey[2], 5: b.grey[1], 6: b.grey[0] };
  const [one, two] = w.swap ? [near, far] : [far, near];
  const legMap = { "#": b.out[0], A: one[1], B: one[2], C: one[3], D: one[4], E: one[5], F: one[6], a: two[1], b: two[2], c: two[3], d: two[4], e: two[5], f: two[6] };
  put(c, NOVA_PACK, map, 5, 17 + bob);
  put(c, NOVA_FLAME[f % 2], map, 6, 25 + bob);
  put(c, LEGS[w.legs], legMap, 8, 25);
  put(c, NOVA_TORSO, map, 10, 17 + bob);
  put(c, NOVA_TAIL[f % 2], map, 2, 14 + bob);
  put(c, NOVA_SCARF, map, 9, 15 + bob);
  put(c, NOVA_ARM[w.arm], map, 19, 18 + bob);
  put(c, NOVA_HELMET, map, 8, 1 + bob);
}
