// Instrument editor: how a note sounds. Pick a kind of sound (square wave, drawn wave, noise or sample), shape it with the
// envelope, and play it on a piano. Pure logic is in audio-core.js; previews come from the runtime's own synth.
import { color as themeColor, ink, tint } from "./theme.js";
import * as A from "./audio-core.js";
import { History } from "./sprite-core.js";
import { zoomCanvasView } from "./canvas-zoom.js";

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const NOTE_OPTIONS = Array.from({ length: 96 }, (_, n) => [n, A.trackerNoteName(n)]);
const WAVE_W = 384, WAVE_H = 128;

// hooks: { onChange(), renderInstrument(def, note) -> Promise<base64 wav>, getSamples() -> string[] }
export function createInstrumentEditor(root, hooks = {}) {
  root.innerHTML = `
    <div class="ins-bar">
      <label>Start from <select class="ins-preset"></select></label>
      <span class="ins-sep"></span>
      <button class="ins-undo">Undo</button><button class="ins-redo">Redo</button>
    </div>
    <div class="ins-body">
      <section class="ins-card"><h3>Sound</h3>
        <label>Kind <select class="ins-type"></select></label>
        <div class="ins-pulse"><div class="ins-hint">How wide the pulse is. Thin sounds buzzy, 50% sounds hollow.</div><div class="ins-duties"></div></div>
        <div class="ins-wave"><div class="ins-hint">Draw your own wave: click and drag. Higher is louder at that moment of the wave.</div>
          <canvas class="ins-wavecanvas" width="${WAVE_W}" height="${WAVE_H}"></canvas>
          <div><label>Shape <select class="ins-wavepreset"></select></label> <button class="ins-wrand">Random</button></div></div>
        <div class="ins-noise"><div class="ins-hint">Hiss is smooth like a snare. Metallic is ringing like a hi-hat.</div>
          <label><input type="radio" name="ins-noise" value="hiss"> Hiss</label> <label><input type="radio" name="ins-noise" value="metallic"> Metallic</label></div>
        <div class="ins-gm"><div class="ins-hint">A real instrument from the General MIDI SoundFont (it must sit next to the runtime: see the README). Its own shape and release come from the recording.</div>
          <label>Instrument <select class="ins-gmprogram"></select></label>
          <label class="ins-check"><input type="checkbox" class="ins-gmdrum"> A drum from the drum kit</label>
          <label class="ins-gmdrumrow">Drum <select class="ins-gmdrumkey"></select></label></div>
        <div class="ins-sample"><div class="ins-hint">Import WAV files with Import in the Samples list. The root note is the pitch the recording plays at unchanged.</div>
          <label>Sample <select class="ins-sampleselect"></select></label>
          <label>Root note <select class="ins-root"></select></label>
          <label class="ins-check"><input type="checkbox" class="ins-loopon"> Loop the sustain</label>
          <label>from <input type="number" class="ins-loopstart" min="0"></label><label>to <input type="number" class="ins-loopend" min="0"></label>
          <div class="ins-hint">Loop positions are counted in sample frames.</div></div>
      </section>
      <section class="ins-card ins-envcard"><h3>Shape over time</h3>
        <canvas class="ins-env" width="320" height="110"></canvas>
        <div class="ins-sliders"></div>
      </section>
      <section class="ins-card"><h3>Mix</h3><div class="ins-mix"></div></section>
    </div>
    <div class="ins-piano-wrap"><label>Octave <select class="ins-octave"></select></label>
      <div class="ins-piano"></div>
      <div class="ins-hint">Click the keys, or press Z S X D C V G B H N J M (and Q 2 W 3 E R 5 T 6 Y 7 U for the octave above).</div></div>
    <div class="ins-status"></div>`;
  const $ = (sel) => root.querySelector(sel);
  const wave = $(".ins-wavecanvas"), wctx = wave.getContext("2d"), env = $(".ins-env"), ectx = env.getContext("2d");
  zoomCanvasView(wave);
  zoomCanvasView(env);

  let name = null, def = A.newInstrument(), dirty = false, history = new History(), octave = 4, audio = null, token = 0, drag = false;

  const markDirty = () => { dirty = true; hooks.onChange && hooks.onChange(); };
  const snap = () => JSON.stringify(def);
  function commit(mutator) { history.record(JSON.parse(snap())); mutator(); def = A.normalizeInstrument(def); markDirty(); renderAll(); }

  // ---------- static pieces ----------
  A.INSTRUMENT_TYPES.forEach(([v, l]) => $(".ins-type").appendChild(new Option(l, v)));
  $(".ins-preset").appendChild(new Option("(a preset)", ""));
  Object.keys(A.INSTRUMENT_PRESETS).forEach((p) => $(".ins-preset").appendChild(new Option(p, p)));
  $(".ins-wavepreset").appendChild(new Option("(a shape)", ""));
  Object.keys(A.WAVE_PRESETS).forEach((p) => $(".ins-wavepreset").appendChild(new Option(p, p)));
  NOTE_OPTIONS.forEach(([n, l]) => $(".ins-root").appendChild(new Option(l, n)));
  for (let o = 1; o <= 6; o++) $(".ins-octave").appendChild(new Option(String(o), o));
  $(".ins-octave").value = octave;
  { // the General MIDI sounds, grouped by family, and the drum kit's pieces
    const sel = $(".ins-gmprogram"); let group = null, og = null;
    for (const d of A.gmPrograms()) { if (d.group !== group) { og = document.createElement("optgroup"); og.label = d.group; sel.appendChild(og); group = d.group; } og.appendChild(new Option(d.label, d.program)); }
    for (const d of A.builtinInstruments().filter((x) => x.set === "gm" && x.drum)) $(".ins-gmdrumkey").appendChild(new Option(d.label, d.fixed_note));
  }
  A.DUTIES.forEach((l, i) => {
    const b = el("button", "ins-duty", l); b.dataset.duty = i;
    b.onclick = () => commit(() => { def.duty = i; });
    $(".ins-duties").appendChild(b);
  });

  // a slider with a number beside it, writing through `set`
  const sliders = {};
  function slider(parent, key, label, min, max, step, get, set, unit) {
    const row = el("label", "ins-slider");
    const r = el("input"); r.type = "range"; r.min = min; r.max = max; r.step = step;
    const out = el("span", "ins-val");
    r.oninput = () => { out.textContent = r.value + unit; };
    r.onchange = () => commit(() => set(Number(r.value)));
    row.append(el("span", "ins-label", label), r, out);
    parent.appendChild(row);
    sliders[key] = () => { r.value = get(); out.textContent = r.value + unit; };
  }
  const envBox = $(".ins-sliders"), mixBox = $(".ins-mix");
  slider(envBox, "attack", "Attack", 0, 1000, 5, () => def.attack, (v) => { def.attack = v; }, " ms");
  slider(envBox, "decay", "Decay", 0, 1500, 5, () => def.decay, (v) => { def.decay = v; }, " ms");
  slider(envBox, "sustain", "Sustain", 0, 100, 1, () => def.sustain, (v) => { def.sustain = v; }, "%");
  slider(envBox, "release", "Release", 0, 2000, 5, () => def.release, (v) => { def.release = v; }, " ms");
  slider(mixBox, "volume", "Volume", 0, 100, 1, () => def.volume, (v) => { def.volume = v; }, "%");
  slider(mixBox, "pan", "Pan", -100, 100, 5, () => def.pan, (v) => { def.pan = v; }, "");
  slider(mixBox, "vdepth", "Vibrato", 0, 2, 0.05, () => def.vibrato.depth, (v) => { def.vibrato.depth = v; }, " st");
  slider(mixBox, "vrate", "Vibrato speed", 1, 12, 0.5, () => def.vibrato.rate, (v) => { def.vibrato.rate = v; }, " Hz");
  slider(mixBox, "vdelay", "Vibrato delay", 0, 1000, 10, () => def.vibrato.delay, (v) => { def.vibrato.delay = v; }, " ms");
  // the notes it sounds best on: the SFX and music editors show only these, so nobody has to hunt for the right octave
  const rangeRow = el("div", "ins-slider");
  const lowSel = el("select"), highSel = el("select");
  for (let n = 0; n < 96; n++) { lowSel.appendChild(new Option(A.trackerNoteName(n), n)); highSel.appendChild(new Option(A.trackerNoteName(n), n)); }
  const setRange = () => commit(() => { const lo = +lowSel.value; def.range = [lo, Math.min(95, lo + 35, Math.max(+highSel.value, lo + 11))]; });
  lowSel.onchange = setRange; highSel.onchange = setRange;
  rangeRow.append(el("span", "ins-label", "Sounds best"), el("span", "ins-rangepick"), el("span", "ins-val", ""));
  rangeRow.children[1].append(lowSel, el("span", null, " to "), highSel);
  mixBox.appendChild(rangeRow);
  mixBox.appendChild(el("div", "ins-hint", "Sounds best: the lanes in the SFX and music editors show these notes (at most three octaves). Pan: -100 is the left speaker, 100 the right. Attack is the fade-in; decay falls to the sustain level while a key is held; release is the fade-out after."));

  // ---------- the drawn wave ----------
  function drawWave() {
    wctx.fillStyle = themeColor("surface"); wctx.fillRect(0, 0, WAVE_W, WAVE_H);
    if (def.type !== "wave") return;
    const w = A.hexToWave(def.wave), cw = WAVE_W / 32, ch = WAVE_H / 16;
    wctx.strokeStyle = ink(0.1);
    for (let y = 0; y <= 16; y += 4) { wctx.beginPath(); wctx.moveTo(0, y * ch); wctx.lineTo(WAVE_W, y * ch); wctx.stroke(); }
    wctx.fillStyle = themeColor("accent");
    w.forEach((v, i) => wctx.fillRect(i * cw + 1, (15 - v) * ch, cw - 2, ch));
    wctx.fillStyle = tint("accent", 0.25);
    w.forEach((v, i) => wctx.fillRect(i * cw + 1, (15 - v) * ch + ch, cw - 2, WAVE_H - (15 - v) * ch - ch));
  }
  function paintWave(e) {
    const r = wave.getBoundingClientRect();
    const i = Math.max(0, Math.min(31, Math.floor(((e.clientX - r.left) / r.width) * 32)));
    const v = Math.max(0, Math.min(15, 15 - Math.floor(((e.clientY - r.top) / r.height) * 16)));
    const w = A.hexToWave(def.wave); w[i] = v; def.wave = A.waveToHex(w);
  }
  wave.addEventListener("pointerdown", (e) => { if (e.button !== 0 || def.type !== "wave") return; wave.setPointerCapture(e.pointerId); history.record(JSON.parse(snap())); drag = true; paintWave(e); markDirty(); drawWave(); });
  wave.addEventListener("pointermove", (e) => { if (drag) { paintWave(e); markDirty(); drawWave(); } });
  const endWave = () => { if (drag) { drag = false; def = A.normalizeInstrument(def); renderAll(); } };
  wave.addEventListener("pointerup", endWave); wave.addEventListener("pointercancel", endWave);

  // ---------- the envelope picture ----------
  function drawEnv() {
    const W = env.width, H = env.height, pad = 6, hold = 400;                // a note held for 400 ms for the picture
    const total = def.attack + def.decay + hold + def.release || 1;
    const x = (ms) => pad + (ms / total) * (W - 2 * pad), y = (lv) => H - pad - lv * (H - 2 * pad);
    ectx.fillStyle = themeColor("surface"); ectx.fillRect(0, 0, W, H);
    const s = def.sustain / 100, a = def.attack, d = def.decay;
    const pts = [[0, 0], [a, 1], [a + d, s], [a + d + hold, s], [a + d + hold + def.release, 0]];
    ectx.strokeStyle = ink(0.12); ectx.beginPath(); ectx.moveTo(x(a + d + hold), 0); ectx.lineTo(x(a + d + hold), H); ectx.stroke();
    ectx.beginPath(); pts.forEach(([t, l], i) => (i ? ectx.lineTo(x(t), y(l)) : ectx.moveTo(x(t), y(l))));
    ectx.lineTo(x(total), y(0)); ectx.closePath();
    ectx.fillStyle = tint("warn", 0.2); ectx.fill(); ectx.strokeStyle = themeColor("warn"); ectx.lineWidth = 2; ectx.stroke(); ectx.lineWidth = 1;
    ectx.fillStyle = themeColor("muted"); ectx.font = "10px sans-serif"; ectx.fillText("key down", x(0) + 2, 10); ectx.fillText("key up", x(a + d + hold) + 3, 10);
  }

  // ---------- the piano ----------
  const WHITE = [0, 2, 4, 5, 7, 9, 11], BLACK = { 0: 1, 2: 3, 5: 6, 7: 8, 9: 10 };
  function buildPiano() {
    const box = $(".ins-piano"); box.replaceChildren();
    for (let oct = 0; oct < 2; oct++) WHITE.forEach((semi, wi) => {
      const note = (octave + oct) * 12 + semi;
      const k = el("button", "key white", wi === 0 ? A.trackerNoteName(note) : ""); k.dataset.note = note;
      k.onpointerdown = () => preview(note);
      box.appendChild(k);
      if (BLACK[semi] !== undefined) {
        const bn = (octave + oct) * 12 + BLACK[semi], b = el("button", "key black"); b.dataset.note = bn;
        b.style.left = `calc(${(oct * 7 + wi + 1) / 14 * 100}% - 2.6%)`;
        b.onpointerdown = (e) => { e.stopPropagation(); preview(bn); };
        box.appendChild(b);
      }
    });
  }
  $(".ins-octave").onchange = (e) => { octave = +e.target.value; buildPiano(); };

  // ---------- playback ----------
  function stop() { token++; if (audio) { audio.pause(); audio = null; } }
  async function preview(note) {
    stop();
    const mine = token;
    try {
      const b64 = await hooks.renderInstrument(def, note);
      if (mine !== token) return;
      audio = new Audio("data:audio/wav;base64," + b64);
      await audio.play();
      $(".ins-status").textContent = `${name}  |  ${A.trackerNoteName(note)}`;
    } catch (err) { $(".ins-status").textContent = "Could not play: " + err; }
  }
  document.addEventListener("keydown", (e) => {
    if (root.offsetParent === null || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
    const k = e.key.toLowerCase();
    const n = A.noteForKey(k, octave);
    if (n !== undefined) { e.preventDefault(); preview(n); }
  });

  // ---------- controls ----------
  $(".ins-type").addEventListener("change", (e) => commit(() => {
    const keep = { volume: def.volume, pan: def.pan, vibrato: def.vibrato };
    def = { ...A.newInstrument(e.target.value), ...keep };
    if (e.target.value === "sample") { const s = hooks.getSamples ? hooks.getSamples() : []; def.sample = s[0] || null; }
  }));
  $(".ins-preset").addEventListener("change", (e) => { const make = A.INSTRUMENT_PRESETS[e.target.value]; e.target.value = ""; if (make) commit(() => { def = make(); }); });
  $(".ins-wavepreset").addEventListener("change", (e) => { const make = A.WAVE_PRESETS[e.target.value]; e.target.value = ""; if (make) commit(() => { def.wave = A.waveToHex(make()); }); });
  $(".ins-wrand").addEventListener("click", () => commit(() => { def.wave = A.waveToHex(A.randomWave(Date.now() % 100000)); }));
  root.querySelectorAll("input[name=ins-noise]").forEach((r) => r.addEventListener("change", () => commit(() => { def.noise = r.value; })));
  $(".ins-gmprogram").addEventListener("change", (e) => commit(() => { def.program = +e.target.value; }));
  $(".ins-gmdrum").addEventListener("change", (e) => commit(() => { def.drum = e.target.checked; if (def.drum) def.fixed_note = 36; else delete def.fixed_note; }));
  $(".ins-gmdrumkey").addEventListener("change", (e) => commit(() => { def.fixed_note = +e.target.value; }));
  $(".ins-sampleselect").addEventListener("change", (e) => commit(() => { def.sample = e.target.value || null; }));
  $(".ins-root").addEventListener("change", (e) => commit(() => { def.root = +e.target.value; }));
  $(".ins-loopon").addEventListener("change", (e) => commit(() => { def.loop = e.target.checked ? { start: 0, end: 10000 } : null; }));
  $(".ins-loopstart").addEventListener("change", (e) => commit(() => { def.loop = { start: +e.target.value, end: def.loop ? def.loop.end : 10000 }; }));
  $(".ins-loopend").addEventListener("change", (e) => commit(() => { def.loop = { start: def.loop ? def.loop.start : 0, end: +e.target.value }; }));
  $(".ins-undo").addEventListener("click", () => { const s = history.undo(JSON.parse(snap())); if (s) { def = A.normalizeInstrument(s); markDirty(); renderAll(); } });
  $(".ins-redo").addEventListener("click", () => { const s = history.redo(JSON.parse(snap())); if (s) { def = A.normalizeInstrument(s); markDirty(); renderAll(); } });

  function renderAll() {
    $(".ins-type").value = def.type;
    for (const k of ["pulse", "wave", "noise", "sample", "gm"]) $(".ins-" + k).hidden = def.type !== k;
    $(".ins-envcard").hidden = def.type === "gm";
    if (def.type === "gm") {
      $(".ins-gmprogram").value = def.program; $(".ins-gmdrum").checked = !!def.drum;
      $(".ins-gmdrumrow").hidden = !def.drum; $(".ins-gmprogram").disabled = !!def.drum;
      if (def.drum) $(".ins-gmdrumkey").value = def.fixed_note ?? 36;
    }
    root.querySelectorAll(".ins-duty").forEach((b) => b.classList.toggle("on", def.type === "pulse" && +b.dataset.duty === def.duty));
    root.querySelectorAll("input[name=ins-noise]").forEach((r) => { r.checked = r.value === def.noise; });
    if (def.type === "sample") {
      const sel = $(".ins-sampleselect"), samples = hooks.getSamples ? hooks.getSamples() : [];
      sel.replaceChildren(new Option(samples.length ? "(choose)" : "(no samples imported yet)", ""));
      samples.forEach((s) => sel.appendChild(new Option(s, s)));
      if (def.sample && !samples.includes(def.sample)) sel.appendChild(new Option(def.sample + " (missing)", def.sample));
      sel.value = def.sample || "";
      $(".ins-root").value = def.root;
      $(".ins-loopon").checked = !!def.loop;
      $(".ins-loopstart").value = def.loop ? def.loop.start : ""; $(".ins-loopend").value = def.loop ? def.loop.end : "";
      $(".ins-loopstart").disabled = $(".ins-loopend").disabled = !def.loop;
    }
    Object.values(sliders).forEach((f) => f());
    { const [lo, hi] = A.instrumentRange("@", { instrument: () => def }); lowSel.value = lo; highSel.value = hi; }
    drawWave(); drawEnv();
    $(".ins-status").textContent = `${name}`;
  }

  buildPiano(); renderAll();
  return {
    load(n, d) { stop(); name = n; def = A.normalizeInstrument(d); dirty = false; history = new History(); renderAll(); },
    refresh: renderAll,
    redraw() { if (def) renderAll(); }, // the look changed
    getName: () => name,
    getDef: () => A.normalizeInstrument(def),
    isDirty: () => dirty,
    markClean() { dirty = false; },
    stop,
  };
}
