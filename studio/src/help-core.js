// The help pages are HTML fragments in docs/help/ with a comment header:
//   <!--
//   title: Your first game
//   group: Tutorials
//   order: 10
//   summary: One line for the list.
//   -->
// Tutorials hold their game's files as <pre class="lua" data-path="entities/player.lua"><code>...</code></pre>. This reads pages and pulls those files out,
// so the studio can offer "Make this game" and the tests can play every tutorial.

export function decodeEntities(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

export function parsePage(text, id) {
  const m = /^\s*<!--([\s\S]*?)-->/.exec(text);
  const meta = {};
  if (m) for (const line of m[1].split("\n")) { const kv = /^\s*(\w+):\s*(.*?)\s*$/.exec(line); if (kv) meta[kv[1]] = kv[2]; }
  return { id, title: meta.title || id, group: meta.group || "Guides", order: Number(meta.order ?? 100), summary: meta.summary || "", body: m ? text.slice(m[0].length).trim() : text.trim() };
}

// The files of the page's game, { path: text }, or null when the page has none. A game.lua is added if the page does not give one.
export function gameFiles(page) {
  const files = {};
  for (const m of page.body.matchAll(/<pre class="lua" data-path="([^"]+)"><code>([\s\S]*?)<\/code><\/pre>/g)) files[m[1]] = decodeEntities(m[2]) + "\n";
  if (!Object.keys(files).length) return null;
  if (!files["game.lua"]) files["game.lua"] = `return gs.game{ title = ${JSON.stringify(page.title)}, console = "glow43", start = "scenes.main" }\n`;
  return files;
}

// Pages sorted for the contents list: [{ group, pages: [...] }] in the order the groups first appear.
export function contents(pages) {
  const sorted = [...pages].sort((a, b) => a.order - b.order);
  const groups = [];
  for (const p of sorted) {
    let g = groups.find((x) => x.group === p.group);
    if (!g) { g = { group: p.group, pages: [] }; groups.push(g); }
    g.pages.push(p);
  }
  return groups;
}

// Which pages mention every word of a search (title, summary and text), best first.
export function search(pages, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored = [];
  for (const p of pages) {
    const plain = p.body.replace(/<[^>]+>/g, " ").toLowerCase();
    const head = `${p.title} ${p.summary}`.toLowerCase();
    if (!words.every((w) => plain.includes(w) || head.includes(w))) continue;
    scored.push({ page: p, score: words.reduce((n, w) => n + (head.includes(w) ? 5 : 0) + Math.min(5, plain.split(w).length - 1), 0) });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.page);
}

// ---------------------------------------------------------------- pieces the viewer builds
export const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const KEYWORDS = new Set(["and", "break", "do", "else", "elseif", "end", "for", "function", "goto", "if", "in", "local", "not", "or", "repeat", "return", "then", "until", "while"]);
const LITERALS = new Set(["true", "false", "nil"]);
// Colours Lua code for the help pages: HTML in, escaped, with spans (c comment, s string, n number, k keyword, l literal, g the gs name).
export function highlightLua(code) {
  let out = "", i = 0;
  const span = (cls, text) => `<span class="tk-${cls}">${escapeHtml(text)}</span>`;
  while (i < code.length) {
    const c = code[i], rest = code.slice(i);
    let m;
    if (rest.startsWith("--")) { const e = code.indexOf("\n", i); const end = e === -1 ? code.length : e; out += span("c", code.slice(i, end)); i = end; }
    else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== c && code[j] !== "\n") { if (code[j] === "\\") j++; j++; }
      out += span("s", code.slice(i, Math.min(j + 1, code.length))); i = Math.min(j + 1, code.length);
    } else if ((m = /^\d+(\.\d+)?/.exec(rest))) { out += span("n", m[0]); i += m[0].length; }
    else if ((m = /^[A-Za-z_]\w*/.exec(rest))) {
      const w = m[0];
      out += KEYWORDS.has(w) ? span("k", w) : LITERALS.has(w) ? span("l", w) : w === "gs" ? span("g", w) : escapeHtml(w);
      i += w.length;
    } else { out += escapeHtml(c); i++; }
  }
  return out;
}

// The API reference page, made from the annotations the editor reads (parseApi in lua-intel-core.js), so the help and the hover text never disagree.
const API_GROUPS = [
  ["gs", "The game, entities and scenes"], ["gs.camera", "The camera"], ["gs.input", "Buttons"], ["gs.draw", "Drawing"], ["gs.ui", "Interface"],
  ["gs.save", "Saving"], ["gs.assets", "Assets"], ["gs.world", "The world"], ["Entity", "Every entity (methods and values)"], ["Scene", "Scenes"],
];
export function apiPageHtml(api) {
  let html = '<h1>API reference</h1><p>Everything the engine gives you. This page is made from the same notes the code editor uses for hover help and completion. In code, <code>gs</code> is always available.</p>';
  html += "<p>" + API_GROUPS.map(([owner, title]) => `<a href="#api-${owner}">${escapeHtml(title)}</a>`).join(" &middot; ") + "</p>";
  for (const [owner, title] of API_GROUPS) {
    const members = (api.members.get(owner) || []).filter((s) => s.kind !== "namespace");
    if (!members.length) continue;
    html += `<h2 id="api-${owner}">${escapeHtml(title)}</h2>`;
    for (const s of members) {
      const isFn = s.kind === "function" || s.kind === "method";
      html += `<div class="api-item" id="api-${escapeHtml(s.path)}"><div class="api-sig"><code>${escapeHtml(isFn ? s.sig : s.sig + (s.type ? ": " + s.type : ""))}</code></div>`;
      if (s.doc) html += `<p>${escapeHtml(s.doc)}</p>`;
      const ps = (s.params || []).filter((p) => p.desc || p.type);
      if (ps.length) html += "<ul>" + ps.map((p) => `<li><code>${escapeHtml(p.name)}${p.optional ? "?" : ""}</code> <em>${escapeHtml(p.type)}</em>${p.desc ? " — " + escapeHtml(p.desc) : ""}</li>`).join("") + "</ul>";
      if ((s.returns || []).length) html += `<p class="api-ret">Returns ${s.returns.map((r) => escapeHtml(r)).join(", ")}</p>`;
      html += "</div>";
    }
  }
  return html;
}
