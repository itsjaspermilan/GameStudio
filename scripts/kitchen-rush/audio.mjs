// Sound effects and songs for Kitchen Rush, written with scripts/lib/music.mjs like Panel Pop's.
// The bin is a short noise burst; anything that means "well done" is a round sine or a pluck in the middle octaves, because a
// cook presses buttons all the time and shrill sounds wear the ear. The songs are a cheerful diner swing:
// vibraphone, electric piano and a walking bass, faster as the week goes on.
import { S, sfx, Song, jingle } from "../lib/music.mjs";

export const SFX = {
  move: sfx(1, ["tri", [S(67, 2, 5)]]),
  plate: sfx(1, ["pluck", [S(60, 3), S(67, 3, 5)]]),
  bin: sfx(2, ["noise", [S(40, 4, 3), S(34, 3, 5)]]),
  serve: sfx(2, ["sine", [S(72, 4), S(76, 4), S(79, 4), S(84, 3, 5)]], ["tri", [S(60, 3), S(64, 3), S(67, 3, 5)]]),
  wrong: sfx(3, ["tri", [S(45, 4), S(0, 0), S(45, 4, 5)]]),
  order: sfx(2, ["sine", [S(81, 3, 5)]], ["tri", [S(69, 2, 5)]]),
  lost: sfx(3, ["tri", [S(55, 4), S(52, 4), S(48, 4, 5)]]),
  tick: sfx(3, ["tri", [S(72, 2, 5)]]),
  go: sfx(3, ["sine", [S(67, 4), S(72, 4), S(76, 4, 5)]], ["tri", [S(55, 3), S(60, 3), S(64, 3, 5)]]),
  ok: sfx(2, ["sine", [S(67, 4), S(74, 4, 5)]]),
  back: sfx(2, ["sine", [S(67, 4), S(62, 4, 5)]]),
  select: sfx(1, ["sine", [S(71, 2, 5)]]),
  star: sfx(3, ["sine", [S(76, 4), S(83, 4, 5)]], ["tri", [S(64, 3), S(71, 3, 5)]]),
};

const D = "gm_drum_kit";
const SONGS = {
  msc_title: { level: 0, seed: 5, root: 7, scale: "major", tempo: 116, oct: 4, inst: ["gm_vibraphone", "gm_electric_piano_1", "gm_acoustic_bass", D], harmony: "arp8", bass: "eighth", drums: "soft", rhythms: [1, 3, 0], rest: 0.3, reverb: 25, vol: [0, -2, -1, -3],
    sections: [{ prog: [0, 5, 1, 4] }, { prog: [3, 4, 0, 5] }, { prog: [0, 2, 3, 4] }], order: [0, 1, 0, 2] },
  msc_menu: { level: -1, seed: 17, root: 2, scale: "major", tempo: 96, oct: 4, inst: ["gm_electric_piano_1", "gm_warm_pad", "gm_acoustic_bass", D], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.4, calm: true, reverb: 35, vol: [0, -2, -1, -4], fill: false,
    sections: [{ prog: [0, 3, 4, 0] }, { prog: [5, 3, 1, 4] }], order: [0, 1] },
  msc_kitchen: { level: -1, seed: 29, root: 0, scale: "major", tempo: 124, oct: 4, inst: ["gm_marimba", "gm_electric_piano_2", "gm_finger_bass", D], harmony: "arp8", bass: "eighth", drums: "four", rhythms: [1, 3, 0], rest: 0.3, reverb: 25, vol: [0, -2, -1, -3],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [0, 3, 1, 4] }, { prog: [5, 3, 0, 4] }], order: [0, 1, 0, 2] },
  msc_rush: { level: -1, seed: 41, root: 9, scale: "dorian", tempo: 136, oct: 4, inst: ["gm_clavinet", "gm_electric_piano_1", "gm_finger_bass", D], harmony: "arp8", bass: "eighth", drums: "drive", rhythms: [1, 2, 0], rest: 0.25, reverb: 20, vol: [-1, -2, -1, -3],
    sections: [{ prog: [0, 3, 6, 4] }, { prog: [0, 5, 3, 4] }], order: [0, 1] },
};

export function allMusic() {
  const out = {};
  for (const [name, o] of Object.entries(SONGS)) out[name] = new Song(o).build();
  out.msc_closed = jingle("closed", { root: 0, scale: "major", tempo: 132, rows: 32, inst: ["gm_vibraphone", "gm_string_ensemble_1", "gm_acoustic_bass", D],
    lead: [[0, 4, 4], [2, 2, 4], [4, 4, 4], [6, 7, 4], [8, 9, 4], [12, 7, 4], [16, 11, 4], [24, 14, 4], [31, "OFF"]],
    bass: [[0, 0], [8, 3], [16, 4], [24, 0]], pad: [[0, 0], [8, 3], [16, 4], [24, 0]], drums: [[0, "C3+C#4"], [8, "C3"], [16, "C3+D3"], [24, "C3+C#4"]] });
  out.msc_fail = jingle("fail", { level: -2, root: 9, scale: "minor", tempo: 84, rows: 32, inst: ["gm_muted_trumpet", "gm_warm_pad", "gm_acoustic_bass", D],
    lead: [[0, 4, 4], [4, 3, 4], [8, 2, 4], [12, 1, 4], [16, 0, 4], [31, "OFF"]], bass: [[0, 0], [16, -3]], pad: [[0, 0], [16, -3]], drums: [[0, "C3"]] });
  return out;
}
