// Sound effects and songs for Then & Now, written with scripts/lib/music.mjs. Effects are chip sounds (cheap on the handheld, short);
// the Lens has its own pair (a rising shimmer into Then, a falling one back to Now) since the music does not change on a flip.
// Songs: a lonely, warm hub; a dark, slow hangar; Ossie's bright but wistful theme; a driving boss; a quiet title.
import { S, sfx, Song, jingle } from "../lib/music.mjs";

export const SFX = {
  sfx_shoot: sfx(2, ["square", [S(64, 2, 3), S(57, 1, 5)]]),
  sfx_charge: sfx(2, ["square", [S(60, 4, 1), S(72, 4, 3), S(55, 3, 5)]], ["noise", [S(50, 2, 5)]]),
  sfx_missile: sfx(2, ["noise", [S(48, 4, 1), S(56, 3, 5)]], ["square", [S(52, 3, 3), S(45, 2, 5)]]),
  sfx_dash: sfx(1, ["noise", [S(60, 3, 1), S(66, 2, 5)]]),
  sfx_lens_in: sfx(1, ["sine", [S(67, 3, 1), S(74, 3, 1), S(79, 3, 1), S(86, 2, 5)]], ["tri", [S(55, 2), S(62, 2), S(67, 2, 5)]]),
  sfx_lens_out: sfx(1, ["sine", [S(86, 3, 1), S(79, 3, 1), S(74, 3, 1), S(67, 2, 5)]], ["tri", [S(67, 2), S(62, 2), S(55, 2, 5)]]),
  sfx_buzz: sfx(2, ["square", [S(40, 3), S(0, 0), S(40, 3, 5)]]),
  sfx_overload: sfx(3, ["noise", [S(56, 5), S(50, 4, 3), S(44, 3, 5)]], ["tri", [S(55, 4, 3), S(43, 4, 3), S(31, 3, 5)]]),
  sfx_dodge: sfx(1, ["sine", [S(79, 3), S(86, 3), S(91, 2, 5)]]),
  sfx_hurt: sfx(2, ["noise", [S(54, 5, 3), S(46, 4, 5)]], ["tri", [S(50, 4, 3), S(40, 3, 5)]]),
  sfx_hit: sfx(1, ["noise", [S(62, 3, 5)]]),
  sfx_boom: sfx(3, ["noise", [S(52, 5, 3), S(44, 4, 3), S(38, 3, 5)]]),
  sfx_big_boom: sfx(4, ["noise", [S(48, 6, 3), S(42, 5, 3), S(36, 4, 3), S(32, 3, 5)]], ["tri", [S(40, 5, 3), S(33, 4, 3), S(28, 3, 5)]]),
  sfx_save: sfx(2, ["sine", [S(67, 3), S(71, 3), S(74, 3), S(79, 3, 5)]], ["tri", [S(55, 2), S(59, 2), S(62, 2, 5)]]),
  sfx_pickup: sfx(2, ["sine", [S(76, 4), S(83, 4, 5)]], ["tri", [S(64, 3), S(71, 3, 5)]]),
  sfx_door: sfx(2, ["noise", [S(40, 2, 1), S(46, 2, 5)]]),
  sfx_empty: sfx(2, ["tri", [S(45, 3), S(43, 3, 5)]]),
  sfx_eshot: sfx(2, ["square", [S(55, 2, 3), S(50, 1, 5)]]),
  sfx_alarm: sfx(4, ["square", [S(52, 3), S(0, 0), S(52, 3), S(0, 0), S(52, 3, 5)]]),
  sfx_ping: sfx(1, ["tri", [S(84, 2, 5)]]),
  sfx_note: sfx(2, ["sine", [S(62, 2), S(65, 2), S(69, 2, 5)]]),
  sfx_gain: sfx(3, ["sine", [S(60, 4), S(64, 4), S(67, 4), S(72, 4), S(76, 4, 5)]], ["tri", [S(48, 3), S(52, 3), S(55, 3), S(60, 3, 5)]]),
  sfx_select: sfx(1, ["sine", [S(71, 2, 5)]]),
  sfx_ok: sfx(2, ["sine", [S(67, 3), S(74, 3, 5)]]),
};

