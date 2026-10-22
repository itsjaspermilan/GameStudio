// Sound effects and songs for Panel Pop. Written with scripts/lib/music.mjs, like Void Swarm.
// The songs use the General MIDI instruments (a sampled, 16-bit sound: marimbas, pianos, brass) with the melody in the middle octave; the
// effects stay chip sounds (cheap on the handheld) but round ones: triangle, sine and pluck. The songs played during a game are smooth and
// laid back (electric piano, vibraphone, warm pads, fretless bass, soft drums), in the spirit of a handheld's home-screen music.
import { S, sfx, Song, jingle } from "../lib/music.mjs";

const POP = [60, 62, 64, 67, 69, 72, 74, 76]; // each panel of a combo pops a step higher, up a major pentatonic scale
// The ones heard all the time (pops, matches, the countdown) are sine and triangle in the middle octaves: a bell up there turned shrill.
export const SFX = {
  move: sfx(1, ["tri", [S(60, 2, 5)]]),
  swap: sfx(1, ["pluck", [S(57, 3), S(64, 3, 5)]]),
  land: sfx(1, ["noise", [S(28, 2, 5), S(24, 1, 5)]]),
  raise: sfx(1, ["tri", [S(43, 2, 5)]]),
  clear: sfx(2, ["sine", [S(60, 3), S(64, 3), S(67, 3, 5)]]),
  chain2: sfx(2, ["sine", [S(64, 4), S(67, 4), S(72, 4, 5)]], ["tri", [S(52, 3), S(55, 3), S(60, 3, 5)]]),
  chain3: sfx(2, ["sine", [S(65, 4), S(69, 4), S(72, 4), S(77, 4, 5)]], ["tri", [S(53, 3), S(57, 3), S(60, 3), S(65, 3, 5)]]),
  chain4: sfx(2, ["sine", [S(67, 4), S(71, 4), S(74, 4), S(79, 4, 5)]], ["tri", [S(55, 3), S(59, 3), S(62, 3), S(67, 3, 5)]]),
  chain5: sfx(2, ["sine", [S(69, 4), S(72, 4), S(76, 4), S(81, 4, 5)]], ["tri", [S(57, 3), S(60, 3), S(64, 3), S(69, 3, 5)]]),
  combo: sfx(2, ["sine", [S(60, 4), S(64, 4), S(67, 4), S(72, 4, 5)]], ["tri", [S(48, 3), S(52, 3), S(55, 3), S(60, 3, 5)]]),
  garb_land: sfx(2, ["noise", [S(30, 5, 3), S(26, 4, 5), S(22, 2, 5)]], ["tri", [S(28, 5, 3), S(24, 4, 5)]]),
  garb_break: sfx(2, ["noise", [S(44, 3, 3), S(40, 3, 5)]], ["pluck", [S(55, 3), S(60, 3), S(67, 3, 5)]]),
  send: sfx(2, ["tri", [S(55, 4, 1), S(62, 4, 5)]], ["noise", [S(40, 2, 5)]]),
  panic: sfx(3, ["tri", [S(57, 3), S(0, 0), S(57, 3), S(0, 0)]]),
  tick: sfx(3, ["tri", [S(60, 3, 5)]]),
  go: sfx(3, ["sine", [S(67, 4), S(67, 4, 7), S(67, 3, 5)]], ["tri", [S(55, 3), S(55, 3, 7), S(55, 3, 5)]]),
  win: sfx(3, ["sine", [S(60), S(64), S(67), S(72, 5, 7), S(72, 4, 5)]], ["tri", [S(48), S(52), S(55), S(60, 5, 7), S(60, 4, 5)]]),
  lose: sfx(4, ["tri", [S(62, 5, 3), S(58, 5, 3), S(55, 5, 3), S(50, 5, 5)]]),
  solved: sfx(3, ["sine", [S(60), S(64), S(67), S(72), S(76, 5, 5)]], ["tri", [S(48, 3), S(52, 3), S(55, 3), S(60, 3), S(64, 3, 5)]]),
  speedup: sfx(3, ["pluck", [S(60, 3), S(67, 3), S(72, 4, 5)]]),
  ok: sfx(2, ["sine", [S(67, 4), S(74, 4, 5)]]),
  back: sfx(2, ["sine", [S(67, 4), S(62, 4, 5)]]),
  select: sfx(1, ["sine", [S(71, 2, 5)]]),
  error: sfx(3, ["tri", [S(40, 4), S(0, 0), S(40, 4)]]),
};
POP.forEach((p, i) => { SFX["pop" + (i + 1)] = sfx(2, ["sine", [S(p, 3), S(p + 7, 2, 5)]], ["tri", [S(p - 12, 2, 5)]]); });

