// Reading a song like a musician reads a score: the key it is really in, the chord of each bar, whether the melody sits on the
// chords, notes that rub against each other, registers that come out shrill or muddy, the shape of the melody and how busy each part
// is. Pure (no sound is made): it works on the editor's song model (audio-core.js parseSong), so the studio and the MCP tools share it.
// Notes are tracker numbers: C4 = 48, A4 = 57 (440 Hz).

const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const pitchName = (n) => `${NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12)}`;
const pc = (n) => ((n % 12) + 12) % 12;

// Krumhansl-Kessler key profiles: how strongly each scale step belongs to a major or minor key.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
// modes a tune may be in on the same home note: if one of them explains the notes better than plain major or minor, the reading says so
const MODES = { dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], "harmonic minor": [0, 2, 3, 5, 7, 8, 11] };
const CHORDS = [
  { suffix: "", steps: [0, 4, 7] }, { suffix: "m", steps: [0, 3, 7] }, { suffix: "dim", steps: [0, 3, 6] },
  { suffix: "sus4", steps: [0, 5, 7] }, { suffix: "sus2", steps: [0, 2, 7] }, { suffix: "aug", steps: [0, 4, 8] },
];
const DRUM = /drum_kit|^kick$|^snare|hihat|openhat|^tom$|^clap$|timpani|taiko|woodblock|agogo|synth_drum|melodic_tom/;

