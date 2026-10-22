// Sound effects and songs for Void Swarm, written as code. Songs are generated from a chord plan, a seeded melody and a drum style,
// then saved in the studio's tracker format (see README.md > Sound), so they open and edit like hand-made ones.
import { rng } from "./canvas.mjs";

// ---------- sound effects: [pitch, volume, effect]; effects 0 none, 1 slide, 2 vibrato, 3 drop, 4 fade in, 5 fade out, 6 arpeggio, 7 hold
export const S = (p, v = 5, f = 0) => [p, v, f], SIL = [36, 0, 0];
export function sfx(speed, a, b) {
  const [ia, sa] = a, n = sa.length;
  const tracks = [{ instrument: ia, steps: sa }];
  if (!b) tracks.push({ instrument: null, steps: sa.map(() => SIL) });
  if (b) { const [ib, sb] = b; tracks.push({ instrument: ib, steps: [...sb, ...Array(Math.max(0, n - sb.length)).fill(SIL)].slice(0, Math.max(n, sb.length)) }); if (sb.length > n) tracks[0].steps = [...sa, ...Array(sb.length - n).fill(SIL)]; }
  return { speed, loop: null, tracks, key: false };
}
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

// ---------- music
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const nm = (n) => { while (n > 83) n -= 12; while (n < 12) n += 12; return `${NAMES[n % 12]}${Math.floor(n / 12)}`; };
const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], harm: [0, 2, 3, 5, 7, 8, 11] };
const RHY = [
  [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 4]],
  [[0, 3], [3, 1], [4, 4], [8, 3], [11, 1], [12, 4]],
  [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]],
  [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]],
  [[0, 1], [1, 1], [2, 1], [3, 1], [4, 2], [6, 2], [8, 1], [9, 1], [10, 1], [11, 1], [12, 4]],
  [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2], [8, 2], [10, 1], [11, 1], [12, 2], [14, 2]],
];
export const empty = (n) => Array(n).fill("--");

