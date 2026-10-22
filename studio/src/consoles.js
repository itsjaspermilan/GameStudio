// Consoles: what a game made for a given "device" may use. Specs live in engine/consoles/*.json (see the README there).
// A project stores a copy of its console in project.json, so editing a console later never breaks an existing game.
// Projects made before consoles existed have none and are treated as the legacy 640x480 console.
import dot from "../../engine/consoles/dot.json" with { type: "json" };
import dash from "../../engine/consoles/dash.json" with { type: "json" };

export const BUILTIN_CONSOLES = [dot, dash];

export const LEGACY_CONSOLE = {
  id: "legacy", name: "Legacy", description: "Projects made before consoles existed: no limits.", based_on: null,
  screen: { width: 640, height: 480, scale: "letterbox" },
  room_speed: 60,
  palette: { mode: "free" },
  graphics: { sprite_size: { multiple_of: 1, max_width: 256, max_height: 256 }, tile_sizes: null, tileset_max: { width: 1024, height: 1024 } },
  rooms: { max_width: 8192, max_height: 8192, views: 1, tile_layers: 16, parallax: false },
  audio: { music_tracks: 4, sfx_channels: 4, sample_rate: 22050, sample_max_seconds: 60, style: "clean" },
  input: ["up", "down", "left", "right", "a", "b", "x", "y", "l", "r", "start", "select", "l2", "r2"],
  limits: {}, budgets: {},
};

// Fill any section a hand-edited spec leaves out from the legacy defaults, so the rest of the studio can rely on them.
export function normalizeConsole(c) {
  const d = LEGACY_CONSOLE;
  return {
    ...d, ...c,
    screen: { ...d.screen, ...(c.screen || {}) },
    palette: { ...d.palette, ...(c.palette || {}) },
    graphics: { ...d.graphics, ...(c.graphics || {}) },
    rooms: { ...d.rooms, ...(c.rooms || {}) },
    audio: { ...d.audio, ...(c.audio || {}) },
    limits: { ...(c.limits || {}) }, budgets: { ...(c.budgets || {}) },
  };
}

// Dot and Dash used to be called Pocket and Wide. A project keeps its own copy of its console, so older projects still say the old
// id and name; show them under the new ones (the file is only rewritten if the console is changed).
const RENAMED = { pocket: { id: "dot", name: "Dot", oldName: "Pocket" }, wide: { id: "dash", name: "Dash", oldName: "Wide" } };
export function currentName(c) {
  const r = c && RENAMED[c.id];
  return r ? { ...c, id: r.id, name: c.name === r.oldName ? r.name : c.name } : c;
}

export function consoleFor(project) {
  return project && project.console ? normalizeConsole(currentName(project.console)) : LEGACY_CONSOLE;
}

export const screenText = (c) => `${c.screen.width}×${c.screen.height}`;