const D = "gm_drum_kit";
const SONGS = {
  msc_title: { level: -1, seed: 11, root: 9, scale: "minor", tempo: 84, oct: 4, inst: ["gm_celesta", "gm_choir_pad", "gm_fretless_bass", D], harmony: "pad", bass: "half", drums: "none", rhythms: [3, 1], rest: 0.4, calm: true, reverb: 45, vol: [0, -2, -1, -4], fill: false,
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [0, 5, 6, 4] }], order: [0, 1] },
  msc_dock: { level: -1, seed: 23, root: 2, scale: "dorian", tempo: 86, oct: 4, inst: ["gm_vibraphone", "gm_warm_pad", "gm_fretless_bass", D], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.45, calm: true, reverb: 40, vol: [0, -2, -1, -4], fill: false,
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 3, 6, 4] }], order: [0, 1, 0] },
  msc_hangar: { level: -1, seed: 37, root: 4, scale: "phrygian", tempo: 94, oct: 4, inst: ["gm_clean_guitar", "gm_bowed_pad", "gm_fretless_bass", D], harmony: "pad", bass: "pump", drums: "soft", rhythms: [3, 0, 1], rest: 0.4, reverb: 35, vol: [0, -2, -1, -3],
    sections: [{ prog: [0, 1, 0, 6] }, { prog: [3, 1, 4, 0] }, { prog: [5, 6, 1, 0] }], order: [0, 1, 0, 2] },
  msc_ossie: { level: -1, seed: 53, root: 7, scale: "major", tempo: 104, oct: 4, inst: ["gm_nylon_guitar", "gm_electric_piano_1", "gm_acoustic_bass", D], harmony: "arp8", bass: "half", drums: "soft", rhythms: [1, 3, 0], rest: 0.35, reverb: 30, vol: [0, -2, -1, -4],
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [0, 4, 1, 4] }], order: [0, 1, 0] },
  msc_boss: { level: -1, seed: 71, root: 2, scale: "harm", tempo: 148, oct: 4, inst: ["gm_brass_section", "gm_tremolo_strings", "gm_synth_bass_1", D], harmony: "arp8", bass: "gallop", drums: "boss", rhythms: [2, 4, 0], rest: 0.2, reverb: 20, vol: [0, -2, -1, -3],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [0, 6, 5, 4] }], order: [0, 1] },
};

export function allMusic() {
  const out = {};
  for (const [name, o] of Object.entries(SONGS)) out[name] = new Song(o).build();
  out.msc_memory = jingle("memory", { level: -2, root: 7, scale: "major", tempo: 72, rows: 48, inst: ["gm_music_box", "gm_halo_pad", "gm_fretless_bass", D],
    lead: [[0, 4, 5], [6, 2, 5], [12, 0, 5], [18, 1, 5], [24, 4, 5], [30, 5, 5], [36, 4, 5], [47, "OFF"]],
    bass: [[0, 0], [12, 5], [24, 3], [36, 4]], pad: [[0, 0], [12, 5], [24, 3], [36, 4]] });
  out.msc_end = jingle("end", { level: -2, root: 9, scale: "minor", tempo: 70, rows: 64, inst: ["gm_cello", "gm_choir_aahs", "gm_contrabass", D],
    lead: [[0, 4, 4], [8, 3, 4], [16, 2, 4], [24, 0, 4], [32, 2, 4], [40, 4, 4], [48, 7, 4], [63, "OFF"]],
    bass: [[0, 0], [16, 5], [32, 3], [48, 4]], pad: [[0, 0], [16, 5], [32, 3], [48, 0]] });
  return out;
}