export class Song {
  constructor(o) { this.o = o; this.sc = SCALES[o.scale]; this.r = rng(o.seed); }
  note(deg, oct) { return this.o.root + oct * 12 + 12 * Math.floor(deg / 7) + this.sc[((deg % 7) + 7) % 7]; }
  chordDegs(root) { return [root, root + 2, root + 4]; }
  melody(prog, { oct, rhythms, reg = 6, calm = false }) {
    const rows = empty(16 * prog.length), r = this.r; let prev = prog[0] + 2;
    const motif = [];
    for (let b = 0; b < 2; b++) motif.push(RHY[rhythms[Math.floor(r() * rhythms.length)]]);
    for (let bar = 0; bar < prog.length; bar++) {
      const chord = this.chordDegs(prog[bar]), rhy = motif[bar % 2];
      rhy.forEach(([on, dur], k) => {
        if (k > 0 && on % 8 !== 0 && r() < (this.o.rest ?? 0.3)) return;
        let d;
        if (on % 8 === 0 || k === 0) d = chord[Math.floor(r() * 3)] + (r() < 0.1 ? 7 : 0);
        else { d = prev + [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)]; }
        d = Math.max(prog[bar] - 2, Math.min(prog[bar] + reg + 2, d));
        if (bar % 4 === 3 && k === rhy.length - 1) d = chord[0] + 7 * (r() < 0.5 ? 1 : 0);
        prev = d;
        rows[bar * 16 + on] = nm(this.note(d, oct));
        const end = on + dur;
        if (end < 16 && rows[bar * 16 + end] === "--" && !calm) rows[bar * 16 + end] = "OFF";
      });
    }
    return rows;
  }
  arp(prog, style, oct) {
    const rows = empty(16 * prog.length);
    prog.forEach((root, bar) => {
      const ch = this.chordDegs(root), seq = style === "arp16" ? [0, 1, 2, 1] : style === "arp8" ? [0, 2, 1, 2] : [0, 1, 2, 3];
      const step = style === "arp16" ? 1 : 2;
      for (let i = 0; i * step < 16; i++) { const k = seq[i % seq.length], deg = k === 3 ? ch[0] + 7 : ch[k]; rows[bar * 16 + i * step] = nm(this.note(deg, oct)); }
    });
    return rows;
  }
  pad(prog, oct) {
    const t = empty(16 * prog.length), l1 = empty(16 * prog.length), l2 = empty(16 * prog.length);
    prog.forEach((root, bar) => { const ch = this.chordDegs(root); t[bar * 16] = nm(this.note(ch[0], oct)); l1[bar * 16] = nm(this.note(ch[1], oct)); l2[bar * 16] = nm(this.note(ch[2], oct)); });
    return [t, l1, l2];
  }
  bass(prog, style, oct) {
    const rows = empty(16 * prog.length);
    prog.forEach((root, bar) => {
      const b = bar * 16, lo = nm(this.note(root, oct)), hi = nm(this.note(root + 7, oct)), fifth = nm(this.note(root + 4, oct));
      if (style === "half") { rows[b] = lo; rows[b + 8] = fifth; }
      else if (style === "eighth") { for (let i = 0; i < 16; i += 2) rows[b + i] = i % 8 === 6 ? fifth : lo; }
      else if (style === "pump") { for (let i = 0; i < 16; i += 4) { rows[b + i] = lo; rows[b + i + 2] = hi; } }
      else if (style === "gallop") { for (let i = 0; i < 16; i += 4) { rows[b + i] = lo; rows[b + i + 1] = lo; rows[b + i + 2] = i % 8 === 4 ? fifth : lo; } }
      else { rows[b] = lo; rows[b + 6] = lo; rows[b + 10] = fifth; rows[b + 12] = lo; }
    });
    return rows;
  }
  drums(bars, style, fill) {
    const rows = empty(16 * bars), add = (i, n) => { rows[i] = rows[i] === "--" ? n : rows[i] + "+" + n; };
    const K = "C3", Sn = "D3", H = "F#3", O = "A#3", C = "C#4", T1 = "A3", T2 = "D4", Cl = "D#3";
    for (let bar = 0; bar < bars; bar++) {
      const b = bar * 16;
      if (style === "none") continue;
      if (style === "soft") { add(b, K); add(b + 8, K); add(b + 4, Cl); add(b + 12, Cl); for (let i = 0; i < 16; i += 4) add(b + i, H); }
      else if (style === "four") { for (let i = 0; i < 16; i += 4) add(b + i, K); add(b + 4, Cl); add(b + 12, Cl); for (let i = 2; i < 16; i += 4) add(b + i, H); }
      else if (style === "drive") { [0, 6, 8, 12].forEach((i) => add(b + i, K)); add(b + 4, Sn); add(b + 12, Sn); for (let i = 2; i < 16; i += 4) add(b + i, H); }
      else if (style === "break") { [0, 10].forEach((i) => add(b + i, K)); add(b + 4, Sn); add(b + 12, Sn); for (let i = 2; i < 16; i += 4) add(b + i, H); }
      else if (style === "boss") { [0, 2, 4, 6, 8, 10, 12, 14].forEach((i) => add(b + i, K)); add(b + 4, Sn); add(b + 12, Sn); add(b + 7, Sn); for (let i = 1; i < 16; i += 2) add(b + i, H); }
      if (bar % 4 === 0 && style !== "soft") add(b, C);
      if (fill && bar % 4 === 3) { add(b + 12, T2); add(b + 13, T2); add(b + 14, T1); add(b + 15, Sn); }
    }
    return rows;
  }
  // One pattern of `bars` bars from a chord plan.
  pattern(prog, v) {
    const o = this.o, mel = this.melody(prog, { oct: v.oct ?? o.oct, rhythms: v.rhythms ?? o.rhythms, reg: v.reg ?? 6, calm: o.calm });
    const layers = Array.from({ length: 12 }, () => empty(16 * prog.length));
    let t1;
    if (o.harmony === "pad") { const [a, b, c] = this.pad(prog, o.padOct ?? 3); t1 = a; layers[1] = b; layers[5] = c; }
    else t1 = this.arp(prog, o.harmony, o.arpOct ?? 4);
    const tracks = [mel, t1, this.bass(prog, v.bass ?? o.bass, o.bassOct ?? 2), this.drums(prog.length, v.drums ?? o.drums, o.fill !== false)];
    return { rows: 16 * prog.length, tracks: tracks.map((t) => t.join(" ")), layers: layers.map((t) => t.join(" ")) };
  }
  build() {
    const o = this.o, patterns = o.sections.map((s) => this.pattern(s.prog, s));
    return {
      format: "tracker", tempo: o.tempo, rows_per_beat: 4, tracks: 4, track_instruments: o.inst, reverb: o.reverb ?? 12, track_vol: o.vol ?? [0, -2, -1, -2],
      patterns, order: o.order, loop_to: o.loop === false ? -1 : 0, key: { root: o.root % 12, scale: o.scale === "harm" ? "minor" : o.scale === "dorian" || o.scale === "phrygian" || o.scale === "lydian" ? "minor" : o.scale },
    };
  }
}

