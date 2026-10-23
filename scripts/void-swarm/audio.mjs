// Void Swarm's sound effects and songs: what each sounds like, written with the tools in scripts/lib/music.mjs.
import { S, sfx, Song, jingle } from "../lib/music.mjs";

export const SFX = {
  sfx_shoot: sfx(2, ["square", [S(54, 4, 3), S(46, 3, 5)]]),
  sfx_hit: sfx(2, ["noise", [S(44, 4, 5), S(38, 2, 5)]]),
  sfx_kill: sfx(2, ["noise", [S(46, 5, 3), S(40, 4, 5), S(34, 3, 5), S(30, 2, 5)]], ["tri", [S(34, 5, 3), S(28, 4, 5)]]),
  sfx_gem: sfx(2, ["pulse", [S(60, 3), S(67 - 12, 3, 5)]]),
  sfx_coin: sfx(3, ["square", [S(58, 4), S(63, 5, 5)]]),
  sfx_levelup: sfx(3, ["square", [S(36), S(40), S(43), S(48), S(52), S(55), S(60), S(60, 5, 5)]], ["tri", [S(24), S(28), S(31), S(36), S(40), S(43), S(48), S(48, 5, 5)]]),
  sfx_hurt: sfx(2, ["saw", [S(40, 6, 3), S(34, 6, 3), S(28, 5, 5)]], ["noise", [S(40, 5, 5), S(36, 4, 5), S(30, 3, 5)]]),
  sfx_dash: sfx(2, ["noise", [S(52, 3, 1), S(46, 4, 5), S(40, 2, 5)]]),
  sfx_explode: sfx(3, ["noise", [S(38, 7, 3), S(34, 7, 5), S(30, 6, 5), S(26, 5, 5), S(24, 3, 5), S(22, 2, 5)]], ["tri", [S(26, 7, 3), S(22, 6, 5), S(18, 4, 5)]]),
  sfx_bossalert: sfx(4, ["saw", [S(30, 6), S(30, 6, 7), S(30, 0), S(30, 6), S(27, 6), S(27, 6, 7), S(27, 0), S(27, 6)]], ["square", [S(42, 3), S(42, 3, 7), S(42, 0), S(42, 3), S(39, 3), S(39, 3, 7), S(39, 0), S(39, 3)]]),
  sfx_move: sfx(1, ["square", [S(58, 2), S(60, 2, 5)]]),
  sfx_ok: sfx(2, ["square", [S(52, 4), S(59, 5, 5)]]),
  sfx_back: sfx(2, ["square", [S(54, 4), S(47, 4, 5)]]),
  sfx_buy: sfx(2, ["pulse", [S(48, 5), S(52, 5), S(55, 5), S(60, 5, 5)]], ["bell", [S(60, 4), S(0, 0), S(0, 0), S(63, 4, 5)]]),
  sfx_error: sfx(3, ["saw", [S(30, 5), S(30, 0), S(30, 5)]]),
  sfx_nova: sfx(3, ["sine", [S(30, 6, 1), S(40, 6, 5), S(50, 4, 5)]], ["noise", [S(40, 4, 3), S(36, 3, 5), S(32, 2, 5)]]),
  sfx_zap: sfx(1, ["saw", [S(58, 4, 2), S(61, 4, 2), S(55, 4, 2), S(60, 3, 5)]]),
  sfx_missile: sfx(2, ["noise", [S(50, 4, 1), S(42, 4, 5), S(36, 2, 5)]]),
  sfx_mine: sfx(3, ["tri", [S(36, 5), S(32, 4, 5)]]),
  sfx_beep: sfx(2, ["square", [S(63, 3, 5)]]),
  sfx_lance: sfx(2, ["saw", [S(58, 5), S(58, 5, 7), S(56, 4, 5)]], ["square", [S(46, 3), S(46, 3, 7), S(44, 2, 5)]]),
  sfx_hole: sfx(4, ["sine", [S(24, 5, 2), S(26, 5, 2), S(24, 4, 5)]]),
  sfx_heal: sfx(3, ["tri", [S(48, 4), S(55, 5), S(60, 5, 5)]]),
  sfx_magnet: sfx(2, ["square", [S(40, 4, 1), S(60, 5, 5)]]),
  sfx_meteor: sfx(3, ["noise", [S(34, 5, 3), S(30, 4, 5), S(26, 3, 5)]]),
  sfx_warn: sfx(3, ["square", [S(58, 3), S(0, 0), S(58, 3)]]),
  sfx_unlock: sfx(3, ["square", [S(48), S(52), S(55), S(48), S(55), S(60), S(63, 5, 5)]], ["bell", [S(60, 3), S(0, 0), S(0, 0), S(60, 3), S(0, 0), S(0, 0), S(63, 4, 5)]]),
};

