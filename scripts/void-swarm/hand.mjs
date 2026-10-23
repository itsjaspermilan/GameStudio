// Hand-drawn pilots: every pixel placed by hand, as GBA sprites were made, instead of painted from shapes (pilots.mjs paints the others
// for now). A drawing is a list of runs [x, y, "pixels"] on the 32 x 32 frame, one row of pixels each: "." leaves a pixel clear, "#" is the
// outline, other letters are places of the pilot's colour bank. The lit top and left of a part are outlined in its own darkest shade, not
// black (GBA selective outlining). The legs and the near arm have a drawing for each pose; everything else moves with the body's
// one-pixel dip. In the legs A B C / D E F are the far leg and boot (on the left, a step darker) and K L M / N O P the near one.
//
// The walk is a shuffle in the way of Vampire Survivors and GBA overworld sprites, not a side-on stride: four frames at six a second,
// standing, then one foot lifting a pixel and stepping while the other stays planted, standing, then the other foot. The body dips a
// pixel on each step and each arm swings a pixel against its own leg. At this size a full stride reads as a limp or a scramble.
export const WALK_CLIPS = { idle: { from: 0, to: 1, fps: 3, loop: true }, walk: { from: 2, to: 5, fps: 6, loop: true } };

const LEFT = { // the far leg: standing, and lifted a pixel and stepped forward
  stand: [[7, 24, "#ABBC#"], [7, 25, "#ABC#"], [7, 26, "#ABC#"], [6, 27, "#DDEF#"], [6, 28, "#EEFF#"], [7, 29, "####"]],
  step: [[7, 24, "#ABBC#"], [7, 25, "#ABC#"], [7, 26, "#DDEF#"], [7, 27, "#EEFF#"], [8, 28, "####"]],
};
const RIGHT = { // the near leg, drawn after the far one
  stand: [[12, 24, "#KLLM#"], [12, 25, "#KLM#"], [12, 26, "#KLM#"], [12, 27, "#NNOP#"], [12, 28, "#OOPP#"], [13, 29, "####"]],
  step: [[12, 24, "#KLLM#"], [12, 25, "#KLM#"], [13, 26, "#NNOP#"], [13, 27, "#OOPP#"], [14, 28, "####"]],
};
// frame by frame (0-1 idle, 2-5 walk; 6-7 repeat 2-3): the legs, the body's dip, the near and far arms
const STAND = { left: "stand", right: "stand", bob: 0, arm: "mid", far: "mid" };
const FRAMES = [
  STAND, { ...STAND, bob: 1 },
  STAND, { left: "step", right: "stand", bob: 1, arm: "fwd", far: "back" }, STAND, { left: "stand", right: "step", bob: 1, arm: "back", far: "fwd" },
  STAND, { left: "step", right: "stand", bob: 1, arm: "fwd", far: "back" },
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
    back: [[4, 19, "#bb"], [3, 20, "#bba"], [2, 21, "#baa#"], [2, 22, "#gfe#"], [3, 23, "###"]],
    fwd: [[4, 19, "#bb"], [4, 20, "#bba"], [4, 21, "#baa"], [4, 22, "#gfe"], [5, 23, "##"]],
  },
  arm: { // the near arm at the torso's right, a white glove at the end
    mid: [[17, 19, "#cb#"], [17, 20, "#cbb#"], [17, 21, "#cba#"], [17, 22, "#hgf#"], [17, 23, "#ggf#"], [18, 24, "###"]],
    fwd: [[17, 19, "#cb#"], [17, 20, "#cbb#"], [18, 21, "#cba#"], [18, 22, "#hgf#"], [18, 23, "#ggf#"], [19, 24, "###"]],
    back: [[17, 19, "#cb#"], [17, 20, "#cbb#"], [16, 21, "#cba#"], [16, 22, "#hgf#"], [16, 23, "#ggf#"], [17, 24, "###"]],
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
  put(c, LEFT[fr.left], legMap);
  put(c, RIGHT[fr.right], legMap);
  put(c, NOVA.torso, map, fr.bob);
  put(c, NOVA.arm[fr.arm], map, fr.bob);
  put(c, NOVA.tail[f % 2], map, fr.bob);
  put(c, NOVA.scarf, map, fr.bob);
  put(c, NOVA.head, map, fr.bob);
}