const drumsI = "gm_drum_kit";
// Ten different stage songs (one per sector), gentler than before: slower, fewer notes, soft instruments, long notes and rests.
const SONGS = {
  msc_s1: { seed: 3, root: 4, scale: "dorian", tempo: 108, oct: 5, inst: ["flute", "pluck", "bass", drumsI], harmony: "arp8", bass: "half", drums: "soft", rhythms: [3, 1, 3, 0], rest: 0.3, calm: true, vol: [0, -3, -1, -4],
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 0], oct: 5 }, { prog: [0, 6, 5, 4] }, { prog: [3, 0, 4, 0], drums: "four" }], order: [0, 1, 0, 2, 3, 1] },
  msc_s2: { seed: 14, root: 9, scale: "minor", tempo: 96, oct: 5, inst: ["bell", "pad", "bass", drumsI], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.4, calm: true, reverb: 35, vol: [-1, -1, -1, -4], fill: false,
    sections: [{ prog: [0, 5, 2, 6] }, { prog: [3, 4, 0, 0] }, { prog: [5, 6, 0, 4] }], order: [0, 1, 0, 2] },
  msc_s3: { seed: 21, root: 2, scale: "phrygian", tempo: 84, oct: 5, inst: ["strings", "pad", "bass", drumsI], harmony: "pad", bass: "half", drums: "none", rhythms: [3, 3, 1], rest: 0.4, calm: true, reverb: 40, vol: [-1, -1, -1, -4], fill: false,
    sections: [{ prog: [0, 1, 0, 6] }, { prog: [3, 4, 1, 0] }, { prog: [0, 6, 5, 6] }], order: [0, 1, 0, 2] },
  msc_s4: { seed: 33, root: 5, scale: "lydian", tempo: 104, oct: 5, inst: ["bell", "epiano", "bass", drumsI], harmony: "arp8", bass: "eighth", drums: "soft", rhythms: [3, 0, 1], rest: 0.35, calm: true, reverb: 30, vol: [-1, -2, -1, -4],
    sections: [{ prog: [0, 4, 5, 3] }, { prog: [1, 4, 0, 0] }, { prog: [3, 5, 4, 0] }], order: [0, 1, 0, 2] },
  msc_s5: { seed: 41, root: 7, scale: "minor", tempo: 116, oct: 5, inst: ["organ", "pluck", "bass", drumsI], harmony: "arp8", bass: "pump", drums: "four", rhythms: [1, 3, 0], rest: 0.3, vol: [-2, -3, -1, -3],
    sections: [{ prog: [0, 0, 5, 6] }, { prog: [3, 4, 0, 0] }, { prog: [5, 6, 0, 4] }], order: [0, 1, 0, 2] },
  msc_s6: { seed: 57, root: 1, scale: "harm", tempo: 122, oct: 5, inst: ["lead", "epiano", "bass", drumsI], harmony: "arp8", bass: "eighth", drums: "drive", rhythms: [1, 3, 5], rest: 0.35, vol: [-2, -3, -1, -3],
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 4] }, { prog: [0, 6, 5, 4] }], order: [0, 1, 0, 2] },
  msc_s7: { seed: 63, root: 11, scale: "dorian", tempo: 110, oct: 5, inst: ["flute", "epiano", "bass", drumsI], harmony: "arp8", bass: "eighth", drums: "break", rhythms: [3, 1, 5], rest: 0.3, calm: true, vol: [0, -3, -1, -3],
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 2, 3, 0] }, { prog: [0, 6, 4, 4] }], order: [0, 1, 0, 2] },
  msc_s8: { seed: 77, root: 5, scale: "phrygian", tempo: 88, oct: 5, inst: ["strings", "pad", "bass", drumsI], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 3, 0], rest: 0.45, calm: true, reverb: 45, vol: [-1, -1, -1, -4], fill: false,
    sections: [{ prog: [0, 1, 0, 1] }, { prog: [4, 3, 1, 0] }, { prog: [0, 6, 1, 0] }], order: [0, 1, 0, 2] },
  msc_s9: { seed: 91, root: 2, scale: "minor", tempo: 120, oct: 5, inst: ["brass", "pluck", "bass", drumsI], harmony: "arp8", bass: "pump", drums: "four", rhythms: [0, 3, 1], rest: 0.3, vol: [-2, -3, -1, -3],
    sections: [{ prog: [0, 5, 3, 4] }, { prog: [2, 6, 5, 4] }, { prog: [0, 3, 5, 4] }], order: [0, 1, 0, 2] },
  msc_s10: { seed: 105, root: 9, scale: "harm", tempo: 126, oct: 5, inst: ["organ", "strings", "bass", drumsI], harmony: "arp8", bass: "gallop", drums: "drive", rhythms: [1, 0, 5], rest: 0.3, reverb: 25, vol: [-2, -2, -1, -3],
    sections: [{ prog: [0, 5, 6, 4] }, { prog: [0, 1, 0, 6] }, { prog: [5, 6, 4, 4] }, { prog: [0, 3, 4, 0] }], order: [0, 1, 2, 3, 0, 1] },
  msc_title: { seed: 7, root: 9, scale: "minor", tempo: 96, oct: 5, inst: ["flute", "pad", "bass", drumsI], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], rest: 0.35, calm: true, reverb: 30, vol: [0, -1, -1, -4],
    sections: [{ prog: [0, 5, 2, 6] }, { prog: [5, 3, 0, 4], oct: 5 }, { prog: [0, 5, 3, 4], drums: "four" }], order: [0, 1, 0, 2] },
  msc_hub: { seed: 21, root: 2, scale: "dorian", tempo: 82, oct: 5, inst: ["bell", "pad", "bass", drumsI], harmony: "pad", bass: "half", drums: "none", rhythms: [3, 1, 3], rest: 0.45, calm: true, reverb: 35, vol: [-1, -1, -1, -4], fill: false,
    sections: [{ prog: [0, 3, 0, 4] }, { prog: [5, 4, 3, 0] }], order: [0, 1] },
  msc_boss: { seed: 99, root: 4, scale: "harm", tempo: 148, oct: 5, inst: ["brass", "pluck", "bass", drumsI], harmony: "arp8", bass: "gallop", drums: "drive", rhythms: [1, 3, 0], rest: 0.3, arpOct: 4,
    sections: [{ prog: [0, 0, 1, 0] }, { prog: [5, 4, 5, 4], oct: 6 }, { prog: [0, 6, 5, 4], reg: 8 }], order: [0, 1, 0, 2], vol: [-1, -3, -1, -3] },
  msc_final: { seed: 123, root: 9, scale: "harm", tempo: 156, oct: 5, inst: ["lead", "organ", "bass", drumsI], harmony: "arp8", bass: "gallop", drums: "boss", rhythms: [1, 3, 5], rest: 0.25, arpOct: 4, reverb: 20,
    sections: [{ prog: [0, 5, 6, 4] }, { prog: [0, 1, 0, 6], oct: 6 }, { prog: [5, 6, 4, 4], reg: 8 }, { prog: [0, 0, 0, 0], bass: "pump" }], order: [0, 1, 2, 3, 0, 1, 2, 3], vol: [-2, -3, -1, -3] },
};