const D = "gm_drum_kit";
// `level` evens out the loudness between songs (steps of 1.25x, measured by rendering them)
const SONGS = {
  msc_title: { level: 0, seed: 12, root: 0, scale: "major", tempo: 112, oct: 4, inst: ["gm_marimba", "gm_electric_piano_1", "gm_finger_bass", D], harmony: "arp8", bass: "eighth", drums: "four", rhythms: [3, 1, 0], rest: 0.3, reverb: 25, vol: [0, -2, -1, -3],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [0, 2, 3, 4] }, { prog: [5, 3, 0, 4] }], order: [0, 1, 0, 2] },
  msc_menu: { level: -1, seed: 24, root: 5, scale: "lydian", tempo: 92, oct: 4, inst: ["gm_vibraphone", "gm_warm_pad", "gm_acoustic_bass", D], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.4, calm: true, reverb: 35, vol: [0, -1, -1, -4], fill: false,
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [1, 4, 0, 0] }], order: [0, 1] },
  msc_endless: { level: -1, seed: 37, root: 2, scale: "dorian", tempo: 92, oct: 4, inst: ["gm_vibraphone", "gm_electric_piano_2", "gm_fretless_bass", D], harmony: "arp8", bass: "half", drums: "soft", rhythms: [3, 1, 0], rest: 0.4, calm: true, reverb: 35, vol: [0, -2, -1, -4],
    sections: [{ prog: [0, 3, 4, 3] }, { prog: [5, 3, 0, 4] }, { prog: [0, 6, 3, 4] }], order: [0, 1, 0, 2] },
  msc_panic: { level: -1, seed: 49, root: 9, scale: "dorian", tempo: 120, oct: 4, inst: ["gm_electric_piano_1", "gm_synth_strings_1", "gm_fretless_bass", D], harmony: "arp8", bass: "eighth", drums: "four", rhythms: [1, 3, 0], rest: 0.3, reverb: 30, vol: [0, -3, -1, -4],
    sections: [{ prog: [0, 3, 6, 4] }, { prog: [0, 5, 4, 0] }], order: [0, 1] },
  msc_vs: { level: 0, seed: 56, root: 7, scale: "dorian", tempo: 104, oct: 4, inst: ["gm_clean_guitar", "gm_warm_pad", "gm_finger_bass", D], harmony: "pad", bass: "eighth", drums: "four", rhythms: [1, 3, 0], rest: 0.35, reverb: 30, vol: [0, -2, -1, -4],
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 0] }, { prog: [0, 6, 5, 4] }], order: [0, 1, 0, 2] },
  msc_stage: { level: 1, seed: 63, root: 5, scale: "lydian", tempo: 98, oct: 4, inst: ["gm_kalimba", "gm_nylon_guitar", "gm_fretless_bass", D], harmony: "arp8", bass: "half", drums: "soft", rhythms: [3, 0, 1], rest: 0.35, calm: true, reverb: 30, vol: [0, -2, -1, -4],
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [1, 4, 0, 0] }, { prog: [3, 5, 4, 0] }], order: [0, 1, 0, 2] },
  msc_puzzle: { level: -1, seed: 74, root: 0, scale: "major", tempo: 88, oct: 4, inst: ["gm_music_box", "gm_new_age_pad", "gm_fretless_bass", D], harmony: "pad", bass: "half", drums: "none", rhythms: [3, 1, 3], rest: 0.45, calm: true, reverb: 40, vol: [0, -1, -2, -4], fill: false,
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [1, 4, 0, 0] }, { prog: [3, 4, 5, 0] }], order: [0, 1, 0, 2] },
  msc_time: { level: 0, seed: 88, root: 4, scale: "dorian", tempo: 100, oct: 4, inst: ["gm_alto_sax", "gm_electric_piano_1", "gm_fretless_bass", D], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1, 5], rest: 0.35, calm: true, reverb: 35, vol: [0, -2, -1, -4],
    sections: [{ prog: [0, 3, 6, 4] }, { prog: [0, 5, 3, 4] }], order: [0, 1] },
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
