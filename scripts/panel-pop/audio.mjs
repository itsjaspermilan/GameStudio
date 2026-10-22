// Sound effects and songs for Panel Pop & Doc Capsule. Same helpers as Void Swarm (scripts/void-swarm/audio.mjs).
import { S, sfx, Song, jingle } from "../void-swarm/audio.mjs";

const POP = [50, 53, 57, 60, 62, 65, 69, 72]; // each panel of a combo pops a step higher
export const SFX = {
  move: sfx(1, ["square", [S(66, 2, 5)]]),
  swap: sfx(1, ["square", [S(58, 3), S(64, 3, 5)]]),
  land: sfx(1, ["noise", [S(30, 3, 5), S(26, 1, 5)]]),
  raise: sfx(1, ["tri", [S(40, 2, 5)]]),
  clear: sfx(2, ["pulse", [S(55, 3), S(59, 3), S(64, 4, 5)]]),
  chain2: sfx(2, ["bell", [S(64, 5), S(68, 5), S(71, 5, 5)]], ["pulse", [S(52, 3), S(56, 3), S(59, 3, 5)]]),
  chain3: sfx(2, ["bell", [S(66, 5), S(70, 5), S(73, 5), S(78, 5, 5)]], ["pulse", [S(54, 3), S(58, 3), S(61, 3), S(66, 3, 5)]]),
  chain4: sfx(2, ["bell", [S(68, 6), S(72, 6), S(75, 6), S(80, 6), S(84, 6, 5)]], ["square", [S(56, 3), S(60, 3), S(63, 3), S(68, 3), S(72, 3, 5)]]),
  chain5: sfx(2, ["bell", [S(70, 6), S(74, 6), S(77, 6), S(82, 6), S(86, 6), S(89, 6, 5)]], ["square", [S(58, 4), S(62, 4), S(65, 4), S(70, 4), S(74, 4), S(77, 4, 5)]]),
  combo: sfx(2, ["pulse", [S(62, 4), S(66, 4), S(69, 4), S(74, 5, 5)]], ["tri", [S(50, 4), S(54, 4), S(57, 4), S(62, 4, 5)]]),
  garb_land: sfx(2, ["noise", [S(34, 6, 3), S(28, 5, 5), S(24, 3, 5)]], ["tri", [S(24, 6, 3), S(20, 5, 5)]]),
  garb_break: sfx(2, ["noise", [S(46, 4, 3), S(40, 4, 5)]], ["square", [S(48, 3), S(55, 3), S(60, 3, 5)]]),
  send: sfx(2, ["saw", [S(48, 4, 1), S(60, 4, 5)]], ["square", [S(36, 3), S(36, 0)]]),
  panic: sfx(3, ["square", [S(58, 3), S(0, 0), S(58, 3), S(0, 0)]]),
  tick: sfx(3, ["square", [S(60, 4, 5)]]),
  go: sfx(3, ["square", [S(72, 5), S(72, 5, 7), S(72, 4, 5)]], ["tri", [S(60, 5), S(60, 5, 7), S(60, 4, 5)]]),
  win: sfx(3, ["square", [S(60), S(64), S(67), S(72, 5, 7), S(72, 5, 5)]], ["tri", [S(48), S(52), S(55), S(60, 5, 7), S(60, 5, 5)]]),
  lose: sfx(4, ["saw", [S(50, 5, 3), S(46, 5, 3), S(42, 5, 3), S(36, 5, 5)]], ["noise", [S(40, 3, 5), S(0, 0), S(0, 0), S(0, 0)]]),
  solved: sfx(3, ["bell", [S(64), S(67), S(72), S(76), S(79, 6, 5)]], ["square", [S(52, 3), S(55, 3), S(60, 3), S(64, 3), S(67, 3, 5)]]),
  speedup: sfx(3, ["square", [S(60, 3), S(67, 3), S(72, 4, 5)]]),
  ok: sfx(2, ["square", [S(60, 4), S(67, 5, 5)]]),
  back: sfx(2, ["square", [S(60, 4), S(53, 4, 5)]]),
  select: sfx(1, ["square", [S(64, 2, 5)]]),
  error: sfx(3, ["saw", [S(30, 5), S(0, 0), S(30, 5)]]),
  pill_move: sfx(1, ["square", [S(55, 2, 5)]]),
  pill_rot: sfx(1, ["square", [S(62, 3), S(67, 3, 5)]]),
  pill_land: sfx(1, ["noise", [S(28, 3, 5), S(24, 2, 5)]]),
  virus_pop: sfx(2, ["noise", [S(46, 4, 3), S(42, 4, 5)]], ["square", [S(60, 3), S(55, 3), S(48, 3, 5)]]),
  pill_clear: sfx(2, ["pulse", [S(58, 3), S(62, 3), S(67, 4, 5)]]),
  virus_laugh: sfx(2, ["pulse", [S(48, 3, 2), S(46, 3, 2), S(48, 3, 2), S(44, 3, 5)]]),
};
POP.forEach((p, i) => { SFX["pop" + (i + 1)] = sfx(2, ["square", [S(p, 4), S(p + 7, 3, 5)]], ["bell", [S(p + 12, 3, 5)]]); });

