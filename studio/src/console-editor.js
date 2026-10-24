// The console editor: a dialog for making a custom console (a copy of another, with its own numbers).
// edit(spec, {isNew}) resolves with the finished console, or null if cancelled. Validation is in consoles.js.
import { validateConsole, slugify, uniqueId, TYPICAL } from "./consoles.js";

const SCREEN_PRESETS = [
  ["Custom", null], ["256×192 (4:3)", [256, 192]], ["320×240 (4:3)", [320, 240]], ["320×180 (16:9)", [320, 180]], ["240×160 (3:2)", [240, 160]],
  ["256×224 (8:7)", [256, 224]], ["160×144 (10:9)", [160, 144]], ["640×480 (4:3)", [640, 480]],
];

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// hooks: { takenIds() -> string[] } so a new console's id is unique
export function createConsoleEditor(dialog, hooks = {}) {
  dialog.replaceChildren();
  const form = el("div", "ce-form");
  dialog.appendChild(form);

  let c = null, isNew = false, resolve = null, idEdited = false, selected = -1;

  // ---------- small form helpers, bound to the working copy `c` by a path like "screen.width" ----------
  const getp = (path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), c);
  function setp(path, value) {
    const keys = path.split("."), last = keys.pop();
    let o = c;
    for (const k of keys) o = o[k] = o[k] && typeof o[k] === "object" ? o[k] : {};
    if (value === undefined) delete o[last]; else o[last] = value;
  }
  const section = (title) => { const h = el("h3", null, title); form.appendChild(h); return h; };
  function field(label, control, hint) {
    const row = el("label", "ce-field");
    row.append(el("span", "ce-label", label), control);
    if (hint) row.title = hint;
    form.appendChild(row);
    return row;
  }
  function numInput(path, { min = 1, max, optional = false, decimal = false, onChange } = {}) {
    const i = el("input"); i.type = "number"; i.min = decimal ? 0.1 : min; if (decimal) i.step = 0.1; if (max) i.max = max;
    i.onchange = () => {
      const v = i.value === "" ? undefined : decimal ? Math.max(0.1, Math.round(Number(i.value) * 10) / 10) : Math.round(Number(i.value));
      setp(path, optional && v === undefined ? undefined : v);
      refresh(); onChange && onChange();
    };
    i.dataset.path = path;
    return i;
  }
  const inputs = () => form.querySelectorAll("[data-path]");

  // ---------- the form ----------
  const nameIn = el("input"); nameIn.spellcheck = false;
  nameIn.oninput = () => { c.name = nameIn.value; if (isNew && !idEdited) { c.id = uniqueId(nameIn.value, hooks.takenIds ? hooks.takenIds() : []); idIn.value = c.id; } refresh(); };
  const idIn = el("input"); idIn.spellcheck = false;
  idIn.oninput = () => { idEdited = true; c.id = slugify(idIn.value) || idIn.value; refresh(); };
  const descIn = el("textarea"); descIn.rows = 2;
  descIn.oninput = () => { c.description = descIn.value; };
  form.appendChild(el("h2", null, "Console"));
  field("Name", nameIn); field("Id", idIn, "Used for the file name. Lowercase letters, digits, - and _."); field("Description", descIn);

  section("Screen");
  const preset = el("select");
  SCREEN_PRESETS.forEach(([label], i) => preset.appendChild(new Option(label, i)));
  preset.onchange = () => { const p = SCREEN_PRESETS[+preset.value][1]; if (p) { c.screen.width = p[0]; c.screen.height = p[1]; } refresh(); };
  field("Size", preset);
  field("Width", numInput("screen.width", { min: 64, max: 2048 }));
  field("Height", numInput("screen.height", { min: 64, max: 2048 }));
  field("Steps per second", numInput("room_speed", { min: 1, max: 240 }));

  section("Colours");
  const mode = el("select");
  [["banks", "Colour banks, GBA style: 15 colours a bank"], ["fixed", "Fixed palette: only these colours"], ["limited", "Limited: any colours, at most N"], ["free", "Free: any colours"]].forEach(([v, l]) => mode.appendChild(new Option(l, v)));
  mode.onchange = () => {
    if (mode.value === "banks") c.palette = { mode: "banks", color_bits: 15, bank_colors: 16, sprite_banks: 16, tile_banks: 16, ...(c.palette && c.palette.colors ? { colors: c.palette.colors } : {}) };
    else if (mode.value === "fixed") c.palette = { mode: "fixed", colors: (c.palette && c.palette.colors) || ["#000000", "#ffffff"] };
    else if (mode.value === "limited") c.palette = { mode: "limited", size: (c.palette && c.palette.size) || 16 };
    else c.palette = { mode: "free" };
    refresh();
  };
  field("Mode", mode);
  const sizeRow = field("Most colours", numInput("palette.size", { min: 2, max: 256 }));
  const spriteBanksRow = field("Sprite banks", numInput("palette.sprite_banks", { min: 1, max: 16 }));
  const tileBanksRow = field("Tile banks", numInput("palette.tile_banks", { min: 1, max: 16 }));
  spriteBanksRow.title = tileBanksRow.title = "How many colour banks a game may have (each game picks its own colours, 15 a bank, in Colours)";
  const swatches = el("div", "ce-swatches");
  const palBox = el("div", "ce-palette");
  const picker = el("input"); picker.type = "color"; picker.value = "#ff004d";
  const btn = (text, fn, title) => { const b = el("button", null, text); b.type = "button"; b.onclick = fn; if (title) b.title = title; return b; };
  const addBtn = btn("Add", () => { const h = picker.value.toLowerCase(); if (!c.palette.colors.includes(h)) c.palette.colors.push(h); selected = -1; refresh(); });
  const repBtn = btn("Replace selected", () => { if (selected >= 0) { c.palette.colors[selected] = picker.value.toLowerCase(); refresh(); } });
  const delBtn = btn("Remove selected", () => { if (selected >= 0) { c.palette.colors.splice(selected, 1); selected = -1; refresh(); } });
  const paste = el("textarea"); paste.rows = 2; paste.placeholder = "Paste colours like #1a1c2c #5d275d ... to replace the palette";
  const pasteBtn = btn("Replace all", () => {
    const found = [...new Set((paste.value.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase()))];
    if (found.length) { c.palette.colors = found.slice(0, 256); selected = -1; paste.value = ""; refresh(); }
  });
  const palCount = el("div", "ce-hint");
  const palTools = el("div", "ce-row"); palTools.append(picker, addBtn, repBtn, delBtn);
  const pasteRow = el("div", "ce-row"); pasteRow.append(paste, pasteBtn);
  palBox.append(swatches, palCount, palTools, pasteRow);
  form.appendChild(palBox);

  section("Sprites and tiles");
  field("Sprite sizes are multiples of", numInput("graphics.sprite_size.multiple_of", { max: 64 }));
  field("Largest sprite width", numInput("graphics.sprite_size.max_width", { max: 512 }));
  field("Largest sprite height", numInput("graphics.sprite_size.max_height", { max: 512 }));
  const tiles = el("input"); tiles.placeholder = "8, 16 (empty = any size)";
  tiles.onchange = () => {
    const list = tiles.value.split(/[ ,]+/).filter(Boolean).map(Number);
    setp("graphics.tile_sizes", list.length ? list : null); refresh();
  };
  field("Allowed tile sizes", tiles);
  field("Largest tileset width", numInput("graphics.tileset_max.width", { max: 1024 }));
  field("Largest tileset height", numInput("graphics.tileset_max.height", { max: 1024 }));

  section("Rooms");
  field("Largest room width", numInput("rooms.max_width", { max: 8192 }));
  field("Largest room height", numInput("rooms.max_height", { max: 8192 }));
  field("Tile layers per room", numInput("rooms.tile_layers", { max: 16 }));
  field("Views (cameras)", numInput("rooms.views", { max: 8 }));
  const par = el("input"); par.type = "checkbox"; par.onchange = () => { setp("rooms.parallax", par.checked); };
  field("Parallax scrolling", par);

  section("Sound");
  field("Music tracks", numInput("audio.music_tracks", { max: 8 }), "How many of a song's eight tracks play (each plays one instrument, and can sound several notes at once).");
  field("Sound effect channels", numInput("audio.sfx_channels", { max: 4 }), "How many sound effect voices can play at once (a sound effect has two lanes, and a lane can sound several notes). They are separate from the music, so effects never cut the music off.");
  const style = el("select");
  [["clean", "Clean: full quality"], ["gba", "GBA: lo-fi, like a Game Boy Advance"]].forEach(([v, l]) => style.appendChild(new Option(l, v)));
  style.onchange = () => { setp("audio.style", style.value); refresh(); };
  field("Sound style", style, "GBA adds a low-pass filter and 8-bit steps to everything you hear.");

  section("Limits and budgets");
  form.appendChild(el("div", "ce-hint", "Limits stop you; budgets only warn. Leave a box empty for none."));
  field("Instances per room (limit)", numInput("limits.instances_per_room", { optional: true, max: 1000000 }), TYPICAL.instances);
  field("Entities alive at once (limit)", numInput("limits.instances_alive", { optional: true, max: 1000000 }), "While the game runs, no more than this many entities exist at once. Extra ones are ignored and the Output says so. Keeps a game that makes entities in a loop from freezing the handheld. " + TYPICAL.alive);
  field("Particles at once (limit)", numInput("limits.particles", { optional: true, max: 100000 }), "Extra particles are simply not made. " + TYPICAL.particles);
  field("Collision checks a step (budget)", numInput("budgets.collision_tests", { optional: true, max: 10000000 }), "Every entity with an on_collide method checks the entities with that tag, every step. The Handheld tab measures it while the game runs. " + TYPICAL.collisions);
  field("Drawing per frame, in screens (budget)", numInput("budgets.draw_screens", { optional: true, max: 100, decimal: true }), "How much of the screen all the drawing covers in one frame, counting overlaps: 1 is one full screen. Big pictures, fades and see-through sprites on top of each other add up. The Handheld tab measures it while the game runs. " + TYPICAL.drawing);
  field("Visible sprites (budget)", numInput("budgets.visible_sprites", { optional: true, max: 1000000 }), TYPICAL.sprites);
  field("Cart size in KB (budget)", numInput("budgets.cart_kb", { optional: true, max: 1000000 }));
  field("Frames per sprite (budget)", numInput("budgets.frames_per_sprite", { optional: true, max: 1000 }));

  const errors = el("ul", "ce-errors");
  const actions = el("div", "ce-actions");
  const cancel = btn("Cancel", () => finish(null)), save = btn("Save console", () => finish(c));
  save.classList.add("primary");
  actions.append(cancel, save);
  form.append(errors, actions);

  // ---------- keep the form and the working copy in step ----------
  function refresh() {
    nameIn.value = c.name || ""; idIn.value = c.id || ""; idIn.disabled = !isNew; descIn.value = c.description || "";
    const idx = SCREEN_PRESETS.findIndex(([, p]) => p && p[0] === c.screen.width && p[1] === c.screen.height);
    preset.value = idx < 0 ? 0 : idx;
    const m = (c.palette && c.palette.mode) || "free";
    mode.value = m;
    sizeRow.hidden = m !== "limited"; palBox.hidden = m !== "fixed";
    spriteBanksRow.hidden = tileBanksRow.hidden = m !== "banks";
    if (m === "fixed") {
      swatches.replaceChildren();
      c.palette.colors.forEach((h, i) => {
        const b = el("button", "swatch" + (i === selected ? " sel" : "")); b.type = "button"; b.style.background = h; b.title = h;
        b.onclick = () => { selected = selected === i ? -1 : i; if (selected >= 0) picker.value = h; refresh(); };
        swatches.appendChild(b);
      });
      palCount.textContent = `${c.palette.colors.length} colours` + (selected >= 0 ? `, ${c.palette.colors[selected]} selected` : ". Click a colour to select it.");
      repBtn.disabled = delBtn.disabled = selected < 0;
    }
    inputs().forEach((i) => { const v = getp(i.dataset.path); i.value = v === undefined || v === null ? "" : v; });
    tiles.value = (c.graphics.tile_sizes || []).join(", ");
    par.checked = !!c.rooms.parallax;
    style.value = c.audio.style === "gba" ? "gba" : "clean";
    const bad = validateConsole(c);
    errors.replaceChildren(...bad.map((t) => el("li", null, t)));
    save.disabled = bad.length > 0;
  }

  function finish(result) {
    const r = resolve; resolve = null;
    if (dialog.open) dialog.close();
    if (r) r(result ? JSON.parse(JSON.stringify(result)) : null);
  }
  dialog.addEventListener("close", () => { if (resolve) finish(null); });
  dialog.addEventListener("cancel", () => { /* Escape: the close handler resolves null */ });

  return {
    edit(spec, opts = {}) {
      c = JSON.parse(JSON.stringify(spec)); isNew = !!opts.isNew; idEdited = !isNew; selected = -1;
      // sections a spec may leave out, so every input has somewhere to write
      c.screen = c.screen || {}; c.palette = c.palette || { mode: "free" };
      c.graphics = c.graphics || {}; c.graphics.sprite_size = c.graphics.sprite_size || {}; c.graphics.tileset_max = c.graphics.tileset_max || {};
      c.rooms = c.rooms || {}; c.audio = c.audio || {}; c.limits = c.limits || {}; c.budgets = c.budgets || {};
      refresh();
      dialog.showModal();
      return new Promise((r) => { resolve = r; });
    },
  };
}
