// What the editor knows about the game's Lua, without a language server: the GameStudio API (read from engine/api/gs.d.lua), the project's
// own files (entities, scenes, sprites, sounds, tags) and a few lint rules that only make sense for a handheld game. Pure: text in, answers out.
// The Lua language server (see lsp-*) adds general Lua intelligence on top; this layer keeps working when it is not running.
import { refName, moduleName, group } from "./project-core.js";

// ---------------------------------------------------------------- the API file
// Reads the annotation file: "---" lines above a declaration are its help text, ---@param / ---@return / ---@field add detail.
export function parseApi(text) {
  const symbols = new Map(), members = new Map();
  const add = (sym) => { symbols.set(sym.path, sym); if (!members.has(sym.owner)) members.set(sym.owner, []); members.get(sym.owner).push(sym); };
  let doc = [], params = [], returns = [], cls = null, type = null;
  const reset = () => { doc = []; params = []; returns = []; type = null; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    let m;
    if (line.startsWith("---@param ")) { m = /^---@param\s+(\.\.\.|[\w]+)(\??)\s+(\S+)\s*(.*)$/.exec(line); if (m) params.push({ name: m[1], optional: !!m[2], type: m[3], desc: m[4] }); continue; }
    if (line.startsWith("---@return ")) { returns.push(line.slice(11)); continue; }
    if (line.startsWith("---@type ")) { type = line.slice(9).split(/\s+/)[0]; continue; }
    if ((m = /^---@class\s+(\w+)/.exec(line))) { cls = m[1]; reset(); continue; }
    if ((m = /^---@field\s+(\w+)\s+(.*)$/.exec(line))) {
      const d = m[2].match(/^(fun\(.*?\)(?::\s*\S+)?|\S+)\s*(.*)$/);
      add({ path: `${cls}.${m[1]}`, owner: cls, name: m[1], kind: d[1].startsWith("fun(") ? "method" : "field", type: d[1], sig: `${cls === "Entity" || cls === "Scene" ? "self" : cls}.${m[1]}`, doc: d[2], params: [], returns: [] });
      continue;
    }
    if (line.startsWith("---@")) continue; // alias, overload, meta...
    if (line.startsWith("---")) { doc.push(line.replace(/^---\s?/, "")); continue; }
    if ((m = /^function\s+([\w.]+)([.:])(\w+)\s*\(([^)]*)\)/.exec(line))) {
      const owner = m[1], sep = m[2], name = m[3], args = m[4].trim();
      const pdocs = params.map((p) => p.name);
      const sigArgs = args || pdocs.join(", ");
      const trueOwner = owner;
      add({ path: `${trueOwner}.${name}`, owner: trueOwner, name, kind: sep === ":" ? "method" : "function", sig: `${trueOwner}${sep}${name}(${sigArgs})`, doc: doc.join(" ").trim(), params, returns });
      reset(); continue;
    }
    if ((m = /^function\s+(\w+)\s*\(([^)]*)\)/.exec(line))) { reset(); continue; }
    if ((m = /^([\w.]+)\.(\w+)\s*=\s*(.*)$/.exec(line))) {
      const owner = m[1], name = m[2];
      const isNs = m[3].trim() === "{}" && !type && !doc.length;
      add({ path: `${owner}.${name}`, owner, name, kind: isNs ? "namespace" : "field", type: type || "table", sig: `${owner}.${name}`, doc: doc.join(" ").trim(), params: [], returns: [] });
      reset(); continue;
    }
    if (line === "") { /* a blank line ends nothing: docs stay attached to the next declaration */ }
    if (/^\w+\s*=\s*\{\}$/.test(line)) { reset(); }
  }
  return { symbols, members };
}

export const ENTITY_HOOKS = [
  { name: "create", args: "", doc: "Called once when the entity is made, after its starting values are set." },
  { name: "update", args: "dt", doc: "Called every step (60 times a second); dt is the time since the last step in seconds." },
  { name: "draw", args: "", doc: "Draw something yourself. Call self:draw_sprite() inside to also draw the sprite." },
  { name: "on_destroy", args: "", doc: "Called when the entity is removed." },
  { name: "on_animation_end", args: "name", doc: "Called when a clip that does not loop reaches its last frame." },
];
export const SCENE_HOOKS = [
  { name: "enter", args: "...", doc: "Called when the scene starts; it gets the extra arguments of gs.goto_scene." },
  { name: "update", args: "dt", doc: "Called every step." },
  { name: "draw", args: "", doc: "Draws after the world, in world space." },
  { name: "draw_ui", args: "", doc: "Draws on top of everything, in screen space (score, menus)." },
  { name: "leave", args: "", doc: "Called when another scene takes over." },
];