const drumsI = "gm_drum_kit";
// Ten different stage songs (one per sector), each with a band of its own from the General MIDI SoundFont (the chip instruments sounded
// whistly and harsh as leads), the melody in the middle octave: kalimba and nylon guitar, a sax over electric piano, steel drums, koto, ...
// Each band has 8 instruments: melody, harmony, bass and drums, then a counter-melody, a second harmony (a pad under an arpeggio or a
// sparkle over a pad), hand percussion and a quiet echo of the melody. Each song plays in a space that fits its sector: a room for the
// close and busy ones, a hall for open space, a cave for the dead moon, the hive, the black hole and the core.
const SONGS = {
  msc_s1: { level: 1, seed: 3, root: 4, scale: "dorian", reverb: 22, reverb_type: "room", tempo: 108, oct: 4, inst: ["gm_kalimba", "gm_nylon_guitar", "gm_finger_bass", drumsI, "gm_clarinet", "gm_warm_pad", drumsI, "gm_kalimba"], harmony: "arp8", bass: "half", drums: "soft", rhythms: [3, 1, 3, 0], rest: 0.3, calm: true, vol: [0, -3, -1, -4, -3, -3, -5, -4],
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 0], oct: 4 }, { prog: [0, 6, 5, 4] }, { prog: [3, 0, 4, 0], drums: "four" }], order: [0, 1, 0, 2, 3, 1] },
  msc_s2: { level: -2, seed: 14, root: 9, scale: "minor", reverb: 40, reverb_type: "hall", tempo: 96, oct: 4, inst: ["gm_vibraphone", "gm_choir_pad", "gm_fretless_bass", drumsI, "gm_flute", "gm_crystal", drumsI, "gm_vibraphone"], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.4, calm: true, vol: [-1, -1, -1, -4, -3, -3, -5, -4], fill: false,
    sections: [{ prog: [0, 5, 2, 6] }, { prog: [3, 4, 0, 0] }, { prog: [5, 6, 0, 4] }], order: [0, 1, 0, 2] },
  msc_s3: { level: -2, seed: 21, root: 2, scale: "phrygian", reverb: 45, reverb_type: "cave", tempo: 84, oct: 4, inst: ["gm_cello", "gm_bowed_pad", "gm_contrabass", drumsI, "gm_english_horn", "gm_music_box", drumsI, "gm_viola"], harmony: "pad", bass: "half", drums: "none", rhythms: [3, 3, 1], rest: 0.4, calm: true, vol: [-1, -1, -1, -4, -3, -3, -5, -4], fill: false,
    sections: [{ prog: [0, 1, 0, 6] }, { prog: [3, 4, 1, 0] }, { prog: [0, 6, 5, 6] }], order: [0, 1, 0, 2] },
  msc_s4: { level: 1, seed: 33, root: 5, scale: "lydian", reverb: 35, reverb_type: "hall", tempo: 104, oct: 4, inst: ["gm_marimba", "gm_electric_piano_2", "gm_finger_bass", drumsI, "gm_flute", "gm_new_age_pad", drumsI, "gm_glockenspiel"], harmony: "arp8", bass: "eighth", drums: "soft", rhythms: [3, 0, 1], rest: 0.35, calm: true, vol: [-1, -2, -1, -4, -3, -3, -5, -4],
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [1, 4, 0, 0] }, { prog: [3, 5, 4, 0] }], order: [0, 1, 0, 2] },
  msc_s5: { level: 1, seed: 41, root: 7, scale: "minor", reverb: 18, reverb_type: "room", tempo: 116, oct: 4, inst: ["gm_clean_guitar", "gm_pizzicato_strings", "gm_pick_bass", drumsI, "gm_muted_trumpet", "gm_synth_strings_2", drumsI, "gm_muted_guitar"], harmony: "arp8", bass: "pump", drums: "four", rhythms: [1, 3, 0], rest: 0.3, vol: [-2, -3, -1, -3, -3, -3, -4, -4],
    sections: [{ prog: [0, 0, 5, 6] }, { prog: [3, 4, 0, 0] }, { prog: [5, 6, 0, 4] }], order: [0, 1, 0, 2] },
  msc_s6: { seed: 57, root: 1, scale: "harm", reverb: 30, reverb_type: "hall", tempo: 122, oct: 4, inst: ["gm_alto_sax", "gm_electric_piano_1", "gm_slap_bass_1", drumsI, "gm_trombone", "gm_polysynth_pad", drumsI, "gm_soprano_sax"], harmony: "arp8", bass: "eighth", drums: "drive", rhythms: [1, 3, 5], rest: 0.35, vol: [-2, -3, -1, -3, -3, -3, -4, -4],
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 4] }, { prog: [0, 6, 5, 4] }], order: [0, 1, 0, 2] },
  msc_s7: { level: 0, seed: 63, root: 11, scale: "dorian", reverb: 30, reverb_type: "cave", tempo: 110, oct: 4, inst: ["gm_steel_drums", "gm_steel_guitar", "gm_finger_bass", drumsI, "gm_ocarina", "gm_warm_pad", drumsI, "gm_marimba"], harmony: "arp8", bass: "eighth", drums: "break", rhythms: [3, 1, 5], rest: 0.3, calm: true, vol: [0, -3, -1, -3, -3, -3, -4, -4],
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 2, 3, 0] }, { prog: [0, 6, 4, 4] }], order: [0, 1, 0, 2] },
  msc_s8: { seed: 77, root: 5, scale: "phrygian", reverb: 50, reverb_type: "cave", tempo: 88, oct: 4, inst: ["gm_koto", "gm_new_age_pad", "gm_fretless_bass", drumsI, "gm_shakuhachi", "gm_celesta", drumsI, "gm_koto"], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 3, 0], rest: 0.45, calm: true, vol: [-1, -1, -1, -4, -3, -3, -5, -4], fill: false,
    sections: [{ prog: [0, 1, 0, 1] }, { prog: [4, 3, 1, 0] }, { prog: [0, 6, 1, 0] }], order: [0, 1, 0, 2] },
  msc_s9: { level: -1, seed: 91, root: 2, scale: "minor", reverb: 30, reverb_type: "hall", tempo: 120, oct: 4, inst: ["gm_french_horn", "gm_string_ensemble_1", "gm_contrabass", drumsI, "gm_trombone", "gm_choir_aahs", drumsI, "gm_french_horn"], harmony: "arp8", bass: "pump", drums: "four", rhythms: [0, 3, 1], rest: 0.3, vol: [-2, -3, -1, -3, -3, -3, -4, -4],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [2, 6, 5, 4] }, { prog: [0, 3, 5, 4] }], order: [0, 1, 0, 2] },
  msc_s10: { level: 0, seed: 105, root: 9, scale: "harm", reverb: 25, reverb_type: "cave", tempo: 126, oct: 4, inst: ["gm_overdriven_guitar", "gm_rock_organ", "gm_pick_bass", drumsI, "gm_synth_brass_1", "gm_synth_strings_1", drumsI, "gm_square_lead"], harmony: "arp8", bass: "gallop", drums: "drive", rhythms: [1, 0, 5], rest: 0.3, vol: [-2, -2, -1, -3, -3, -3, -4, -4],
    sections: [{ prog: [0, 5, 6, 4] }, { prog: [0, 1, 0, 6] }, { prog: [5, 6, 4, 4] }, { prog: [0, 3, 4, 0] }], order: [0, 1, 2, 3, 0, 1] },
  msc_title: { level: -2, seed: 7, root: 9, scale: "minor", reverb: 40, reverb_type: "hall", tempo: 96, oct: 4, inst: ["gm_vibraphone", "gm_warm_pad", "gm_fretless_bass", drumsI, "gm_string_ensemble_2", "gm_crystal", drumsI, "gm_vibraphone"], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.35, calm: true, vol: [0, -1, -1, -4, -3, -3, -5, -4],
    sections: [{ prog: [0, 5, 2, 6] }, { prog: [5, 3, 0, 4], oct: 4 }, { prog: [0, 5, 3, 4], drums: "four" }], order: [0, 1, 0, 2] },
  msc_hub: { level: -1, seed: 21, root: 2, scale: "dorian", reverb: 30, reverb_type: "room", tempo: 82, oct: 4, inst: ["gm_electric_piano_1", "gm_choir_pad", "gm_acoustic_bass", drumsI, "gm_clarinet", "gm_music_box", drumsI, "gm_electric_piano_1"], harmony: "pad", bass: "half", drums: "none", rhythms: [3, 1, 3], rest: 0.45, calm: true, vol: [-1, -1, -1, -4, -3, -3, -5, -4], fill: false,
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 0] }], order: [0, 1] },
  msc_boss: { seed: 99, root: 4, scale: "harm", reverb: 18, reverb_type: "room", tempo: 148, oct: 4, inst: ["gm_brass_section", "gm_tremolo_strings", "gm_synth_bass_1", drumsI, "gm_french_horn", "gm_choir_aahs", drumsI, "gm_synth_brass_2"], harmony: "arp8", bass: "gallop", drums: "drive", rhythms: [1, 3, 0], rest: 0.3, arpOct: 3,
    // one octave for the whole tune and the arpeggio under it (the music check found a three-octave span and strings above the brass)
    sections: [{ prog: [0, 0, 1, 0] }, { prog: [5, 4, 5, 4] }, { prog: [0, 6, 5, 4] }], order: [0, 1, 0, 2], vol: [-1, -3, -1, -3, -3, -3, -4, -4] },
  msc_final: { level: -1, seed: 123, root: 9, scale: "harm", reverb: 25, reverb_type: "hall", tempo: 156, oct: 4, inst: ["gm_overdriven_guitar", "gm_string_ensemble_1", "gm_synth_bass_1", drumsI, "gm_brass_section", "gm_choir_aahs", drumsI, "gm_synth_strings_2"], harmony: "arp8", bass: "gallop", drums: "boss", rhythms: [1, 3, 5], rest: 0.25, arpOct: 3, reverb: 20,
    sections: [{ prog: [0, 5, 6, 4] }, { prog: [0, 1, 0, 6] }, { prog: [5, 6, 4, 4] }, { prog: [0, 0, 0, 0], bass: "pump" }], order: [0, 1, 2, 3, 0, 1, 2, 3], vol: [-2, -3, -1, -3, -3, -3, -4, -4] },
};

