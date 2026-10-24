// Scene layouts (scenes/<name>.layout.lua, built when the scene starts) and rooms (rooms/<name>.lua, the older form gs.load_room builds) are
// the same data: a level or a screen as plain data. This reads the part of Lua a room uses (`return { ... }` with
// numbers, strings, true/false/nil, nested tables and comments) into JS, and writes a room back as tidy Lua. A file with anything else in
// it (a function, a variable, arithmetic) is code, not data: parseRoom says so and the studio opens it as text instead.
//
// A room: { width, height, background, layers: [{ name, tileset, depth, data: [[tile, ...], ...], ... }], entities: [[kind, x, y, props?, name?]],
//           texts: [{ text, x, y, name, color, size, align, font, shadow, screen }] (font: a built-in font, or a sprite, a frame a letter from " "), pictures: [{ sprite, x, y, name, frame, scale, screen }],
//           panels: [{ x, y, w, h, tileset, tile, name, screen }] (a 3x3 block of tiles, `tile` its top-left, stretched to the size),
//           paths: { name: { points: [[x, y], ...], loop } }, code?, ...anything else, kept as it was }
// A name makes the thing a field of the scene's code (self.<name>), see engine/gs/world.lua "scene layouts".

import { FONTS, FONT_FIRST, FONT_GAP } from "./fonts.js";

// ---------- reading ----------
function tokenize(src) {
  const out = [];
  let i = 0;
  const err = (m) => { throw new Error(`${m} (line ${src.slice(0, i).split("\n").length})`); };
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (src.startsWith("--", i)) {
      const long = src.slice(i + 2).match(/^\[(=*)\[/);
      if (long) { const close = "]" + long[1] + "]", end = src.indexOf(close, i); if (end < 0) err("a comment is not closed"); i = end + close.length; }
      else { const nl = src.indexOf("\n", i); i = nl < 0 ? src.length : nl + 1; }
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\n") err("a string is not closed");
        if (src[j] === "\\") { const n = src[j + 1]; s += { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" }[n] ?? n; j += 2; }
        else s += src[j++];
      }
      if (j >= src.length) err("a string is not closed");
      out.push({ t: "str", v: s }); i = j + 1; continue;
    }
    const num = src.slice(i).match(/^-?(0x[0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+)/);
    if (num && (c !== "-" || !/[\w)\]}]/.test(lastSignificant(out)))) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const word = src.slice(i).match(/^[A-Za-z_]\w*/);
    if (word) { out.push({ t: "name", v: word[0] }); i += word[0].length; continue; }
    if ("{}[]=,;".includes(c)) { out.push({ t: c }); i++; continue; }
    err(`'${c}' is code, not data`);
  }
  return out;
}
const lastSignificant = (toks) => { const t = toks[toks.length - 1]; return t ? (t.t === "num" || t.t === "str" || t.t === "name" ? "w" : t.t) : ""; };

// Lua tables become JS: a table with only list items is an array, one with only names an object; a mix keeps the list under "__list".
function parseValue(tk, p) {
  const t = tk[p.i];
  if (!t) throw new Error("the room ends too early");
  if (t.t === "num" || t.t === "str") { p.i++; return t.v; }
  if (t.t === "name") {
    p.i++;
    if (t.v === "true") return true;
    if (t.v === "false") return false;
    if (t.v === "nil") return null;
    throw new Error(`'${t.v}' is a name, not a value: this room has code in it`);
  }
  if (t.t !== "{") throw new Error(`unexpected '${t.t}'`);
  p.i++;
  const list = [], obj = {};
  let named = false;
  while (tk[p.i] && tk[p.i].t !== "}") {
    const a = tk[p.i], b = tk[p.i + 1];
    if (a.t === "name" && b && b.t === "=") { p.i += 2; obj[a.v] = parseValue(tk, p); named = true; }
    else if (a.t === "[") {
      p.i++; const k = parseValue(tk, p);
      if (!tk[p.i] || tk[p.i].t !== "]") throw new Error("expected ']'");
      p.i++;
      if (!tk[p.i] || tk[p.i].t !== "=") throw new Error("expected '='");
      p.i++; obj[k] = parseValue(tk, p); named = true;
    } else list.push(parseValue(tk, p));
    if (tk[p.i] && (tk[p.i].t === "," || tk[p.i].t === ";")) p.i++;
    else if (tk[p.i] && tk[p.i].t !== "}") throw new Error("expected ',' between items");
  }
  if (!tk[p.i]) throw new Error("a table is not closed");
  p.i++;
  if (!named) return list;
  if (list.length) obj.__list = list;
  return obj;
}

