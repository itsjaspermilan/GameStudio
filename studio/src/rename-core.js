// Renaming a resource means renaming every reference to it too. Sound files point at each other by name (songs name instruments, sound effects
// name instruments, an instrument names a sample), so those are rewritten. Lua code names things in strings, which can't all be rewritten
// safely: the plain ways (module names, gs.spawn / gs.goto_scene / gs.load_room, a room's entity list) are rewritten by renameInCode, and
// what is left is counted and reported.
//
// files: { "music/song.json": {...}, "sfx/boop.json": {...}, "instruments/lead.json": {...} }     kind: a group key from project-core.js
import { refName, moduleName, group } from "./project-core.js";

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
// gs.goto_scene("play"), gs.load_room("caves.deep"), and the first item of an entry in a room's entity list ({ "enemies.grub", 10, 20 }).
// files: { rel: text }. Returns { files: {rel: new text} (only those that changed), count }.
export function renameInCode(files, kind, from, to) {
  const g = group(kind);
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
    if (kind === "entities" && rel.startsWith("rooms/")) swap(new RegExp(`(\\{\\s*)(["'])${esc(dotted(from))}\\2(?=\\s*,)`, "g"), dotted(to));
    if (t !== text) out[rel] = t;
  }
  return { files: out, count };
}