export function allMusic() {
  const out = {};
  for (const [name, o] of Object.entries(SONGS)) out[name] = new Song(o).build();
  out.msc_victory = jingle("victory", { root: 0, scale: "major", tempo: 132, rows: 32, inst: ["gm_trumpet", "gm_string_ensemble_1", "gm_acoustic_bass", drumsI],
    lead: [[0, 0, 5], [2, 0, 5], [4, 0, 5], [6, 2, 5], [8, 4, 5], [10, 2, 5], [12, 4, 5], [16, 7, 5], [24, 9, 5], [31, "OFF"]].map(([r, d, o]) => [r, d === 0 && r < 8 ? 4 : d, o]),
    bass: [[0, 0], [8, 3], [16, 4], [24, 0]], pad: [[0, 0], [8, 3], [16, 4], [24, 0]], drums: [[0, "C3+C#4"], [8, "C3"], [16, "C3+D3"], [20, "D3"], [24, "C3+C#4"]] });
  out.msc_gameover = jingle("gameover", { level: -2, root: 9, scale: "minor", tempo: 70, rows: 32, inst: ["gm_cello", "gm_choir_aahs", "gm_contrabass", drumsI],
    lead: [[0, 4, 4], [4, 3, 4], [8, 2, 4], [12, 0, 4], [16, -1, 4], [24, 0, 3], [31, "OFF"]], bass: [[0, 0], [16, -3]], pad: [[0, 0], [16, -3]], drums: [[0, "C3"]] });
  return out;
}