// rooms/<name>.lua text -> { room } or { error } (an error means: open it as text).
export function parseRoom(text) {
  try {
    const tk = tokenize(String(text || ""));
    if (!tk.length || tk[0].t !== "name" || tk[0].v !== "return") return { error: "a room file is `return { ... }`" };
    const p = { i: 1 };
    const v = parseValue(tk, p);
    if (p.i !== tk.length) return { error: "there is more after the room's table: this room has code in it" };
    if (!v || typeof v !== "object" || Array.isArray(v)) return { error: "a room is a table with names (width = ..., layers = ...)" };
    return { room: normalizeRoom(v) };
  } catch (e) { return { error: e.message }; }
}

// Fill in what the editor needs; keep everything else exactly as it was.
export function normalizeRoom(r) {
  const room = { ...r };
  room.width = Math.max(16, Math.round(Number(r.width) || 256));
  room.height = Math.max(16, Math.round(Number(r.height) || 192));
  room.layers = Array.isArray(r.layers) ? r.layers.map((l) => ({ ...l, data: Array.isArray(l.data) ? l.data.map((row) => (Array.isArray(row) ? row.map((v) => (Number.isFinite(v) ? v : -1)) : [])) : [] })) : [];
  // an entity is { "kind", x, y, props } or, with a name, { "kind", x, y, props, name = "hero" } (its list part, then the name)
  room.entities = Array.isArray(r.entities)
    ? r.entities.map((e) => {
      const l = Array.isArray(e) ? e : e.__list || [e.class, e.x, e.y, e.props];
      const props = l[3] && typeof l[3] === "object" && !Array.isArray(l[3]) ? l[3] : undefined; // {} reads as an empty list: no values
      const out = [String(l[0] ?? ""), Number(l[1]) || 0, Number(l[2]) || 0, props];
      // the name is a field when read from a file, and the fifth item of an entity that was normalized already (the editor loads that)
      const named = Array.isArray(e) ? e[4] : e.name;
      if (typeof named === "string") out.push(named);
      return out;
    })
    : [];
  const items = (list, first) => (Array.isArray(list) ? list : []).map((t) => {
    const l = Array.isArray(t) ? t : t.__list || [];
    const o = Array.isArray(t) ? {} : t;
    return { [first]: String(l[0] ?? o[first] ?? ""), x: Number(l[1] ?? o.x) || 0, y: Number(l[2] ?? o.y) || 0, ...Object.fromEntries(Object.entries(o).filter(([k]) => !["__list", first, "x", "y"].includes(k))) };
  });
  room.texts = items(r.texts, "text");
  room.panels = (Array.isArray(r.panels) ? r.panels : []).map((t) => {
    const l = Array.isArray(t) ? t : t.__list || [], o = Array.isArray(t) ? {} : t;
    const n = (i, k, d) => Number(l[i] ?? o[k] ?? d) || 0;
    return { x: n(0, "x", 0), y: n(1, "y", 0), w: Math.max(1, n(2, "w", 32)), h: Math.max(1, n(3, "h", 32)), tile: 0, ...Object.fromEntries(Object.entries(o).filter(([k]) => !["__list", "x", "y", "w", "h"].includes(k))) };
  });
  room.pictures = items(r.pictures, "sprite");
  room.paths = r.paths && typeof r.paths === "object" && !Array.isArray(r.paths) ? Object.fromEntries(Object.entries(r.paths).map(([k, p]) => [k, normalizePath(p)])) : {};
  return room;
}
// A path is a list of points ({ {x, y}, ... }), with loop = true to go round; written either way, read into { points, loop }.
function normalizePath(p) {
  const pts = Array.isArray(p) ? p : (p && p.__list) || (p && p.points) || [];
  return { points: pts.filter((q) => Array.isArray(q)).map((q) => [Number(q[0]) || 0, Number(q[1]) || 0]), loop: !!(p && p.loop) };
}

