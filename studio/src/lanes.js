// Lanes: the layout shared by the SFX and music editors. One lane per channel (or track): an instrument box on the left that you
// drop an instrument onto, and a strip beside it where notes are dashes at their pitch, as in a piano roll. Everything scrolls
// sideways together. The editors own the data; this draws it and reports what the user did.
//
// Three kinds of lane, from what the instrument is:
//   roll  an ordinary instrument: rows are pitches, in the range that instrument sounds good (no hunting for the right octave)
//   drum  a single drum sound: one row of hits
//   kit   a drum kit: one row per piece (kick, snare, hi-hat...), each hit is a dot on its row
import { acceptsInstrument, droppedInstrument, instrumentColor, CHANNEL_COLORS } from "./instrument-panel.js";
import * as A from "./audio-core.js";

const ROW_H = 6;                            // pixels per row when every semitone is shown
const KEY_ROW_H = 12;                       // with the key lock on only the notes that fit are shown, so they can be roomy and labelled
const COLLAPSED_H = 30;                     // a lane folded away to a thin overview
const KIT_ROW_H = 14, KIT_LABEL_W = 78;     // a drum kit's rows are taller and labelled (in the gutter beside the lane box)
const GUTTER_W = 34;                        // the gutter with the note names, so they never cover the first column of notes
const DRUM_H = ROW_H * 6;
const EDGE = 7;                             // pixels at a note's right end that grab it to change its length
const BLACK = new Set([1, 3, 6, 8, 10]);
const DRUM_NOTE = 48;