const D = "gm_drum_kit";
const SONGS = {
  msc_title: { seed: 11, root: 0, scale: "major", tempo: 118, oct: 5, inst: ["bell", "epiano", "bass", D], harmony: "arp8", bass: "eighth", drums: "four", rhythms: [3, 1, 0], rest: 0.3, reverb: 25, vol: [0, -2, -1, -3],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [0, 2, 3, 4] }, { prog: [5, 3, 0, 4] }], order: [0, 1, 0, 2] },
  msc_menu: { seed: 23, root: 5, scale: "lydian", tempo: 100, oct: 5, inst: ["flute", "pad", "bass", D], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.4, calm: true, reverb: 35, vol: [0, -1, -1, -4], fill: false,
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [1, 4, 0, 0] }], order: [0, 1] },
  msc_endless: { seed: 31, root: 7, scale: "major", tempo: 130, oct: 5, inst: ["lead", "pluck", "bass", D], harmony: "arp8", bass: "pump", drums: "four", rhythms: [1, 3, 0], rest: 0.3, vol: [-2, -3, -1, -3],
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [3, 4, 0, 0] }, { prog: [5, 3, 4, 0] }], order: [0, 1, 0, 2] },
  msc_panic: { seed: 47, root: 9, scale: "minor", tempo: 158, oct: 5, inst: ["lead", "pluck", "bass", D], harmony: "arp8", bass: "gallop", drums: "drive", rhythms: [1, 3, 5], rest: 0.25, vol: [-2, -3, -1, -3],
    sections: [{ prog: [0, 5, 6, 4] }, { prog: [0, 3, 4, 0] }], order: [0, 1] },
  msc_vs: { seed: 53, root: 2, scale: "dorian", tempo: 140, oct: 5, inst: ["brass", "pluck", "bass", D], harmony: "arp8", bass: "gallop", drums: "drive", rhythms: [1, 3, 5], rest: 0.3, vol: [-2, -3, -1, -3],
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 0] }, { prog: [0, 6, 5, 4] }], order: [0, 1, 0, 2] },
  msc_stage: { seed: 61, root: 5, scale: "lydian", tempo: 122, oct: 5, inst: ["organ", "epiano", "bass", D], harmony: "arp8", bass: "eighth", drums: "break", rhythms: [3, 0, 1], rest: 0.3, vol: [-2, -2, -1, -3],
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [1, 4, 0, 0] }, { prog: [3, 5, 4, 0] }], order: [0, 1, 0, 2] },
  msc_puzzle: { seed: 71, root: 0, scale: "major", tempo: 92, oct: 5, inst: ["flute", "pad", "pluck", D], harmony: "pad", bass: "half", drums: "none", rhythms: [3, 1, 3], rest: 0.45, calm: true, reverb: 40, vol: [0, -1, -2, -4], fill: false,
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [1, 4, 0, 0] }, { prog: [3, 4, 5, 0] }], order: [0, 1, 0, 2] },
  msc_time: { seed: 83, root: 4, scale: "minor", tempo: 146, oct: 5, inst: ["lead", "epiano", "bass", D], harmony: "arp8", bass: "pump", drums: "four", rhythms: [1, 3, 5], rest: 0.3, vol: [-2, -3, -1, -3],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [0, 6, 5, 4] }], order: [0, 1] },
  msc_dm_a: { seed: 91, root: 7, scale: "major", tempo: 128, oct: 5, inst: ["bell", "pluck", "bass", D], harmony: "arp16", bass: "eighth", drums: "four", rhythms: [3, 0, 1], rest: 0.3, vol: [-1, -3, -1, -3],
    sections: [{ prog: [0, 3, 4, 0] }, { prog: [5, 3, 4, 0] }, { prog: [0, 5, 3, 4] }], order: [0, 1, 0, 2] },
  msc_dm_b: { seed: 97, root: 2, scale: "major", tempo: 104, oct: 5, inst: ["flute", "pad", "bass", D], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.4, calm: true, reverb: 35, vol: [0, -1, -1, -4],
    sections: [{ prog: [0, 3, 4, 3] }, { prog: [5, 3, 4, 0] }], order: [0, 1] },
  msc_dm_vs: { seed: 103, root: 9, scale: "minor", tempo: 138, oct: 5, inst: ["lead", "organ", "bass", D], harmony: "arp8", bass: "pump", drums: "drive", rhythms: [1, 3, 0], rest: 0.3, vol: [-2, -3, -1, -3],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [0, 3, 4, 0] }, { prog: [5, 6, 4, 4] }], order: [0, 1, 0, 2] },
};

