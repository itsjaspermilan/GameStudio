// Sound effects and songs for Panel Pop. Written with scripts/lib/music.mjs, like Void Swarm.
// The songs use the General MIDI instruments (a sampled, 16-bit sound: marimbas, pianos, brass) with the melody in the middle octave; the
// effects stay chip sounds (cheap on the handheld) but round ones: triangle, sine, bell and pluck, with square kept for the odd accent.
import { S, sfx, Song, jingle } from "../lib/music.mjs";

const POP = [60, 62, 64, 67, 69, 72, 74, 76]; // each panel of a combo pops a step higher, up a major pentatonic scale
export const SFX = {
  move: sfx(1, ["tri", [S(67, 2, 5)]]),
  swap: sfx(1, ["pluck", [S(62, 3), S(69, 3, 5)]]),
  land: sfx(1, ["noise", [S(28, 2, 5), S(24, 1, 5)]]),
  raise: sfx(1, ["tri", [S(43, 2, 5)]]),
  clear: sfx(2, ["bell", [S(67, 3), S(71, 3), S(74, 4, 5)]]),
  chain2: sfx(2, ["bell", [S(72, 4), S(76, 4), S(79, 4, 5)]], ["tri", [S(60, 3), S(64, 3), S(67, 3, 5)]]),
  chain3: sfx(2, ["bell", [S(74, 4), S(78, 4), S(81, 4), S(86, 4, 5)]], ["tri", [S(62, 3), S(66, 3), S(69, 3), S(74, 3, 5)]]),
  chain4: sfx(2, ["bell", [S(76, 5), S(80, 5), S(83, 5), S(88, 5, 5)]], ["pulse", [S(64, 3), S(68, 3), S(71, 3), S(76, 3, 5)]]),
  chain5: sfx(2, ["bell", [S(77, 5), S(81, 5), S(84, 5), S(89, 5), S(93, 5, 5)]], ["pulse", [S(65, 3), S(69, 3), S(72, 3), S(77, 3), S(81, 3, 5)]]),
  combo: sfx(2, ["pluck", [S(67, 4), S(71, 4), S(74, 4), S(79, 5, 5)]], ["tri", [S(55, 4), S(59, 4), S(62, 4), S(67, 4, 5)]]),
  garb_land: sfx(2, ["noise", [S(30, 5, 3), S(26, 4, 5), S(22, 2, 5)]], ["tri", [S(28, 5, 3), S(24, 4, 5)]]),
  garb_break: sfx(2, ["noise", [S(44, 3, 3), S(40, 3, 5)]], ["pluck", [S(60, 3), S(67, 3), S(72, 3, 5)]]),
  send: sfx(2, ["tri", [S(55, 4, 1), S(67, 4, 5)]], ["noise", [S(40, 2, 5)]]),
  panic: sfx(3, ["pulse", [S(64, 3), S(0, 0), S(64, 3), S(0, 0)]]),
  tick: sfx(3, ["bell", [S(72, 3, 5)]]),
  go: sfx(3, ["bell", [S(79, 4), S(79, 4, 7), S(79, 3, 5)]], ["tri", [S(67, 4), S(67, 4, 7), S(67, 3, 5)]]),
  win: sfx(3, ["bell", [S(72), S(76), S(79), S(84, 5, 7), S(84, 4, 5)]], ["tri", [S(60), S(64), S(67), S(72, 5, 7), S(72, 4, 5)]]),
  lose: sfx(4, ["tri", [S(62, 5, 3), S(58, 5, 3), S(55, 5, 3), S(50, 5, 5)]]),
  solved: sfx(3, ["bell", [S(72), S(76), S(79), S(84), S(88, 5, 5)]], ["tri", [S(60, 3), S(64, 3), S(67, 3), S(72, 3), S(76, 3, 5)]]),
  speedup: sfx(3, ["pluck", [S(67, 3), S(74, 3), S(79, 4, 5)]]),
  ok: sfx(2, ["sine", [S(72, 4), S(79, 4, 5)]]),
  back: sfx(2, ["sine", [S(72, 4), S(67, 4, 5)]]),
  select: sfx(1, ["sine", [S(76, 2, 5)]]),
  error: sfx(3, ["tri", [S(40, 4), S(0, 0), S(40, 4)]]),
};
POP.forEach((p, i) => { SFX["pop" + (i + 1)] = sfx(2, ["bell", [S(p + 12, 3), S(p + 19, 2, 5)]], ["sine", [S(p, 3, 5)]]); });