export function jingle(name, spec) { // short one-shot songs, written by hand as degree lists
  const s = new Song({ seed: 1, root: spec.root, scale: spec.scale, oct: 5 });
  const lead = empty(spec.rows), bass = empty(spec.rows), pad = empty(spec.rows), pad2 = empty(spec.rows), dr = empty(spec.rows);
  spec.lead.forEach(([r, d, o]) => { lead[r] = d === "OFF" ? "OFF" : nm(s.note(d, o)); });
  spec.bass.forEach(([r, d]) => { bass[r] = d === "OFF" ? "OFF" : nm(s.note(d, 2)); });
  spec.pad.forEach(([r, d]) => { pad[r] = nm(s.note(d, 3)); pad2[r] = nm(s.note(d + 2, 3)); });
  (spec.drums || []).forEach(([r, n]) => { dr[r] = n; });
  const layers = Array.from({ length: 12 }, () => empty(spec.rows).join(" ")); layers[1] = pad2.join(" ");
  return { format: "tracker", tempo: spec.tempo, rows_per_beat: 4, tracks: 4, track_instruments: spec.inst, reverb: 25, track_vol: [0, -1, -1, -2],
    patterns: [{ rows: spec.rows, tracks: [lead.join(" "), pad.join(" "), bass.join(" "), dr.join(" ")], layers }], order: [0], loop_to: -1, key: { root: spec.root % 12, scale: spec.scale } };
}

export function allMusic() {
  const out = {};
  for (const [name, o] of Object.entries(SONGS)) out[name] = new Song(o).build();
  out.msc_victory = jingle("victory", { root: 0, scale: "major", tempo: 132, rows: 32, inst: ["brass", "strings", "bass", drumsI],
    lead: [[0, 0, 5], [2, 0, 5], [4, 0, 5], [6, 2, 5], [8, 4, 5], [10, 2, 5], [12, 4, 5], [16, 7, 5], [24, 9, 5], [31, "OFF"]].map(([r, d, o]) => [r, d === 0 && r < 8 ? 4 : d, o]),
    bass: [[0, 0], [8, 3], [16, 4], [24, 0]], pad: [[0, 0], [8, 3], [16, 4], [24, 0]], drums: [[0, "C3+C#4"], [8, "C3"], [16, "C3+D3"], [20, "D3"], [24, "C3+C#4"]] });
  out.msc_gameover = jingle("gameover", { root: 9, scale: "minor", tempo: 70, rows: 32, inst: ["strings", "pad", "bass", drumsI],
    lead: [[0, 4, 5], [4, 3, 5], [8, 2, 5], [12, 0, 5], [16, -1, 5], [24, 0, 4], [31, "OFF"]], bass: [[0, 0], [16, -3]], pad: [[0, 0], [16, -3]], drums: [[0, "C3"]] });
  return out;
}
