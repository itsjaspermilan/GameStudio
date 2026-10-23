// Hand-drawn pilots: every pixel placed by hand, as GBA sprites were made, instead of painted from shapes (pilots.mjs paints the others
// for now). A drawing is a list of runs [x, y, "pixels"] on the 32 x 32 frame, one row of pixels each: "." leaves a pixel clear, "#" is the
// outline, other letters are places of the pilot's colour bank. The lit top and left of a part are outlined in its own darkest shade, not
// black (GBA selective outlining). The legs and the near arm have a drawing for each pose; everything else moves with the body's
// one-pixel dip. In the legs A B C / D E F are the far leg and boot (on the left, a step darker) and K L M / N O P the near one. Each half
// of the walk has its own leg drawings: in the first the near leg steps forward, in the second the far leg does, crossing behind it (a
// walk that only swaps the shading makes the same leg lead every step, which reads as a limp). Each arm swings against its own leg.

// ---------------------------------------------------------------- shared by every hand-drawn pilot
const LEGS = { // hips at y 24, feet on y 29; runs are drawn in order, so the near leg's runs come after the far leg's
  stand: [[7, 24, "#ABBC#KLLM#"], [7, 25, "#ABC##KLM#"], [7, 26, "#ABC##KLM#"], [6, 27, "#DDEF##NNOP#"], [6, 28, "#EEFF##OOPP#"], [7, 29, "####..####"]],
  // the near leg leads: it lands in front, takes the weight while the far foot kicks up behind, and the far foot swings through
  contact1: [[7, 24, "#ABBC#KLLM#"], [6, 25, "#ABC#.#KLM#"], [5, 26, "#ABC#...#KLM#"], [4, 27, "#DDEF#...#NNOP#"], [4, 28, "#EEFF#...#OOPP#"], [5, 29, "####.....####"]],
  down1: [[7, 24, "#ABBC#KLLM#"], [6, 25, "#ABC#.#KLM#"], [3, 26, "#DDEF#..#KLM#"], [3, 27, "#EEFF#..#NNOP#"], [4, 28, "####...#OOPP#"], [12, 29, "####"]],
  pass1: [[7, 24, "#ABBC#KLLM#"], [7, 25, "#ABC##KLM#"], [8, 26, "#DDEF#KLM#"], [9, 27, "####NNOP#"], [12, 28, "#OOPP#"], [13, 29, "####"]],
  // the far leg leads: it lands in front, behind the near leg, which pushes off behind, kicks up and swings through
  contact2: [[7, 24, "#ABBC#"], [9, 25, "#ABC#"], [11, 26, "#ABC#"], [14, 27, "#DDEF#"], [14, 28, "#EEFF#"], [15, 29, "####"],
    [12, 24, "#KLLM#"], [10, 25, "#KLM#"], [7, 26, "#KLM#"], [4, 27, "#NNOP#"], [4, 28, "#OOPP#"], [5, 29, "####"]],
  down2: [[7, 24, "#ABBC#"], [8, 25, "#ABC#"], [9, 26, "#ABC#"], [9, 27, "#DDEF#"], [9, 28, "#EEFF#"], [10, 29, "####"],
    [12, 24, "#KLLM#"], [11, 25, "#KLM#"], [6, 26, "#NNOP#"], [6, 27, "#OOPP#"], [7, 28, "####"]],
  pass2: [[7, 24, "#ABBC#"], [7, 25, "#ABC#"], [7, 26, "#ABC#"], [6, 27, "#DDEF#"], [6, 28, "#EEFF#"], [7, 29, "####"],
    [12, 24, "#KLLM#"], [12, 25, "#KLM#"], [12, 26, "#NNOP#"], [12, 27, "#OOPP#"], [13, 28, "####"]],
};
// frame by frame (0-1 idle, 2-7 walk): the legs, the body's dip, the near and far arms (each swings against its own leg)
const FRAMES = [
  { legs: "stand", bob: 0, arm: "mid", far: "mid" }, { legs: "stand", bob: 1, arm: "mid", far: "mid" },
  { legs: "contact1", bob: 0, arm: "back", far: "fwd" }, { legs: "down1", bob: 1, arm: "mid", far: "mid" }, { legs: "pass1", bob: 0, arm: "fwd", far: "back" },
  { legs: "contact2", bob: 0, arm: "fwd", far: "back" }, { legs: "down2", bob: 1, arm: "mid", far: "mid" }, { legs: "pass2", bob: 0, arm: "back", far: "fwd" },
];

function put(c, runs, map, dy = 0) {
  for (const [x, y, s] of runs) [...s].forEach((ch, i) => { if (ch !== "." && map[ch] !== undefined) c.px(x + i, y + dy, map[ch]); });
}

