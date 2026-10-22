// The instrument palette beside the SFX and music editors: ready-made instruments in one section, the project's own in another.
// Drag one onto a channel (or track) to give it that instrument; click one to hear it.
import * as A from "./audio-core.js";

export const DRAG_TYPE = "text/x-gs-instrument";
const GROUP_COLORS = { Keys: "#4f9bf0", Orchestra: "#6ccf4f", Synth: "#f5d94a", Drums: "#ea5a4b", Basic: "#8a90a8" };
const GM_COLORS = { Piano: "#4f9bf0", "Chromatic percussion": "#4bd0c0", Organ: "#7b8cf0", Guitar: "#e0884b", Bass: "#f5d94a", Strings: "#6ccf4f", Ensemble: "#9bc24b", Brass: "#d0b04b", Reed: "#c07070", Pipe: "#70a0c0", "Synth lead": "#d46bb0", "Synth pad": "#a56be0", "Synth effects": "#b090d0", Ethnic: "#5bb0a0", Percussive: "#ea8a4b", "Sound effects": "#8a90a8", "Drum kit": "#ea5a4b" };
export const CUSTOM_COLOR = "#a56be0";
export const instrumentColor = (name) => {
  if (!name) return "#555a6b";
  if (A.BUILTIN_INSTRUMENTS.includes(name)) return GROUP_COLORS.Basic;
  const d = A.builtinDef(name);
  return d ? (d.set === "gm" ? GM_COLORS[d.group] : GROUP_COLORS[d.group]) || GROUP_COLORS.Basic : CUSTOM_COLOR;
};
// The instrument name carried by a drag, or null if it isn't one of ours.
export const droppedInstrument = (e) => { const n = e.dataTransfer && e.dataTransfer.getData(DRAG_TYPE); return n || null; };
export const acceptsInstrument = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes(DRAG_TYPE);

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// hooks: { getCustom() -> names, preview(name), copy(name) (make an editable copy of a ready-made one) }
export function createInstrumentPanel(root, hooks = {}) {
  root.classList.add("ip");
  const collapsed = new Set(), opened = new Set(); // groups folded away; General MIDI groups start folded, so these are the ones opened

  function item(name, label, builtin) {
    const b = el("div", "ip-item"); b.draggable = true; b.dataset.name = name;
    const dot = el("span", "ip-dot"); dot.style.background = instrumentColor(name);
    b.append(dot, el("span", "ip-label", label));
    if (builtin && hooks.copy && !A.BUILTIN_INSTRUMENTS.includes(name)) {
      const c = el("button", "ip-copy", "⧉"); c.title = "Make an editable copy in My instruments";
      c.onclick = (e) => { e.stopPropagation(); hooks.copy(name); };
      b.appendChild(c);
    }
    b.title = "Drag onto a channel, or click to hear it";
    b.onclick = () => hooks.preview && hooks.preview(name);
    b.ondragstart = (e) => { e.dataTransfer.setData(DRAG_TYPE, name); e.dataTransfer.setData("text/plain", name); e.dataTransfer.effectAllowed = "copy"; };
    return b;
  }
  function section(title, key, content, count) {
    const box = el("div", "ip-section");
    const head = el("button", "ip-head", `${collapsed.has(key) ? "▸" : "▾"} ${title}`);
    head.onclick = () => { collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key); render(); };
    box.appendChild(head);
    if (!collapsed.has(key)) box.appendChild(content);
    return box;
  }
  function render() {
    root.replaceChildren();
    root.appendChild(el("div", "ip-title", "Instruments"));
    root.appendChild(el("div", "ip-hint", "Drag one onto a channel. Click to hear it."));
    // ready-made sounds, in sets: the chip sounds first, then General MIDI, each in groups you can fold away
    const builtin = el("div", "ip-list");
    for (const set of A.BUILTIN_SETS()) {
      builtin.appendChild(el("div", "ip-set", set.label));
      for (const g of A.BUILTIN_GROUPS(set.id)) {
        const key = `${set.id}:${g}`, head = el("button", "ip-group", `${collapsed.has(key) || (set.id === "gm" && !opened.has(key)) ? "▸" : "▾"} ${g}`);
        const closed = set.id === "gm" ? !opened.has(key) : collapsed.has(key);
        head.onclick = () => { if (set.id === "gm") { opened.has(key) ? opened.delete(key) : opened.add(key); } else { collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key); } render(); };
        builtin.appendChild(head);
        if (!closed) for (const d of A.builtinInstruments().filter((x) => (x.set || "chip") === set.id && x.group === g)) builtin.appendChild(item(d.name, d.label, true));
      }
      if (set.id === "chip") {
        const key = "chip:Basic waves", head = el("button", "ip-group", `${collapsed.has(key) ? "▸" : "▾"} Basic waves`);
        head.onclick = () => { collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key); render(); };
        builtin.appendChild(head);
        if (!collapsed.has(key)) A.BUILTIN_INSTRUMENTS.forEach((n, i) => builtin.appendChild(item(n, A.BUILTIN_LABELS[i], true)));
      }
    }
    root.appendChild(section("Built-in", "builtin", builtin));
    const mine = el("div", "ip-list");
    const names = hooks.getCustom ? hooks.getCustom() : [];
    if (!names.length) mine.appendChild(el("div", "ip-hint", "None yet. Click + next to Instruments in the list on the left to make one."));
    names.forEach((n) => mine.appendChild(item(n, n, false)));
    root.appendChild(section("My instruments", "mine", mine));
  }
  render();
  return { refresh: render };
}

// One colour per channel or track, so a channel is recognisable in the grid and the headers.
export const CHANNEL_COLORS = ["#4f9bf0", "#ea5a4b", "#6ccf4f", "#f5d94a", "#a56be0", "#e0884b", "#4bd0c0", "#d46bb0"];
