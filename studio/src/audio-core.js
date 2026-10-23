// Pure logic for sound effects, instruments and music (no DOM). The synth that plays them is runtime/synth.c; formats:
//   sfx/<name>.json    {speed, loop: {start, end} | null, key, tracks: [{instrument, key?, vol?, steps: [[pitch, volume, effect], ...], layers?: [steps, ...]}, ...]}
//                      (a layer is another voice on the track's instrument: it is what lets two notes sound at once)
//   music/<name>.json  see the tracker section below (the older "patterns of sound effects" form is converted when opened)

export const MAX_STEPS = 32;
export const MAX_PATTERNS = 64;
export const CHANNELS = 4;
export const PITCH_MAX = 63;
export const VOL_MAX = 7;
export const WAVES = ["Triangle", "Saw", "Square", "Pulse", "Sine", "Noise"];
export const EFFECTS = ["None", "Slide", "Vibrato", "Drop", "Fade in", "Fade out", "Arpeggio", "Hold"];
export const FX_HOLD = 7;                          // a step that keeps the note from the step before going, instead of starting a new one
export const USER_EFFECTS = EFFECTS.slice(0, FX_HOLD); // the effects a person picks (Hold is how a long note is written)

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

// Pitch 0 is C1; 12 semitones per octave (the same mapping the synth uses: MIDI note 24 + pitch).
export function noteName(pitch) {
  const midi = 24 + pitch;
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
export function pitchHz(pitch) { return 440 * Math.pow(2, (24 + pitch - 69) / 12); }

// ---------- sound effects ----------
// A sound effect has up to four tracks (the console's sound effect channels), each playing ONE instrument, and every track has
// the same number of steps. A step is [pitch, volume, effect]. (The older form, one row of [pitch, instrument, volume, effect]
// steps, is converted when it is read.)

export const MAX_SFX_TRACKS = 2;                   // a sound effect has two lanes, always shown
export const SFX_TRACKS = 2;
export const MAX_SFX_VOICES = 4;                   // lanes and layers together: the most sound effect channels a console has
export const MAX_VOICES_PER_LANE = 4;              // a lane's own voice and up to three layers (a chord of up to four notes)
export const VOL_STEPS = 3;                       // a track's volume: -3 .. +3 around the baseline 0
export const SFX_LOW = 24, SFX_HIGH = PITCH_MAX;   // the pitches the editor offers: C3 up (lower than that is hard to hear)

export const silentStep = (pitch = 36) => [pitch, 0, 0];

export function newSfx() {
  return {
    speed: 8, loop: null, key: { ...DEFAULT_KEY },
    tracks: [{ instrument: "square", steps: Array.from({ length: 8 }, () => [36, 5, 0]) },
      ...Array.from({ length: SFX_TRACKS - 1 }, () => ({ instrument: null, steps: Array.from({ length: 8 }, () => silentStep()) }))],
  };
}

const instName = (v) => (typeof v === "string" && v ? v : typeof v === "number" && v >= 0 && v < BUILTIN_INSTRUMENTS.length ? BUILTIN_INSTRUMENTS[v] : null);

// The older single-row form -> tracks: one track per instrument used, in order of first use.
function sfxFromLegacy(d) {
  const steps = d.steps.slice(0, MAX_STEPS).map((s) => (Array.isArray(s) ? s : []));
  const order = [];
  for (const s of steps) { const n = instName(s[1]) || "square"; if (!order.includes(n)) order.push(n); }
  if (!order.length) order.push("square");
  const names = order.slice(0, MAX_SFX_TRACKS);
  const tracks = names.map((instrument) => ({ instrument, steps: [] }));
  steps.forEach((s) => {
    const n = instName(s[1]) || "square", own = Math.max(0, names.indexOf(n)), pitch = int(s[0], 0, PITCH_MAX, 36);
    tracks.forEach((t, i) => t.steps.push(i === own ? [pitch, int(s[2], 0, VOL_MAX, 0), int(s[3], 0, EFFECTS.length - 1, 0)] : silentStep(pitch)));
  });
  return { speed: d.speed, loop: d.loop, tracks, key: d.key };
}

const stepsOf = (list) => (Array.isArray(list) ? list : []).slice(0, MAX_STEPS).map((s) => {
  s = Array.isArray(s) ? s : [];
  return [int(s[0], 0, PITCH_MAX, 36), int(s[1], 0, VOL_MAX, 0), int(s[2], 0, EFFECTS.length - 1, 0)];
});
export function normalizeSfx(d) {
  d = d && typeof d === "object" ? d : {};
  if (Array.isArray(d.steps) && !Array.isArray(d.tracks)) d = sfxFromLegacy(d);
  let tracks = (Array.isArray(d.tracks) ? d.tracks : []).slice(0, MAX_SFX_TRACKS).map((t) => ({
    instrument: instName(t && t.instrument),
    steps: stepsOf(t && t.steps),
  }));
  tracks.forEach((t, i) => {
    const raw = d.tracks[i] || {}, k = normalizeLaneKey(raw.key), v = int(raw.vol, -VOL_STEPS, VOL_STEPS, 0);
    if (k !== null) t.key = k;                                                                    // a track's own key (false = any note); none = follow the sound's
    if (v) t.vol = v;                                                                              // a track's volume step; none = 0
    const layers = (Array.isArray(raw.layers) ? raw.layers : []).slice(0, MAX_VOICES_PER_LANE - 1).map((steps) => stepsOf(steps));
    if (layers.length) t.layers = layers;
  });
  while (tracks.length < SFX_TRACKS) tracks.push({ instrument: null, steps: [] });
  const n = Math.max(1, ...tracks.map((t) => t.steps.length));
  for (const t of tracks) {
    while (t.steps.length < n) t.steps.push(silentStep());
    for (const steps of voicesOf(t)) {
      while (steps.length < n) steps.push(silentStep());
      steps.forEach((s, i) => { if (s[2] === FX_HOLD && (i === 0 || steps[i - 1][1] === 0 || s[1] === 0)) s[2] = 0; }); // a hold needs a note before it
    }
    if (t.layers) {
      t.layers = t.layers.filter((steps) => steps.some((s) => s[1] > 0));                    // a layer with no notes is not kept
      if (!t.layers.length) delete t.layers;
    }
  }
  let loop = null;
  if (d.loop && typeof d.loop === "object") {
    const start = int(d.loop.start, 0, n - 1, 0);
    loop = { start, end: int(d.loop.end, start, n - 1, n - 1) };
  }
  const reverb = int(d.reverb, 0, 100, 0); // how much of it goes into the song's reverb; effects are dry unless they ask
  return { speed: int(d.speed, 1, 64, 8), loop, tracks, key: normalizeKey(d.key), ...(reverb ? { reverb } : {}) };
}

export const sfxLength = (d) => d.tracks[0].steps.length;
export const sfxSeconds = (d) => (sfxLength(d) * d.speed) / 60;

// A lane's voices: its own steps, then its layers (more voices on the same instrument, so notes can overlap).
export const voicesOf = (t) => [t.steps, ...(t.layers || [])];
const voiceAt = (d, track, layer = 0) => ({ steps: layer ? d.tracks[track].layers[layer - 1] : d.tracks[track].steps });
export const sfxVoiceCount = (d) => d.tracks.reduce((n, t) => n + voicesOf(t).length, 0);

// Set the number of steps: new steps are silent; shrinking keeps the loop inside the sound.
export function resizeSfx(d, n) {
  n = int(n, 1, MAX_STEPS, sfxLength(d));
  for (const t of d.tracks) for (const steps of voicesOf(t)) {
    while (steps.length < n) steps.push(silentStep(steps[steps.length - 1][0]));
    steps.length = n;
  }
  if (d.loop) {
    if (d.loop.start > n - 1) d.loop = null;
    else d.loop.end = Math.min(d.loop.end, n - 1);
  }
  return d;
}

// Move every pitch by `semitones`, keeping everything inside the range.
export function transposeSfx(d, semitones) {
  for (const t of d.tracks) for (const steps of voicesOf(t)) for (const s of steps) s[0] = Math.max(0, Math.min(PITCH_MAX, s[0] + semitones));
  return d;
}

// ---- notes in a sound effect's voice: a note is a step with a volume, followed by any steps that hold it ----
export function sfxNotes(t) {
  const out = [];
  t.steps.forEach((s, col) => {
    if (s[1] === 0) return;
    if (s[2] === FX_HOLD && out.length && out[out.length - 1].col + out[out.length - 1].len === col) out[out.length - 1].len++;
    else out.push({ col, len: 1, pitch: s[0], vol: s[1], fx: s[2] });
  });
  return out;
}
// Every note of a lane, from all its voices: {layer, col, len, pitch, vol, fx}.
export const laneNotes = (t) => voicesOf(t).flatMap((steps, layer) => sfxNotes({ steps }).map((n) => ({ ...n, layer })));
const sfxNoteAt = (t, col) => sfxNotes(t).find((n) => col >= n.col && col < n.col + n.len);
// Put a note at a step of one voice (a new note is one step long; on the start of an existing note it changes the pitch).
export function placeSfxNote(d, track, col, pitch, vol = 5, layer = 0) {
  if (col >= sfxLength(d)) resizeSfx(d, col + 1);
  const v = voiceAt(d, track, layer);
  pitch = Math.max(0, Math.min(PITCH_MAX, pitch));
  const here = sfxNoteAt(v, col);
  if (here && here.col === col) { setSfxPitch(d, track, col, pitch, layer); return d; }
  let k = col + 1;                                                    // a note placed inside another one of its voice cuts it short
  while (here && k < here.col + here.len) { v.steps[k] = [v.steps[k][0], 0, 0]; k++; }
  v.steps[col] = [pitch, vol, 0];
  return d;
}
// Put a note on the first voice of a lane that is free at `col`, adding a layer when they are all busy (up to four voices a lane and
// the console's sound effect channels in all). Returns the voice used, or -1 when there is no room.
export function addSfxNote(d, track, col, pitch, vol = 5) {
  if (col >= sfxLength(d)) resizeSfx(d, col + 1);
  const t = d.tracks[track];
  const same = laneNotes(t).find((n) => n.pitch === pitch && col >= n.col && col < n.col + n.len);
  if (same) return same.layer;
  for (let layer = 0; layer < voicesOf(t).length; layer++) {
    if (!sfxNoteAt(voiceAt(d, track, layer), col)) { placeSfxNote(d, track, col, pitch, vol, layer); return layer; }
  }
  if (voicesOf(t).length >= MAX_VOICES_PER_LANE || sfxVoiceCount(d) >= MAX_SFX_VOICES) return -1;
  (t.layers = t.layers || []).push(Array.from({ length: sfxLength(d) }, () => silentStep(pitch)));
  const layer = t.layers.length;
  placeSfxNote(d, track, col, pitch, vol, layer);
  return layer;
}
export function setSfxPitch(d, track, col, pitch, layer = 0) {
  const v = voiceAt(d, track, layer), n = sfxNoteAt(v, col);
  if (n) for (let k = n.col; k < n.col + n.len; k++) v.steps[k][0] = Math.max(0, Math.min(PITCH_MAX, pitch));
  return d;
}
export function eraseSfxNote(d, track, col, layer = 0) {
  const v = voiceAt(d, track, layer), n = sfxNoteAt(v, col);
  if (n) for (let k = n.col; k < n.col + n.len; k++) v.steps[k] = [v.steps[k][0], 0, 0];
  return n;
}
// Make the note at `col` last `len` steps (as long as it can before the next note of its voice; the sound grows if needed, up to 32 steps).
export function resizeSfxNote(d, track, col, len, layer = 0) {
  const v = voiceAt(d, track, layer), n = sfxNoteAt(v, col);
  if (!n || n.col !== col) return d;
  const next = sfxNotes(v).find((x) => x.col > col);
  len = Math.max(1, Math.min(len, (next ? next.col : MAX_STEPS) - col));
  if (col + len > sfxLength(d)) resizeSfx(d, col + len);
  const s0 = v.steps[col];
  for (let k = col + 1; k < col + n.len; k++) v.steps[k] = [v.steps[k][0], 0, 0];
  for (let k = col + 1; k < col + len; k++) v.steps[k] = [s0[0], s0[1], FX_HOLD];
  return d;
}
// Move a note to another step, pitch or lane, keeping its length (shortened to the room there), volume and effect. It goes on the first
// voice of the target lane with room; if there is none the sound is left as it was and false comes back.
export function moveSfxNote(d, from, to) {
  const t0 = d.tracks[from.track], src = voiceAt(d, from.track, from.layer), n = sfxNotes(src).find((x) => x.col === from.col);
  if (!n) return false;
  const saved = JSON.stringify(d), s0 = src.steps[n.col].slice();
  eraseSfxNote(d, from.track, n.col, from.layer);
  if (t0.layers) t0.layers = t0.layers.filter((steps) => steps.some((s) => s[1] > 0));
  const t = d.tracks[to.track];
  for (let layer = 0; layer <= (t.layers || []).length + 1; layer++) {
    if (layer > (t.layers || []).length) {                           // every voice here is taken at that step: a new layer, if the lane may have one
      if (voicesOf(t).length >= MAX_VOICES_PER_LANE || sfxVoiceCount(d) >= MAX_SFX_VOICES) break;
      (t.layers = t.layers || []).push(Array.from({ length: sfxLength(d) }, () => silentStep(to.pitch)));
    }
    const v = voiceAt(d, to.track, layer);
    if (sfxNoteAt(v, to.col)) continue;
    const next = sfxNotes(v).find((x) => x.col > to.col);
    placeSfxNote(d, to.track, to.col, to.pitch, s0[1], layer);
    resizeSfxNote(d, to.track, to.col, Math.min(n.len, (next ? next.col : MAX_STEPS) - to.col), layer);
    voiceAt(d, to.track, layer).steps[to.col][2] = s0[2] === FX_HOLD ? 0 : s0[2];
    return true;
  }
  Object.assign(d, JSON.parse(saved));                               // nowhere to put it: undo the removal
  return false;
}

// ---- the key lock: only the notes of one scale are offered, so everything fits together ----
export const SCALES = [
  { id: "major", label: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: "minor", label: "Minor", steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: "major-pentatonic", label: "Major pentatonic (happy, no wrong notes)", steps: [0, 2, 4, 7, 9] },
  { id: "minor-pentatonic", label: "Minor pentatonic (moody, no wrong notes)", steps: [0, 3, 5, 7, 10] },
  { id: "blues", label: "Blues", steps: [0, 3, 5, 6, 7, 10] },
];
export const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const DEFAULT_KEY = { root: 0, scale: "major" };
// A key is {root: 0..11, scale: id}, or null for no lock. Anything else becomes null.
export function normalizeKey(k) {
  if (!k || typeof k !== "object") return null;
  const scale = SCALES.find((s) => s.id === k.scale);
  const root = Number(k.root);
  return scale && Number.isInteger(root) && root >= 0 && root < 12 ? { root, scale: scale.id } : null;
}
// A lane can have a key of its own: false = any note, a key = its own, null = follow the song's (or sound's) key.
export const normalizeLaneKey = (v) => (v === false ? false : normalizeKey(v));
export const laneKey = (shared, own) => (own === false ? null : own || shared);
// The notes a lane offers: the instrument's base octave (the one its range is centred on) and one above and one below, clamped to [min, max].
export function laneWindow(range, [min, max] = [0, 95]) {
  const [lo, hi] = range || [36, 71], octave = Math.floor((lo + hi) / 24);
  return [Math.max(min, (octave - 1) * 12), Math.min(max, (octave + 2) * 12 - 1)];
}
export const inKey = (note, key) => !key || SCALES.find((s) => s.id === key.scale).steps.includes((((note - key.root) % 12) + 12) % 12);
// The nearest note that fits the key (the lower one on a tie), kept within [lo, hi].
export function snapToKey(note, key, lo = 0, hi = 95) {
  if (!key) return note;
  for (let d = 0; d <= 12; d++) {
    for (const n of [note - d, note + d]) if (n >= lo && n <= hi && inKey(n, key)) return n;
  }
  return note;
}
export const keyLabel = (key) => (key ? `${KEY_NAMES[key.root]} ${SCALES.find((s) => s.id === key.scale).label.split(" (")[0].toLowerCase()}` : "off");

// Give a track its instrument (null empties it).
export function setSfxInstrument(d, track, name) { d.tracks[track].instrument = name || null; return d; }

// ---------- music ----------

export function newMusic() { return { patterns: [[null, null, null, null]], loop: null }; }

export function normalizeMusic(d) {
  d = d && typeof d === "object" ? d : {};
  let patterns = Array.isArray(d.patterns) ? d.patterns.slice(0, MAX_PATTERNS) : [];
  patterns = patterns.map((p) => Array.from({ length: CHANNELS }, (_, c) => (Array.isArray(p) && typeof p[c] === "string" && p[c] ? p[c] : null)));
  if (!patterns.length) patterns = [[null, null, null, null]];
  const n = patterns.length;
  let loop = null;
  if (d.loop && typeof d.loop === "object") {
    const from = int(d.loop.from, 0, n - 1, 0);
    loop = { from, to: int(d.loop.to, from, n - 1, n - 1) };
  }
  return { patterns, loop };
}

// ---------- presets and randomiser ----------

const preset = (speed, steps) => ({ speed, steps, loop: null });
export const PRESETS = {
  Coin: () => preset(4, [[46, 2, 7, 0], [58, 2, 7, 5]]),
  Jump: () => preset(3, [[24, 2, 6, 0], [36, 2, 6, 1], [44, 2, 5, 1], [48, 2, 3, 5]]),
  Hit: () => preset(3, [[30, 5, 7, 3], [22, 5, 6, 3], [16, 5, 3, 5]]),
  Laser: () => preset(2, [[60, 3, 6, 3], [56, 3, 6, 3], [50, 3, 5, 3], [44, 3, 4, 5]]),
  Explosion: () => preset(5, [[24, 5, 7, 0], [20, 5, 7, 3], [16, 5, 6, 3], [12, 5, 5, 3], [8, 5, 4, 5], [6, 5, 3, 5]]),
  "Power up": () => preset(3, [[32, 2, 6, 6], [38, 2, 6, 6], [44, 2, 6, 6], [50, 2, 6, 6], [56, 2, 5, 5]]),
  Blip: () => preset(2, [[44, 2, 6, 0], [44, 2, 3, 5]]),
};

// Small deterministic random numbers, so a given seed always makes the same sound.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSfx(seed) {
  const rnd = mulberry32(seed), pick = (n) => Math.floor(rnd() * n);
  const n = 4 + pick(9), speed = 2 + pick(5), wave = [0, 1, 2, 3, 5][pick(5)];
  const fx = [0, 0, 1, 3, 5, 6][pick(6)];
  let pitch = 20 + pick(30);
  const steps = [];
  for (let i = 0; i < n; i++) {
    pitch = Math.max(0, Math.min(PITCH_MAX, pitch + pick(13) - 6));
    steps.push([pitch, wave, Math.max(1, 7 - Math.floor((i * 5) / n) - pick(2)), i % 2 ? fx : 0]);
  }
  steps[n - 1][3] = 5; // end with a fade so it doesn't stop abruptly
  return normalizeSfx({ speed, steps, loop: null });
}