const D = "gm_drum_kit";
// `level` evens out the loudness between songs (steps of 1.25x, measured by rendering them)
const SONGS = {
  msc_title: { level: 0, seed: 12, root: 0, scale: "major", tempo: 112, oct: 4, inst: ["gm_marimba", "gm_electric_piano_1", "gm_finger_bass", D], harmony: "arp8", bass: "eighth", drums: "four", rhythms: [3, 1, 0], rest: 0.3, reverb: 25, vol: [0, -2, -1, -3],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [0, 2, 3, 4] }, { prog: [5, 3, 0, 4] }], order: [0, 1, 0, 2] },
  msc_menu: { level: -1, seed: 24, root: 5, scale: "lydian", tempo: 92, oct: 4, inst: ["gm_vibraphone", "gm_warm_pad", "gm_acoustic_bass", D], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.4, calm: true, reverb: 35, vol: [0, -1, -1, -4], fill: false,
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [1, 4, 0, 0] }], order: [0, 1] },
  msc_endless: { level: 1, seed: 33, root: 7, scale: "major", tempo: 124, oct: 4, inst: ["gm_steel_drums", "gm_clean_guitar", "gm_finger_bass", D], harmony: "arp8", bass: "pump", drums: "four", rhythms: [1, 3, 0], rest: 0.3, vol: [-1, -3, -1, -3],
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [3, 4, 0, 0] }, { prog: [5, 3, 4, 0] }], order: [0, 1, 0, 2] },
  msc_panic: { level: 0, seed: 48, root: 9, scale: "minor", tempo: 150, oct: 4, inst: ["gm_xylophone", "gm_pizzicato_strings", "gm_pick_bass", D], harmony: "arp8", bass: "gallop", drums: "drive", rhythms: [1, 3, 5], rest: 0.25, vol: [-1, -3, -1, -3],
    sections: [{ prog: [0, 5, 6, 4] }, { prog: [0, 3, 4, 0] }], order: [0, 1] },
  msc_vs: { level: 0, seed: 54, root: 2, scale: "dorian", tempo: 132, oct: 4, inst: ["gm_brass_section", "gm_electric_piano_2", "gm_slap_bass_1", D], harmony: "arp8", bass: "gallop", drums: "drive", rhythms: [1, 3, 5], rest: 0.3, vol: [-2, -3, -1, -3],
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 0] }, { prog: [0, 6, 5, 4] }], order: [0, 1, 0, 2] },
  msc_stage: { level: 1, seed: 62, root: 5, scale: "lydian", tempo: 116, oct: 4, inst: ["gm_kalimba", "gm_nylon_guitar", "gm_finger_bass", D], harmony: "arp8", bass: "eighth", drums: "break", rhythms: [3, 0, 1], rest: 0.3, calm: true, vol: [0, -2, -1, -3],
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [1, 4, 0, 0] }, { prog: [3, 5, 4, 0] }], order: [0, 1, 0, 2] },
  msc_puzzle: { level: -1, seed: 74, root: 0, scale: "major", tempo: 88, oct: 4, inst: ["gm_music_box", "gm_new_age_pad", "gm_fretless_bass", D], harmony: "pad", bass: "half", drums: "none", rhythms: [3, 1, 3], rest: 0.45, calm: true, reverb: 40, vol: [0, -1, -2, -4], fill: false,
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [1, 4, 0, 0] }, { prog: [3, 4, 5, 0] }], order: [0, 1, 0, 2] },
  msc_time: { level: 0, seed: 86, root: 4, scale: "minor", tempo: 128, oct: 4, inst: ["gm_alto_sax", "gm_electric_piano_1", "gm_finger_bass", D], harmony: "arp8", bass: "pump", drums: "four", rhythms: [1, 3, 5], rest: 0.3, vol: [-1, -3, -1, -3],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [0, 6, 5, 4] }], order: [0, 1] },
};

export function allMusic() {
  const out = {};
  for (const [name, o] of Object.entries(SONGS)) out[name] = new Song(o).build();
  out.msc_win = jingle("win", { root: 0, scale: "major", tempo: 132, rows: 32, inst: ["gm_trumpet", "gm_string_ensemble_1", "gm_acoustic_bass", D],
    lead: [[0, 4, 4], [2, 4, 4], [4, 4, 4], [6, 5, 4], [8, 7, 4], [10, 5, 4], [12, 7, 4], [16, 9, 4], [24, 11, 4], [31, "OFF"]],
    bass: [[0, 0], [8, 3], [16, 4], [24, 0]], pad: [[0, 0], [8, 3], [16, 4], [24, 0]], drums: [[0, "C3+C#4"], [8, "C3"], [16, "C3+D3"], [20, "D3"], [24, "C3+C#4"]] });
  out.msc_lose = jingle("lose", { level: -2, root: 9, scale: "minor", tempo: 70, rows: 32, inst: ["gm_cello", "gm_choir_aahs", "gm_contrabass", D],
    lead: [[0, 4, 4], [4, 3, 4], [8, 2, 4], [12, 0, 4], [16, -1, 4], [24, 0, 3], [31, "OFF"]], bass: [[0, 0], [16, -3]], pad: [[0, 0], [16, -3]], drums: [[0, "C3"]] });
  out.msc_ending = jingle("ending", { root: 7, scale: "major", tempo: 108, rows: 64, inst: ["gm_celesta", "gm_string_ensemble_1", "gm_acoustic_bass", D],
    lead: [[0, 4, 4], [2, 5, 4], [4, 6, 4], [6, 7, 4], [8, 6, 4], [10, 5, 4], [12, 4, 4], [16, 2, 4], [18, 3, 4], [20, 4, 4], [24, 5, 4], [28, 4, 4],
      [32, 7, 4], [34, 8, 4], [36, 9, 4], [38, 8, 4], [40, 7, 4], [44, 8, 4], [48, 9, 4], [50, 8, 4], [52, 7, 4], [56, 7, 4], [63, "OFF"]],
    bass: [[0, 0], [16, 4], [32, 3], [48, 4], [56, 0]], pad: [[0, 0], [16, 4], [32, 3], [48, 4], [56, 0]], drums: [[0, "C3"], [16, "C3"], [32, "C3+C#4"], [48, "C3+D3"], [56, "C3+C#4"]] });
  return out;
}
