// Text tools for the code editor that need no language server: find and replace across the game's files, an outline of a Lua file's
// functions, and putting Lua indentation right (the formatter).

// ---------- find and replace in the game ----------
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A RegExp for a search, or null for an empty or broken one. opts: { caseSensitive, wholeWord, regex }
export function searchPattern(query, opts = {}) {
  if (!query) return null;
  let src = opts.regex ? query : escapeRe(query);
  if (opts.wholeWord) src = `\\b(?:${src})\\b`;
  try { return new RegExp(src, opts.caseSensitive ? "g" : "gi"); } catch { return null; }
}

// files: { rel: text } -> [{ rel, line (1-based), col (0-based), length, text (the whole line) }], at most `limit`.
export function findInFiles(files, query, opts = {}, limit = 2000) {
  const re = searchPattern(query, opts);
  if (!re) return [];
  const out = [];
  for (const rel of Object.keys(files).sort()) {
    const lines = files[rel].split("\n");
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(lines[i]))) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        out.push({ rel, line: i + 1, col: m.index, length: m[0].length, text: lines[i] });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

// Replace every match in one text; returns { text, count }. With regex on, $1 and the like work in the replacement.
// Like Find, it works a line at a time, so ^ and $ mean the start and end of a line.
export function replaceInText(text, query, replacement, opts = {}) {
  const re = searchPattern(query, opts);
  if (!re) return { text, count: 0 };
  let count = 0;
  const out = String(text).split("\n").map((line) => line.replace(re, (...a) => {
    if (a[0].length === 0) return a[0];
    count++;
    if (!opts.regex) return replacement;
    const groups = a.slice(1, -2); // $1 .. $n, then the offset and the whole string
    return replacement.replace(/\$(\d|&)/g, (m, k) => (k === "&" ? a[0] : groups[Number(k) - 1] ?? ""));
  })).join("\n");
  return { text: out, count };
}

// Language-server edits ({ range: { start: { line, character }, end }, newText }) applied to a text, last first so earlier positions hold.
export function applyEdits(text, edits) {
  const lines = String(text).split("\n");
  const offset = (p) => { let o = 0; for (let i = 0; i < p.line && i < lines.length; i++) o += lines[i].length + 1; return o + p.character; };
  const sorted = edits.map((e) => ({ from: offset(e.range.start), to: offset(e.range.end), text: e.newText })).sort((a, b) => b.from - a.from);
  let out = String(text);
  for (const e of sorted) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  return out;
}