// ====================================================================================================================
// Instruments, tracker songs, and the descriptions the runtime renders for previews
// ====================================================================================================================
//   instruments/<name>.json  {type: pulse|wave|noise|sample, duty, wave, noise, sample, root, loop, volume, pan, attack, decay,
//                             sustain, release, vibrato: {depth, rate, delay}}
//   music/<name>.json        {format: "tracker", tempo, rows_per_beat, tracks: n, track_instruments: [name x n],
//                             track_vol?, track_keys?, patterns: [{rows, tracks: [text per track], layers?: [text per extra voice, 12]}],
//                             order: [pattern numbers], loop_to, reverb}
// Every sound effect and music track plays ONE instrument, named here: one of the project's, or a ready-made one
// (engine/instruments.json, supplied with setBuiltinInstruments).

export const BUILTIN_INSTRUMENTS = ["tri", "saw", "square", "pulse", "sine", "noise"]; // handles 0..5, in this order
export const BUILTIN_LABELS = ["Triangle", "Saw", "Square", "Pulse 25%", "Sine", "Noise"];

// The ready-made instruments come from engine/instruments.json (the runtime has the same file); the studio hands it over at start-up.
let BUILTIN_DOC = { basic: [], instruments: [] };
export function setBuiltinInstruments(doc) { BUILTIN_DOC = doc; }
export const builtinInstruments = () => BUILTIN_DOC.instruments;
export const builtinDef = (name) => BUILTIN_DOC.instruments.find((d) => d.name === name);
export const isBuiltinName = (name) => BUILTIN_INSTRUMENTS.includes(name) || !!builtinDef(name);
export const BUILTIN_GROUPS = (set) => [...new Set(BUILTIN_DOC.instruments.filter((d) => !set || (d.set || "chip") === set).map((d) => d.group))];
export const BUILTIN_SETS = () => (BUILTIN_DOC.sets && BUILTIN_DOC.sets.length ? BUILTIN_DOC.sets : [{ id: "chip", label: "Chip sounds" }]);
export const gmPrograms = () => BUILTIN_DOC.instruments.filter((d) => d.set === "gm" && !d.drum); // the 128 General MIDI sounds, in program order
export const instrumentLabel = (name) => (BUILTIN_INSTRUMENTS.includes(name) ? BUILTIN_LABELS[BUILTIN_INSTRUMENTS.indexOf(name)] : (builtinDef(name) && builtinDef(name).label) || name);
export const INSTRUMENT_TYPES = [["pulse", "Square wave"], ["wave", "Custom wave"], ["noise", "Noise"], ["sample", "Sample"], ["gm", "General MIDI"]];
export const DUTIES = ["12.5%", "25%", "50%", "75%"];
export const SONG_SLOTS = 16;