export function allMusic() {
  const out = {};
  for (const [name, o] of Object.entries(SONGS)) out[name] = new Song(o).build();
  out.msc_win = jingle("win", { root: 0, scale: "major", tempo: 136, rows: 32, inst: ["brass", "strings", "bass", D],
    lead: [[0, 4, 5], [2, 4, 5], [4, 4, 5], [6, 5, 5], [8, 7, 5], [10, 5, 5], [12, 7, 5], [16, 9, 5], [24, 11, 5], [31, "OFF"]],
    bass: [[0, 0], [8, 3], [16, 4], [24, 0]], pad: [[0, 0], [8, 3], [16, 4], [24, 0]], drums: [[0, "C3+C#4"], [8, "C3"], [16, "C3+D3"], [20, "D3"], [24, "C3+C#4"]] });
  out.msc_lose = jingle("lose", { root: 9, scale: "minor", tempo: 72, rows: 32, inst: ["strings", "pad", "bass", D],
    lead: [[0, 4, 5], [4, 3, 5], [8, 2, 5], [12, 0, 5], [16, -1, 5], [24, 0, 4], [31, "OFF"]], bass: [[0, 0], [16, -3]], pad: [[0, 0], [16, -3]], drums: [[0, "C3"]] });
  out.msc_ending = jingle("ending", { root: 7, scale: "major", tempo: 112, rows: 64, inst: ["bell", "strings", "bass", D],
    lead: [[0, 4, 5], [4, 6, 5], [8, 7, 5], [12, 6, 5], [16, 4, 5], [20, 2, 5], [24, 4, 5], [32, 7, 5], [36, 9, 5], [40, 11, 5], [44, 9, 5], [48, 7, 5], [56, 4, 5], [63, "OFF"]],
    bass: [[0, 0], [16, 4], [32, 3], [48, 4], [56, 0]], pad: [[0, 0], [16, 4], [32, 3], [48, 4], [56, 0]], drums: [[0, "C3"], [16, "C3"], [32, "C3+C#4"], [48, "C3+D3"], [56, "C3+C#4"]] });
  return out;
}