// ---------- writing ----------
const IDENT = /^[A-Za-z_]\w*$/;
const RESERVED = new Set(["and", "break", "do", "else", "elseif", "end", "false", "for", "function", "goto", "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while"]);
const luaKey = (k) => (IDENT.test(k) && !RESERVED.has(k) ? k : `[${luaString(k)}]`);
const luaString = (s) => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
const luaNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));

// One value on one line (small tables, props).
export function luaInline(v) {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "number") return luaNum(v);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") return luaString(v);
  if (Array.isArray(v)) return v.length ? `{ ${v.map(luaInline).join(", ")} }` : "{}";
  const parts = [];
  if (v.__list) parts.push(...v.__list.map(luaInline));
  for (const [k, x] of Object.entries(v)) if (k !== "__list" && x !== undefined) parts.push(`${luaKey(k)} = ${luaInline(x)}`);
  return parts.length ? `{ ${parts.join(", ")} }` : "{}";
}

const ROOM_ORDER = ["width", "height", "background"];
const TEXT_ORDER = ["name", "color", "size", "align", "font", "shadow", "screen", "depth", "blend", "alpha"];
const PICTURE_ORDER = ["name", "frame", "scale", "screen", "depth", "blend", "alpha"];
const PANEL_ORDER = ["tileset", "tile", "name", "screen", "depth", "blend", "alpha"];
const LAYER_ORDER = ["name", "tileset", "depth", "scroll_x", "scroll_y", "wrap_x", "wrap_y", "solid", "visible", "blend", "alpha", "cell"];

// A room as Lua: the known parts in a fixed order and a readable shape (a tile row per line, an entity per line), the rest after them.
export function serializeRoom(room, comment) {
  const L = [];
  if (comment) L.push(`-- ${comment}`);
  L.push("return {");
  const known = new Set([...ROOM_ORDER, "layers", "entities", "texts", "pictures", "panels", "paths"]);
  const head = ROOM_ORDER.filter((k) => room[k] !== undefined && room[k] !== null).map((k) => `${k} = ${luaInline(room[k])}`);
  if (head.length) L.push(`  ${head.join(", ")},`);
  for (const [k, v] of Object.entries(room)) if (!known.has(k) && k !== "__list" && v !== undefined) L.push(`  ${luaKey(k)} = ${luaInline(v)},`);
  if (room.layers && room.layers.length) {
    L.push("  layers = {");
    for (const l of room.layers) {
      const attrs = [...LAYER_ORDER.filter((k) => l[k] !== undefined && l[k] !== null), ...Object.keys(l).filter((k) => !LAYER_ORDER.includes(k) && k !== "data" && l[k] !== undefined)];
      L.push(`    { ${attrs.map((k) => `${luaKey(k)} = ${luaInline(l[k])}`).join(", ")}, data = {`);
      for (const row of l.data || []) L.push(`      { ${row.map(luaNum).join(", ")} },`); // as Tidy indents it
      L.push("    } },");
    }
    L.push("  },");
  }
  L.push("  entities = {");
  for (const [kind, x, y, props, name] of room.entities || []) {
    const hasProps = props && Object.keys(props).filter((k) => k !== "__list").length;
    // a name after the list needs the props' place kept, so an empty one is written as {}
    const p = hasProps ? ", " + luaInline(props) : name ? ", {}" : "";
    L.push(`    { ${luaString(kind)}, ${luaNum(x)}, ${luaNum(y)}${p}${name ? `, name = ${luaString(name)}` : ""} },`);
  }
  L.push("  },");
  const itemLine = (t, first, order) => {
    const rest = [...order.filter((k) => t[k] !== undefined && t[k] !== null && t[k] !== ""), ...Object.keys(t).filter((k) => ![first, "x", "y", ...order].includes(k) && t[k] !== undefined)];
    return `    { ${luaString(t[first])}, ${luaNum(t.x)}, ${luaNum(t.y)}${rest.map((k) => `, ${luaKey(k)} = ${luaInline(t[k])}`).join("")} },`;
  };
  if (room.panels && room.panels.length) {
    L.push("  panels = {");
    for (const b of room.panels) {
      const rest = [...PANEL_ORDER.filter((k) => b[k] !== undefined && b[k] !== null && b[k] !== ""), ...Object.keys(b).filter((k) => !["x", "y", "w", "h", ...PANEL_ORDER].includes(k) && b[k] !== undefined)];
      L.push(`    { ${[b.x, b.y, b.w, b.h].map(luaNum).join(", ")}${rest.map((k) => `, ${luaKey(k)} = ${luaInline(b[k])}`).join("")} },`);
    }
    L.push("  },");
  }
  for (const [key, first, order] of [["texts", "text", TEXT_ORDER], ["pictures", "sprite", PICTURE_ORDER]]) {
    if (!room[key] || !room[key].length) continue;
    L.push(`  ${key} = {`);
    for (const t of room[key]) L.push(itemLine(t, first, order));
    L.push("  },");
  }
  const paths = Object.entries(room.paths || {});
  if (paths.length) {
    L.push("  paths = {");
    for (const [k, p] of paths) L.push(`    ${luaKey(k)} = { ${p.points.map(([x, y]) => `{ ${luaNum(x)}, ${luaNum(y)} }`).join(", ")}${p.loop ? `${p.points.length ? ", " : ""}loop = true` : ""} },`);
    L.push("  },");
  }
  L.push("}");
  return L.join("\n") + "\n";
}

