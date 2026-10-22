// Renaming a resource means renaming every reference to it too. Sound files point at each other by name (songs name instruments, sound effects
// name instruments, an instrument names a sample), so those are rewritten. Lua code names things in strings, which can't all be rewritten
// safely: the plain ways (module names, gs.spawn / gs.goto_scene / gs.load_room, a room's entity list) are rewritten by renameInCode, and
// what is left is counted and reported.
//
// files: { "music/song.json": {...}, "sfx/boop.json": {...}, "instruments/lead.json": {...} }     kind: a group key from project-core.js
import { refName, moduleName, group } from "./project-core.js";
import { parseRoom, serializeRoom } from "./room-core.js";

export function renameReferences(files, kind, from, to) {
  const next = JSON.parse(JSON.stringify(files));
  let count = 0;
  const swap = (obj, key) => { if (obj && obj[key] === from) { obj[key] = to; count++; } };
  for (const [path, f] of Object.entries(next)) {
    if (path.startsWith("music/")) {
      if (kind === "sfx" && f.format !== "tracker") for (const p of f.patterns || []) for (let c = 0; c < p.length; c++) if (p[c] === from) { p[c] = to; count++; }
      if (kind === "instruments" && Array.isArray(f.instruments)) f.instruments = f.instruments.map((n) => { if (n === from) { count++; return to; } return n; });
      if (kind === "instruments" && Array.isArray(f.track_instruments)) f.track_instruments = f.track_instruments.map((n) => { if (n === from) { count++; return to; } return n; });
    } else if (path.startsWith("sfx/") && kind === "instruments") {
      for (const st of f.steps || []) if (Array.isArray(st)) swap(st, 1);
      for (const t of f.tracks || []) swap(t, "instrument");
    } else if (path.startsWith("instruments/") && kind === "sounds") {
      swap(f, "sample");
    }
  }
  const changed = Object.keys(next).filter((p) => JSON.stringify(next[p]) !== JSON.stringify(files[p]));
  return { files: next, changed, count };
}

// How many times Lua code names this resource as a quoted string ("grub", "enemies.grub", "lib.state"). These are not changed.
export function countCodeMentions(luaTexts, kind, name) {
  const g = group(kind);
  const names = new Set([name]);
  if (g) names.add(refName(g, name));
  let n = 0;
  for (const text of luaTexts || []) {
    for (const nm of names) {
      const re = new RegExp(`(["'])${nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`, "g");
      n += (String(text).match(re) || []).length;
    }
  }
  return n;
}