const clampInt = (v, lo, hi, d) => int(v, lo, hi, d);
const clampNum = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };

// ---------- wavetables: 32 steps of 0..15, written as 32 hex digits ----------
export const waveToHex = (w) => w.map((v) => v.toString(16)).join("").toUpperCase();
export function hexToWave(hex) {
  const out = Array.from({ length: 32 }, () => 8);
  String(hex || "").slice(0, 32).split("").forEach((c, i) => { const v = parseInt(c, 16); out[i] = Number.isNaN(v) ? 8 : v; });
  return out;
}
export const WAVE_PRESETS = {
  Sine: () => Array.from({ length: 32 }, (_, i) => Math.round(7.5 + 7.5 * Math.sin((2 * Math.PI * i) / 32))),
  Triangle: () => Array.from({ length: 32 }, (_, i) => (i < 16 ? Math.round((i * 15) / 15) : Math.round(((31 - i) * 15) / 15))),
  Saw: () => Array.from({ length: 32 }, (_, i) => Math.round((i * 15) / 31)),
  Square: () => Array.from({ length: 32 }, (_, i) => (i < 16 ? 15 : 0)),
  Organ: () => Array.from({ length: 32 }, (_, i) => Math.max(0, Math.min(15, Math.round(7.5 + 4 * Math.sin((2 * Math.PI * i) / 32) + 2.5 * Math.sin((4 * Math.PI * i) / 32) + 1.5 * Math.sin((6 * Math.PI * i) / 32))))),
  Buzz: () => Array.from({ length: 32 }, (_, i) => (i % 8 < 2 ? 15 : i % 8 < 4 ? 4 : 9)),
};
export function randomWave(seed) {
  const rnd = mulberry32(seed);
  const harmonics = [1, 2, 3, 4].map(() => rnd() * 4);
  return Array.from({ length: 32 }, (_, i) => Math.max(0, Math.min(15, Math.round(7.5 + harmonics.reduce((s, a, k) => s + a * Math.sin((2 * Math.PI * i * (k + 1)) / 32 + k), 0)))));
}

// ---------- instruments ----------
export function newInstrument(type = "pulse") {
  const base = { type, volume: 100, pan: 0, attack: 0, decay: 0, sustain: 100, release: 0, vibrato: { depth: 0, rate: 5, delay: 0 } };
  if (type === "pulse") return { ...base, duty: 2 };
  if (type === "wave") return { ...base, wave: waveToHex(WAVE_PRESETS.Sine()) };
  if (type === "gm") return { ...base, program: 0, drum: false };
  if (type === "noise") return { ...base, noise: "hiss", decay: 80, sustain: 0, release: 20 };
  return { ...base, sample: null, root: 48, loop: null };
}

export function normalizeInstrument(d) {
  d = d && typeof d === "object" ? d : {};
  const type = ["pulse", "wave", "noise", "sample", "gm"].includes(d.type) ? d.type : "pulse";
  const v = d.vibrato && typeof d.vibrato === "object" ? d.vibrato : {};
  const out = {
    type, volume: clampInt(d.volume, 0, 100, 100), pan: clampInt(d.pan, -100, 100, 0),
    attack: clampInt(d.attack, 0, 2000, 0), decay: clampInt(d.decay, 0, 2000, 0), sustain: clampInt(d.sustain, 0, 100, 100), release: clampInt(d.release, 0, 2000, 0),
    vibrato: { depth: Math.round(clampNum(v.depth, 0, 4, 0) * 100) / 100, rate: Math.round(clampNum(v.rate, 0.1, 20, 5) * 10) / 10, delay: clampInt(v.delay, 0, 2000, 0) },
  };
  if (type === "pulse") out.duty = clampInt(d.duty, 0, 3, 2);
  if (type === "wave") out.wave = waveToHex(hexToWave(d.wave));
  if (type === "noise") out.noise = d.noise === "metallic" ? "metallic" : "hiss";
  if (Array.isArray(d.range) && d.range.length === 2) { const lo = clampInt(d.range[0], 0, 95, 36), hi = clampInt(d.range[1], lo, 95, 71); out.range = [lo, hi]; }
  if (Array.isArray(d.kit)) out.kit = d.kit.filter((k) => k && Number.isFinite(k.key)).map((k) => ({ key: clampInt(k.key, 0, 95, 36), label: String(k.label || "") }));
  if (type === "gm") { out.program = clampInt(d.program, 0, 127, 0); out.drum = !!d.drum; }
  if (Number.isFinite(Number(d.fixed_note)) && d.fixed_note !== null && d.fixed_note >= 0) out.fixed_note = clampInt(d.fixed_note, 0, 127, 48);
  if (d.sweep && typeof d.sweep === "object" && Number(d.sweep.semitones)) out.sweep = { semitones: clampNum(d.sweep.semitones, -48, 48, 0), ms: clampInt(d.sweep.ms, 1, 2000, 100) };
  if (type === "sample") {
    out.sample = typeof d.sample === "string" && d.sample ? d.sample : null;
    out.root = clampInt(d.root, 0, 95, 48);
    const lp = d.loop && typeof d.loop === "object" ? d.loop : null;
    out.loop = lp ? { start: Math.max(0, clampInt(lp.start, 0, 1e9, 0)), end: Math.max(0, clampInt(lp.end, 0, 1e9, 0)) } : null;
    if (out.loop && out.loop.end <= out.loop.start) out.loop = null;
  }
  return out;
}