// ---------- editing helpers (pure, used by the editor) ----------
// A layer's grid sized to the room for a tile size: rows and columns added (empty, -1) or cut off.
export function fitLayer(layer, room, tw, th) {
  const cols = Math.ceil(room.width / tw), rows = Math.ceil(room.height / th);
  const data = [];
  for (let r = 0; r < rows; r++) {
    const src = layer.data[r] || [];
    data.push(Array.from({ length: cols }, (_, c) => (Number.isFinite(src[c]) ? src[c] : -1)));
  }
  return { ...layer, data };
}

// Every cell connected to (c, r) with the same tile becomes `v` (a flood fill). Returns how many changed.
export function fillLayer(layer, c, r, v) {
  const g = layer.data, from = g[r] && g[r][c];
  if (from === undefined || from === v) return 0;
  const stack = [[c, r]];
  let n = 0;
  while (stack.length) {
    const [x, y] = stack.pop();
    if (!g[y] || g[y][x] !== from) continue;
    g[y][x] = v; n++;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return n;
}

// The entity nearest a point within `radius`, as its index, or -1.
export function entityAt(room, x, y, radius = 10) {
  let best = -1, bd = radius * radius;
  room.entities.forEach(([, ex, ey], i) => { const d = (ex - x) ** 2 + (ey - y) ** 2; if (d <= bd) { best = i; bd = d; } });
  return best;
}

export const snap = (v, grid) => (grid > 1 ? Math.round(v / grid) * grid : Math.round(v));

// A name not yet used among `taken` ("path", "path2", ...).
export function freshName(base, taken) {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(base + n)) n++;
  return base + n;
}

// ---------- names (a named thing is a field of the scene's code: self.<name>) ----------
// Names every scene already has (engine/gs/world.lua TAKEN), so a layout may not use them.
export const SCENE_NAMES = new Set(["enter", "leave", "update", "draw", "draw_ui", "after", "every", "go", "tween"]);

// Everything with a name in a layout: [{ name, kind: "entity" | "text" | "picture", detail }], in the order they are built.
export function layoutNames(room) {
  const out = [];
  for (const [kind, x, y, , name] of room.entities || []) if (name) out.push({ name, kind: "entity", detail: `entity ${kind} at ${x}, ${y}` });
  for (const b of room.panels || []) if (b.name) out.push({ name: b.name, kind: "panel", detail: `panel ${b.w}x${b.h} of ${b.tileset} at ${b.x}, ${b.y}` });
  for (const p of room.pictures || []) if (p.name) out.push({ name: p.name, kind: "picture", detail: `picture ${p.sprite} at ${p.x}, ${p.y}` });
  for (const t of room.texts || []) if (t.name) out.push({ name: t.name, kind: "text", detail: `text "${t.text}" at ${t.x}, ${t.y}` });
  return out;
}

