// Music editor: lanes, one per track, with the song's patterns in a row of steps along the top. Drag an instrument onto a lane's
// box, then click in the strip to place notes; drag a note's end to hold it for longer, or drag the note itself to move it. Each track
// plays ONE instrument, and a track can sound up to four notes at once. There are always eight tracks. Pure logic is in audio-core.js; playback is rendered by the runtime's own synth
// (hooks.renderSong), exactly as the game plays it.
import * as A from "./audio-core.js";
import { History } from "./sprite-core.js";
import { createInstrumentPanel } from "./instrument-panel.js";
import { createLanes } from "./lanes.js";

const CW = 22;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// hooks: { onChange(), renderSong(song, {seconds}) -> Promise<base64 wav>, previewNote(instrumentName, note),
//          getInstrumentNames() -> string[], loadSfx(name) -> Promise<sfx json>,
//          previewInstrument(name), copyInstrument(name), getLookups() -> {instrument(name)} (the project's own instruments, for their ranges) }
export function createMusicEditor(root, hooks = {}) {
  root.innerHTML = `
    <div class="mus-legacy" hidden>
      <p><b>This music uses the older format</b> (patterns of sound effects). It still plays in your game. Convert it to the tracker to edit it:
      each sound effect becomes notes you can change. The old file is replaced when you save.</p>
      <button class="mus-convert primary">Convert to tracker</button>
    </div>
    <div class="ed-row mus-body">
      <div class="mus-main ed-main">
        <div class="mus-bar">
          <button class="mus-play primary" title="Play from the start (Space)">&#9654; Play</button>
          <button class="mus-playhere" title="Play from the selected step (Enter)">&#9654; From here</button>
          <button class="mus-stop" title="Stop">&#9632;</button>
          <span class="mus-sep"></span>
          <label title="Beats per minute: higher is faster">Tempo <input type="number" class="mus-tempo" min="30" max="300"></label>
          <label>Length <select class="mus-rows-sel" title="How long this pattern is. A bar is four beats."></select></label>
          <label>Start from <select class="mus-start" title="Begin with a ready-made song"></select></label>
          <span class="mus-reverb-box" title="Reverb: the song sounds as if played in a space. Room is short and warm, Hall long and bright, Cave very long and dark. The slider is how much (GBA music usually had a little).">
          <label>Reverb <select class="mus-reverb-type"><option value="room">Room</option><option value="hall">Hall</option><option value="cave">Cave</option></select></label>
          <input type="range" class="mus-reverb" min="0" max="100" aria-label="How much reverb"></span>
          <span class="key-lock" title="Key lock: lanes only offer notes that fit one key, so nothing clashes. Turn it off for every note.">
          <label>Key <select class="key-root"></select></label><select class="key-scale"></select></span>
          <span class="mus-sep"></span>
          <button class="mus-undo">Undo</button><button class="mus-redo">Redo</button>
        </div>
        <div class="mus-orderbar">
          <span class="mus-ordlabel">Song</span>
          <div class="mus-order"></div>
          <button class="mus-newpat" title="Add a new empty pattern after this one">+ New</button>
          <button class="mus-duppat" title="Add a copy of this pattern after this one">Copy</button>
          <button class="mus-delord" title="Take this step out of the song">Remove</button>
          <label class="mus-check"><input type="checkbox" class="mus-loop"> Loop back to <select class="mus-loop-to"></select></label>
        </div>
        <div class="mus-lanes"></div>
        <div class="lane-edit">
          <span class="le-info"></span>
          <label>Note <select class="le-note"></select></label>
          <label>Length <input type="number" class="le-len" min="1" max="64" title="How many steps the note lasts"></label>
          <label>Volume <select class="le-vol"></select></label>
          <label class="mus-check"><input type="checkbox" class="le-showfx"> Effects</label>
          <span class="le-fxbox"><label><select class="le-fx"></select></label><label><select class="le-fxp"></select></label><span class="le-fxhint"></span></span>
          <button class="le-del">Delete note</button>
          <span class="le-tip">Click a lane to place a note and drag to make it longer. Drag a note to move it, even to another track. Click above or below a note to add a second note on top. Right-click erases. Space plays.</span>
        </div>
      </div>
      <div class="ip mus-palette"></div>
    </div>
    <div class="mus-status"></div>`;
  const $ = (sel) => root.querySelector(sel);

  let name = null, song = A.newSong(), legacy = null, dirty = false, history = new History();
  let cur = { order: 0 }, sel = null, row = 0, showFx = false;
  let audio = null, token = 0, raf = 0, playhead = null;

  const channels = () => A.TRACKER.MAX_TRACKS;
  const panel = createInstrumentPanel($(".mus-palette"), {
    getCustom: () => (hooks.getInstrumentNames ? hooks.getInstrumentNames() : []),
    preview: (n) => hooks.previewInstrument && hooks.previewInstrument(n),
    copy: (n) => hooks.copyInstrument && hooks.copyInstrument(n),
  });
  const markDirty = () => { dirty = true; hooks.onChange && hooks.onChange(); };
  const snap = () => JSON.stringify(song);
  const pat = () => song.patterns[song.order[cur.order]];
  function clampCursor() {
    cur.order = Math.max(0, Math.min(song.order.length - 1, cur.order));
    row = Math.max(0, Math.min(pat().rows - 1, row));
    if (sel && (sel.lane >= song.tracks || sel.row >= pat().rows)) sel = null;
  }
  function commit(mutator, rebuild = false) {
    history.record(JSON.parse(snap())); mutator(); song = A.parseSong(A.serializeSong(song)); clampCursor(); markDirty();
    if (rebuild) { lanes.rebuild(); }
    renderAll();
  }

  // ---------- the lanes ----------
  const lookups = () => (hooks.getLookups ? hooks.getLookups() : {});
  const kindOf = (inst) => (!inst ? "roll" : A.kitOf(inst, lookups()) ? "kit" : A.isDrum(inst) ? "drum" : "roll");
  const cellsOf = (t) => pat().tracks[t];                           // a track's own voice (drum hits live here)
  const cellsOfV = (t, voice = 0) => pat().tracks[A.voiceIndex(voice, t)];
  const noteAt = (t, voice, col) => A.voiceNotes(pat(), t).find((n) => n.layer === voice && n.col === col);
  function notesOf(t) {
    const kind = kindOf(song.track_inst[t]), cells = cellsOf(t);
    if (kind === "kit") return A.kitHits(cells).map((h) => ({ col: h.col, note: h.key, len: 1, vol: -1, volMax: 15 }));
    if (kind === "drum") return cells.flatMap((c, col) => (c && c.note >= 0 ? [{ col, note: c.note, len: 1, vol: c.vol, volMax: 15 }] : []));
    return A.voiceNotes(pat(), t).map((n) => ({ col: n.col, note: n.note, len: n.len, vol: n.vol, volMax: 15, voice: n.layer, selected: !!sel && sel.lane === t && sel.voice === n.layer && sel.row === n.col }));
  }

  const lanes = createLanes($(".mus-lanes"), {
    cw: CW, key: (t) => A.laneKey(song.key, song.track_keys[t]),
    get beat() { return song.rows_per_beat; },
    count: () => song.tracks, columns: () => pat().rows, shown: () => pat().rows,
    laneName: (i) => `Track ${i + 1}`,
    lane: (i) => {
      const inst = song.track_inst[i], kind = kindOf(inst);
      return { instrument: inst, kind, range: A.instrumentRange(inst, lookups()), ownKey: song.track_keys[i] ?? null, vol: song.track_vol[i], kit: kind === "kit" ? A.kitOf(inst, lookups()) : null, tools: kind === "roll" ? ["surprise", "clear"] : kind === "kit" ? ["beat", "clear"] : ["clear"] };
    },
    onLaneKey(t, k) { commit(() => { song.track_keys[t] = k; }, true); },
    onLaneVol(t, v) { commit(() => { song.track_vol[t] = A.clampVol(v); }, true); },
    onTool(t, tool, arg) {
      if (tool === "clear") { commit(() => { A.voicesOfTrack(pat(), t).forEach((cells) => cells.fill(null)); }); sel = null; renderEdit(); }
      else if (tool === "beat") commit(() => A.applyKitBeat(cellsOf(t), arg, 4 * song.rows_per_beat));
      else if (tool === "surprise") {
        const [lo, hi] = A.laneWindow(A.instrumentRange(song.track_inst[t], lookups()));
        commit(() => { A.voicesOfTrack(pat(), t).forEach((cells) => cells.fill(null)); pat().tracks[t] = A.generateMelody({ key: A.laneKey(song.key, song.track_keys[t]), lo, hi, rows: pat().rows, unit: song.rows_per_beat, seed: Date.now() % 100000 }); });
        sel = null; row = 0; renderEdit(); play(true);                              // and play it, so you hear what you got
      }
    },
    notes: notesOf,
    onPlace(t, col, note) {
      const kind = kindOf(song.track_inst[t]);
      if (kind === "kit") { commit(() => A.toggleKitHit(cellsOf(t), col, note)); if (hooks.previewNote) hooks.previewNote(song.track_inst[t], note); return; }
      if (kind === "drum") {
        const had = cellsOf(t)[col] && cellsOf(t)[col].note >= 0;
        commit(() => { cellsOf(t)[col] = had ? null : A.cellOf(note); });
        if (!had && hooks.previewNote) hooks.previewNote(song.track_inst[t], note);
        return;
      }
      // a new note is one step long and goes on the first of the track's four voices that is free there, so notes can overlap
      if (!A.voicesOfTrack(pat(), t).some((cells) => !A.noteCovering(cells, col))) { $(".mus-status").textContent = "A track can sound four notes at once. Shorten a note, or use another track."; return; }
      let layer = 0;
      commit(() => { layer = A.addVoiceNote(pat(), t, col, note); });
      const start = (A.voiceNotes(pat(), t).find((n) => n.layer === layer && col >= n.col && col < n.col + n.len) || { col }).col;
      sel = { lane: t, voice: layer, row: start }; row = start; renderAll();
      if (hooks.previewNote && song.track_inst[t]) hooks.previewNote(song.track_inst[t], note);
      return { col: start, voice: layer };
    },
    onSelect(t, col, note, voice = 0) { sel = { lane: t, voice, row: col }; row = col; lanes.redraw(); renderEdit(); },
    onErase(t, col, note, voice) { eraseAt(t, col, voice); },
    onMove(from, to) {                                               // a note was carried to another step, pitch or track
      const pos = [{ track: from.lane, layer: from.voice, col: from.col }, { track: to.lane, col: to.col, note: to.note }];
      const trial = A.parseSong(A.serializeSong(song));
      if (!A.moveVoiceNote(trial.patterns[song.order[cur.order]], ...pos)) { $(".mus-status").textContent = "No room there: a track can sound four notes at once."; lanes.redraw(); return; }
      let landed = null;
      commit(() => { landed = A.moveVoiceNote(pat(), ...pos); });
      if (landed) { sel = { lane: to.lane, voice: landed.layer, row: landed.col }; row = landed.col; renderAll(); }
      if (hooks.previewNote && song.track_inst[to.lane]) hooks.previewNote(song.track_inst[to.lane], to.note);
    },
    onResizeStart() { history.record(JSON.parse(snap())); },
    onResize(t, col, len, final, voice = 0) { A.resizeNote(cellsOfV(t, voice), col, len); if (final) song = A.parseSong(A.serializeSong(song)); markDirty(); renderAll(); },
    onDrop(t, n) { commit(() => A.setTrackInstrument(song, t, n), true); if (hooks.previewNote) hooks.previewNote(n, 48); },
    onClear(t) { commit(() => A.setTrackInstrument(song, t, null), true); },
    onHover(t, col, note, label) { $(".mus-status").textContent = `${name}  |  ${statusText()}  |  track ${t + 1}, step ${col + 1}, ${label || A.trackerNoteName(note)}`; },
  });
  function eraseAt(t, col, voice = 0, note) {
    const kind = kindOf(song.track_inst[t]);
    if (kind === "kit") { commit(() => { if (A.cellNotes(cellsOf(t)[col]).includes(note)) A.toggleKitHit(cellsOf(t), col, note); }); return; }
    if (kind === "drum") { commit(() => { cellsOf(t)[col] = null; }); return; }
    if (!A.trackNotes(cellsOfV(t, voice)).some((n) => col >= n.col && col < n.col + n.len)) return;
    commit(() => A.eraseNote(cellsOfV(t, voice), col));
    if (sel && sel.lane === t) { sel = null; renderEdit(); }
  }

  // ---------- the static controls ----------
  A.TRACKER.ROWS.forEach((n) => $(".mus-rows-sel").appendChild(new Option(`${n / 16} bar${n === 16 ? "" : "s"}`, n)));
  $(".mus-start").appendChild(new Option("(a starter song)", ""));
  A.STARTER_SONGS.forEach((x) => $(".mus-start").appendChild(new Option(x.label, x.id)));
  $(".mus-start").addEventListener("change", (e) => {
    const id = e.target.value; e.target.value = "";
    if (id) { sel = null; row = 0; cur = { order: 0 }; commit(() => { song = A.starterSong(id); }, true); }
  });
  $(".key-root").appendChild(new Option("Off", ""));
  A.KEY_NAMES.forEach((k, i) => $(".key-root").appendChild(new Option(k, i)));
  A.SCALES.forEach((sc) => $(".key-scale").appendChild(new Option(sc.label, sc.id)));
  $(".le-vol").appendChild(new Option("(as the instrument)", -1));
  for (let v = 0; v <= 15; v++) $(".le-vol").appendChild(new Option(String(v), v));
  A.TRACKER_EFFECTS.forEach((f) => $(".le-fx").appendChild(new Option(f.name, f.id)));
  for (let v = 0; v <= 15; v++) $(".le-fxp").appendChild(new Option(v.toString(16).toUpperCase(), v));

  function statusText() {
    return `${song.order.length} step${song.order.length === 1 ? "" : "s"}, ${song.patterns.length} pattern${song.patterns.length === 1 ? "" : "s"}  |  ${A.songSeconds(song).toFixed(1)} s${song.loop_to != null ? " per play, then it loops" : ""}`;
  }
  function renderKey() {
    $(".key-root").value = song.key ? song.key.root : "";
    $(".key-scale").value = song.key ? song.key.scale : A.DEFAULT_KEY.scale; $(".key-scale").disabled = !song.key;
  }
  const setKey = () => commit(() => { const r = $(".key-root").value; song.key = r === "" ? null : { root: +r, scale: $(".key-scale").value }; }, true);
  $(".key-root").addEventListener("change", setKey);
  $(".key-scale").addEventListener("change", setKey);
  function renderBar() {
    renderKey();
    $(".mus-tempo").value = song.tempo;
    $(".mus-rows-sel").value = pat().rows;
    $(".mus-reverb").value = song.reverb;
    $(".mus-reverb-type").value = song.reverb_type || "room";
    $(".mus-status").textContent = `${name}  |  ${statusText()}`;
    const ord = $(".mus-order"); ord.replaceChildren();
    song.order.forEach((p, i) => {
      const b = el("button", (i === cur.order ? "on" : "") + (playhead && playhead.order === i ? " playing" : ""), `${i + 1}`);
      b.title = `Step ${i + 1} plays pattern ${p + 1}`;
      if (song.loop_to === i) b.appendChild(el("span", "mus-mark", " ↻"));
      b.onclick = () => { cur.order = i; row = 0; sel = null; commit(() => {}, true); };
      ord.appendChild(b);
    });
    const lt = $(".mus-loop-to"); lt.replaceChildren();
    song.order.forEach((_, i) => lt.appendChild(new Option(String(i + 1), i)));
    $(".mus-loop").checked = song.loop_to != null; lt.disabled = song.loop_to == null;
    if (song.loop_to != null) lt.value = song.loop_to;
  }
  function renderEdit() {
    const n = sel && pat().tracks[sel.lane] ? noteAt(sel.lane, sel.voice || 0, sel.row) : null, on = !!n;
    $(".le-info").textContent = on ? `Track ${sel.lane + 1}, step ${sel.row + 1}` : "No note selected";
    for (const k of ["note", "len", "vol", "fx", "fxp", "del"]) $(".le-" + k).disabled = !on;
    $(".le-fxbox").hidden = !showFx; $(".le-showfx").checked = showFx;
    const note = $(".le-note"); note.replaceChildren();
    if (on) {
      const [lo, hi] = A.laneWindow(A.instrumentRange(song.track_inst[sel.lane], lookups())), key = A.laneKey(song.key, song.track_keys[sel.lane]);
      for (let k = Math.max(0, Math.min(lo, n.note)); k <= Math.min(95, Math.max(hi, n.note)); k++) {
        if (k === n.note || (A.inKey(k, key) && k >= lo && k <= hi)) note.appendChild(new Option(A.trackerNoteName(k), k)); // only notes that fit the key
      }
      note.value = n.note; $(".le-len").value = n.len; $(".le-vol").value = n.vol; $(".le-fx").value = n.fx; $(".le-fxp").value = n.fxp;
      $(".le-fxhint").textContent = A.TRACKER_EFFECTS[n.fx].hint; $(".le-fxp").hidden = !n.fx;
    }
  }
  function renderAll() {
    $(".mus-legacy").hidden = !legacy; $(".mus-body").hidden = !!legacy;
    if (legacy) return;
    clampCursor(); renderBar(); lanes.redraw(); renderEdit();
  }

  // ---------- editing ----------
  const editSel = (fn) => {
    if (!sel) return;
    history.record(JSON.parse(snap()));
    const c = cellsOfV(sel.lane, sel.voice || 0)[sel.row]; if (c) fn(c);
    markDirty(); renderAll();
  };
  $(".le-note").addEventListener("change", (e) => editSel((c) => { c.note = +e.target.value; }));
  $(".le-len").addEventListener("change", (e) => { if (sel) { history.record(JSON.parse(snap())); A.resizeNote(cellsOfV(sel.lane, sel.voice || 0), sel.row, +e.target.value); markDirty(); renderAll(); } });
  $(".le-vol").addEventListener("change", (e) => editSel((c) => { c.vol = +e.target.value; }));
  $(".le-fx").addEventListener("change", (e) => editSel((c) => { c.fx = +e.target.value; if (!c.fx) c.fxp = 0; }));
  $(".le-fxp").addEventListener("change", (e) => editSel((c) => { c.fxp = +e.target.value; }));
  $(".le-showfx").addEventListener("change", (e) => { showFx = e.target.checked; renderEdit(); });
  $(".le-del").addEventListener("click", () => { if (sel) eraseAt(sel.lane, sel.row, sel.voice || 0); });
  $(".mus-tempo").addEventListener("change", (e) => commit(() => { song.tempo = +e.target.value; }));
  $(".mus-rows-sel").addEventListener("change", (e) => commit(() => A.setPatternRows(song, song.order[cur.order], +e.target.value), true));
  $(".mus-reverb").addEventListener("change", (e) => commit(() => { song.reverb = +e.target.value; }));
  $(".mus-reverb-type").addEventListener("change", (e) => commit(() => { song.reverb_type = e.target.value; }));
  $(".mus-newpat").addEventListener("click", () => { sel = null; commit(() => { const p = A.addPattern(song); if (p >= 0 && A.insertOrder(song, cur.order + 1, p)) cur.order += 1; row = 0; }, true); });
  $(".mus-duppat").addEventListener("click", () => { sel = null; commit(() => { const p = A.addPattern(song, song.order[cur.order]); if (p >= 0 && A.insertOrder(song, cur.order + 1, p)) cur.order += 1; }, true); });
  $(".mus-delord").addEventListener("click", () => { sel = null; commit(() => { A.removeOrder(song, cur.order); }, true); });
  $(".mus-loop").addEventListener("change", (e) => commit(() => { song.loop_to = e.target.checked ? 0 : null; }));
  $(".mus-loop-to").addEventListener("change", (e) => commit(() => { song.loop_to = +e.target.value; }));
  const undoRedo = (which) => { const s = history[which](JSON.parse(snap())); if (s) { song = s; sel = null; markDirty(); lanes.rebuild(); renderAll(); } };
  $(".mus-undo").addEventListener("click", () => undoRedo("undo"));
  $(".mus-redo").addEventListener("click", () => undoRedo("redo"));
  $(".mus-convert").addEventListener("click", async () => {
    try {
      const names = new Set(legacy.patterns.flat().filter(Boolean)), defs = new Map();
      for (const n of names) { try { defs.set(n, A.normalizeSfx(await hooks.loadSfx(n))); } catch { /* missing: left silent */ } }
      song = A.parseSong(A.serializeSong(A.legacyToSong(A.normalizeMusic(legacy), defs, channels())));
      legacy = null; history = new History(); cur = { order: 0 }; sel = null; row = 0; markDirty(); lanes.rebuild(); renderAll();
    } catch (err) { $(".mus-status").textContent = "Could not convert: " + err; }
  });

  // ---------- playback ----------
  function drawPlayhead() {
    lanes.setPlayhead(playhead && playhead.order === cur.order ? playhead.row : -1);
    root.querySelectorAll(".mus-order button").forEach((b, i) => b.classList.toggle("playing", !!playhead && playhead.order === i));
  }
  function stop() {
    token++;
    if (audio) { audio.pause(); audio = null; }
    cancelAnimationFrame(raf); playhead = null; drawPlayhead();
  }
  async function play(fromHere) {
    stop();
    const mine = token;
    const src = fromHere ? A.songFrom(song, cur.order, row) : song;
    const first = fromHere ? cur.order : 0, firstRow = fromHere ? row : 0;
    try {
      const b64 = await hooks.renderSong(src, { seconds: Math.min(300, Math.max(5, A.songSeconds(src) * (src.loop_to != null ? 2 : 1) + 1)) });
      if (mine !== token) return;
      audio = new Audio("data:audio/wav;base64," + b64);
      await audio.play();
      const t0 = performance.now(), rowMs = A.rowSeconds(song) * 1000;
      const lens = song.order.map((p) => song.patterns[p].rows);
      const startRows = lens.slice(0, first).reduce((a, b) => a + b, 0) + firstRow;
      const total = lens.reduce((a, b) => a + b, 0);
      const loopStart = song.loop_to == null ? -1 : lens.slice(0, song.loop_to).reduce((a, b) => a + b, 0);
      const tick = () => {
        if (mine !== token) return;
        let r = startRows + Math.floor((performance.now() - t0) / rowMs);
        if (r >= total) { if (loopStart < 0) { stop(); return; } r = loopStart + ((r - loopStart) % (total - loopStart)); }
        let o = 0; while (o < lens.length - 1 && r >= lens[o]) { r -= lens[o]; o++; }
        playhead = { order: o, row: r }; drawPlayhead(); raf = requestAnimationFrame(tick);
      };
      tick();
      audio.onended = () => { if (mine === token && song.loop_to == null) stop(); };
    } catch (err) { $(".mus-status").textContent = "Could not play: " + err; }
  }
  $(".mus-play").addEventListener("click", () => play(false));
  $(".mus-playhere").addEventListener("click", () => play(true));
  $(".mus-stop").addEventListener("click", stop);

  document.addEventListener("keydown", (e) => {
    if (root.offsetParent === null || legacy) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); $(e.shiftKey ? ".mus-redo" : ".mus-undo").click(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " ") { e.preventDefault(); audio ? stop() : play(false); }
    else if (e.key === "Enter") { e.preventDefault(); play(true); }
    else if ((e.key === "Backspace" || e.key === "Delete") && sel) { e.preventDefault(); eraseAt(sel.lane, sel.row, sel.voice || 0); }
    else if (e.key === "Escape" && sel) deselect();
  });
  // Clicking anywhere but a lane or the note bar lets go of the selected note.
  const deselect = () => { sel = null; lanes.redraw(); renderEdit(); };
  root.addEventListener("pointerdown", (e) => { if (sel && !e.target.closest(".lane-canvas, .lane-edit")) deselect(); });

  renderAll();
  return {
    load(n, d) {
      stop(); name = n; dirty = false; history = new History(); cur = { order: 0 }; sel = null; row = 0;
      if (A.isTrackerMusic(d)) { legacy = null; song = A.parseSong(d); } else { legacy = A.isLegacyMusic(d) ? d : null; song = A.newSong({ tracks: channels() }); }
      lanes.rebuild(); renderAll();
    },
    refresh() { panel.refresh(); lanes.rebuild(); renderAll(); },
    redraw() { if (song) { lanes.rebuild(); renderAll(); } }, // the look changed
    getName: () => name,
    getDef: () => (legacy ? legacy : A.serializeSong(song)),
    isDirty: () => dirty,
    markClean() { dirty = false; },
    stop,
  };
}