// Ready-made instruments to start from: the name is what the user sees.
export const INSTRUMENT_PRESETS = {
  "Bright lead": () => ({ ...newInstrument("pulse"), duty: 1, attack: 3, decay: 150, sustain: 70, release: 60, vibrato: { depth: 0.25, rate: 5.5, delay: 120 } }),
  "Soft lead": () => ({ ...newInstrument("pulse"), duty: 2, volume: 80, attack: 25, decay: 100, sustain: 80, release: 90, vibrato: { depth: 0.15, rate: 5, delay: 200 } }),
  "Thin lead": () => ({ ...newInstrument("pulse"), duty: 0, volume: 85, attack: 2, decay: 90, sustain: 55, release: 40 }),
  "Pluck": () => ({ ...newInstrument("pulse"), duty: 1, attack: 0, decay: 220, sustain: 0, release: 60 }),
  "Square bass": () => ({ ...newInstrument("pulse"), duty: 2, attack: 0, decay: 160, sustain: 60, release: 40 }),
  "Triangle bass": () => ({ ...newInstrument("wave"), wave: waveToHex(WAVE_PRESETS.Triangle()), attack: 0, decay: 0, sustain: 100, release: 30 }),
  "Organ": () => ({ ...newInstrument("wave"), wave: waveToHex(WAVE_PRESETS.Organ()), attack: 8, release: 50 }),
  "Pad": () => ({ ...newInstrument("wave"), wave: waveToHex(WAVE_PRESETS.Sine()), volume: 75, attack: 350, decay: 300, sustain: 70, release: 500, vibrato: { depth: 0.1, rate: 4, delay: 400 } }),
  "Kick": () => ({ ...newInstrument("wave"), wave: waveToHex(WAVE_PRESETS.Sine()), attack: 0, decay: 120, sustain: 0, release: 20 }),
  "Snare": () => ({ ...newInstrument("noise"), noise: "hiss", attack: 0, decay: 130, sustain: 0, release: 30 }),
  "Hi-hat": () => ({ ...newInstrument("noise"), noise: "metallic", attack: 0, decay: 45, sustain: 0, release: 10 }),
  "Open hat": () => ({ ...newInstrument("noise"), noise: "metallic", attack: 0, decay: 200, sustain: 0, release: 60 }),
};


// ---------- building the description the runtime renders ----------
// Collects the instruments, samples, sound effects and songs a preview needs, numbering them the way the runtime expects.
//   lookups: { instrument(name) -> instrument json | undefined }  (the project's own instruments)
export class AudioDesc {
  constructor(lookups = {}, { style = "clean", channels = 8, sfxChannels = 3, stereo = false } = {}) {
    this.lookups = lookups; this.style = style; this.channels = channels; this.sfxChannels = sfxChannels; this.stereo = stereo;
    this.instIds = new Map(BUILTIN_INSTRUMENTS.map((n, i) => [n, i])); this.instLines = []; this.sampleIds = new Map(); this.sampleLines = [];
    this.blocks = []; this.sfxCount = 0; this.songCount = 0; this.problems = [];
  }
  // A handle for an instrument given by number (the original waves) or by name; -1 if it can't be found.
  instrument(ref) {
    if (typeof ref === "number") return Math.max(0, Math.min(BUILTIN_INSTRUMENTS.length - 1, ref | 0));
    if (this.instIds.has(ref)) return this.instIds.get(ref);
    const raw = (this.lookups.instrument && this.lookups.instrument(ref)) || builtinDef(ref);
    if (!raw) { this.problems.push(`instrument '${ref}' is missing`); return -1; }
    const d = normalizeInstrument(raw);
    const sw = d.sweep || { semitones: 0, ms: 0 };
    const common = `${d.volume} ${d.pan} ${d.attack} ${d.decay} ${d.sustain} ${d.release} ${Math.round(d.vibrato.depth * 100)} ${Math.round(d.vibrato.rate * 10)} ${d.vibrato.delay} ${Math.round(sw.semitones * 100)} ${sw.ms} ${d.fixed_note ?? -1}`;
    let rest = "";
    if (d.type === "pulse") rest = `pulse ${d.duty} ${common}`;
    else if (d.type === "wave") rest = `wave ${d.wave} ${common}`;
    else if (d.type === "noise") rest = `noise ${d.noise === "metallic" ? 1 : 0} ${common}`;
    else if (d.type === "gm") rest = `gm ${d.program} ${d.drum ? 1 : 0} ${common}`;
    else {
      if (!d.sample) { this.problems.push(`instrument '${ref}' has no sample`); return -1; }
      if (!this.sampleIds.has(d.sample)) { this.sampleIds.set(d.sample, this.sampleIds.size); this.sampleLines.push(`sample ${this.sampleIds.get(d.sample)} sounds/${d.sample}.wav`); }
      const lp = d.loop || { start: -1, end: -1 };
      rest = `sample ${this.sampleIds.get(d.sample)} ${d.root} ${lp.start} ${lp.end} ${common}`;
    }
    const id = BUILTIN_INSTRUMENTS.length + this.instLines.length;
    this.instLines.push(`inst ${id} ${rest}`);
    this.instIds.set(ref, id);
    return id;
  }
  // A sound effect: one block per track that has an instrument, then one per layer (another voice on that instrument). Returns their ids
  // (to play together, tracks first so that if the channels run out the layers are the first to go), possibly none.
  addSfx(d) {
    const lp = d.loop || { start: -1, end: -1 }, ids = [], more = [];
    for (const t of d.tracks.slice(0, MAX_SFX_TRACKS)) {
      if (!t.instrument) continue;
      const inst = this.instrument(t.instrument);
      if (inst < 0) continue;
      voicesOf(t).forEach((steps, k) => {
        const id = this.sfxCount++;
        this.blocks.push(`sfx ${id} ${d.speed} ${steps.length} ${lp.start} ${lp.end} ${t.vol || 0} ${d.reverb || 0}\n${steps.map((s) => `s ${s[0]} ${inst} ${s[1]} ${s[2]}`).join("\n")}\n`);
        (k ? more : ids).push(id);
      });
    }
    return ids.concat(more);
  }
  // A tracker song; `song` is the editor's model (see parseSong). Track t plays instrument t.
  addSong(song) {
    const id = this.songCount++;
    const slots = Array.from({ length: SONG_SLOTS }, (_, i) => (i < song.tracks && song.track_inst[i] ? this.instrument(song.track_inst[i]) : -1));
    const voices = Math.min(TRACKER.MAX_TRACKS * TRACKER.LAYERS, Math.max(song.tracks, ...song.patterns.map((p) => p.tracks.length)));   // voice v plays track v % 8's instrument
    const space = Math.max(0, REVERB_TYPES.indexOf(song.reverb_type || "room"));
    let t = `song ${id} ${song.tempo} ${song.rows_per_beat} ${voices} ${song.loop_to == null ? -1 : song.loop_to} ${song.reverb} ${space}\ntvol ${Array.from({ length: TRACKER.MAX_TRACKS }, (_, i) => (song.track_vol || [])[i] || 0).join(" ")}\nslots ${slots.join(" ")}\norder ${song.order.length} ${song.order.join(" ")}\n`;
    song.patterns.forEach((p, pi) => {
      t += `pattern ${pi} ${p.rows}\n`;
      p.tracks.forEach((track, ti) => track.forEach((c, r) => { if (c) t += `cell ${pi} ${ti} ${r} ${c.note} ${ti % TRACKER.MAX_TRACKS} ${c.vol} ${c.fx} ${c.fxp}${(c.extra || []).map((n) => " " + n).join("")}\n`; }));
    });
    this.blocks.push(t);
    return id;
  }
  text(renderLine) {
    return (this.stereo ? "stereo\n" : "") + `style ${this.style}\nchannels ${this.channels}\nsfxchannels ${this.sfxChannels}\n` + this.sampleLines.join("\n") + (this.sampleLines.length ? "\n" : "")
      + this.instLines.join("\n") + (this.instLines.length ? "\n" : "") + this.blocks.join("") + renderLine + "\n";
  }
}