function correlate(a, b) {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

// The key a set of pitch-class weights fits best: { root, mode, name, confidence (correlation, -1..1), runnerUp }.
export function findKey(hist) {
  const scores = [];
  for (let root = 0; root < 12; root++) {
    for (const [mode, prof] of [["major", MAJOR_PROFILE], ["minor", MINOR_PROFILE]]) {
      const rot = Array.from({ length: 12 }, (_, i) => prof[(i - root + 12) % 12]);
      scores.push({ root, mode, name: `${NAMES[root]} ${mode}`, confidence: correlate(hist, rot) });
    }
  }
  scores.sort((a, b) => b.confidence - a.confidence);
  return { ...scores[0], runnerUp: scores[1] };
}

// The chord a set of pitch-class weights spells best, or null for too little to tell.
export function nameChord(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return null;
  let best = null;
  for (let root = 0; root < 12; root++) {
    for (const ch of CHORDS) {
      const inside = ch.steps.reduce((s, k) => s + weights[(root + k) % 12], 0);
      // most of the sound inside the chord, and the root itself present, with plain triads preferred on a tie
      const score = inside / total + (weights[root] > 0 ? 0.15 : -0.3) - (ch.suffix === "" || ch.suffix === "m" ? 0 : 0.05);
      if (!best || score > best.score) best = { root, name: NAMES[root] + ch.suffix, pcs: ch.steps.map((k) => (root + k) % 12), score, fit: inside / total };
    }
  }
  return best && best.fit >= 0.5 ? best : null;
}

// Every note of the song in playing order: { track, start, len, pitch, bar } with start and len in rows from the song's beginning.
export function songNotes(song, { isDrum } = {}) {
  const drum = (t) => (isDrum ? isDrum(song.track_inst[t]) : DRUM.test(String(song.track_inst[t] || "")));
  const notes = [];
  let at = 0;
  const barRows = song.rows_per_beat * 4;
  for (const p of song.order) {
    const pat = song.patterns[p];
    pat.tracks.forEach((cells, v) => {
      const t = v % song.tracks;
      if (!song.track_inst[t] || drum(t)) return;
      for (let r = 0; r < cells.length; r++) {
        const c = cells[r];
        if (!c || c.note < 0) continue;
        let end = r + 1;
        while (end < cells.length && !(cells[end] && (cells[end].note >= 0 || cells[end].note === -1))) end++;
        for (const pitch of [c.note, ...(c.extra || [])]) notes.push({ track: t, start: at + r, len: end - r, pitch, bar: Math.floor((at + r) / barRows) });
      }
    });
    at += pat.rows;
  }
  return { notes, rows: at, barRows, drums: Array.from({ length: song.tracks }, (_, t) => drum(t)) };
}

const rangeOf = (list) => {
  if (!list.length) return null;
  let lo = Infinity, hi = -Infinity, sum = 0, w = 0;
  for (const n of list) { lo = Math.min(lo, n.pitch); hi = Math.max(hi, n.pitch); sum += n.pitch * n.len; w += n.len; }
  return { lo, hi, mean: sum / w };
};

// The whole reading. Returns plain data (see describeAnalysis for the words).
export function analyzeSong(song, opts = {}) {
  const { notes, rows, barRows, drums } = songNotes(song, opts);
  const beatRows = song.rows_per_beat, seconds = (rows / beatRows) * (60 / song.tempo);
  const tracks = Array.from({ length: song.tracks }, (_, t) => ({ track: t, instrument: song.track_inst[t], drum: drums[t], notes: notes.filter((n) => n.track === t) }));
  const pitched = tracks.filter((t) => !t.drum && t.notes.length);
  const out = { seconds, bars: Math.ceil(rows / barRows), tempo: song.tempo, tracks: [], issues: [], good: [] };
  if (!pitched.length) { out.issues.push("No pitched notes (only drums, or empty)."); return out; }

  // ---- key: weighted by how long each pitch class sounds
  const hist = Array(12).fill(0);
  for (const n of notes) hist[pc(n.pitch)] += n.len;
  const key = findKey(hist);
  let scale = SCALE[key.mode].map((s) => (key.root + s) % 12);
  if (key.mode === "minor") scale.push((key.root + 11) % 12); // the raised 7th of harmonic minor belongs too
  const total = notes.reduce((s, n) => s + n.len, 0);
  const share = (sc) => notes.filter((n) => !sc.includes(pc(n.pitch))).reduce((s, n) => s + n.len, 0) / total;
  // a mode on one of the two best homes that fits clearly better (dorian reads as minor or as the major a tone below it, for example)
  // Home: a tune usually starts on its home chord and its phrases come back to it. When the first bar and the last bar spell chords with
  // the same root, that root is home; the notes then say which mode of it (D phrygian has the notes of G minor but comes home to D).
  const barChord = (b) => {
    const w = Array(12).fill(0), from = b * barRows, to = from + barRows;
    for (const n of notes) { const o = Math.min(n.start + n.len, to) - Math.max(n.start, from); if (o > 0) w[pc(n.pitch)] += o; }
    return nameChord(w);
  };
  const lastBar = Math.max(0, Math.ceil(rows / barRows) - 1);
  const first = barChord(0), lastC = barChord(lastBar);
  const home = first && lastC && first.root === lastC.root ? first.root : null;
  const modesOf = (root) => Object.entries({ major: SCALE.major, minor: SCALE.minor, ...MODES }).map(([mode, steps]) => ({ mode, sc: steps.map((st) => (root + st) % 12) }));
  if (home !== null && home !== key.root) {
    const best = modesOf(home).map((m) => ({ ...m, sh: share(m.sc) })).sort((a, b) => a.sh - b.sh)[0];
    if (best.sh <= share(scale) + 0.02) { scale = best.sc; key.root = home; key.mode = best.mode; key.name = `${NAMES[home]} ${best.mode}`; }
  } else {
    // the same home: a mode of it may still fit clearly better (E dorian reads as E minor with a raised sixth)
    for (const m of modesOf(key.root)) if (share(m.sc) + 0.04 < share(scale)) { scale = m.sc; key.mode = m.mode; key.name = `${NAMES[key.root]} ${m.mode}`; }
  }
  const outside = notes.filter((n) => !scale.includes(pc(n.pitch)));
  const outsideShare = outside.reduce((s, n) => s + n.len, 0) / total;
  out.key = { name: key.name, confidence: +key.confidence.toFixed(2), runnerUp: key.runnerUp.name, outsideShare: +outsideShare.toFixed(3),
    outsideNotes: [...new Set(outside.map((n) => NAMES[pc(n.pitch)]))] };
  if (song.key && song.key.scale && Number.isInteger(song.key.root)) {
    const said = `${NAMES[song.key.root]} ${song.key.scale}`;
    out.key.declared = said;
  }

  // ---- parts: which is the melody (highest), the bass (lowest), ranges and how busy each is
  const ranged = pitched.map((t) => ({ ...t, range: rangeOf(t.notes) }));
  const lead = ranged.reduce((a, b) => (b.range.mean > a.range.mean ? b : a));
  const bass = ranged.reduce((a, b) => (b.range.mean < a.range.mean ? b : a));
  for (const t of tracks) {
    if (!t.notes.length) { out.tracks.push({ track: t.track, instrument: t.instrument, role: t.drum ? "drums" : "silent" }); continue; }
    const r = rangeOf(t.notes);
    const onsets = new Set(t.notes.map((n) => n.start)).size;
    out.tracks.push({ track: t.track, instrument: t.instrument, role: t.drum ? "drums" : t === lead || t.track === lead.track ? "melody" : t.track === bass.track && ranged.length > 1 ? "bass" : "harmony",
      lowest: pitchName(r.lo), highest: pitchName(r.hi), middle: pitchName(Math.round(r.mean)), notesPerBeat: +(onsets / (rows / beatRows)).toFixed(2) });
  }

  // ---- register: what sounds shrill, muddy or upside down
  if (lead.range.mean > 72) out.issues.push(`The melody (${lead.instrument}) sits high, around ${pitchName(Math.round(lead.range.mean))}: above C6 most instruments turn thin and shrill. Try an octave lower.`);
  if (lead.range.hi > 84) out.issues.push(`The melody reaches ${pitchName(lead.range.hi)}: notes above C7 pierce. Keep the top note at or below C6-C7.`);
  if (bass.track !== lead.track) {
    if (bass.range.mean > 48) out.issues.push(`The bass (${bass.instrument}) sits around ${pitchName(Math.round(bass.range.mean))}: a bass usually lives between C1 and C3.`);
    if (bass.range.mean < 24) out.issues.push(`The bass (${bass.instrument}) sits very low (${pitchName(Math.round(bass.range.mean))}); small speakers may not play it.`);
  }
  for (const t of ranged) {
    if (t.track === lead.track || t.track === bass.track) continue;
    if (t.range.hi > lead.range.mean + 2) out.issues.push(`Track ${t.track + 1} (${t.instrument}) goes above the melody's middle (up to ${pitchName(t.range.hi)}): the accompaniment may cover the tune.`);
    if (t.range.mean < 44 && bass.track !== t.track) out.issues.push(`Track ${t.track + 1} (${t.instrument}) sits low (${pitchName(Math.round(t.range.mean))}) close to the bass: chords down there sound muddy.`);
  }

  // ---- harmony: the chord of each bar from everything but the melody (or everything, if the melody is alone)
  const bars = out.bars;
  const chords = [];
  const support = pitched.length > 1 ? notes.filter((n) => n.track !== lead.track) : notes;
  for (let b = 0; b < bars; b++) {
    const w = Array(12).fill(0);
    const from = b * barRows, to = from + barRows;
    for (const n of support) {
      const overlap = Math.min(n.start + n.len, to) - Math.max(n.start, from);
      if (overlap > 0) w[pc(n.pitch)] += overlap * (n.track === bass.track ? 1.5 : 1);
    }
    chords.push(nameChord(w));
  }
  out.chords = chords.map((c) => (c ? c.name : "?"));

  // the melody on strong beats: on a chord tone, or a passing note?
  const strong = lead.notes.filter((n) => n.start % (beatRows * 2) === 0 && chords[n.bar]);
  const onChord = strong.filter((n) => chords[n.bar].pcs.includes(pc(n.pitch))).length;
  out.melody = { onChordAtStrongBeats: strong.length ? +(onChord / strong.length).toFixed(2) : null };
  if (strong.length >= 4) {
    if (onChord / strong.length < 0.5) out.issues.push(`Only ${Math.round((onChord / strong.length) * 100)}% of the melody's strong-beat notes are in the chord under them: it may sound like it does not belong. Aim for most of beats 1 and 3 on chord tones.`);
    else if (onChord / strong.length >= 0.7) out.good.push(`The melody lands on the chord on ${Math.round((onChord / strong.length) * 100)}% of strong beats.`);
  }

  // ---- melody shape: steps and leaps, span, ending
  const seq = [...lead.notes].sort((a, b) => a.start - b.start || b.pitch - a.pitch).filter((n, i, a) => i === 0 || n.start !== a[i - 1].start);
  let steps = 0, leaps = 0, bigLeaps = 0;
  for (let i = 1; i < seq.length; i++) {
    const d = Math.abs(seq[i].pitch - seq[i - 1].pitch);
    if (d <= 2) steps++; else if (d > 7) { leaps++; if (d > 12) bigLeaps++; }
  }
  const moves = Math.max(1, seq.length - 1);
  out.melody.stepwise = +(steps / moves).toFixed(2);
  out.melody.leaps = leaps;
  out.melody.span = `${pitchName(lead.range.lo)}-${pitchName(lead.range.hi)}`;
  if (bigLeaps) out.issues.push(`The melody jumps more than an octave ${bigLeaps} time${bigLeaps === 1 ? "" : "s"}: hard to follow; move one of the notes an octave.`);
  if (seq.length > 8 && steps / moves < 0.3) out.issues.push("The melody hardly ever moves by step: lots of jumps make a tune feel random. Connect the chord tones with notes in between.");
  else if (seq.length > 8 && steps / moves > 0.5) out.good.push("The melody moves mostly by step, which makes it easy to follow.");
  if (lead.range.hi - lead.range.lo > 19) out.issues.push(`The melody spans ${lead.range.hi - lead.range.lo} semitones: a hummable tune usually stays within about an octave and a half.`);
  const last = seq[seq.length - 1];
  if (last) {
    const lastChord = chords[last.bar];
    const home = pc(last.pitch) === key.root, inChord = lastChord && lastChord.pcs.includes(pc(last.pitch));
    out.melody.ends = `${pitchName(last.pitch)}${home ? " (the home note)" : inChord ? " (a chord tone)" : ""}`;
    if (song.loop_to == null || song.loop_to < 0) { if (!home && !inChord) out.issues.push(`The song ends on ${pitchName(last.pitch)}, neither the home note nor in the last chord: it will sound unfinished.`); }
  }
  // repetition: how many 2-bar phrases of the melody come back (some repetition is what makes a tune stick)
  const phrase = (b) => lead.notes.filter((n) => n.bar === b || n.bar === b + 1).map((n) => `${n.start - b * barRows}:${n.pitch}`).sort().join(",");
  const seen = new Map();
  for (let b = 0; b + 1 < bars; b += 2) { const p = phrase(b); if (p) seen.set(p, (seen.get(p) || 0) + 1); }
  const phrases = [...seen.values()].reduce((s, x) => s + x, 0);
  out.melody.repeatedPhrases = phrases ? +(1 - seen.size / phrases).toFixed(2) : 0;
  if (phrases >= 6 && seen.size === phrases) out.issues.push("No two-bar phrase of the melody ever comes back: a little repetition (the same idea, or the same rhythm) makes a tune memorable.");

  // ---- clashes: notes in different parts a semitone (or a tritone) apart, sounding together for at least a beat
  const clashes = [];
  const byStart = [...notes].sort((a, b) => a.start - b.start);
  for (let i = 0; i < byStart.length; i++) {
    const a = byStart[i];
    for (let j = i + 1; j < byStart.length && byStart[j].start < a.start + a.len; j++) {
      const b = byStart[j];
      if (a.track === b.track) continue;
      const together = Math.min(a.start + a.len, b.start + b.len) - b.start;
      // a semitone or a minor ninth rubs; spread further apart (two octaves and more) the ear hears two separate lines
      const d = Math.abs(a.pitch - b.pitch);
      if (together >= beatRows && (d === 1 || d === 13)) clashes.push({ bar: b.bar + 1, a: `${pitchName(a.pitch)} (track ${a.track + 1})`, b: `${pitchName(b.pitch)} (track ${b.track + 1})`, kind: "semitone" });
    }
  }
  out.clashes = clashes.length;
  if (clashes.length) out.issues.push(`${clashes.length} place${clashes.length === 1 ? "" : "s"} where two parts rub a semitone apart for a beat or more, first in bar ${clashes[0].bar}: ${clashes[0].a} against ${clashes[0].b}.`);

  // ---- key
  if (outsideShare > 0.12) out.issues.push(`${Math.round(outsideShare * 100)}% of the notes are outside ${key.name} (${out.key.outsideNotes.join(", ")}): on purpose that is colour, by accident it sounds wrong.`);
  if (key.confidence < 0.6) out.issues.push(`The key is unclear (best guess ${key.name}, then ${key.runnerUp.name}): the song may feel like it has no home.`);
  else out.good.push(`Clearly in ${key.name}.`);

  // ---- rhythm: how busy the parts are
  const leadDensity = new Set(lead.notes.map((n) => n.start)).size / (rows / beatRows);
  if (leadDensity > 3) out.issues.push(`The melody plays ${leadDensity.toFixed(1)} notes a beat: very busy; it can sound chirpy. Longer notes and rests give it room.`);
  if (leadDensity < 0.4 && bars > 4) out.issues.push(`The melody plays only ${leadDensity.toFixed(1)} notes a beat: it may not register as a tune.`);
  const progression = out.chords.filter((c, i, a) => i === 0 || c !== a[i - 1]);
  if (progression.length <= 1 && bars >= 8) out.issues.push("The harmony never changes: a song on one chord gets static. Two to four chords that come back work well.");
  return out;
}

// The reading as a short text for a person (or an agent with a small context window).
export function describeAnalysis(a) {
  const L = [];
  L.push(`${a.bars} bars, ${a.tempo} BPM, ${a.seconds.toFixed(1)} s` + (a.key ? `; key ${a.key.name} (confidence ${a.key.confidence}${a.key.declared ? `, saved as ${a.key.declared}` : ""})` : ""));
  for (const t of a.tracks) {
    if (!t.lowest) { L.push(`  track ${t.track + 1}: ${t.instrument || "(none)"}, ${t.role}`); continue; }
    L.push(`  track ${t.track + 1}: ${t.instrument}, ${t.role}, ${t.lowest}-${t.highest} (middle ${t.middle}), ${t.notesPerBeat} notes a beat`);
  }
  if (a.chords) {
    const per = [];
    for (let i = 0; i < a.chords.length; i += 4) per.push(a.chords.slice(i, i + 4).join(" "));
    L.push(`chords by bar: ${per.join(" | ")}`);
  }
  if (a.melody) L.push(`melody: ${a.melody.span}, ${Math.round((a.melody.stepwise || 0) * 100)}% steps, ${a.melody.leaps} leaps, ${a.melody.onChordAtStrongBeats === null ? "" : Math.round(a.melody.onChordAtStrongBeats * 100) + "% on the chord at strong beats, "}${Math.round((a.melody.repeatedPhrases || 0) * 100)}% of phrases repeat, ends on ${a.melody.ends}`);
  if (a.good.length) L.push("good: " + a.good.join(" "));
  L.push(a.issues.length ? "worth a look:\n" + a.issues.map((s) => "  - " + s).join("\n") : "nothing to fix found.");
  return L.join("\n");
}
