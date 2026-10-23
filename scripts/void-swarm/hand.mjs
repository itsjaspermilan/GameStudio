// Hand-drawn pilots: every pixel placed by hand, as GBA sprites were made, instead of painted from shapes (pilots.mjs paints the others
// for now). A drawing is a list of runs [x, y, "pixels"] on the 32 x 32 frame, one row of pixels each: "." leaves a pixel clear, "#" is the
// outline, other letters are places of the pilot's colour bank. The lit top and left of a part are outlined in its own darkest shade, not
// black (GBA selective outlining). The legs and the near arm have a drawing for each pose; everything else moves with the body's
// one-pixel dip. In the legs A B C / D E F are the left leg and boot and K L M / N O P the right one: the far (left) leg is a step darker,
// and the second half of the walk swaps the two, which is how many GBA walks were drawn.

// ---------------------------------------------------------------- shared by every hand-drawn pilot
const LEGS = { // hips at y 24, feet on y 29
  stand: [[7, 24, "#ABBC#KLLM#"], [7, 25, "#ABC##KLM#"], [7, 26, "#ABC##KLM#"], [6, 27, "#DDEF##NNOP#"], [6, 28, "#EEFF##OOPP#"], [7, 29, "####..####"]],
  contact: [ // one foot lands in front, the other pushes off behind
    [7, 24, "#ABBC#KLLM#"], [6, 25, "#ABC#.#KLM#"], [5, 26, "#ABC#...#KLM#"], [4, 27, "#DDEF#...#NNOP#"], [4, 28, "#EEFF#...#OOPP#"], [5, 29, "####.....####"]],
  down: [ // the front foot takes the weight, the back one kicks up behind
    [7, 24, "#ABBC#KLLM#"], [6, 25, "#ABC#.#KLM#"], [3, 26, "#DDEF#..#KLM#"], [3, 27, "#EEFF#..#NNOP#"], [4, 28, "####...#OOPP#"], [12, 29, "####"]],
  pass: [ // the back foot swings through under the body, lifted
    [7, 24, "#ABBC#KLLM#"], [7, 25, "#ABC##KLM#"], [8, 26, "#DDEF#KLM#"], [9, 27, "####NNOP#"], [12, 28, "#OOPP#"], [13, 29, "####"]],
};
// frame by frame (0-1 idle, 2-7 walk): the legs, whether they swap shading, the body's dip, the near arm
const FRAMES = [
  { legs: "stand", swap: false, bob: 0, arm: "mid" }, { legs: "stand", swap: false, bob: 1, arm: "mid" },
  { legs: "contact", swap: false, bob: 0, arm: "back" }, { legs: "down", swap: false, bob: 1, arm: "mid" }, { legs: "pass", swap: false, bob: 0, arm: "fwd" },
  { legs: "contact", swap: true, bob: 0, arm: "fwd" }, { legs: "down", swap: true, bob: 1, arm: "mid" }, { legs: "pass", swap: true, bob: 0, arm: "back" },
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
  tail: [[[2, 19, "#srs#"], [2, 20, "#r#"]], [[1, 18, "##"], [0, 19, "#ss#"], [1, 20, "##"]]], // its end flutters, two drawings
  torso: [ // a chest light and a belt with a gold buckle
    [6, 19, "#ddddcccbb#"],
    [6, 20, "#ddvvdccccb#"],
    [6, 21, "#ddvudccccb#"],
    [6, 22, "#dddddcccbb#"],
    [6, 23, "#effgyygffe#"],
  ],
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
  const [left, right] = fr.swap ? [near, far] : [far, near];
  const legMap = { "#": b.out[0] };
  "ABCDEF".split("").forEach((k, i) => { legMap[k] = left[i]; });
  "KLMNOP".split("").forEach((k, i) => { legMap[k] = right[i]; });
  put(c, LEGS[fr.legs], legMap);
  put(c, NOVA.torso, map, fr.bob);
  put(c, NOVA.arm[fr.arm], map, fr.bob);
  put(c, NOVA.tail[f % 2], map, fr.bob);
  put(c, NOVA.scarf, map, fr.bob);
  put(c, NOVA.head, map, fr.bob);
}