// A sound effect, all its tracks together. lookups: {instrument(name)}.
export function renderSfxWith(d, lookups, { volume = 1, seconds, style = "clean", sfxChannels = 3 } = {}) {
  const ad = new AudioDesc(lookups, { style, sfxChannels, stereo: true });
  const ids = ad.addSfx(normalizeSfx(d));
  return { text: ad.text(`render sfx ${ids.join(",")} ${volume}${seconds ? " " + seconds : ""}`), problems: ad.problems, silent: ids.length === 0 };
}

// A preview of one instrument: a note held for half a second, then released (using the same player songs use).
function notePreview(ref, release, note, lookups, opts) {
  const ad = new AudioDesc(lookups, opts);
  const rowsOf = (cells) => Array.from({ length: 16 }, (_, r) => cells[r] || null);
  ad.addSong({
    tempo: 120, rows_per_beat: 4, tracks: 1, loop_to: null, reverb: 0, track_inst: [ref], order: [0],
    patterns: [{ rows: 16, tracks: [rowsOf({ 0: cellOf(note, 15), 4: cellOf(NOTE_OFF, -1) })] }],
  });
  return { text: ad.text(`render song 0 ${(0.5 + release / 1000 + 0.3).toFixed(2)}`), problems: ad.problems };
}
export function instrumentPreviewDesc(d, note, lookups = {}, opts = {}) {
  return notePreview("@", d.release || 0, note, { ...lookups, instrument: (n) => (n === "@" ? d : lookups.instrument && lookups.instrument(n)) }, opts);
}
// The same for an instrument given by name (a built-in or one of the project's).
export function namedNotePreviewDesc(name, note, lookups = {}, opts = {}) {
  return notePreview(name, 300, note, lookups, opts);
}

// ====================================================================================================================
// Tracker songs
// ====================================================================================================================
// In the editor a song is: {tempo, rows_per_beat, tracks (always 8), track_inst: [name|null x tracks], track_vol: [-3..3 x tracks], track_keys,
// patterns: [{rows, tracks: [[cell|null x rows] x 32]}]. A track is a lane with up to four voices: voice v is layer floor(v / 8) of track v % 8,
// so notes that overlap in one lane sit on different voices (all playing the track's instrument).
// order: [pattern numbers], loop_to: number|null, reverb (0..100, how much of the music goes into the reverb), reverb_type ("room", "hall", "cave")}.
// Songs saved with 4 tracks (before 2026-10-23) keep their lanes and chords: a file's layers are read in steps of its own track count. A cell is {note, vol, fx, fxp}: note 0..95, or -1 for "note off", or -2
// for no note (a volume or effect change on its own); vol 0..15 or -1 for "the instrument's own". Each track plays one instrument.

export const TRACKER = { MAX_ROWS: 64, MAX_PATTERNS: 32, MAX_ORDER: 64, MAX_TRACKS: 8, DEFAULT_TRACKS: 8, LAYERS: 4, ROWS: [16, 32, 64], MIN_TEMPO: 30, MAX_TEMPO: 300 };
// The space a song's reverb sounds like (the synth's REVERB_ROOM, _HALL, _CAVE, in this order).
export const REVERB_TYPES = ["room", "hall", "cave"];
export const NOTE_OFF = -1, NOTE_NONE = -2;
export const DEFAULT_TRACK_INSTRUMENTS = ["lead", "piano", "bass", "kick", "snare", "hihat", "pad", "clap"];
export const TRACKER_EFFECTS = [
  { id: 0, name: "None", hint: "" },
  { id: 1, name: "Slide up", hint: "How fast it rises (0-F)" },
  { id: 2, name: "Slide down", hint: "How fast it falls (0-F)" },
  { id: 3, name: "Vibrato", hint: "How much it wobbles (0-F)" },
  { id: 4, name: "Arpeggio", hint: "Chord: 0 major, 1 minor, 2 octave, 3 sus, 4 power, 5 major 7th, 6 minor 7th, 7 two octaves" },
  { id: 5, name: "Volume slide", hint: "0-7 fades out, 8-F fades in" },
  { id: 6, name: "Pan", hint: "0 left, 8 centre, F right" },
  { id: 7, name: "Note cut", hint: "Cut the note after this many ticks (1/30 s)" },
];

