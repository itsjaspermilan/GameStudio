// Writing sound in code, for any game: sound effects from short step lists, and songs generated from a chord plan, a seeded melody,
// a harmony style, a bass style and a drum style, saved in the studio's tracker format (see README.md > Sound) so they open and edit
// like hand-made ones. Void Swarm's and Panel Pop's sound are made with it (scripts/void-swarm/audio.mjs, scripts/panel-pop/audio.mjs),
// and the MCP server's song_write uses it.
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
// ---------- music
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const nm = (n) => { while (n > 83) n -= 12; while (n < 12) n += 12; return `${NAMES[n % 12]}${Math.floor(n / 12)}`; };
export const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], harm: [0, 2, 3, 5, 7, 8, 11] };
export const RHY = [
  [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 4]],
  [[0, 3], [3, 1], [4, 4], [8, 3], [11, 1], [12, 4]],
  [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]],
  [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]],
  [[0, 1], [1, 1], [2, 1], [3, 1], [4, 2], [6, 2], [8, 1], [9, 1], [10, 1], [11, 1], [12, 4]],
  [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2], [8, 2], [10, 1], [11, 1], [12, 2], [14, 2]],
];
export const empty = (n) => Array(n).fill("--");

// Each song has a `level` (steps of 1.25x added to every track, from rendering them all) so moving between screens keeps the loudness even.
export const leveled = (vol, level = 0) => vol.map((v) => Math.max(-3, Math.min(3, v + level)));

// The chord note (scale degrees, in any octave) closest to `prev`; `rank` 1 takes the second closest.
function nearest(chord, prev, rank) {
  const cands = [];
  for (const c of chord) for (const o of [-14, -7, 0, 7, 14]) cands.push(c + o);
  cands.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev) || a - b);
  const pick = cands[rank] !== undefined && cands[rank] !== prev ? cands[rank] : cands[0];
  return pick;
}

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
        // on the strong beats a chord note, the one nearest the last note (voice leading: a random one jumped about), now and then the next nearest
        if (on % 8 === 0 || k === 0) d = nearest(chord, prev, r() < 0.3 ? 1 : 0);
        else { d = prev + [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)]; }
        d = Math.max(prog[bar] - 2, Math.min(prog[bar] + reg + 2, d));
        if (bar % 4 === 3 && k === rhy.length - 1) d = nearest([chord[0]], prev, 0); // the phrase ends on the chord's root, the closer one
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
    else t1 = this.arp(prog, o.harmony, o.arpOct ?? (o.oct ?? 5) - 1); // an octave under the melody, so it accompanies rather than covers it
    const tracks = [mel, t1, this.bass(prog, v.bass ?? o.bass, o.bassOct ?? 2), this.drums(prog.length, v.drums ?? o.drums, o.fill !== false)];
    return { rows: 16 * prog.length, tracks: tracks.map((t) => t.join(" ")), layers: layers.map((t) => t.join(" ")) };
  }
  build() {
    const o = this.o, patterns = o.sections.map((s) => this.pattern(s.prog, s));
    return {
      format: "tracker", tempo: o.tempo, rows_per_beat: 4, tracks: 4, track_instruments: o.inst, reverb: o.reverb ?? 12, ...(o.reverb_type ? { reverb_type: o.reverb_type } : {}), track_vol: leveled(o.vol ?? [0, -2, -1, -2], o.level),
      patterns, order: o.order, loop_to: o.loop === false ? -1 : 0, key: { root: o.root % 12, scale: o.scale === "lydian" ? "major" : o.scale === "harm" || o.scale === "dorian" || o.scale === "phrygian" ? "minor" : o.scale }, // the editor's key lock knows major and minor; lydian is a major mode
    };
  }
}

export function jingle(name, spec) { // short one-shot songs, written by hand as degree lists
  const s = new Song({ seed: 1, root: spec.root, scale: spec.scale, oct: 5 });
  const lead = empty(spec.rows), bass = empty(spec.rows), pad = empty(spec.rows), pad2 = empty(spec.rows), dr = empty(spec.rows);
  spec.lead.forEach(([r, d, o]) => { lead[r] = d === "OFF" ? "OFF" : nm(s.note(d, o)); });
  spec.bass.forEach(([r, d]) => { bass[r] = d === "OFF" ? "OFF" : nm(s.note(d, 2)); });
  spec.pad.forEach(([r, d]) => { pad[r] = nm(s.note(d, 3)); pad2[r] = nm(s.note(d + 2, 3)); });
  (spec.drums || []).forEach(([r, n]) => { dr[r] = n; });
  const layers = Array.from({ length: 12 }, () => empty(spec.rows).join(" ")); layers[1] = pad2.join(" ");
  return { format: "tracker", tempo: spec.tempo, rows_per_beat: 4, tracks: 4, track_instruments: spec.inst, reverb: 25,
    patterns: [{ rows: spec.rows, tracks: [lead.join(" "), pad.join(" "), bass.join(" "), dr.join(" ")], layers }], order: [0], loop_to: -1, key: { root: spec.root % 12, scale: spec.scale }, track_vol: leveled([0, -1, -1, -2], spec.level) };
}