// Rewrite the plain ways Lua code names a code resource after it is renamed or moved to another folder: its module name as a string
// anywhere ("entities.enemies.grub", require "lib.state"), and its short name where a call takes one: gs.spawn("enemies.grub"),
// gs.goto_scene("play"), gs.load_room("caves.deep"), the first item of an entry in a room's or layout's entity list ({ "enemies.grub", 10, 20 }),
// and a layout's `code = "level"`.
// files: { rel: text }. Returns { files: {rel: new text} (only those that changed), count }.
export function renameInCode(files, kind, from, to) {
  const g = group(kind);
  if (g && ASSET_CALLS[kind]) return renameAsset(files, kind, from, to);
  if (!g || g.kind !== "code") return { files: {}, count: 0 };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dotted = (n) => n.replace(/\//g, ".");
  const call = { entities: "gs\\.spawn", scenes: "gs\\.goto_scene", rooms: "gs\\.load_room" }[kind];
  // each pattern captures what comes before the name and the quote around it
  const patterns = [new RegExp(`()(["'])${esc(moduleName(g, from))}\\2`, "g")];
  if (call) patterns.push(new RegExp(`(\\b${call}\\s*\\(\\s*)(["'])${esc(dotted(from))}\\2`, "g"));
  const out = {};
  let count = 0;
  for (const [rel, text] of Object.entries(files)) {
    let t = String(text);
    const swap = (re, name) => { t = t.replace(re, (_, pre, q) => { count++; return pre + q + name + q; }); };
    swap(patterns[0], moduleName(g, to));
    if (patterns[1]) swap(patterns[1], dotted(to));
    if (kind === "entities" && (rel.startsWith("rooms/") || rel.endsWith(".layout.lua"))) swap(new RegExp(`(\\{\\s*)(["'])${esc(dotted(from))}\\2(?=\\s*,)`, "g"), dotted(to));
    // a layout that runs this scene's code names it
    if (kind === "scenes" && rel.endsWith(".layout.lua")) swap(new RegExp(`(\\bcode\\s*=\\s*)(["'])${esc(dotted(from))}\\2`, "g"), dotted(to));
    if (t !== text) out[rel] = t;
  }
  return { files: out, count };
}

// A scene's code after things in its layout were renamed ({ old: new }): every `self.old` becomes `self.new`. Strings and comments are
// left alone. Returns { text, count }.
export function renameSceneFields(text, renames) {
  const names = Object.keys(renames || {}).filter((k) => renames[k] && renames[k] !== k);
  if (!names.length) return { text, count: 0 };
  let out = "", count = 0, i = 0;
  const src = String(text);
  const re = new RegExp(`\\bself(\\s*\\.\\s*)(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "y");
  while (i < src.length) {
    const c = src[i];
    // skip what is not code: comments, long strings, quoted strings
    if (src.startsWith("--", i)) {
      const long = src.slice(i + 2).match(/^\[(=*)\[/);
      const end = long ? src.indexOf("]" + long[1] + "]", i) : src.indexOf("\n", i);
      const stop = end < 0 ? src.length : long ? end + long[1].length + 2 : end;
      out += src.slice(i, stop); i = stop; continue;
    }
    const ls = src.slice(i).match(/^\[(=*)\[/);
    if (ls) { const end = src.indexOf("]" + ls[1] + "]", i); const stop = end < 0 ? src.length : end + ls[1].length + 2; out += src.slice(i, stop); i = stop; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    re.lastIndex = i;
    const m = /\w/.test(src[i - 1] || "") ? null : re.exec(src);
    if (m) { out += "self" + m[1] + renames[m[2]]; i += m[0].length; count++; continue; }
    out += c; i++;
  }
  return { text: out, count };
}

// The renames worth applying when a layout is saved: chains collapsed (a -> b -> c is a -> c), and only where the new name is in the
// layout and the old one no longer is (an undone rename is not applied).
export function settleRenames(steps, namesNow) {
  const now = new Set(namesNow), out = {};
  for (const [from, to] of steps) {
    const origin = Object.keys(out).find((k) => out[k] === from); // a name given since the last save: follow it back to the one in the code
    out[origin ?? from] = to;
  }
  for (const k of Object.keys(out)) if (out[k] === k || !now.has(out[k]) || now.has(k)) delete out[k];
  return out;
}

// Where Lua code names art and sound (a sprite moved to a folder is renamed "ui/logo"): the string right after these.
const ASSET_CALLS = {
  sprites: ["\\bsprite\\s*=\\s*", "[:.]set_sprite\\s*\\(\\s*", "\\bgs\\.draw\\.sprite\\s*\\(\\s*", "\\bgs\\.assets\\.sprite\\s*\\(\\s*", "\\bfont\\s*=\\s*", "\\bgs\\.draw\\.font_(?:text|width)\\s*\\(\\s*"],
  tilesets: ["\\btileset\\s*=\\s*", "\\bgs\\.assets\\.tileset\\s*\\(\\s*"],
  sfx: ["\\bgs\\.sfx\\s*\\(\\s*"],
  music: ["\\bgs\\.music\\s*\\(\\s*"],
};

// What a layout or room names, as data: pictures and fonts are sprites, layers and panels use tilesets. Returns the new room or null.
function renameInRoom(room, kind, from, to) {
  let n = 0;
  const swap = (o, k) => { if (o && o[k] === from) { o[k] = to; n++; } };
  if (kind === "sprites") { for (const p of room.pictures) swap(p, "sprite"); for (const t of room.texts) swap(t, "font"); }
  if (kind === "tilesets") { for (const l of room.layers) swap(l, "tileset"); for (const p of room.panels) swap(p, "tileset"); }
  return n ? { room, n } : null;
}

// A sprite, tileset, sound effect or song renamed or moved: the plain places code names it (ASSET_CALLS), and layouts and rooms, read
// as data and written back (an entity and a sprite may share a name, so a layout is not searched as text). Sound files are renamed
// by renameReferences. Returns { files: {rel: new text}, count }.
function renameAsset(files, kind, from, to) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = ASSET_CALLS[kind].map((pre) => new RegExp(`(${pre})(["'])${esc(from)}\\2`, "g"));
  const out = {};
  let count = 0;
  for (const [rel, text] of Object.entries(files)) {
    if (/^rooms\//.test(rel) || /\.layout\.lua$/.test(rel)) {
      const parsed = parseRoom(text);
      if (parsed.room) {
        const r = renameInRoom(parsed.room, kind, from, to);
        if (r) { const first = /^-- (.*)/.exec(text); out[rel] = serializeRoom(r.room, first ? first[1] : undefined); count += r.n; }
        continue;
      }
    }
    let t = String(text);
    for (const re of patterns) t = t.replace(re, (_, pre, q) => { count++; return pre + q + to + q; });
    if (t !== text) out[rel] = t;
  }
  return { files: out, count };
}