// ---------- outline ----------
// The functions a Lua file defines, in order: { name, line (1-based), kind: "method" | "function" | "local" }.
export function outline(text) {
  const out = [];
  String(text).split("\n").forEach((l, i) => {
    let m = l.match(/^\s*function\s+([\w.]+):(\w+)\s*\(/);
    if (m) { out.push({ name: `${m[1]}:${m[2]}`, line: i + 1, kind: "method" }); return; }
    m = l.match(/^\s*function\s+([\w.]+)\s*\(/);
    if (m) { out.push({ name: m[1], line: i + 1, kind: "function" }); return; }
    m = l.match(/^\s*local\s+function\s+(\w+)\s*\(/);
    if (m) { out.push({ name: m[1], line: i + 1, kind: "local" }); return; }
    m = l.match(/^\s*(?:local\s+)?([\w.]+)\s*=\s*function\s*\(/);
    if (m) out.push({ name: m[1], line: i + 1, kind: m[1].includes(".") ? "function" : "local" });
  });
  return out;
}

// ---------- the formatter: indentation ----------
// The code of a line with strings and comments blanked out, and whether a long string or comment is still open at its end.
function codeOf(line, open) {
  let s = "", i = 0;
  if (open) {
    const end = line.indexOf(open);
    if (end < 0) return { code: "", open };
    i = end + open.length;
  }
  while (i < line.length) {
    const c = line[i];
    if (line.startsWith("--", i)) {
      const long = line.slice(i + 2).match(/^\[(=*)\[/);
      if (!long) break;
      const close = "]" + long[1] + "]", end = line.indexOf(close, i + 4 + long[1].length);
      if (end < 0) return { code: s, open: close };
      i = end + close.length; continue;
    }
    const ls = line.slice(i).match(/^\[(=*)\[/);
    if (ls) {
      const close = "]" + ls[1] + "]", end = line.indexOf(close, i + 2 + ls[1].length);
      s += '""';
      if (end < 0) return { code: s, open: close };
      i = end + close.length; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== c) j += line[j] === "\\" ? 2 : 1;
      s += '""'; i = j + 1; continue;
    }
    s += c; i++;
  }
  return { code: s, open: null };
}

// The block words and brackets of a line's code, in order.
const tokens = (code) => code.match(/\b(?:function|do|then|repeat|end|until|else|elseif)\b|[{}()\[\]]/g) || [];
const OPENS = new Set(["function", "do", "then", "repeat", "{", "(", "["]);
const CLOSES = new Set(["end", "until", "}", ")", "]"]);

// Every line indented by its depth (`unit` per level, two spaces by default). Each line adds at most one level however many blocks it
// opens (`gs.go(function()` indents its body once, and `end)` comes back once). Lines inside long strings stay as they are; blank lines
// stay blank. Returns the new text.
export function reindent(text, unit = "  ") {
  const out = [];
  const stack = []; // one entry per open block or bracket: { level: did it add a level, line: the line that opened it }
  let open = null, continued = false, indent = 0;
  const levels = (st) => st.reduce((n, e) => n + (e.level ? 1 : 0), 0);
  String(text).split("\n").forEach((raw, ln) => {
    const inLong = !!open;
    const line = inLong ? raw : raw.trim();
    const r = codeOf(line, open);
    const toks = tokens(r.code);
    if (inLong) out.push(raw);
    else if (!line) out.push("");
    else {
      // closers (and else / elseif) at the start of a line come back before the line itself
      // a line that starts by closing blocks goes back to where the line that opened the first of them was: `end },` lines up with
      // the `desc = function()` it ends, not with the table the function sat in
      let rest = r.code.trim(), m, back = null, k = stack.length;
      while (k > 0 && (m = rest.match(/^(?:(?:end|until|else|elseif)\b|[}\)\]])\s*/))) { const e = stack[--k]; back ||= e; rest = rest.slice(m[0].length); }
      // a statement that goes on from the line before (it ended with an operator, a comma or `=`) keeps one extra level
      indent = back ? back.at : levels(stack) + (continued ? 1 : 0);
      out.push(unit.repeat(indent) + line);
    }
    let skipThen = false;
    // A block opened on a line that finishes brackets from earlier lines (`  "y" }) do` after `for _, f in ipairs({ "x",`) belongs to
    // the statement those brackets started: its `end` goes back to that statement's indent, not to this continuation line's.
    let at = indent;
    for (const t of toks) {
      if (t === "elseif" || t === "else") { const e = stack.pop(); stack.push(e || { level: true, line: ln, at: indent }); skipThen = t === "elseif"; continue; }
      if (t === "then" && skipThen) { skipThen = false; continue; }
      if (OPENS.has(t)) stack.push({ level: !stack.some((e) => e.line === ln && e.level), line: ln, bracket: "{([".includes(t), at });
      else if (CLOSES.has(t)) { const e = stack.pop(); if (e && e.line < ln && e.at < at) at = e.at; }
    }
    const code = r.code.trim();
    const top = stack[stack.length - 1];
    // inside a table or a call a trailing comma just separates items
    continued = !inLong && !!code && /(?:[=,+\-*\/%^<>~]|(?<!\.)\.\.|\band|\bor|\bnot)$/.test(code) && !(top && (top.line === ln || top.bracket));
    open = r.open;
  });
  return out.join("\n");
}

// ---------- the formatter: comments that fit a column ----------
export const COMMENT_WIDTH = 100;

// Comment lines longer than `width` are broken between words. What runs over goes in front of the next comment line when that line
// carries on the same sentence (same indent, starts in lower case), so a paragraph stays a paragraph; otherwise it gets a line of its own.
// Earlier line breaks are kept, so lists and short lines stay as they were. Only whole-line `-- ` comments change: code with a comment
// after it, `---` annotations, indented comment text (examples, tables) and long strings or `--[[ ]]` comments stay as they are.
export function wrapComments(text, width = COMMENT_WIDTH) {
  const lines = String(text).split("\n"), out = [];
  let open = null, carry = null; // carry: { indent, words } still to be placed
  const plain = (line) => line.match(/^(\s*)-- (\S.*)$/);
  const flush = () => { if (carry) { emit(carry.indent, carry.words); carry = null; } };
  const emit = (indent, words) => {
    let cur = "";
    for (const w of words) {
      if (cur && (indent + "-- " + cur + " " + w).length > width) { out.push(indent + "-- " + cur); cur = w; } else cur = cur ? cur + " " + w : w;
    }
    if (cur) out.push(indent + "-- " + cur);
  };
  for (const line of lines) {
    const inLong = !!open;
    open = codeOf(line, open).open;
    const m = !inLong && !line.trimStart().startsWith("---") && !line.trimStart().startsWith("--[") ? plain(line) : null;
    if (!m) { flush(); out.push(line); continue; }
    const [, indent, body] = m;
    let words = body.split(" ");
    if (carry && carry.indent === indent && /^[a-z(]/.test(body)) { words = carry.words.concat(words); carry = null; } else flush();
    if ((indent + "-- " + words.join(" ")).length <= width) { out.push(indent + "-- " + words.join(" ")); continue; }
    // fill this line, keep the rest for the next one
    let cur = words[0], k = 1;
    while (k < words.length && (indent + "-- " + cur + " " + words[k]).length <= width) cur += " " + words[k++];
    out.push(indent + "-- " + cur);
    carry = k < words.length ? { indent, words: words.slice(k) } : null;
  }
  flush();
  return out.join("\n");
}

// The Tidy button: indentation first, then comments wrapped to the column.
export const tidyLua = (text, width = COMMENT_WIDTH) => wrapComments(reindent(text), width);