// ---------------------------------------------------------------- Nova: a round helmet with a big visor, a red scarf, a blue suit
const NOVA = {
  head: [ // the dome is lit from the top left, the visor turned to the right with two eyes and a glint
    [9, 1, "eeeeeeee"],
    [7, 2, "eehhhhgggg##"],
    [6, 3, "ehhhhhggggggf#"],
    [5, 4, "ehhhhgggggggfff#"],
    [4, 5, "ehhhgggg#########"],
    [4, 6, "ehhgggg#vvvvhhvvu#"],
    [3, 7, "ehhgggg#vvhhvvvvvuu#"],
    [3, 8, "#hgggg#vvvvvavvvauu#"],
    [3, 9, "#ggggf#vvvvvavvvauu#"],
    [3, 10, "#gggff#uvvvvvvvvuuu#"],
    [3, 11, "#ggfff#uuuvvvvvuuua#"],
    [3, 12, "#gfffff#uuuuuuuuuaa#"],
    [4, 13, "#ffffff#aaaaaaaaa#"],
    [4, 14, "#efffffff########"],
    [5, 15, "#eeffffffffffe#"],
    [6, 16, "##eeeeeeeeee##"],
  ],
  scarf: [[4, 17, "##tt#tttsssstss#"], [3, 18, "#sttss#ssrrrrsr#"]],
  tail: [[[1, 17, "###"], [0, 18, "#tsr"], [1, 19, "##"]], [[2, 16, "##"], [1, 17, "#ts"], [0, 18, "#sr#"], [1, 19, "#"]]], // its end flutters, above the far arm
  torso: [ // a chest light and a belt with a gold buckle
    [6, 19, "#ddddcccbb#"],
    [6, 20, "#ddvvdccccb#"],
    [6, 21, "#ddvudccccb#"],
    [6, 22, "#dddddcccbb#"],
    [6, 23, "#effgyygffe#"],
  ],
  farArm: { // the far arm, a shade darker, showing at the torso's left when it is not swung forward behind the body
    mid: [[4, 19, "#bb"], [3, 20, "#bba"], [3, 21, "#baa"], [3, 22, "#gfe"], [4, 23, "###"]],
    back: [[4, 19, "#bb"], [3, 20, "#bba#"], [2, 21, "#baa#"], [1, 22, "#gfe#"], [2, 23, "###"]],
    fwd: [[5, 19, "#b"], [5, 20, "#b"], [5, 21, "#a"]],
  },
  arm: { // the near arm at the torso's right, a white glove at the end
    mid: [[17, 19, "#cb#"], [17, 20, "#cbb#"], [17, 21, "#cba#"], [17, 22, "#hgf#"], [17, 23, "#ggf#"], [18, 24, "###"]],
    fwd: [[17, 19, "#cb#"], [17, 20, "#ccbb#"], [18, 21, "#cbb#"], [19, 22, "#hgf#"], [19, 23, "#gff#"], [20, 24, "###"]],
    back: [[16, 19, "#cb#"], [16, 20, "#cbb#"], [15, 21, "#cba#"], [15, 22, "#hgf#"], [15, 23, "#ggf#"], [16, 24, "###"]],
  },
};

// Nova, frame f. b: the colour bank (nova_lancer).
export function drawNova(c, f, b) {
  const map = { "#": b.out[0], a: b.blue[0], b: b.blue[1], c: b.blue[2], d: b.blue[3], e: b.grey[0], f: b.grey[1], g: b.grey[2], h: b.grey[3],
    r: b.red[0], s: b.red[1], t: b.red[2], u: b.teal[0], v: b.teal[1], y: b.flame[0] };
  const fr = FRAMES[f];
  const far = [b.blue[2], b.blue[1], b.blue[0], b.grey[2], b.grey[1], b.grey[0]], near = [b.blue[3], b.blue[2], b.blue[1], b.grey[3], b.grey[2], b.grey[1]];
  const legMap = { "#": b.out[0] };
  "ABCDEF".split("").forEach((k, i) => { legMap[k] = far[i]; });
  "KLMNOP".split("").forEach((k, i) => { legMap[k] = near[i]; });
  put(c, NOVA.farArm[fr.far], map, fr.bob);
  put(c, LEGS[fr.legs], legMap);
  put(c, NOVA.torso, map, fr.bob);
  put(c, NOVA.arm[fr.arm], map, fr.bob);
  put(c, NOVA.tail[f % 2], map, fr.bob);
  put(c, NOVA.scarf, map, fr.bob);
  put(c, NOVA.head, map, fr.bob);
}