// What is wrong with giving something this name, or null. `own` is the thing's current name (it may keep it).
export function nameProblem(name, room, own) {
  if (!name) return null;
  if (!/^[A-Za-z_]\w*$/.test(name) || RESERVED.has(name)) return "A name is letters, digits and _, not starting with a digit (it is used in code as self.name).";
  if (SCENE_NAMES.has(name)) return `'${name}' is something every scene already has: pick another name.`;
  if (name !== own && layoutNames(room).some((n) => n.name === name)) return `Something in this layout is already called '${name}'.`;
  return null;
}

// How an entity is drawn in a layout: its class's own frame, scale (sx, sy), flip and alpha, read from the top of its gs.entity{ ... } table
// (plain numbers and true/false only; code that sets them later is not run), then what the layout gives that one thing.
const POSE_KEYS = ["frame", "sx", "sy", "flip", "alpha"];
export function lookDefaults(src) {
  const out = {}, body = /gs\.entity\s*\{([\s\S]*?)\n\}/.exec(String(src || ""));
  for (const line of (body ? body[1] : "").split("\n")) {
    const m = /^\s{2}(\w+)\s*=\s*(-?\d+(?:\.\d+)?|true|false)\s*,/.exec(line);
    if (m && POSE_KEYS.includes(m[1])) out[m[1]] = m[2] === "true" ? true : m[2] === "false" ? false : Number(m[2]);
  }
  return out;
}
export function entityPose(look, props) {
  const d = { ...(look && look.defaults), ...(props || {}) };
  const frames = look ? Math.max(1, Math.round(look.img.width / look.fw)) : 1;
  const num = (v, def) => (typeof v === "number" && Number.isFinite(v) ? v : def);
  return { frame: ((Math.floor(num(d.frame, 0)) % frames) + frames) % frames, sx: num(d.sx, 1), sy: num(d.sy, 1), flip: d.flip === true, alpha: Math.max(0, Math.min(1, num(d.alpha, 1))) };
}

// The built-in fonts (the runtime's, see fonts.js): their names, a letter's glyph ([width, row, ...]) and how wide text is at size 1.
export const BUILTIN_FONTS = Object.keys(FONTS);
export const isBuiltinFont = (name) => !name || name in FONTS;
export function glyphOf(name, code) {
  const glyphs = FONTS[name || "round_small"].glyphs, i = code - FONT_FIRST;
  return glyphs[i >= 0 && i < glyphs.length - 1 ? i : code === 9 ? 0 : glyphs.length - 1];
}
export function builtinWidth(text, name) {
  const cs = [...String(text ?? "")];
  return cs.reduce((w, c) => w + glyphOf(name, c.codePointAt(0))[0], 0) + Math.max(0, cs.length - 1) * FONT_GAP;
}
// The shadow the game makes from a text's colour when `shadow = true` (gs.draw's shadow_of): light letters get a dark shadow of their
// own hue, dark letters a pale one.
export function shadowOf([r, g, b]) {
  if (r * 0.3 + g * 0.59 + b * 0.11 > 110) return [Math.floor(r * 0.3), Math.floor(g * 0.3), Math.floor(b * 0.36)];
  return [Math.floor(r + (255 - r) * 0.7), Math.floor(g + (255 - g) * 0.7), Math.floor(b + (255 - b) * 0.66)];
}

// A text's box in the room, for picking it with the pointer: [x0, y0, x1, y1]. In a built-in font its letters' own widths, or with
// `font` = [w, h] (the size of a frame of the text's font sprite) a letter a frame.
export function textBox(t, font) {
  const size = Number(t.size) || 1, s = String(t.text ?? "");
  const w = (font ? s.length * font[0] : builtinWidth(s, t.font)) * size, h = (font ? font[1] : FONTS[t.font || "round_small"].h) * size;
  const x0 = t.align === "center" ? t.x - w / 2 : t.align === "right" ? t.x - w : t.x;
  return [x0, t.y, x0 + Math.max(w, 8), t.y + h];
}