const LETTERS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const trackerNoteName = (n) => `${LETTERS[n % 12]}${Math.floor(n / 12)}`;
export function noteToToken(n) { return n === NOTE_NONE ? "--" : n === NOTE_OFF ? "OFF" : trackerNoteName(n); }
// "C4", "F#3", "Db2", "OFF", "--" -> number, or undefined if it isn't a note
export function parseNoteToken(t) {
  if (t === "--" || t === "") return NOTE_NONE;
  if (t === "OFF") return NOTE_OFF;
  const m = /^([A-G])([#b-]?)(\d)$/.exec(t);
  if (!m) return undefined;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + Number(m[3]) * 12;
  return base < 0 || base > 95 ? undefined : base;
}
export const cellOf = (note, vol = -1, fx = 0, fxp = 0, extra) => (extra && extra.length ? { note, extra: extra.slice(0, 3), vol, fx, fxp } : { note, vol, fx, fxp });
// every note a cell strikes: its note, then any struck with it (a drum kit can hit several pieces at once)
export const cellNotes = (c) => (c && c.note >= 0 ? [c.note, ...(c.extra || [])] : []);

// One cell as the word saved in the file: NOTE[,VOL[,FX[,FXP]]], trailing empty fields left off.
export function cellToToken(c) {
  if (!c) return "--";
  const f = [[noteToToken(c.note), ...(c.extra || []).map(noteToToken)].join("+"), c.vol >= 0 ? String(c.vol) : "", c.fx ? String(c.fx) : "", c.fx ? String(c.fxp) : ""];
  while (f.length > 1 && f[f.length - 1] === "") f.pop();
  return f.join(",");
}
// `withInst`: the older form NOTE,INST,VOL,FX,FXP (returns the instrument slot too, as `inst`).
export function tokenToCell(tok, withInst = false) {
  const f = tok.split(",");
  const parts = f[0].split("+"), note = parseNoteToken(parts[0]);
  if (note === undefined) return null;
  const extra = parts.slice(1, 4).map(parseNoteToken).filter((n) => n !== undefined && n >= 0);
  let i = 1, inst = 0;
  if (withInst) { inst = clampInt(f[1], 0, SONG_SLOTS - 1, 0); i = 2; }
  const vol = f[i] === undefined || f[i] === "" ? -1 : clampInt(f[i], 0, 15, -1);
  const fx = clampInt(f[i + 1], 0, TRACKER_EFFECTS.length - 1, 0), fxp = clampInt(f[i + 2], 0, 15, 0);
  if (note === NOTE_NONE && vol === -1 && fx === 0) return null;
  const c = cellOf(note, vol, fx, fxp, note >= 0 ? extra : []);
  if (withInst) c.inst = inst;
  return c;
}

const emptyTrack = (rows) => Array.from({ length: rows }, () => null);
export const newPattern = (rows = 32, voices = TRACKER.MAX_TRACKS * TRACKER.LAYERS) => ({ rows, tracks: Array.from({ length: voices }, () => emptyTrack(rows)) });
const defaultInstrument = (t) => DEFAULT_TRACK_INSTRUMENTS[t] || null;

export const clampVol = (v) => clampInt(v, -VOL_STEPS, VOL_STEPS, 0);
export function newSong() {                          // every song has the same eight tracks
  const tracks = TRACKER.MAX_TRACKS;
  return { tempo: 120, rows_per_beat: 4, tracks, track_inst: Array.from({ length: tracks }, (_, t) => defaultInstrument(t)), track_keys: Array(tracks).fill(null), track_vol: Array(tracks).fill(0), patterns: [newPattern(32)], order: [0], loop_to: 0, reverb: 15, reverb_type: "room", key: { ...DEFAULT_KEY } };
}

// From the saved JSON to the editor's model (and back with serializeSong). Anything out of range is repaired. Songs saved in
// the older form (any instrument in any cell) are converted: each track keeps the instrument it used most.
export function parseSong(d) {
  d = d && typeof d === "object" ? d : {};
  const old = Array.isArray(d.instruments) && !Array.isArray(d.track_instruments);
  const tracks = TRACKER.MAX_TRACKS;                  // songs saved with more tracks lose the extra ones; with fewer, the rest are empty lanes
  const use = Array.from({ length: tracks }, () => new Map());
  const patterns = (Array.isArray(d.patterns) ? d.patterns : []).slice(0, TRACKER.MAX_PATTERNS).map((p) => {
    const rows = clampInt(p && p.rows, 1, TRACKER.MAX_ROWS, 32);
    const out = newPattern(rows);
    // voice texts in the editor's order (layer * 8 + track); the file's layers step by its own track count (4 in older songs)
    const own = ((p && p.tracks) || []).slice(0, tracks), ft = Math.max(1, own.length);
    const texts = Array.from({ length: tracks * TRACKER.LAYERS }, () => "");
    own.forEach((text, t) => { texts[t] = text; });
    ((p && Array.isArray(p.layers)) ? p.layers : []).forEach((text, k) => {
      const layer = 1 + Math.floor(k / ft), t = k % ft;
      if (layer < TRACKER.LAYERS) texts[voiceIndex(layer, t)] = text;
    });
    texts.forEach((text, t) => String(text).split(/\s+/).filter(Boolean).slice(0, rows).forEach((tok, r) => {
      const c = tokenToCell(tok, old);
      if (c && old) { if (c.note >= 0 && use[t % tracks]) use[t % tracks].set(c.inst, (use[t % tracks].get(c.inst) || 0) + 1); delete c.inst; }
      out.tracks[t][r] = c;
    }));
    return out;
  });
  if (!patterns.length) patterns.push(newPattern(32, tracks));
  const order = (Array.isArray(d.order) ? d.order : [0]).slice(0, TRACKER.MAX_ORDER).map((o) => clampInt(o, 0, patterns.length - 1, 0));
  if (!order.length) order.push(0);
  let track_inst;
  if (old) {
    const names = d.instruments.filter((n) => typeof n === "string" && n);
    track_inst = Array.from({ length: tracks }, (_, t) => {
      const best = [...use[t].entries()].sort((a, b) => b[1] - a[1])[0];
      return names[best ? best[0] : 0] || names[0] || defaultInstrument(t);
    });
  } else {
    const list = Array.isArray(d.track_instruments) ? d.track_instruments : [];
    track_inst = Array.from({ length: tracks }, (_, t) => (typeof list[t] === "string" && list[t] ? list[t] : list.length ? null : defaultInstrument(t)));
  }
  return {
    tempo: clampInt(d.tempo, TRACKER.MIN_TEMPO, TRACKER.MAX_TEMPO, 120), rows_per_beat: clampInt(d.rows_per_beat, 1, 16, 4), tracks,
    track_inst, patterns, order,
    track_vol: Array.from({ length: tracks }, (_, t) => clampVol(Array.isArray(d.track_vol) ? d.track_vol[t] : 0)),
    track_keys: Array.from({ length: tracks }, (_, t) => normalizeLaneKey(Array.isArray(d.track_keys) ? d.track_keys[t] : null)),   // a track's own key (false = any note); null = follow the song's
    loop_to: d.loop_to == null ? null : clampInt(d.loop_to, 0, order.length - 1, 0), reverb: clampInt(d.reverb, 0, 100, 0),
    reverb_type: REVERB_TYPES.includes(d.reverb_type) ? d.reverb_type : "room",   // songs saved before the choice existed sound like a room
    key: normalizeKey(d.key),   // songs saved before the key lock existed have none: it stays off for them
  };
}
export function serializeSong(s) {
  return {
    format: "tracker", tempo: s.tempo, rows_per_beat: s.rows_per_beat, tracks: s.tracks, track_instruments: s.track_inst.map((n) => n || ""), reverb: s.reverb,
    ...(s.reverb_type && s.reverb_type !== "room" ? { reverb_type: s.reverb_type } : {}),
    ...((s.track_vol || []).some((v) => v) ? { track_vol: s.track_vol } : {}),
    ...((s.track_keys || []).some((k) => k !== null) ? { track_keys: s.track_keys } : {}),
    patterns: s.patterns.map((p) => {
      const text = p.tracks.map((t) => t.slice(0, p.rows).map(cellToToken).join(" "));
      const layers = text.slice(s.tracks);
      return { rows: p.rows, tracks: text.slice(0, s.tracks), ...(p.tracks.slice(s.tracks).some((t) => t.some(Boolean)) ? { layers } : {}) };   // the extra voices only when a lane uses them
    }),
    order: [...s.order], loop_to: s.loop_to, key: s.key || null,
  };
}
export const isTrackerMusic = (d) => !!d && d.format === "tracker";

export const rowSeconds = (s) => 60 / (s.tempo * s.rows_per_beat);
export function songSeconds(s) { return s.order.reduce((t, p) => t + s.patterns[p].rows, 0) * rowSeconds(s); }

// ---------- editing operations (all in place) ----------
export function setCell(s, p, t, r, cell) { s.patterns[p].tracks[t][r] = cell; return s; }
export function clearCell(s, p, t, r) { s.patterns[p].tracks[t][r] = null; return s; }
export function setTrackInstrument(s, t, name) { s.track_inst[t] = name || null; return s; }

export function setPatternRows(s, p, rows) {
  rows = clampInt(rows, 1, TRACKER.MAX_ROWS, s.patterns[p].rows);
  const pat = s.patterns[p];
  pat.tracks = pat.tracks.map((t) => Array.from({ length: rows }, (_, r) => (r < t.length ? t[r] : null)));
  pat.rows = rows;
  return s;
}
export function addPattern(s, copyFrom = null) {
  if (s.patterns.length >= TRACKER.MAX_PATTERNS) return -1;
  const src = copyFrom == null ? null : s.patterns[copyFrom];
  s.patterns.push(src ? { rows: src.rows, tracks: src.tracks.map((t) => t.map((c) => (c ? { ...c } : null))) } : newPattern(s.patterns.length ? s.patterns[s.patterns.length - 1].rows : 32, s.tracks));
  return s.patterns.length - 1;
}
// Remove a pattern; the order entries that used it go too (the song keeps at least one pattern and one order entry).
export function removePattern(s, p) {
  if (s.patterns.length <= 1) return false;
  s.patterns.splice(p, 1);
  s.order = s.order.filter((o) => o !== p).map((o) => (o > p ? o - 1 : o));
  if (!s.order.length) s.order = [0];
  if (s.loop_to != null) s.loop_to = Math.min(s.loop_to, s.order.length - 1);
  return true;
}
export function insertOrder(s, at, p) {
  if (s.order.length >= TRACKER.MAX_ORDER) return false;
  s.order.splice(at, 0, p);
  if (s.loop_to != null && s.loop_to >= at) s.loop_to = Math.min(s.loop_to + 1, s.order.length - 1);
  return true;
}
export function removeOrder(s, at) {
  if (s.order.length <= 1) return false;
  s.order.splice(at, 1);
  if (s.loop_to != null) s.loop_to = at < s.loop_to ? s.loop_to - 1 : Math.min(s.loop_to, s.order.length - 1);
  return true;
}
export function transposeRange(s, p, t, r0, r1, semitones) {
  for (const cells of voicesOfTrack(s.patterns[p], t)) for (let r = r0; r <= r1; r++) { const c = cells[r]; if (c && c.note >= 0) c.note = Math.max(0, Math.min(95, c.note + semitones)); }
  return s;
}

// A copy of the song that starts at `row` of the pattern at order position `at`, for "play from here".
export function songFrom(s, at, row) {
  const copy = JSON.parse(JSON.stringify(s));
  const src = copy.patterns[copy.order[at]];
  if (row > 0 && row < src.rows) {
    const part = { rows: src.rows - row, tracks: src.tracks.map((t) => t.slice(row)) };
    copy.patterns.push(part);
    copy.order = [copy.patterns.length - 1, ...copy.order.slice(at + 1)];
    copy.loop_to = copy.loop_to != null && copy.loop_to > at ? copy.loop_to - at : null;
    if (!copy.order.slice(1).length) copy.loop_to = null;
  } else {
    copy.order = copy.order.slice(at);
    copy.loop_to = copy.loop_to != null ? Math.max(0, copy.loop_to - at) : null;
    if (s.loop_to != null && s.loop_to < at) copy.loop_to = 0;
  }
  return copy;
}

// The keyboard works like a piano, as in most trackers: the Z row is the lower octave, the Q row the upper.
export const PIANO_KEYS = (() => {
  const lower = "zsxdcvgbhnjm", upper = "q2w3er5t6y7u";
  const out = {};
  [...lower].forEach((k, i) => { out[k] = i; });
  [...upper].forEach((k, i) => { out[k] = 12 + i; });
  out[","] = 12; out["i"] = 24;
  return out;
})();
export const noteForKey = (key, octave) => (key in PIANO_KEYS ? Math.max(0, Math.min(95, octave * 12 + PIANO_KEYS[key])) : undefined);

// Render descriptions for songs.
export function renderSongDesc(song, lookups, { style = "gba", channels = 8, sfxChannels = 3, seconds = 60, stereo = true } = {}) {
  const ad = new AudioDesc(lookups, { style, channels, sfxChannels, stereo });
  ad.addSong(song);
  return { text: ad.text(`render song 0 ${seconds}`), problems: ad.problems };
}

// ---------- the older "patterns of sound effects" music ----------
// Best-effort conversion to a tracker song: each channel becomes a track playing the instrument of its first sound effect. A row is
// as long as the fastest sound effect's step, so sounds with other speeds are rounded to the nearest row.
export function legacyToSong(music, sfxByName, tracks = TRACKER.DEFAULT_TRACKS) {
  const used = new Set(music.patterns.flat().filter(Boolean));
  const speeds = [...used].map((n) => sfxByName.get(n)).filter(Boolean).map((s) => s.speed);
  const rowTicks = speeds.length ? Math.min(...speeds) : 6;
  const tempo = Math.max(TRACKER.MIN_TEMPO, Math.min(TRACKER.MAX_TEMPO, Math.round(900 / rowTicks)));
  const song = newSong();
  song.tempo = tempo; song.patterns = []; song.order = [];
  song.track_inst = song.track_inst.map(() => null);
  const FX = { 2: [3, 4], 3: [2, 15], 5: [5, 7], 6: [4, 0] }; // vibrato, drop (slide down), fade out (volume slide), arpeggio
  music.patterns.forEach((pat, pi) => {
    let rows = 0;
    pat.slice(0, 4).forEach((name) => { const s = name && sfxByName.get(name); if (s) rows = Math.max(rows, Math.ceil((sfxLength(s) * s.speed) / rowTicks)); });
    const length = [16, 32, 64].find((n) => n >= rows) || 64;
    const p = newPattern(length);
    pat.slice(0, 4).forEach((name, t) => {
      const s = name && sfxByName.get(name);
      if (!s) return;
      const tr = s.tracks.find((x) => x.instrument) || s.tracks[0];
      if (tr.instrument && !song.track_inst[t]) song.track_inst[t] = tr.instrument;
      const n = tr.steps.length, total = s.loop ? length * rowTicks : n * s.speed;
      for (let at = 0; at < total && at / rowTicks < length; at += s.speed) {
        let step = Math.floor(at / s.speed);
        if (s.loop && step >= n) step = s.loop.start + ((step - s.loop.start) % (s.loop.end - s.loop.start + 1));
        const st = tr.steps[Math.min(step, n - 1)], row = Math.round(at / rowTicks);
        if (row >= length) break;
        if (st[1] === 0) p.tracks[t][row] = cellOf(NOTE_OFF);
        else { const fx = FX[st[2]] || [0, 0]; p.tracks[t][row] = cellOf(Math.min(95, st[0] + 12), Math.round((st[1] * 15) / 7), fx[0], fx[1]); }
      }
      if (!s.loop) { const end = Math.round(total / rowTicks); if (end < length && !p.tracks[t][end]) p.tracks[t][end] = cellOf(NOTE_OFF); }
    });
    song.patterns.push(p); song.order.push(pi);
  });
  song.track_inst = song.track_inst.map((n, t) => n || defaultInstrument(t));
  if (!song.patterns.length) { song.patterns.push(newPattern(32)); song.order = [0]; }
  if (music.loop) { song.loop_to = Math.min(music.loop.from, song.order.length - 1); song.order = song.order.slice(0, Math.max(music.loop.to + 1, 1)); }
  else song.loop_to = null;
  return song;
}
export const isLegacyMusic = (d) => !!d && !isTrackerMusic(d) && Array.isArray(d.patterns);

// Drum instruments always play one pitch, so their lanes show hits rather than a piano roll.
export const isDrum = (name) => { const d = builtinDef(name); return !!d && d.fixed_note !== undefined; };


// ---------- how high and low an instrument sounds good ----------
// Every instrument has a comfortable range (at most three octaves); the editors show just that, so nobody has to hunt for the right octave.
export const kitOf = (name, lookups = {}) => {
  const d = (lookups.instrument && lookups.instrument(name)) || builtinDef(name);
  return d && Array.isArray(d.kit) && d.kit.length ? d.kit : null;
};
export function instrumentRange(name, lookups = {}) {
  if (!name) return [36, 71];
  const raw = (lookups.instrument && lookups.instrument(name)) || builtinDef(name);
  if (!raw) return [36, 71];                                              // the six basic waves, or a missing instrument
  if (Array.isArray(raw.range) && raw.range.length === 2) return [raw.range[0], raw.range[1]];
  if (raw.type === "gm") { const g = gmPrograms().find((x) => x.program === raw.program); if (g && g.range) return g.range; }
  if (raw.type === "sample") { const root = Number.isFinite(raw.root) ? raw.root : 48; return [Math.max(0, Math.min(root - 12, 60)), Math.min(95, Math.max(root + 23, 35))]; }
  return [36, 71];
}

// ---------- notes in a tracker track ----------
// A track is an array of cells. A note lasts until the next note or note-off. (A drum kit's hits are one-shots: see kitHits.)
export function trackNotes(cells) {
  const out = [];
  for (let r = 0; r < cells.length; r++) {
    const c = cells[r];
    if (!c || c.note < 0) continue;
    let end = r + 1;
    while (end < cells.length && !(cells[end] && (cells[end].note >= 0 || cells[end].note === NOTE_OFF))) end++;
    out.push({ col: r, note: c.note, len: end - r, vol: c.vol, fx: c.fx, fxp: c.fxp });
  }
  return out;
}
export const noteCovering = (cells, col) => trackNotes(cells).find((n) => col >= n.col && col < n.col + n.len);
// Put a note on a step: one step long (a note-off follows) unless it lands on an existing note, which just changes pitch.
export function placeNote(cells, col, note, len = 1) {
  const here = cells[col] && cells[col].note >= 0 ? cells[col] : null;
  if (here) { here.note = note; return cells; }
  cells[col] = cellOf(note);
  for (let r = col + 1; r < Math.min(cells.length, col + len); r++) cells[r] = null;
  if (col + len < cells.length && !cells[col + len]) cells[col + len] = cellOf(NOTE_OFF);
  return cells;
}
// Remove the note covering `col`. The note before it keeps its length, however it was ended.
export function eraseNote(cells, col) {
  const notes = trackNotes(cells), n = notes.find((x) => col >= x.col && col < x.col + x.len);
  if (!n) return null;
  const prev = notes.find((x) => x.col + x.len === n.col);
  const end = n.col + n.len;
  cells[n.col] = prev ? cellOf(NOTE_OFF) : null;
  if (end < cells.length && cells[end] && cells[end].note === NOTE_OFF) cells[end] = null;
  return n;
}
// Make the note starting at `col` last `len` steps, as far as the next note allows.
export function resizeNote(cells, col, len) {
  const notes = trackNotes(cells), n = notes.find((x) => x.col === col);
  if (!n) return cells;
  const next = notes.find((x) => x.col > col);
  len = Math.max(1, Math.min(len, (next ? next.col : cells.length) - col));
  const oldEnd = col + n.len;
  if (oldEnd < cells.length && cells[oldEnd] && cells[oldEnd].note === NOTE_OFF) cells[oldEnd] = null;
  for (let r = col + 1; r < col + len; r++) if (cells[r] && cells[r].note === NOTE_OFF) cells[r] = null;
  const end = col + len;
  if (end < cells.length && !cells[end]) cells[end] = cellOf(NOTE_OFF);
  return cells;
}
// ---- voices: a lane's notes can overlap because each note lives on one of the lane's voices ----
export const voiceIndex = (layer, track) => layer * TRACKER.MAX_TRACKS + track;
export const voicesOfTrack = (pat, track) => Array.from({ length: TRACKER.LAYERS }, (_, layer) => pat.tracks[voiceIndex(layer, track)]);
// Every note of a lane, from all its voices: {layer, col, len, note, vol, fx, fxp}.
export const voiceNotes = (pat, track) => voicesOfTrack(pat, track).flatMap((cells, layer) => trackNotes(cells).map((n) => ({ ...n, layer })));
// Put a note on the first voice of a lane that is free at `col` (a note already sounding that pitch there is left alone). Returns the
// voice used, or -1 when all four are busy.
export function addVoiceNote(pat, track, col, note, len = 1) {
  const same = voiceNotes(pat, track).find((n) => n.note === note && col >= n.col && col < n.col + n.len);
  if (same) return same.layer;
  const voices = voicesOfTrack(pat, track);
  for (let layer = 0; layer < voices.length; layer++) {
    if (!noteCovering(voices[layer], col)) { placeNote(voices[layer], col, note, len); return layer; }
  }
  return -1;
}
// Move a note to another step, pitch or lane of the pattern, keeping its length (shortened to the room there), volume and effect. It goes
// on the first voice of the target lane with room; if there is none the pattern is left as it was and null comes back.
export function moveVoiceNote(pat, from, to) {
  const src = pat.tracks[voiceIndex(from.layer, from.track)], n = trackNotes(src).find((x) => x.col === from.col);
  if (!n) return null;
  const saved = pat.tracks.map((cells) => cells.map((c) => (c ? { ...c, ...(c.extra ? { extra: [...c.extra] } : {}) } : null)));
  eraseNote(src, n.col);
  const voices = voicesOfTrack(pat, to.track);
  for (let layer = 0; layer < voices.length; layer++) {
    const cells = voices[layer];
    if (noteCovering(cells, to.col)) continue;
    const next = trackNotes(cells).find((x) => x.col > to.col);
    placeNote(cells, to.col, to.note, Math.max(1, Math.min(n.len, (next ? next.col : cells.length) - to.col)));
    Object.assign(cells[to.col], { vol: n.vol, fx: n.fx, fxp: n.fxp });
    return { layer, col: to.col };
  }
  pat.tracks.forEach((_, i) => { pat.tracks[i] = saved[i]; });
  return null;
}
// ---- a drum kit track: every cell holds the pieces struck on that step ----
export function kitHits(cells) {
  const out = [];
  cells.forEach((c, col) => cellNotes(c).forEach((key) => out.push({ col, key })));
  return out;
}
export function toggleKitHit(cells, col, key) {
  const c = cells[col], keys = cellNotes(c);
  const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key].slice(0, 4);
  if (!next.length) { cells[col] = null; return false; }
  cells[col] = cellOf(next[0], c ? c.vol : -1, c ? c.fx : 0, c ? c.fxp : 0, next.slice(1));
  return next.includes(key);
}

// ====================================================================================================================
// Making it easy: timing, drum beats, a melody to start from, starter songs
// ====================================================================================================================

// ---------- timing: the length a note starts with, and the grid clicks land on ----------
// A step is a sixteenth note when a beat is four steps. "1/4" is one beat, "1/8" half of one, and so on.
export const TIMINGS = [
  { id: "1/2", label: "1/2", name: "Half note", beats: 2 },
  { id: "1/4", label: "1/4", name: "Quarter note", beats: 1 },
  { id: "1/8", label: "1/8", name: "Eighth note", beats: 0.5 },
  { id: "1/16", label: "1/16", name: "Sixteenth note", beats: 0.25 },
];
export function unitSteps(id, stepsPerBeat = 4) {
  const t = TIMINGS.find((x) => x.id === id) || TIMINGS[1];
  return Math.max(1, Math.round(t.beats * stepsPerBeat));
}

// ---------- drum beats for a drum kit lane ----------
// hits are step numbers within one bar of 16 steps (four beats of four steps); the keys are General MIDI drum keys.
export const KIT_BEATS = [
  { id: "simple", label: "Simple (kick and snare)", hits: { 36: [0, 8], 38: [4, 12] } },
  { id: "rock", label: "Rock", hits: { 36: [0, 8], 38: [4, 12], 42: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: "dance", label: "Dance (four on the floor)", hits: { 36: [0, 4, 8, 12], 39: [4, 12], 46: [2, 6, 10, 14] } },
  { id: "hiphop", label: "Hip-hop", hits: { 36: [0, 6, 10], 38: [4, 12], 42: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { id: "march", label: "March", hits: { 36: [0, 8], 38: [0, 4, 8, 12, 14, 15] } },
  { id: "fill", label: "Add a drum fill (last beat)", fill: true, hits: { 50: [12, 13], 45: [14, 15] } },
];
// Fill a kit lane's cells with a beat, repeating it each bar; `fill` beats are added to the last bar only. Returns the cells.
export function applyKitBeat(cells, beatId, stepsPerBar = 16) {
  const beat = KIT_BEATS.find((b) => b.id === beatId);
  if (!beat) return cells;
  const bars = Math.floor(cells.length / stepsPerBar) || 1;
  if (!beat.fill) for (let r = 0; r < cells.length; r++) cells[r] = null;
  for (let bar = beat.fill ? bars - 1 : 0; bar < bars; bar++) {
    for (const [key, steps] of Object.entries(beat.hits)) {
      for (const s of steps) {
        const col = bar * stepsPerBar + Math.round((s * stepsPerBar) / 16);
        if (col < cells.length && !cellNotes(cells[col]).includes(+key)) toggleKitHit(cells, col, +key);
      }
    }
  }
  return cells;
}

// ---------- a melody to start from ----------
// A pleasant phrase in the key: mostly steps to a neighbouring note, some rests, ending at home. Same seed, same melody.
export function generateMelody({ key, lo, hi, rows, unit = 4, seed = 1 }) {
  const rnd = mulberry32(seed), k = key || { root: 0, scale: "major-pentatonic" };
  const pool = [];
  for (let n = lo; n <= hi; n++) if (inKey(n, k)) pool.push(n);
  const cells = Array.from({ length: rows }, () => null);
  if (pool.length < 2) return cells;
  let at = Math.floor(pool.length / 2) + Math.floor(rnd() * 3) - 1;
  const slots = Math.floor(rows / unit);
  for (let s = 0; s < slots; s++) {
    const last = s === slots - 1, col = s * unit;
    if (!last && s > 0 && rnd() < 0.22) continue;                                   // a rest
    const r = rnd();
    at += r < 0.3 ? 1 : r < 0.6 ? -1 : r < 0.72 ? 2 : r < 0.84 ? -2 : 0;
    at = Math.max(0, Math.min(pool.length - 1, at));
    if (last) { const homes = pool.map((n, i) => [n, i]).filter(([n]) => (n - k.root) % 12 === 0); if (homes.length) at = homes.reduce((b, h) => (Math.abs(h[1] - at) < Math.abs(b[1] - at) ? h : b))[1]; }
    const long = !last && rnd() < 0.25 && s + 2 < slots; // never so long that it swallows the last slot (the home note)
    placeNote(cells, col, pool[at], long ? unit * 2 : unit);
    if (long) s++;
  }
  return cells;
}

// ---------- starter songs ----------
// Each is a few lines of the file format, so a beginner begins with something that already sounds like music.
const dashes = (n) => Array(n).fill("--").join(" ");
const rep = (bar, times) => Array(times).fill(bar).join(" ");
export const STARTER_SONGS = [
  { id: "adventure", label: "Happy adventure", song: {
    format: "tracker", tempo: 120, rows_per_beat: 4, tracks: 4, reverb: 12, key: { root: 0, scale: "major" }, order: [0], loop_to: 0,
    track_instruments: ["lead", "piano", "bass", "gm_drum_kit"],
    patterns: [{ rows: 32, tracks: [
      "C5 -- -- -- E5 -- -- -- G5 -- -- -- E5 -- -- -- D5 -- -- -- F5 -- -- -- E5 -- -- -- C5 -- OFF --",
      "C4 -- -- -- E4 -- -- -- G4 -- -- -- E4 -- -- -- B3 -- -- -- D4 -- -- -- G4 -- -- -- D4 -- -- --",
      "C2 -- -- -- -- -- -- -- G2 -- -- -- -- -- -- -- G2 -- -- -- -- -- -- -- C2 -- -- -- -- -- -- --",
      rep("C3+F#3 -- F#3 -- D3+F#3 -- F#3 -- C3+F#3 -- F#3 -- D3+F#3 -- F#3 --", 2)] }] } },
  { id: "chill", label: "Chill evening", song: {
    format: "tracker", tempo: 90, rows_per_beat: 4, tracks: 4, reverb: 30, key: { root: 9, scale: "minor" }, order: [0], loop_to: 0,
    track_instruments: ["flute", "pad", "bass", "gm_drum_kit"],
    patterns: [{ rows: 32, tracks: [
      "A5 -- -- -- C6 -- -- -- E6 -- -- -- D6 -- -- -- C6 -- -- -- A5 -- -- -- G5 -- -- -- A5 -- OFF --",
      "A3 " + dashes(15) + " F3 " + dashes(15),
      "A2 " + dashes(7) + " A2 " + dashes(7) + " F2 " + dashes(7) + " F2 " + dashes(7),
      rep("C3 -- -- -- F#3 -- -- -- D3 -- C3 -- F#3 -- -- --", 2)] }] } },
  { id: "boss", label: "Boss fight", song: {
    format: "tracker", tempo: 150, rows_per_beat: 4, tracks: 4, reverb: 5, key: { root: 4, scale: "minor" }, order: [0], loop_to: 0,
    track_instruments: ["lead", "brass", "bass", "gm_drum_kit"],
    patterns: [{ rows: 32, tracks: [
      "E4 -- E4 -- G4 -- E4 -- A4 -- G4 -- E4 -- D4 -- E4 -- E4 -- G4 -- E4 -- B4 -- A4 -- G4 -- E4 --",
      "E3 " + dashes(7) + " E3 " + dashes(7) + " E3 " + dashes(7) + " G3 " + dashes(7),
      "E2 -- E2 -- E2 -- E2 -- E2 -- E2 -- E2 -- E2 -- E2 -- E2 -- E2 -- E2 -- G2 -- G2 -- A2 -- B2 --",
      rep("C3 -- A#3 -- C3+D#3 -- A#3 -- C3 -- A#3 -- C3+D#3 -- A#3 --", 2)] }] } },
];
export function starterSong(id) {
  const s = STARTER_SONGS.find((x) => x.id === id);
  return s ? parseSong(JSON.parse(JSON.stringify(s.song))) : null;
}
