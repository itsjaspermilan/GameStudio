// Renaming a resource means renaming every reference to it too. Sound files point at each other by name (songs name instruments, sound effects
// name instruments, an instrument names a sample), so those are rewritten. Lua code names things in strings, which can't be rewritten safely:
// those are counted and reported instead.
//
// files: { "music/song.json": {...}, "sfx/boop.json": {...}, "instruments/lead.json": {...} }     kind: a group key from project-core.js
import { refName, group } from "./project-core.js";

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
