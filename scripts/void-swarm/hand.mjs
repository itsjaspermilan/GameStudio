// Hand-drawn pilots: every pixel placed by hand, as GBA sprites were made, instead of painted from shapes (pilots.mjs paints the others
// for now). A drawing is a list of runs [x, y, "pixels"], one row of pixels each: "." leaves a pixel clear, "#" is the dark outline, other
// letters are places of the pilot's colour bank. Drawn to the craft in .claude/skills/pixel-craft:
//   - light from the top left: highlights as one compact cluster, shadow only on the far side (no pillow shading, no parallel bands);
//   - selective outline: lit edges outlined in a mid shade of their own colour, shadow edges in the dark outline;
//   - proportions for 32 x 32: a helmet of about 14 rows, a torso of 6, legs of 7; arms and legs 3 pixels wide, never 1;
//   - a four-frame walk (contact, passing, contact, passing) at about 8 frames a second. Both contacts have the same stride, the second
//     with the legs crossing (the far leg comes forward behind the near one); the body rises a pixel as a foot passes under it.
//   - three-quarter view facing right: the head's visor and the chest's details look right; the near arm and leg are on the body's
//     left, the far arm and leg on its right, half behind it.
// In the legs A B C / D E F and K L M / N O P are the left and right leg and boot; the left one is the near leg (lighter).

export const WALK_CLIPS = { idle: { from: 0, to: 1, fps: 3, loop: true }, walk: { from: 2, to: 5, fps: 8, loop: true } };

const LEGS = { // hips at y 22, boots' soles on y 27 (the whole figure is drawn 2 rows lower)
  left: {
    stand: [[10, 22, "#ABC#"], [10, 23, "#ABC#"], [10, 24, "#ABC#"], [9, 25, "#DDEF#"], [9, 26, "#EEFF#"], [10, 27, "####"]],
    back: [[10, 22, "#ABC#"], [9, 23, "#ABC#"], [8, 24, "#ABC#"], [6, 25, "#DDEF#"], [6, 26, "#EEFF#"], [7, 27, "####"]],
    passing: [[10, 22, "#ABC#"], [11, 23, "#ABC#"], [11, 24, "#DDEF#"], [11, 25, "#EEFF#"], [12, 26, "####"]],
    front: [[10, 22, "#ABC#"], [12, 23, "#ABC#"], [14, 24, "#ABC#"], [16, 25, "#DDEF#"], [16, 26, "#EEFF#"], [17, 27, "####"]],
  },
  right: {
    stand: [[14, 22, "#KLM#"], [14, 23, "#KLM#"], [14, 24, "#KLM#"], [14, 25, "#NNOP#"], [14, 26, "#OOPP#"], [15, 27, "####"]],
    front: [[14, 22, "#KLM#"], [15, 23, "#KLM#"], [16, 24, "#KLM#"], [16, 25, "#NNOP#"], [16, 26, "#OOPP#"], [17, 27, "####"]],
    passing: [[14, 22, "#KLM#"], [13, 23, "#KLM#"], [13, 24, "#NNOP#"], [13, 25, "#OOPP#"], [14, 26, "####"]],
    back: [[14, 22, "#KLM#"], [12, 23, "#KLM#"], [10, 24, "#KLM#"], [7, 25, "#NNOP#"], [7, 26, "#OOPP#"], [8, 27, "####"]],
  },
};
// frame by frame (0-1 idle, 2-5 walk; 6-7 repeat 2-3): the legs, the body's rise (-1 is a pixel up), the near (left) and far (right)
// arms; each arm swings against the leg on its own side
const FRAMES = [
  { left: "stand", right: "stand", bob: 0, arm: "mid", farArm: "mid" }, { left: "stand", right: "stand", bob: 1, arm: "mid", farArm: "mid" },
  { left: "back", right: "front", bob: 0, arm: "front", farArm: "back" },
  { left: "passing", right: "stand", bob: -1, arm: "mid", farArm: "mid" },
  { left: "front", right: "back", bob: 0, arm: "back", farArm: "front" },
  { left: "stand", right: "passing", bob: -1, arm: "mid", farArm: "mid" },
  { left: "back", right: "front", bob: 0, arm: "front", farArm: "back" },
  { left: "passing", right: "stand", bob: -1, arm: "mid", farArm: "mid" },
];

function put(c, runs, map, dy = 0) {
  for (const [x, y, s] of runs) [...s].forEach((ch, i) => { if (ch !== "." && map[ch] !== undefined) c.px(x + i, y + dy, map[ch]); });
}