const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// config: {
//   cw, beat (steps in a beat), unit() -> optional: steps a click snaps to (default 1), key(i) -> {root, scale}|null (the lane's key lock: other notes are dimmed and clicks snap to the key), count() -> lanes, columns() -> columns, shown() -> columns drawn bright (the rest are dimmed), laneName(i),
//   lane(i) -> {instrument, kind: "roll"|"drum"|"kit", range: [lowest note, highest note] (a roll shows its base octave and one above and below), limit: [lowest, highest] the editor can store, ownKey: the lane's own key override (false = any note, null = follow), kit: [{key, label}], tools: ["surprise"|"beat"|"clear"]},
//   notes(i) -> [{col, note, len, vol, volMax, selected, voice}]   (for a kit: one entry per hit, note = the piece's key),
//   onPlace(i, col, note)        a press on an empty cell: put a note there (a kit or drum lane toggles a hit). May return {col, voice} of the new note so that dragging on stretches it
//   onResizeStart(i, col, voice) a note's end was grabbed (record history now)
//   onResize(i, col, len, final, voice) the length is being dragged
//   onSelect(i, col, note, voice), onErase(i, col, note, voice), onMove(from {lane, col, note, voice}, to {lane, col, note}) (a note was carried), onLaneVol(i, steps), onDrop(i, name), onClear(i), onHover(i, col, note, label),
//   onLaneKey(i, key)            the lane's key picker changed (key: an object, false for any note, null to follow the song)
//   onTool(i, tool, arg)         a lane button: "surprise" (a new melody), "beat" (arg = a drum beat), "clear" }
export function createLanes(root, config) {
  root.classList.add("lanes");
  const cw = config.cw || 22;
  let playhead = -1, drag = null, hover = null, move = null;   // drag: stretching a note; move: carrying one (move.target is where it would land)
  const lanes = [], collapsed = new Set();
  const unitOf = () => Math.max(1, (config.unit && config.unit()) || 1);
  const keyOf = (i) => (config.key ? config.key(i) : null);

  // The notes a roll lane shows: its instrument's base octave and one above and below, widened to include any note already outside them.
  function windowOf(i) {
    const info = config.lane(i);
    let [lo, hi] = A.laneWindow(info.range, info.limit);
    for (const n of config.notes(i)) { lo = Math.min(lo, n.note); hi = Math.max(hi, n.note); }
    return [Math.max(0, lo), Math.min(95, hi)];
  }
  function volumeStepper(i, vol) { // the track's volume, in steps around 0 (the baseline)
    const wrap = el("div", "lane-vol"), less = el("button", null, "−"), more = el("button", null, "+");
    wrap.title = `This track's volume: ${-A.VOL_STEPS} to +${A.VOL_STEPS} steps around 0, the baseline.`;
    less.disabled = vol <= -A.VOL_STEPS; more.disabled = vol >= A.VOL_STEPS;
    less.onclick = () => config.onLaneVol(i, vol - 1); more.onclick = () => config.onLaneVol(i, vol + 1);
    wrap.append(el("span", "lv-label", "Volume"), less, el("span", "lv-value", vol > 0 ? "+" + vol : String(vol)), more);
    return wrap;
  }
  function keyPicker(i, own) { // this lane's own key: the song's, none, or one of its own
    const wrap = el("div", "lane-key"), root = el("select"), scale = el("select");
    wrap.title = "Which notes this lane offers. 'Song key' follows the key in the bar above; pick a key to give this lane its own, or 'Any note' for all of them.";
    root.appendChild(new Option("Song key", "")); root.appendChild(new Option("Any note", "off"));
    A.KEY_NAMES.forEach((k, n) => root.appendChild(new Option("Key of " + k, n)));
    A.SCALES.forEach((sc) => scale.appendChild(new Option(sc.label.split(" (")[0], sc.id)));
    root.value = own === false ? "off" : own ? String(own.root) : ""; scale.value = own ? own.scale : A.DEFAULT_KEY.scale; scale.hidden = !own;
    const send = () => config.onLaneKey(i, root.value === "" ? null : root.value === "off" ? false : { root: +root.value, scale: scale.value });
    root.onchange = send; scale.onchange = send;
    wrap.append(root, scale);
    return wrap;
  }
  // The notes a roll lane has a row for: the range, but with the key lock on only the notes that fit (and any note already placed).
  function rowsOf(i) {
    const [lo, hi] = windowOf(i), key = keyOf(i), placed = new Set(config.notes(i).map((n) => n.note)), out = [];
    for (let n = hi; n >= lo; n--) if (!key || A.inKey(n, key) || placed.has(n)) out.push(n);
    return out;
  }
  const rowHeightOf = (i) => (config.lane(i).kind === "kit" ? KIT_ROW_H : keyOf(i) ? KEY_ROW_H : ROW_H);
  const heightOf = (i) => {
    const info = config.lane(i);
    if (collapsed.has(i)) return COLLAPSED_H;
    if (info.kind === "kit") return info.kit.length * KIT_ROW_H;
    if (info.kind === "drum") return DRUM_H;
    return Math.max(DRUM_H, rowsOf(i).length * rowHeightOf(i));
  };

  // The canvas is drawn at the screen's own pixel density, so text and edges stay sharp on high-resolution displays.
  function sizeCanvas(l, w, h) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    l.w = w; l.h = h; l.canvas.width = Math.round(w * dpr); l.canvas.height = Math.round(h * dpr);
    l.canvas.style.width = w + "px"; l.canvas.style.height = h + "px";
    l.gutter.width = Math.round(l.gw * dpr); l.gutter.height = Math.round(h * dpr);
    l.gutter.style.width = l.gw + "px"; l.gutter.style.height = h + "px";
    l.gutter.style.left = (132 + 8) + "px";               // sticks beside the lane box (its width and the gap) while the lanes scroll sideways
  }
  function build() {
    root.replaceChildren();
    lanes.length = 0;
    for (let i = 0; i < config.count(); i++) {
      const info = config.lane(i), color = CHANNEL_COLORS[i % CHANNEL_COLORS.length];
      const row = el("div", "lane"); row.style.setProperty("--chan", color);
      const box = el("div", "lane-box");
      const head = el("div", "lane-head");
      const fold = el("button", "fold", collapsed.has(i) ? "▸" : "▾");
      fold.title = collapsed.has(i) ? "Show this lane" : "Fold this lane away to a thin strip";
      fold.onclick = (e) => { e.stopPropagation(); collapsed.has(i) ? collapsed.delete(i) : collapsed.add(i); build(); };
      head.append(fold, el("span", "num", config.laneName ? config.laneName(i) : `Channel ${i + 1}`));
      if (info.instrument) {
        const x = el("button", "x", "×"); x.title = "Empty this lane"; x.onclick = (e) => { e.stopPropagation(); config.onClear(i); };
        head.appendChild(x);
      }
      const name = el("div", "lane-inst" + (info.instrument ? "" : " empty"));
      if (info.instrument) { const dot = el("span", "ip-dot"); dot.style.background = instrumentColor(info.instrument); name.append(dot, el("span", null, A.instrumentLabel(info.instrument))); }
      else name.textContent = "drop an instrument here";
      box.append(head, name);
      if (info.instrument && !collapsed.has(i)) {
        const hint = info.kind === "kit" ? "One row per drum. Click to add or remove a hit." : info.kind === "drum" ? "Click to add or remove a hit." : (() => { const [lo, hi] = windowOf(i); return `${A.trackerNoteName(lo)} to ${A.trackerNoteName(hi)}`; })();
        box.appendChild(el("div", "lane-range", hint));
        if (config.onLaneVol) box.appendChild(volumeStepper(i, info.vol || 0));
        if (info.kind === "roll" && config.onLaneKey) box.appendChild(keyPicker(i, info.ownKey));
        const tools = el("div", "lane-tools");
        for (const tool of info.tools || []) {
          if (tool === "surprise") {
            const b = el("button", null, "✨ Random"); b.title = "Fill this lane with a new melody in the key. Try it again for another."; b.onclick = () => config.onTool(i, "surprise");
            tools.appendChild(b);
          } else if (tool === "beat") {
            const sel = el("select"); sel.title = "Fill this lane with a drum beat";
            sel.appendChild(new Option("Drum beat…", ""));
            A.KIT_BEATS.forEach((bt) => sel.appendChild(new Option(bt.label, bt.id)));
            sel.onchange = () => { const v = sel.value; sel.value = ""; if (v) config.onTool(i, "beat", v); };
            tools.appendChild(sel);
          } else if (tool === "clear") {
            const b = el("button", null, "Clear"); b.title = "Take every note out of this lane"; b.onclick = () => config.onTool(i, "clear");
            tools.appendChild(b);
          }
        }
        if (tools.children.length) box.appendChild(tools);
      }
      box.ondragover = (e) => { if (acceptsInstrument(e)) { e.preventDefault(); row.classList.add("over"); } };
      box.ondragleave = () => row.classList.remove("over");
      box.ondrop = (e) => { e.preventDefault(); row.classList.remove("over"); const n = droppedInstrument(e); if (n) config.onDrop(i, n); };
      const canvas = el("canvas", "lane-canvas");
      canvas.ondragover = box.ondragover; canvas.ondragleave = box.ondragleave; canvas.ondrop = box.ondrop;
      const gutter = el("canvas", "lane-gutter");
      const l = { row, canvas, ctx: canvas.getContext("2d"), gutter, gctx: gutter.getContext("2d"), w: 0, h: 0, gw: info.kind === "kit" ? KIT_LABEL_W : GUTTER_W };
      sizeCanvas(l, config.columns() * cw, heightOf(i));
      row.append(box, gutter, canvas);
      root.appendChild(row);
      lanes.push(l);
      wire(i, canvas);
      drawLane(i);
    }
  }

  // ---------- geometry ----------
  // The row a pitch (or a drum kit's key) is drawn on, as a y position, and back again.
  function rowY(i, note) {
    const info = config.lane(i);
    if (info.kind === "drum") return Math.floor((DRUM_H - ROW_H) / 2);
    if (info.kind === "kit") { const k = info.kit.findIndex((p) => p.key === note); return k < 0 ? -100 : k * KIT_ROW_H; }
    const k = rowsOf(i).indexOf(note);
    return k < 0 ? -100 : k * rowHeightOf(i);
  }
  function noteAtY(i, y) {
    const info = config.lane(i);
    if (info.kind === "drum") return DRUM_NOTE;
    if (info.kind === "kit") return info.kit[Math.max(0, Math.min(info.kit.length - 1, Math.floor(y / KIT_ROW_H)))].key;
    const rows = rowsOf(i);
    return rows[Math.max(0, Math.min(rows.length - 1, Math.floor(y / rowHeightOf(i))))]; // only rows that exist: with the key lock on, a click always lands on a note that fits
  }
  const rowH = rowHeightOf;

  // ---------- drawing ----------
  // The strip of note names (or drum names) beside a lane. It is its own element, so the names never cover the first column of notes.
  function drawGutter(i) {
    const l = lanes[i], info = config.lane(i), ctx = l.gctx, W = l.gw, H = l.h, dpr = l.gutter.width / l.gw, key = keyOf(i);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#14161d"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fillRect(W - 1, 0, 1, H);
    if (collapsed.has(i) || !info.instrument) return;
    ctx.textBaseline = "middle";
    if (info.kind === "kit") {
      ctx.font = "10px -apple-system, system-ui, sans-serif";
      info.kit.forEach((p, k) => {
        if (k % 2) { ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(0, k * KIT_ROW_H, W - 1, KIT_ROW_H); }
        ctx.fillStyle = "#c9cde0"; ctx.fillText(p.label, 5, k * KIT_ROW_H + KIT_ROW_H / 2 + 0.5, W - 9);
      });
    } else if (info.kind === "roll") {
      const rh = rowHeightOf(i);
      rowsOf(i).forEach((note, k) => {
        const y = k * rh, c = note % 12 === 0, home = key && (note - key.root) % 12 === 0, fits = !key || A.inKey(note, key);
        if (home) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(0, y, W - 1, rh); }
        ctx.fillStyle = c ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"; ctx.fillRect(0, y + rh - 1, W - 1, 1);
        if (key || c) {
          ctx.font = (c || home ? "600 " : "") + "10px -apple-system, system-ui, sans-serif";
          ctx.fillStyle = !fits ? "#585e74" : c ? "#e4e7f5" : home ? "#c9cde0" : "#8a90a8";
          ctx.fillText(A.trackerNoteName(note), 6, y + rh / 2 + 0.5);
        }
      });
    }
  }
  function drawLane(i) {
    const l = lanes[i]; if (!l) return;
    drawGutter(i);
    const info = config.lane(i), ctx = l.ctx, W = l.w, H = l.h, dpr = l.canvas.width / l.w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const color = CHANNEL_COLORS[i % CHANNEL_COLORS.length], shown = config.shown(), kind = info.kind, key = keyOf(i), unit = unitOf(), beat = config.beat || 4;
    ctx.fillStyle = "#1b1d27"; ctx.fillRect(0, 0, W, H);
    for (let c = 0; c < config.columns(); c++) {
      ctx.fillStyle = c >= shown ? "#15171f" : Math.floor(c / unit) % 2 ? "#222530" : "#1e212b"; // the shading alternates with the timing, so the grid is easy to follow
      ctx.fillRect(c * cw, 0, cw, H);
      const strength = c % (beat * 4) === 0 ? 0.24 : c % beat === 0 ? 0.13 : c % unit === 0 ? 0.05 : 0; // bars, then beats, then the timing's own steps
      if (strength) { ctx.fillStyle = `rgba(255,255,255,${strength})`; ctx.fillRect(c * cw, 0, 1, H); }
    }
    if (collapsed.has(i)) { // a thin overview: every note as a dash, high above low
      const ns = config.notes(i), ys = ns.map((n) => n.note), lo = Math.min(...ys, 999), hi = Math.max(...ys, -1);
      for (const n of ns) {
        const t = kind === "roll" && hi > lo ? (hi - n.note) / (hi - lo) : 0.5;
        ctx.fillStyle = color; ctx.fillRect(n.col * cw + 1, 4 + t * (H - 12), Math.max(2, (n.len || 1) * cw - 2), 3);
      }
      if (!ns.length) { ctx.fillStyle = "#6b7188"; ctx.font = "11px sans-serif"; ctx.textBaseline = "middle"; ctx.fillText(info.instrument ? "empty: click to open" : "no instrument", 10, H / 2); }
      if (playhead >= 0) { ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(playhead * cw, 0, cw, H); }
      return;
    }
    ctx.textBaseline = "middle";
    if (kind === "kit") {
      info.kit.forEach((p, k) => {
        const y = k * KIT_ROW_H;
        if (k % 2) { ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(0, y, W, KIT_ROW_H); }
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(0, y + KIT_ROW_H - 1, W, 1);
      });
    } else if (kind === "drum") {
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(0, DRUM_H / 2 - 1, W, 2);
    } else if (info.instrument) {
      const rows = rowsOf(i), rh = rowHeightOf(i);
      ctx.textBaseline = "middle";
      rows.forEach((note, k) => {
        const y = k * rh, inside = !key || A.inKey(note, key), home = key && (note - key.root) % 12 === 0;
        if (k % 2) { ctx.fillStyle = "rgba(0,0,0,0.13)"; ctx.fillRect(0, y, W, rh); }
        if (!key && BLACK.has(note % 12)) { ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(0, y, W, rh); }
        if (key && !inside) { ctx.fillStyle = "rgba(10,11,16,0.55)"; ctx.fillRect(0, y, W, rh); }               // a note already here that does not fit
        else if (home) { ctx.fillStyle = "rgba(255,255,255,0.09)"; ctx.fillRect(0, y, W, rh); }                  // the key's home note
        ctx.fillStyle = note % 12 === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"; ctx.fillRect(0, y + rh - 1, W, 1);
      });
    }
    if (!info.instrument) { ctx.fillStyle = "#6b7188"; ctx.font = "12px sans-serif"; ctx.textBaseline = "middle"; ctx.fillText("Drag an instrument onto this lane to start", 12, H / 2); }
    for (const n of config.notes(i)) { // a note is a rounded box: its own colour (fainter when quiet) with a light edge, and a grip when it can be stretched
      const x = n.col * cw + 1, w = Math.max(1, n.len || 1) * cw - 2, rh = rowHeightOf(i);
      const y = kind === "kit" ? rowY(i, n.note) + 1 : kind === "roll" ? rowY(i, n.note) + 1 : rowY(i, n.note), h = kind === "kit" ? KIT_ROW_H - 3 : kind === "roll" ? rh - 2 : ROW_H;
      const radius = Math.min(3, h / 2, w / 2);
      const carried = move && move.on && move.lane === i && move.n.col === n.col && move.n.note === n.note && move.n.voice === n.voice;
      ctx.globalAlpha = (n.col >= shown ? 0.4 : 0.4 + 0.6 * Math.min(1, (n.vol >= 0 ? n.vol : n.volMax || 1) / (n.volMax || 1))) * (carried ? 0.3 : 1);
      ctx.fillStyle = color; roundRect(ctx, x, y, w, h, radius); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1; roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius); ctx.stroke();
      if (n.len > 1 && kind === "roll") { ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(x + w - 4, y + 2, 1, h - 4); ctx.fillRect(x + w - 6, y + 2, 1, h - 4); } // the grip for the length
      if (n.selected) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; roundRect(ctx, x - 1, y - 1.5, w + 2, h + 3, radius + 1); ctx.stroke(); ctx.lineWidth = 1; }
    }
    if (move && move.on && move.target && move.target.lane === i) { // where the carried note would land
      const g = move.target, x = g.col * cw + 1, w = Math.max(1, Math.min(move.n.len || 1, config.columns() - g.col)) * cw - 2, rh = rowHeightOf(i), y = rowY(i, g.note) + 1;
      ctx.fillStyle = color; ctx.globalAlpha = 0.35; roundRect(ctx, x, y, w, rh - 2, 3); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = "#fff"; ctx.setLineDash([3, 2]); roundRect(ctx, x + 0.5, y + 0.5, w - 1, rh - 3, 3); ctx.stroke(); ctx.setLineDash([]);
    }
    if (hover && hover.lane === i && !drag && !(move && move.on)) { // the step a click will land on: a faint column and the exact cell
      const w = Math.min(unit, config.columns() - hover.col) * cw;
      ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fillRect(hover.col * cw, 0, w, H);
      const y = rowY(i, hover.note), h = kind === "kit" ? KIT_ROW_H : kind === "roll" ? rowHeightOf(i) : H;
      if (y >= 0 || kind === "drum") { ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.strokeRect(hover.col * cw + 0.5, (kind === "drum" ? 0 : y) + 0.5, w - 1, h - 1); }
    }
    if (playhead >= 0) { ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(playhead * cw, 0, cw, H); }
  }
  const drawAll = () => lanes.forEach((_, i) => drawLane(i));

  // ---------- mouse ----------
  function where(i, e) {
    const c = lanes[i].canvas, r = c.getBoundingClientRect();
    const px = e.clientX - r.left - c.clientLeft, py = e.clientY - r.top - c.clientTop;   // the canvas is drawn in CSS pixels (see sizeCanvas)
    const col = Math.max(0, Math.min(config.columns() - 1, Math.floor(px / cw)));
    return { col, snap: Math.floor(col / unitOf()) * unitOf(), px, py, note: noteAtY(i, py) };
  }
  // The note drawn under the pointer, and whether the pointer is at its right edge.
  function noteUnder(i, p) {
    const kind = config.lane(i).kind, h = rowH(i);
    for (const n of config.notes(i)) {
      const x0 = n.col * cw, x1 = (n.col + Math.max(1, n.len || 1)) * cw;
      if (p.px < x0 || p.px >= x1) continue;
      if (kind === "drum" || (kind === "kit" ? n.note === p.note : Math.abs(rowY(i, n.note) - Math.floor(p.py / h) * h) < 1)) {
        return { n, edge: kind === "roll" && p.px >= x1 - EDGE };
      }
    }
    return null;
  }
  // The lane whose strip is nearest to a pointer height, so a note can be carried from one lane to another.
  function laneAt(clientY) {
    let best = 0, bestD = Infinity;
    lanes.forEach((l, j) => { const r = l.canvas.getBoundingClientRect(), d = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0; if (d < bestD) { best = j; bestD = d; } });
    return best;
  }
  function wire(i, canvas) {
    canvas.addEventListener("pointerdown", (e) => {
      const info = config.lane(i);
      if (collapsed.has(i)) { collapsed.delete(i); build(); return; }                      // a folded lane just opens
      if (!info.instrument) return;
      const p = where(i, e), hit = noteUnder(i, p);
      if (e.button === 2) { e.preventDefault(); if (hit) config.onErase(i, hit.n.col, hit.n.note, hit.n.voice); return; }
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      if (hit && info.kind !== "roll") { config.onPlace(i, hit.n.col, p.note); return; }   // a hit on a drum or kit lane: toggles
      if (hit && hit.edge) { drag = { lane: i, col: hit.n.col, voice: hit.n.voice }; config.onResizeStart(i, hit.n.col, hit.n.voice); return; }
      if (hit) { // a press on a note selects it; moving on with the button down carries it
        config.onSelect(i, hit.n.col, hit.n.note, hit.n.voice);
        if (config.onMove) move = { lane: i, n: hit.n, x: e.clientX, y: e.clientY, grab: Math.floor(p.px / cw) - hit.n.col, on: false, target: null };
        return;
      }
      const placed = config.onPlace(i, p.snap, p.note);
      if (info.kind === "roll" && placed && placed.col === p.snap) drag = { lane: i, col: placed.col, voice: placed.voice }; // dragging on from a new note stretches it
    });
    canvas.addEventListener("pointermove", (e) => {
      if (move) {
        if (!move.on && Math.hypot(e.clientX - move.x, e.clientY - move.y) < 4) return;
        move.on = true;
        const j = laneAt(e.clientY), info = config.lane(j), q = where(j, e);
        const col = Math.max(0, Math.min(config.columns() - 1, q.col - move.grab));
        move.target = info.instrument && info.kind === "roll" ? { lane: j, col, note: q.note } : null;
        canvas.style.cursor = "grabbing";
        drawAll();
        return;
      }
      const p = where(i, e);
      hover = { lane: i, col: p.snap, note: p.note }; // the highlighted step is the one a click will use (snapped to the timing)
      if (drag && drag.lane === i) {
        const u = unitOf(), raw = Math.floor(p.px / cw) - drag.col + 1;
        const len = Math.max(u, Math.min(Math.floor((config.columns() - drag.col) / u) * u || u, Math.ceil(raw / u) * u)); // lengths grow in whole timing units
        if (len !== drag.len) { drag.len = len; config.onResize(i, drag.col, len, false, drag.voice); }
      } else {
        const hit = noteUnder(i, p);
        canvas.style.cursor = hit ? (hit.edge ? "col-resize" : "grab") : "crosshair";
      }
      if (config.onHover) { const info = config.lane(i), piece = info.kind === "kit" ? info.kit.find((k) => k.key === p.note) : null; config.onHover(i, p.snap, p.note, piece && piece.label); }
      drawLane(i);   // show the cell a click would use
    });
    const up = () => {
      if (move) {
        const m = move; move = null;
        canvas.style.cursor = "crosshair";
        if (m.on && m.target && (m.target.lane !== m.lane || m.target.col !== m.n.col || m.target.note !== m.n.note)) config.onMove({ lane: m.lane, col: m.n.col, note: m.n.note, voice: m.n.voice }, m.target);
        else if (m.on) drawAll();
        return;
      }
      if (!drag) return;
      const d = drag; drag = null;
      if (d.len !== undefined) config.onResize(d.lane, d.col, d.len, true, d.voice);
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", () => { drag = null; if (move) { move = null; drawAll(); } });
    canvas.addEventListener("pointerleave", () => { hover = null; drawLane(i); });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  build();
  return {
    rebuild: build,                          // the lanes, their instruments or their sizes changed
    redraw() { // only the notes changed (a window may have grown to fit a note, so lanes are resized when needed)
      lanes.forEach((l, i) => { const h = heightOf(i); if (l.h !== h) sizeCanvas(l, l.w, h); });
      drawAll();
    },
    setPlayhead(c) {
      playhead = c; drawAll();
      if (c >= 0) { // keep the playing step in view in a long pattern
        const x = c * cw + 150 + GUTTER_W, left = root.scrollLeft, width = root.clientWidth;
        if (x < left + 150 + GUTTER_W || x > left + width - 40) root.scrollLeft = Math.max(0, x - 200);
      }
    },
    scrollTo(col) { root.scrollLeft = Math.max(0, col * cw - root.clientWidth / 2); },
  };
}