// Problems with a console spec (an empty list means it is usable). Used when a custom console is edited.
export function validateConsole(c) {
  const bad = [];
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!c || typeof c !== "object") return ["not a console"];
  if (typeof c.id !== "string" || !/^[a-z0-9_-]{1,40}$/.test(c.id)) bad.push("id must be 1-40 lowercase letters, digits, - or _");
  if (typeof c.name !== "string" || !c.name.trim()) bad.push("name is required");
  const s = c.screen || {};
  if (!int(s.width, 64, 2048) || !int(s.height, 64, 2048)) bad.push("screen width and height must be whole numbers from 64 to 2048");
  const p = c.palette || {};
  if (!["fixed", "limited", "free"].includes(p.mode)) bad.push("palette mode must be fixed, limited or free");
  if (p.mode === "fixed") {
    const cols = p.colors;
    if (!Array.isArray(cols) || cols.length < 2 || cols.length > 256) bad.push("a fixed palette needs 2 to 256 colours");
    else if (!cols.every((x) => /^#[0-9a-fA-F]{6}$/.test(x))) bad.push("palette colours must look like #rrggbb");
    else if (new Set(cols.map((x) => x.toLowerCase())).size !== cols.length) bad.push("palette colours must be different from each other");
  }
  if (p.mode === "limited" && !int(p.size, 2, 256)) bad.push("a limited palette needs a size from 2 to 256");
  const g = c.graphics || {}, ss = g.sprite_size || {};
  if (g.sprite_size && (!int(ss.multiple_of, 1, 64) || !int(ss.max_width, 1, 512) || !int(ss.max_height, 1, 512))) bad.push("sprite size limits must be whole numbers (multiple of 1-64, maximums up to 512)");
  if (g.tile_sizes != null && (!Array.isArray(g.tile_sizes) || !g.tile_sizes.length || !g.tile_sizes.every((t) => int(t, 1, 256)))) bad.push("tile sizes must be a list of whole numbers from 1 to 256, or empty for any size");
  if (g.tileset_max && (!int(g.tileset_max.width, 1, 1024) || !int(g.tileset_max.height, 1, 1024))) bad.push("the tileset size limit must be whole numbers up to 1024");
  const r = c.rooms || {};
  if (!int(r.max_width, 1, 8192) || !int(r.max_height, 1, 8192)) bad.push("room size limits must be whole numbers up to 8192");
  else if (int(s.width, 64, 2048) && (r.max_width < s.width || r.max_height < s.height)) bad.push("rooms must be at least as big as the screen");
  if (!int(r.tile_layers, 1, 16)) bad.push("tile layers must be 1 to 16");
  if (!int(r.views, 1, 8)) bad.push("views must be 1 to 8");
  if (c.audio && c.audio.music_tracks !== undefined && !int(c.audio.music_tracks, 1, 8)) bad.push("music tracks must be 1 to 8");
  if (c.audio && c.audio.sfx_channels !== undefined && !int(c.audio.sfx_channels, 1, 4)) bad.push("sound effect channels must be 1 to 4");
  if (c.audio && c.audio.style !== undefined && !["clean", "gba"].includes(c.audio.style)) bad.push("audio style must be clean or gba");
  for (const k of Object.keys(c.limits || {})) if (!int(c.limits[k], 1, 1e6)) bad.push(`limit ${k} must be a positive whole number`);
  for (const k of Object.keys(c.budgets || {})) { const v = c.budgets[k]; if (typeof v !== "number" || !isFinite(v) || v <= 0) bad.push(`budget ${k} must be a positive number`); }
  return bad;
}

// The largest whole-number scale at which the screen fits a display, and the size it ends up at.
export function fitScale(screen, display) {
  const k = Math.max(1, Math.min(Math.floor(display.width / screen.width), Math.floor(display.height / screen.height)));
  return { scale: k, width: screen.width * k, height: screen.height * k };
}

// Room size limits: [min, max] of the console, so a room can never be bigger than the console allows.
export function clampRoomSize(c, w, h) {
  const clamp = (v, max) => Math.max(16, Math.min(max, Math.round(Number(v)) || max));
  return [clamp(w, c.rooms.max_width), clamp(h, c.rooms.max_height)];
}

// What a typical GBA-style game uses, to put next to the limits (they are ceilings the handheld can hold, not targets). From general knowledge of the
// GBA: 128 hardware sprites at most, usually tens on screen; logic over tens of objects; hardware layers made see-through and parallax cheap.
export const TYPICAL = {
  instances: "A GBA-style game usually has 20 to 100 objects in a room.",
  alive: "A GBA-style game usually has 20 to 100 objects alive at once.",
  particles: "A GBA-style game usually shows well under 100.",
  collisions: "A GBA-style game usually makes tens to a few hundred checks a step.",
  drawing: "A GBA-style game covers 1 to 2 screens; the handheld holds 6 at 60 frames a second.",
  sprites: "The GBA could show 128 sprites at once; most games showed far fewer.",
};

export const instanceLimit = (c) => (c.limits && c.limits.instances_per_room) || Infinity;

// A copy of a console to start a new custom one from.
export function duplicateConsole(c, id, name) {
  const copy = JSON.parse(JSON.stringify(c));
  copy.id = id; copy.name = name; copy.based_on = c.id;
  return copy;
}

// What colours a console allows: {mode: "fixed", colors: ["#rrggbb", ...]}, {mode: "limited", size}, or {mode: "free"}.
export function paletteOf(c) {
  const p = (c && c.palette) || {};
  if (p.mode === "fixed" && Array.isArray(p.colors)) return { mode: "fixed", colors: p.colors.map((x) => x.toLowerCase()) };
  if (p.mode === "limited") return { mode: "limited", size: p.size };
  return { mode: "free" };
}

// ---- the list of consoles: built in plus custom ----
// "pocket" and "wide" are the old names of Dot and Dash: kept reserved so a custom console can never take them.
export const RESERVED_IDS = ["dot", "dash", "legacy", "pocket", "wide"];

export function slugify(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}

// A console id from a name that isn't reserved or already taken.
export function uniqueId(name, taken) {
  const base = slugify(name) || "console", used = new Set([...RESERVED_IDS, ...taken]);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const id = `${base.slice(0, 36)}-${i}`;
    if (!used.has(id)) return id;
  }
}

// The text of each custom console file in, usable consoles out; files that don't parse or validate are reported.
export function parseCustomConsoles(texts) {
  const consoles = [], problems = [];
  const seen = new Set(RESERVED_IDS);
  for (const text of texts) {
    let c;
    try { c = JSON.parse(text); } catch (e) { problems.push("a console file is not valid JSON"); continue; }
    const bad = validateConsole(c);
    if (bad.length) { problems.push(`console '${c && c.id}': ${bad[0]}`); continue; }
    if (seen.has(c.id)) { problems.push(`console '${c.id}' uses a name that is already taken`); continue; }
    seen.add(c.id);
    consoles.push(c);
  }
  return { consoles, problems };
}

export const allConsoles = (customs) => [...BUILTIN_CONSOLES, ...(customs || [])];

// ---- a game carries the custom console it uses ----
// A game made for one of your own consoles keeps a copy of it as consoles/<id>.json, so it runs the same on another machine and on the device.
// Built-in consoles need no copy (null).
export const consoleFileOf = (id) => (BUILTIN_CONSOLES.some((c) => c.id === id) ? null : `consoles/${id}.json`);
export const consoleFileText = (c) => JSON.stringify(c, null, 2) + "\n";

// The console a game uses: a built-in one or one of yours by id, else the copy the game carries (`carriedText`), else Dot.
export function resolveConsole(id, customs, carriedText) {
  const known = allConsoles(customs).find((c) => c.id === id);
  if (known) return known;
  if (carriedText) {
    const { consoles } = parseCustomConsoles([carriedText]);
    if (consoles[0] && consoles[0].id === id) return consoles[0];
  }
  return BUILTIN_CONSOLES[0];
}

// ---- budgets: soft limits shown as meters ----
// level: "ok" under 80%, "warn" up to the budget, "over" past it. With no budget there is nothing to compare to.
export function budgetStatus(used, budget) {
  if (!budget) return { level: "ok", ratio: 0, budget: 0 };
  const ratio = used / budget;
  return { level: ratio > 1 ? "over" : ratio >= 0.8 ? "warn" : "ok", ratio, budget };
}

export function formatKB(bytes) {
  const kb = bytes / 1024;
  return kb < 10 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
}