// ---------------------------------------------------------------- the project
// What the editor knows about the game's files. names: group key -> [names] (from scanProject); texts: { "entities/a.lua": "..." }.
export function buildIndex(names, texts) {
  const tags = new Set(), fields = {};
  for (const [file, text] of Object.entries(texts || {})) {
    for (const m of text.matchAll(/\btags\s*=\s*\{([^}]*)\}/g)) for (const t of m[1].matchAll(/["']([^"']+)["']/g)) tags.add(t[1]);
    if (/^(entities|scenes)\//.test(file)) fields[file] = selfFields(text);
  }
  const modules = new Set();
  for (const key of ["entities", "scenes", "rooms", "lib"]) for (const n of names[key] || []) modules.add(moduleName(group(key), n));
  return { names: names || {}, tags, fields, modules };
}

// Fields a file's entity has: the starting values in gs.entity{ ... } and every self.name = ... in its methods.
export function selfFields(text) {
  const out = new Set();
  const spec = /gs\.(?:entity|scene)\s*(?:\(\s*[\w.]+\s*,\s*)?\{/.exec(text);
  if (spec) {
    let depth = 1, i = spec.index + spec[0].length, key = "", start = i;
    for (; i < text.length && depth > 0; i++) {
      const c = text[i];
      if (c === "{" || c === "(") depth++; else if (c === "}" || c === ")") depth--;
    }
    const body = text.slice(start, i - 1);
    // only the top level of the table: names followed by "=" at depth 0
    let d = 0, buf = "";
    for (const c of body) {
      if (c === "{" || c === "(") d++; else if (c === "}" || c === ")") d--;
      if (d === 0) buf += c; else if (c === "{") buf += "{"; else if (c === "}") buf += "}";
    }
    for (const m of buf.matchAll(/(?:^|[,{\n])\s*([A-Za-z_]\w*)\s*=/g)) out.add(m[1]);
  }
  for (const m of text.matchAll(/\bself\.([A-Za-z_]\w*)\s*(?:,\s*self\.[A-Za-z_]\w*\s*)*=[^=]/g)) out.add(m[1]);
  for (const m of text.matchAll(/\bself\.([A-Za-z_]\w*)\s*,/g)) out.add(m[1]);
  out.delete("tags"); out.delete("hitbox");
  return [...out].sort();
}

// ---------------------------------------------------------------- asset arguments
// Calls whose first argument is the name of something in the project. `kind` is a group key; "tag" and "module" are special.
export const ASSET_CALLS = [
  { re: /\bgs\.spawn\s*\(\s*$/, kind: "entities" },
  { re: /\bgs\.sfx\s*\(\s*$/, kind: "sfx" },
  { re: /\bgs\.music\s*\(\s*$/, kind: "music" },
  { re: /\bgs\.goto_scene\s*\(\s*$/, kind: "scenes", asModule: true },
  { re: /\bgs\.load_room\s*\(\s*$/, kind: "rooms" },
  { re: /\bgs\.draw\.sprite\s*\(\s*$/, kind: "sprites" },
  { re: /\bgs\.assets\.sprite\s*\(\s*$/, kind: "sprites" },
  { re: /\bgs\.assets\.tileset\s*\(\s*$/, kind: "tilesets" },
  { re: /[:.]set_sprite\s*\(\s*$/, kind: "sprites" },
  { re: /\bgs\.(?:first|count|each|all)\s*\(\s*$/, kind: "tag" },
  { re: /\bgs\.(?:nearest|in_radius|in_rect)\s*\((?:[^,()]*,){2,3}\s*$/, kind: "tag" },
  { re: /[:.]touching(?:_all)?\s*\(\s*$/, kind: "tag" },
  { re: /\brequire\s*\(?\s*$/, kind: "module" },
  { re: /\bsprite\s*=\s*$/, kind: "sprites" },
  { re: /\btileset\s*=\s*$/, kind: "tilesets" },
  { re: /\btags\s*=\s*\{(?:[^}"']|"[^"]*"|'[^']*')*$/, kind: "tag" },
];

// The names of one kind, as Lua code writes them.
export function namesFor(kind, call, index) {
  if (kind === "tag") return [...index.tags].sort();
  if (kind === "module") return [...index.modules].sort();
  const g = group(kind);
  if (!g) return [];
  return (index.names[kind] || []).map((n) => (call && call.asModule ? moduleName(g, n) : kind === "sprites" || kind === "tilesets" || kind === "sfx" || kind === "music" ? n : refName(g, n))).sort();
}

// Edit distance for "did you mean".
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function closest(name, options) {
  let best = null, bestD = Infinity;
  for (const o of options) { const d = distance(name.toLowerCase(), o.toLowerCase()); if (d < bestD) { best = o; bestD = d; } }
  return best !== null && bestD <= Math.max(2, Math.floor(name.length / 3)) ? best : null;
}

// ---------------------------------------------------------------- where is the cursor
// `before` is the text of the line up to the cursor. Returns what kind of thing is being typed:
//   { type: "asset", call, kind, from, prefix, quote }  inside a string that names something
//   { type: "member", chain, sep, from, prefix }        after gs. or self: or entity.
//   { type: "hook", cls, from, prefix }                 after "function Name:" at the start of a line
export function contextAt(before) {
  // a string still open at the cursor?
  let quote = null, qpos = -1;
  for (let i = 0; i < before.length; i++) {
    const c = before[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; }
    else if (c === '"' || c === "'") { quote = c; qpos = i; }
    else if (c === "-" && before[i + 1] === "-") return null; // a comment
  }
  if (quote) {
    const head = before.slice(0, qpos);
    for (const call of ASSET_CALLS) if (call.re.test(head)) return { type: "asset", call, kind: call.kind, from: qpos + 1, prefix: before.slice(qpos + 1), quote };
    // the second or later string in tags = { "a", "b
    return null;
  }
  let m = /^\s*function\s+([A-Z]\w*):(\w*)$/.exec(before);
  if (m) return { type: "hook", cls: m[1], from: before.length - m[2].length, prefix: m[2] };
  m = /([A-Za-z_][\w]*(?:[.:][A-Za-z_]\w*)*)([.:])(\w*)$/.exec(before);
  if (m) return { type: "member", chain: m[1], sep: m[2], from: before.length - m[3].length, prefix: m[3] };
  return null;
}

// What a name in code is, as far as we can tell from the text above it: an Entity (spawned, found, or a parameter of a collision handler), or nothing.
export function variableKind(name, textBefore, file) {
  if (name === "self") return /^scenes\//.test(file || "") ? "Scene" : "Entity";
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\blocal\\s+${esc}\\s*=\\s*gs\\.(?:spawn|first|nearest)\\s*\\(`).test(textBefore)) return "Entity";
  if (new RegExp(`\\blocal\\s+${esc}\\s*=\\s*self:touching\\s*\\(`).test(textBefore)) return "Entity";
  if (new RegExp(`function\\s+\\w+:on_collide_\\w+\\s*\\([^)]*\\b${esc}\\b`).test(textBefore)) return "Entity";
  if (new RegExp(`gs\\.each\\s*\\([^,]+,\\s*function\\s*\\(\\s*${esc}\\b`).test(textBefore)) return "Entity";
  if (new RegExp(`for\\s+(?:\\w+\\s*,\\s*)?${esc}\\s+in\\s+(?:ipairs|pairs)\\s*\\(\\s*(?:gs\\.(?:all|in_radius|in_rect)|\\w+:touching_all)`).test(textBefore)) return "Entity";
  return null;
}

// ---------------------------------------------------------------- completion
const typeOf = (s) => (s.kind === "function" || s.kind === "method" ? "function" : s.kind === "namespace" ? "namespace" : "property");
const detailOf = (s) => (s.kind === "function" || s.kind === "method" ? `(${s.sig.slice(s.sig.indexOf("(") + 1, -1)})` : s.type || "");
function apiItem(s) { return { label: s.name, type: typeOf(s), detail: detailOf(s), info: s.doc || "", sym: s }; }

// Completion items for a context. api from parseApi, index from buildIndex, text = the whole file (to find variables and fields), file = its path.
export function complete(ctx, api, index, text, file, pos) {
  if (!ctx) return [];
  const starts = (label) => label.toLowerCase().startsWith((ctx.prefix || "").toLowerCase());
  if (ctx.type === "asset") {
    const names = namesFor(ctx.kind, ctx.call, index);
    const label = ctx.kind === "tag" ? "tag" : ctx.kind === "module" ? "file" : group(ctx.kind).single;
    return names.filter(starts).map((n) => ({ label: n, type: "constant", detail: label }));
  }
  if (ctx.type === "hook") {
    const hooks = ctx.cls && /^[A-Z]/.test(ctx.cls) ? (/^scenes\//.test(file || "") ? SCENE_HOOKS : ENTITY_HOOKS) : [];
    const out = hooks.filter((h) => starts(h.name)).map((h) => ({ label: h.name, type: "function", detail: `(${h.args})`, info: h.doc }));
    if (!/^scenes\//.test(file || "")) for (const t of [...index.tags].sort()) if (starts(`on_collide_${t}`)) out.push({ label: `on_collide_${t}`, type: "function", detail: "(other)", info: `Called every step this entity overlaps an entity tagged '${t}'.` });
    return out;
  }
  // member access
  const chain = ctx.chain;
  const before = text.slice(0, pos);
  let owner = null;
  if (chain === "gs" || api.symbols.get(chain)?.kind === "namespace") owner = chain;
  else if (!chain.includes(".") && !chain.includes(":")) {
    const kind = variableKind(chain, before, file);
    if (kind) owner = kind;
  }
  if (!owner) return [];
  let items = (api.members.get(owner) || []).filter((s) => starts(s.name)).map(apiItem);
  if (owner === "Entity" || owner === "Scene") {
    const mine = (index.fields[file] || []);
    const known = new Set(items.map((i) => i.label));
    const own = (text ? selfFields(text) : mine);
    for (const f of own) if (!known.has(f) && starts(f)) items.push({ label: f, type: "property", detail: "this entity's value" });
    if (owner === "Entity" && ctx.sep === ":") items = items.filter((i) => i.type === "function");
  }
  return items;
}

// ---------------------------------------------------------------- hover
// Help for the word under the cursor: an API function (signature and text) or the name of a file in the project.
export function hoverAt(line, col, api, index, file, textBefore) {
  // a string that names something?
  const quoted = findStringAt(line, col);
  if (quoted) {
    const head = line.slice(0, quoted.from - 1);
    for (const call of ASSET_CALLS) {
      if (!call.re.test(head)) continue;
      if (call.kind === "tag") return { kind: "tag", name: quoted.text, exists: index.tags.has(quoted.text), from: quoted.from, to: quoted.to };
      const exists = namesFor(call.kind, call, index).includes(quoted.text);
      return { kind: call.kind, name: quoted.text, exists, from: quoted.from, to: quoted.to, target: assetTarget(call, quoted.text, index) };
    }
    return null;
  }
  const m = wordAt(line, col);
  if (!m) return null;
  let chain = m.text.replace(/:/g, ".");
  let sym = api.symbols.get(chain);
  if (!sym) {
    const parts = m.text.split(/[.:]/);
    if (parts.length >= 2) {
      const kind = variableKind(parts[0], textBefore || "", file);
      if (kind) sym = api.symbols.get(`${kind}.${parts[1]}`);
    }
  }
  return sym && sym.kind !== "namespace" ? { kind: "api", sym, from: m.from, to: m.to } : null;
}

// where an asset name leads: { group, name } for entities, scenes, rooms, lib modules and art/sound; null for tags
export function assetTarget(call, text, index) {
  if (call.kind === "module") {
    const [dir, ...rest] = text.split(".");
    return dir && rest.length ? { group: dir, name: rest.join("/") } : null;
  }
  if (call.kind === "tag" || !group(call.kind)) return null;
  if (call.asModule) return { group: call.kind, name: text.replace(/^[a-z]+\./, "").replace(/\./g, "/") };
  return { group: call.kind, name: group(call.kind).nested ? text.replace(/\./g, "/") : text };
}

function findStringAt(line, col) {
  let quote = null, start = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) { if (col >= start && col <= i) return { from: start + 1, to: i, text: line.slice(start + 1, i) }; quote = null; }
    } else if (c === '"' || c === "'") { quote = c; start = i; }
  }
  return null;
}
function wordAt(line, col) {
  const isW = (c) => /[\w.:]/.test(c || "");
  let a = col, b = col;
  while (a > 0 && isW(line[a - 1])) a--;
  while (b < line.length && isW(line[b])) b++;
  const text = line.slice(a, b).replace(/^[.:]+|[.:]+$/g, "");
  if (!text) return null;
  // hovering the "gs" in "gs.draw.rect" means the whole chain up to the word under the cursor
  let end = a + line.slice(a, b).length, upto = col;
  const seg = /[\w]/.test(line[col] || "") ? col : col - 1;
  let e = seg; while (e < line.length && /\w/.test(line[e])) e++;
  const chainText = line.slice(a, e).replace(/^[.:]+/, "");
  return { text: chainText, from: a, to: e };
}

// ---------------------------------------------------------------- lint
// Warnings for the file at `file`. Each: { from, to, severity: "error"|"warning"|"info", message } with offsets into `text`.
export function diagnose(text, file, index) {
  const out = [];
  const lines = text.split("\n");
  let offset = 0;
  let inHot = null; // inside update or draw: name and the line where it started
  const isEntity = /^entities\//.test(file), isScene = /^scenes\//.test(file);
  const isGameCode = /^(entities|scenes|lib|rooms)\//.test(file) || file === "game.lua";

  const checkName = (kind, call, nm, from, label) => {
    const names = namesFor(kind, call, index);
    if (names.includes(nm) || nm === "") return;
    if (kind === "module" && !/^(entities|scenes|lib|rooms)\./.test(nm)) return; // built-in or library modules are not ours to judge
    if (kind === "tag" && index.tags.size === 0) return;
    const guess = closest(nm, names);
    const what = kind === "tag" ? "tag" : kind === "module" ? "file" : group(kind).single;
    out.push({ from, to: from + nm.length, severity: kind === "tag" ? "warning" : "error",
      message: kind === "tag" ? `No entity has the tag '${nm}'.${guess ? ` Did you mean '${guess}'?` : ""} Tags are set in an entity's tags = { ... }.`
        : `There is no ${what} called '${nm}'.${guess ? ` Did you mean '${guess}'?` : ""}` });
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const code = stripComment(line);
    const hot = /^function\s+[\w.]+:(update|draw|draw_ui)\s*\(/.exec(line);
    if (hot) inHot = hot[1]; else if (/^end\b/.test(line)) inHot = null;
    // strings in calls that name things
    for (const m of code.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)) {
      const head = code.slice(0, m.index);
      for (const call of ASSET_CALLS) {
        if (!call.re.test(head)) continue;
        if ((call.kind === "sprites" && /\bsprite\s*=\s*$/.test(head) && !(isEntity || isScene || /\{/.test(head))) ) break;
        checkName(call.kind, call, m[2], offset + m.index + 1);
        break;
      }
    }
    // tags in collision handlers
    const col = /^function\s+[\w.]+:on_collide_(\w+)\s*\(/.exec(line);
    if (col && index.tags.size && !index.tags.has(col[1])) {
      const from = offset + line.indexOf("on_collide_") + "on_collide_".length;
      const guess = closest(col[1], [...index.tags]);
      out.push({ from, to: from + col[1].length, severity: "warning", message: `No entity has the tag '${col[1]}', so this will never run.${guess ? ` Did you mean '${guess}'?` : ""}` });
    }
    // a new table every step
    if (inHot && /(?:=|\(|,|return)\s*\{/.test(code) && !/^\s*function/.test(code)) {
      const from = offset + code.search(/\{/);
      out.push({ from, to: from + 1, severity: "info", message: `A new table every step in ${inHot}() gives the garbage collector work, which can cause small hitches on the handheld. Make it once (in create or enter) and reuse it.` });
    }
    offset += line.length + 1;
  }

  // an entity or scene file must end with `return <class>`
  if (isEntity || isScene) {
    const last = lines.map((l) => stripComment(l).trim()).filter(Boolean).pop() || "";
    if (/gs\.(entity|scene)\b/.test(text) && !/^return\b/.test(last)) {
      out.push({ from: 0, to: Math.min(text.length, (lines[0] || "").length || 1), severity: "error", message: `This file must end with 'return <the ${isEntity ? "entity" : "scene"}>' so the game can find it.` });
    }
  }
  return out;
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === "-" && line[i + 1] === "-") return line.slice(0, i) + " ".repeat(line.length - i);
  }
  return line;
}