// ---------------------------------------------------------------- Nova: a round helmet with a big visor, a red scarf, a blue suit
const NOVA = {
  helmet: [ // the highlight is one cluster at the top left; the visor sits in the shadow of the brim, a glint and two eyes behind it
    [12, 1, "fffff##"],
    [11, 2, "fhhgggg#"],
    [10, 3, "fhhhgggggf#"],
    [9, 4, "fhhgggggggff#"],
    [8, 5, "fhggggaaaaaaae#"],
    [8, 6, "fggggavvhhvvua#"],
    [8, 7, "fgggfavvavvaua#"],
    [8, 8, "fggffauvavvaua#"],
    [8, 9, "fgfffauuuuuuua#"],
    [8, 10, "fffffeaaaaaaae#"],
    [9, 11, "#fffffeeeeee#"],
    [10, 12, "#ffffeeeee#"],
    [11, 13, "#feeeeee#"],
    [12, 14, "#######"],
  ],
  scarf: [[9, 15, "#ttttssssr#"], [9, 16, "#ssrrrrrrr#"]],
  tail: [[[5, 15, "#tt"], [4, 16, "#sr#"]], [[5, 16, "#ts"], [4, 17, "#sr#"]]], // its end flutters behind, two drawings
  torso: [ // the chest faces right: its teal light and the gold buckle sit right of centre; the lit left edge outlined in mid blue
    [9, 17, "bddccccbba#"],
    [9, 18, "bdcccvvbba#"],
    [9, 19, "bdcccvubaa#"],
    [9, 20, "bdcccccbaa#"],
    [9, 21, "#ffggfyyfe#"],
  ],
  arm: { // the near arm, at the torso's left and in front of it, a white glove at the end
    mid: [[6, 17, "#dc#"], [5, 18, "#dcb#"], [5, 19, "#dcb#"], [5, 20, "#cbb#"], [5, 21, "#hgf#"], [6, 22, "###"]],
    front: [[6, 17, "#dc#"], [6, 18, "#dcb#"], [7, 19, "#dcb#"], [8, 20, "#cbb#"], [8, 21, "#hgf#"], [9, 22, "###"]],
    back: [[6, 17, "#dc#"], [5, 18, "#dcb#"], [4, 19, "#dcb#"], [3, 20, "#cbb#"], [3, 21, "#hgf#"], [4, 22, "###"]],
  },
  farArm: { // the far arm, a step darker, half behind the torso's right side
    mid: [[19, 17, "bb#"], [19, 18, "bba#"], [19, 19, "baa#"], [19, 20, "baa#"], [19, 21, "gfe#"], [20, 22, "##"]],
    front: [[19, 17, "bb#"], [19, 18, "bba#"], [20, 19, "baa#"], [21, 20, "baa#"], [21, 21, "gfe#"], [22, 22, "##"]],
    back: [[19, 17, "bb#"], [19, 18, "ba#"], [19, 19, "a#"]],
  },
};

// Nova, frame f. b: the colour bank (nova_lancer).
export function drawNova(c, f, b) {
  const map = { "#": b.out[0], a: b.blue[0], b: b.blue[1], c: b.blue[2], d: b.blue[3], e: b.grey[0], f: b.grey[1], g: b.grey[2], h: b.grey[3],
    r: b.red[0], s: b.red[1], t: b.red[2], u: b.teal[0], v: b.teal[1], y: b.flame[0] };
  const fr = FRAMES[f], dy = 2 + fr.bob, feet = 2; // the legs stay on the ground; the body above them rises and dips
  const far = [b.blue[2], b.blue[1], b.blue[0], b.grey[2], b.grey[1], b.grey[0]], near = [b.blue[3], b.blue[2], b.blue[1], b.grey[3], b.grey[2], b.grey[1]];
  const legMap = { "#": b.out[0] };
  "ABCDEF".split("").forEach((k, i) => { legMap[k] = near[i]; });
  "KLMNOP".split("").forEach((k, i) => { legMap[k] = far[i]; });
  // back to front: the far arm and leg, the near leg, the torso, then the near arm over it
  put(c, NOVA.farArm[fr.farArm], map, dy);
  put(c, LEGS.right[fr.right], legMap, feet);
  put(c, LEGS.left[fr.left], legMap, feet);
  put(c, NOVA.torso, map, dy);
  put(c, NOVA.arm[fr.arm], map, dy);
  put(c, NOVA.tail[f % 2], map, dy);
  put(c, NOVA.scarf, map, dy);
  put(c, NOVA.helmet, map, dy);
}
