// Sound effect editor: lanes, one per channel (the console's sound effect channels). Drag an instrument onto a lane's box, then
// click in the strip to place notes (drag a note's end to hold it longer, or drag the note to move it). There are always two lanes, and
// a lane can sound several notes at once (the console's sound effect channels limit the total). Pure logic is in audio-core.js; playback
// is rendered by the runtime's own synth (hooks.renderSfx) so what you hear here is exactly what the game plays.
import * as A from "./audio-core.js";
import { History } from "./sprite-core.js";
import { createInstrumentPanel } from "./instrument-panel.js";
import { createLanes } from "./lanes.js";

const CW = 22, DEFAULT_VOL = 5;

// hooks: { onChange(), renderSfx(def, {volume, seconds}) -> Promise<base64 wav>, getInstrumentNames() -> string[],
//          previewInstrument(name), previewNote(name, note), copyInstrument(name),
//          getLookups() -> {instrument(name)} (the project's own instruments, for their ranges) }
export function createSfxEditor(root, hooks = {}) {
  root.innerHTML = `
    <div class="ed-main">
      <div class="sfx-bar">
        <button class="sfx-play primary" title="Play (Space)">&#9654; Play</button>
        <button class="sfx-stop" title="Stop">&#9632;</button>
        <label>Speed <input type="number" class="sfx-speed" min="1" max="64" title="Ticks of 1/60 s per step: lower is faster"></label>
        <label>Length <input type="number" class="sfx-length" min="1" max="32" title="Number of steps"></label>
        <label class="sfx-check"><input type="checkbox" class="sfx-loop"> Loop</label>
        <label>from <input type="number" class="sfx-loop-start" min="1" max="32"></label>
        <label>to <input type="number" class="sfx-loop-end" min="1" max="32"></label>
        <span class="sfx-sep"></span>
        <span class="key-lock" title="Key lock: lanes only offer notes that fit one key, so nothing clashes. Turn it off for every note.">
          <label>Key <select class="key-root"></select></label><select class="key-scale"></select></span>
        <span class="sfx-sep"></span>
        <button class="sfx-undo">Undo</button><button class="sfx-redo">Redo</button>
        <span class="sfx-sep"></span>
        <label>Start from <select class="sfx-preset"></select></label>
        <button class="sfx-random" title="A new random sound">Randomize</button>
        <button class="sfx-down" title="Everything one octave lower">Octave &minus;</button>
        <button class="sfx-up" title="Everything one octave higher">Octave +</button>
        <button class="sfx-clear" title="Silence every step">Clear</button>
      </div>
      <div class="sfx-lanes"></div>
      <div class="lane-edit">
        <span class="le-info"></span>
        <label>Note <select class="le-note"></select></label>
        <label>Length <input type="number" class="le-len" min="1" max="32" title="How many steps the note lasts"></label>
        <label>Volume <select class="le-vol"></select></label>
        <label>Effect <select class="le-fx"></select></label>
        <button class="le-del">Delete note</button>
        <span class="le-tip">Click a lane to place a note and drag to make it longer. Drag a note to move it, even to the other lane. Click above or below a note to add a second note on top. Right-click erases.</span>
      </div>
      <div class="sfx-status"></div>
    </div>
    <div class="ip sfx-palette"></div>`;
  root.classList.add("ed-row");
  const $ = (sel) => root.querySelector(sel);

  let name = null, def = A.newSfx(), dirty = false, history = new History();
  let sel = null, playhead = -1, seed = 1, audio = null, raf = 0, playToken = 0;

  const channels = () => A.MAX_SFX_TRACKS;
  const panel = createInstrumentPanel($(".sfx-palette"), {
    getCustom: () => (hooks.getInstrumentNames ? hooks.getInstrumentNames() : []),
    preview: (n) => hooks.previewInstrument && hooks.previewInstrument(n),
    copy: (n) => hooks.copyInstrument && hooks.copyInstrument(n),
  });
  A.USER_EFFECTS.forEach((e, i) => $(".le-fx").appendChild(new Option(e, i)));
  $(".key-root").appendChild(new Option("Off", ""));
  A.KEY_NAMES.forEach((k, i) => $(".key-root").appendChild(new Option(k, i)));
  A.SCALES.forEach((sc) => $(".key-scale").appendChild(new Option(sc.label, sc.id)));
  for (let v = 1; v <= A.VOL_MAX; v++) $(".le-vol").appendChild(new Option(String(v), v));
  $(".sfx-preset").appendChild(new Option("(a preset)", ""));
  Object.keys(A.PRESETS).forEach((p) => $(".sfx-preset").appendChild(new Option(p, p)));

  const markDirty = () => { dirty = true; hooks.onChange && hooks.onChange(); };
  const snap = () => JSON.stringify(def);
  function commit(mutator, rebuild = false) { history.record(JSON.parse(snap())); mutator(); def = A.normalizeSfx(def); markDirty(); if (rebuild) lanes.rebuild(); refresh(); }
  const step = (i, col) => def.tracks[i] && def.tracks[i].steps[col];

  // ---------- the lanes ----------
  const lookups = () => (hooks.getLookups ? hooks.getLookups() : {});
  const kindOf = (inst) => (!inst ? "roll" : A.kitOf(inst, lookups()) ? "kit" : A.isDrum(inst) ? "drum" : "roll");
  const noteOf = (lane, col, voice = 0) => A.laneNotes(def.tracks[lane]).find((n) => n.layer === voice && col >= n.col && col < n.col + n.len);
  const stepsOf = (lane, voice = 0) => A.voicesOf(def.tracks[lane])[voice];
  const lanes = createLanes($(".sfx-lanes"), {
    cw: CW, beat: 4, key: (i) => A.laneKey(def.key, def.tracks[i].key),
    count: channels, columns: () => A.MAX_STEPS, shown: () => A.sfxLength(def),
    laneName: (i) => `Channel ${i + 1}`,
    lane: (i) => {
      const inst = def.tracks[i].instrument, kind = kindOf(inst);
      return { instrument: inst, kind, range: A.instrumentRange(inst, lookups()), limit: [12, A.PITCH_MAX + 12], ownKey: def.tracks[i].key ?? null, vol: def.tracks[i].vol || 0, kit: kind === "kit" ? A.kitOf(inst, lookups()) : null, tools: kind === "roll" ? ["surprise", "clear"] : ["clear"] };
    },
    onLaneVol(i, v) { commit(() => { const x = A.clampVol(v); if (x) def.tracks[i].vol = x; else delete def.tracks[i].vol; }, true); },
    onLaneKey(i, k) { commit(() => { if (k === null) delete def.tracks[i].key; else def.tracks[i].key = k; }, true); },
    onTool(i, tool) {
      const inst = def.tracks[i].instrument, [lo, hi] = A.laneWindow(A.instrumentRange(inst, lookups()), [12, A.PITCH_MAX + 12]);
      if (tool === "clear") commit(() => { def.tracks[i].steps = def.tracks[i].steps.map((s) => [s[0], 0, 0]); delete def.tracks[i].layers; });
      else if (tool === "surprise") {
        commit(() => {
          const steps = Math.max(16, A.sfxLength(def)), unit = 1;
          def.tracks[i].steps = def.tracks[i].steps.map((s) => [s[0], 0, 0]); delete def.tracks[i].layers;
          const cells = A.generateMelody({ key: A.laneKey(def.key, def.tracks[i].key), lo, hi, rows: steps, unit, seed: Date.now() % 100000 });
          for (const n of A.trackNotes(cells)) { A.placeSfxNote(def, i, n.col, n.note - 12, DEFAULT_VOL); A.resizeSfxNote(def, i, n.col, n.len); }
        });
        play();
      }
    },
    notes: (i) => A.laneNotes(def.tracks[i]).map((n) => ({ col: n.col, note: n.pitch + 12, len: n.len, vol: n.vol, volMax: A.VOL_MAX, voice: n.layer, selected: !!sel && sel.lane === i && (sel.voice || 0) === n.layer && sel.col === n.col })),
    onPlace(i, col, note) {
      const kind = kindOf(def.tracks[i].instrument), here = noteOf(i, col);
      if (kind !== "roll") {
        if (here && here.col === col && here.pitch + 12 === note) { commit(() => A.eraseSfxNote(def, i, col)); return; } // a drum hit toggles
        commit(() => { A.placeSfxNote(def, i, col, note - 12, DEFAULT_VOL); });
        sel = null; refresh();
        if (hooks.previewNote && def.tracks[i].instrument) hooks.previewNote(def.tracks[i].instrument, note);
        return;
      }
      // a new note is one step long and goes on the first voice of the lane that is free there, so notes can overlap
      if (A.addSfxNote(A.normalizeSfx(JSON.parse(snap())), i, col, note - 12) < 0) { $(".sfx-status").textContent = "No room for another note at once here: the lane is full, or the console's sound effect channels are all used."; return; }
      let layer = 0;
      commit(() => { layer = A.addSfxNote(def, i, col, note - 12, DEFAULT_VOL); });
      const start = (A.laneNotes(def.tracks[i]).find((n) => n.layer === layer && col >= n.col && col < n.col + n.len) || { col }).col;
      sel = { lane: i, voice: layer, col: start }; refresh();
      if (hooks.previewNote && def.tracks[i].instrument) hooks.previewNote(def.tracks[i].instrument, note);
      return { col: start, voice: layer };
    },
    onSelect(i, col, note, voice = 0) { sel = { lane: i, voice, col }; lanes.redraw(); renderEdit(); },
    onErase(i, col, note, voice = 0) { commit(() => A.eraseSfxNote(def, i, col, voice)); sel = null; renderEdit(); },
    onMove(from, to) {                                               // a note was carried to another step, pitch or lane
      const pos = [{ track: from.lane, layer: from.voice, col: from.col }, { track: to.lane, col: to.col, pitch: to.note - 12 }];
      if (!A.moveSfxNote(A.normalizeSfx(JSON.parse(snap())), ...pos)) { $(".sfx-status").textContent = "No room there: a lane can sound four notes at once, within the console's sound effect channels."; lanes.redraw(); return; }
      commit(() => { A.moveSfxNote(def, ...pos); });
      const landed = A.laneNotes(def.tracks[to.lane]).find((n) => n.col === to.col && n.pitch === to.note - 12);
      sel = landed ? { lane: to.lane, voice: landed.layer, col: to.col } : null; refresh();
      if (hooks.previewNote && def.tracks[to.lane].instrument) hooks.previewNote(def.tracks[to.lane].instrument, to.note);
    },
    onResizeStart() { history.record(JSON.parse(snap())); },
    onResize(i, col, len, final, voice = 0) { A.resizeSfxNote(def, i, col, len, voice); if (final) def = A.normalizeSfx(def); markDirty(); refresh(); },
    onDrop(i, n) { commit(() => A.setSfxInstrument(def, i, n)); lanes.rebuild(); if (hooks.previewNote) hooks.previewNote(n, 48); },
    onClear(i) { commit(() => A.setSfxInstrument(def, i, null)); lanes.rebuild(); },
    onHover(i, col, note, label) { renderStatus(i, col, note, label); },
  });

  function renderKey() {
    $(".key-root").value = def.key ? def.key.root : "";
    $(".key-scale").value = def.key ? def.key.scale : A.DEFAULT_KEY.scale; $(".key-scale").disabled = !def.key;
  }
  const setKey = () => commit(() => { const r = $(".key-root").value; def.key = r === "" ? null : { root: +r, scale: $(".key-scale").value }; }, true);
  $(".key-root").addEventListener("change", setKey);
  $(".key-scale").addEventListener("change", setKey);
  function renderControls() {
    renderKey();
    $(".sfx-speed").value = def.speed; $(".sfx-length").value = A.sfxLength(def);
    $(".sfx-loop").checked = !!def.loop;
    $(".sfx-loop-start").value = def.loop ? def.loop.start + 1 : ""; $(".sfx-loop-end").value = def.loop ? def.loop.end + 1 : "";
    $(".sfx-loop-start").disabled = $(".sfx-loop-end").disabled = !def.loop;
  }
  function renderEdit() {
    const n = sel && def.tracks[sel.lane] ? noteOf(sel.lane, sel.col, sel.voice || 0) : null, on = !!n;
    $(".le-info").textContent = on ? `Channel ${sel.lane + 1}, step ${n.col + 1}` : "No note selected";
    for (const c of ["note", "len", "vol", "fx", "del"]) $(".le-" + c).disabled = !on;
    const note = $(".le-note"); note.replaceChildren();
    if (on) {
      const [lo, hi] = A.laneWindow(A.instrumentRange(def.tracks[sel.lane].instrument, lookups()), [12, A.PITCH_MAX + 12]), key = A.laneKey(def.key, def.tracks[sel.lane].key);
      for (let k = Math.max(12, Math.min(lo, n.pitch + 12)); k <= Math.min(A.PITCH_MAX + 12, Math.max(hi, n.pitch + 12)); k++) {
        if (k === n.pitch + 12 || (A.inKey(k, key) && k >= lo && k <= hi)) note.appendChild(new Option(A.trackerNoteName(k), k - 12)); // only notes that fit the key
      }
      note.value = n.pitch; $(".le-len").value = n.len; $(".le-vol").value = n.vol; $(".le-fx").value = n.fx;
    }
  }
  function renderStatus(i, col, note, label) {
    const secs = A.sfxSeconds(def).toFixed(2);
    let info = "";
    if (i !== undefined && col !== undefined) info = `  |  channel ${i + 1}, step ${col + 1}, ${label || A.trackerNoteName(note)}`;
    $(".sfx-status").textContent = `${name}  |  ${A.sfxLength(def)} steps  |  ${secs} s${info}`;
  }
  function refresh() { renderControls(); lanes.redraw(); renderEdit(); renderStatus(); }

  // ---------- controls ----------
  const num = (s) => parseInt($(s).value, 10);
  const withNote = (fn) => { const n = sel && noteOf(sel.lane, sel.col, sel.voice || 0); if (n) commit(() => fn(n)); };
  const setVol = (n, v) => { for (let k = n.col; k < n.col + n.len; k++) stepsOf(sel.lane, sel.voice || 0)[k][1] = v; };
  $(".le-note").addEventListener("change", (e) => withNote(() => A.setSfxPitch(def, sel.lane, sel.col, +e.target.value, sel.voice || 0)));
  $(".le-len").addEventListener("change", (e) => withNote((n) => A.resizeSfxNote(def, sel.lane, n.col, +e.target.value, sel.voice || 0)));
  $(".le-vol").addEventListener("change", (e) => withNote((n) => setVol(n, +e.target.value)));
  $(".le-fx").addEventListener("change", (e) => withNote((n) => { stepsOf(sel.lane, sel.voice || 0)[n.col][2] = +e.target.value; }));
  $(".le-del").addEventListener("click", () => withNote((n) => { A.eraseSfxNote(def, sel.lane, n.col, sel.voice || 0); sel = null; }));
  $(".sfx-speed").addEventListener("change", () => commit(() => { def.speed = num(".sfx-speed"); }));
  $(".sfx-length").addEventListener("change", () => commit(() => A.resizeSfx(def, num(".sfx-length"))));
  $(".sfx-loop").addEventListener("change", (e) => commit(() => { def.loop = e.target.checked ? { start: 0, end: A.sfxLength(def) - 1 } : null; }));
  $(".sfx-loop-start").addEventListener("change", () => commit(() => { def.loop = { start: num(".sfx-loop-start") - 1, end: def.loop.end }; }));
  $(".sfx-loop-end").addEventListener("change", () => commit(() => { def.loop = { start: def.loop.start, end: num(".sfx-loop-end") - 1 }; }));
  $(".sfx-preset").addEventListener("change", (e) => {
    const make = A.PRESETS[e.target.value]; e.target.value = "";
    if (make) { commit(() => { def = A.normalizeSfx(make()); }); lanes.rebuild(); }
  });
  $(".sfx-random").addEventListener("click", () => { commit(() => { def = A.randomSfx(seed++ * 7919 + Date.now() % 1000); }); lanes.rebuild(); play(); });
  $(".sfx-down").addEventListener("click", () => { commit(() => A.transposeSfx(def, -12)); lanes.rebuild(); });
  $(".sfx-up").addEventListener("click", () => { commit(() => A.transposeSfx(def, 12)); lanes.rebuild(); });
  $(".sfx-clear").addEventListener("click", () => commit(() => { for (const t of def.tracks) { t.steps = t.steps.map((s) => [s[0], 0, 0]); delete t.layers; } }));
  const undoRedo = (which) => { const s = history[which](JSON.parse(snap())); if (s) { def = A.normalizeSfx(s); markDirty(); lanes.rebuild(); refresh(); } };
  $(".sfx-undo").addEventListener("click", () => undoRedo("undo"));
  $(".sfx-redo").addEventListener("click", () => undoRedo("redo"));

  // ---------- playback ----------
  function stop() {
    playToken++;
    if (audio) { audio.pause(); audio = null; }
    cancelAnimationFrame(raf); playhead = -1; lanes.setPlayhead(-1);
  }
  async function play() {
    stop();
    const token = playToken;
    try {
      if (!def.tracks.slice(0, channels()).some((t) => t.instrument)) { $(".sfx-status").textContent = "Nothing to play: drag an instrument onto a lane first."; return; }
      const b64 = await hooks.renderSfx(def, { volume: 1, seconds: def.loop ? 3 : undefined });
      if (token !== playToken) return; // stopped or restarted meanwhile
      audio = new Audio("data:audio/wav;base64," + b64);
      await audio.play();
      const t0 = performance.now(), stepMs = (def.speed / 60) * 1000, n = A.sfxLength(def);
      const tick = () => {
        if (token !== playToken) return;
        const i = Math.floor((performance.now() - t0) / stepMs);
        if (!def.loop && i >= n) { stop(); return; }
        playhead = def.loop && i > def.loop.end ? def.loop.start + ((i - def.loop.start) % (def.loop.end - def.loop.start + 1)) : i;
        lanes.setPlayhead(playhead); raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) { $(".sfx-status").textContent = "Could not play: " + err; }
  }
  $(".sfx-play").addEventListener("click", play);
  $(".sfx-stop").addEventListener("click", stop);
  document.addEventListener("keydown", (e) => {
    if (root.offsetParent === null) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
    const k = e.key.toLowerCase();
    if (e.key === " ") { e.preventDefault(); audio ? stop() : play(); }
    if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); $(e.shiftKey ? ".sfx-redo" : ".sfx-undo").click(); }
    if ((e.key === "Backspace" || e.key === "Delete") && sel) { e.preventDefault(); $(".le-del").click(); }
    if (e.key === "Escape" && sel) deselect();
  });
  // Clicking anywhere but a lane or the note bar lets go of the selected note.
  const deselect = () => { sel = null; lanes.redraw(); renderEdit(); };
  root.addEventListener("pointerdown", (e) => { if (sel && !e.target.closest(".lane-canvas, .lane-edit")) deselect(); });

  refresh();
  return {
    load(n, d) {
      stop(); name = n; def = A.normalizeSfx(d); sel = null; history = new History();
      dirty = !!d && Array.isArray(d.steps) && !Array.isArray(d.tracks); // an older sound effect was converted: offer to save it
      lanes.rebuild(); refresh(); if (dirty) markDirty();
    },
    getName: () => name,
    getDef: () => A.normalizeSfx(def),
    isDirty: () => dirty,
    markClean() { dirty = false; },
    refreshInstruments() { panel.refresh(); lanes.rebuild(); refresh(); },
    stop,
  };
}
