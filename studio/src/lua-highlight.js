// Lua for the code editor, coloured by what each word is: keywords; the name of a function being defined; calls; fields after . or :;
// self; gs and the standard library; class names (Capitalised, like Player); true, false and nil; numbers, strings and comments (---@ lines
// as annotations). The colours are CSS variables (--hl-*) in style.css, so light and dark mode and both systems' looks share one style.
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const CONTROL = new Set(["if", "then", "else", "elseif", "end", "for", "while", "do", "repeat", "until", "return", "break", "goto", "in"]);
const DECLARE = new Set(["function", "local"]);
const WORDS = new Set(["and", "or", "not"]);
const ATOMS = new Set(["true", "false", "nil"]);
const STANDARD = new Set(["print", "require", "pairs", "ipairs", "next", "select", "type", "tostring", "tonumber", "setmetatable", "getmetatable", "rawget",
  "rawset", "rawequal", "rawlen", "error", "assert", "pcall", "xpcall", "unpack", "load", "math", "string", "table", "coroutine", "os", "io", "utf8", "debug", "_G"]);

// after `function`: the words up to the "(" name what is defined (Player:update), the last one is the function
const parser = {
  name: "lua",
  startState: () => ({ long: null, longKind: null, defining: false, afterDot: false }),
  token(stream, s) {
    if (s.long) { // inside a long string or comment: [[ ... ]] or [==[ ... ]==]
      const at = stream.string.indexOf(s.long, stream.pos);
      if (at < 0) stream.skipToEnd(); else { stream.pos = at + s.long.length; s.long = null; }
      return s.longKind;
    }
    if (stream.eatSpace()) return null;
    if (stream.match("--")) {
      const long = stream.match(/^\[(=*)\[/);
      if (long) { s.long = "]" + long[1] + "]"; s.longKind = "comment"; return this.token(stream, s) || "comment"; }
      const doc = stream.match(/^-@\w+/) || stream.string.slice(stream.start, stream.start + 3) === "---";
      stream.skipToEnd();
      return doc ? "doc" : "comment";
    }
    const c = stream.peek();
    if (c === '"' || c === "'") {
      stream.next();
      let ch;
      while ((ch = stream.next()) != null) { if (ch === "\\") stream.next(); else if (ch === c) break; }
      s.afterDot = false;
      return "string";
    }
    const long = stream.match(/^\[(=*)\[/);
    if (long) { s.long = "]" + long[1] + "]"; s.longKind = "string"; return this.token(stream, s) || "string"; }
    if (stream.match(/^0x[0-9a-fA-F]+/) || stream.match(/^\d+\.?\d*(?:[eE][+-]?\d+)?/) || stream.match(/^\.\d+(?:[eE][+-]?\d+)?/)) { s.afterDot = false; return "number"; }
    const word = stream.match(/^[A-Za-z_]\w*/);
    if (word) {
      const w = word[0], wasDot = s.afterDot;
      s.afterDot = false;
      if (CONTROL.has(w)) { s.defining = false; return "control"; }
      if (DECLARE.has(w)) { if (w === "function") s.defining = true; return "declare"; }
      if (WORDS.has(w)) return "word";
      if (ATOMS.has(w)) return "atom";
      if (w === "self") return "self";
      const calls = stream.match(/^\s*(?:\(|\{|["'])/, false); // f(...), f{...} and f"..." are calls
      if (s.defining) {
        if (stream.match(/^\s*\(/, false)) { s.defining = false; return "define"; }
        return /^[A-Z]/.test(w) ? "class" : "variable";
      }
      if (wasDot) return calls ? "method" : "field";
      if (w === "gs") return "gs";
      if (STANDARD.has(w)) return "standard";
      if (calls) return "call";
      return /^[A-Z]/.test(w) ? "class" : "variable";
    }
    if (stream.match("...")) return "operator";
    if (stream.match("..")) { s.afterDot = false; return "operator"; }
    if (c === "." || c === ":") { stream.next(); s.afterDot = true; return "punctuation"; } // ("..": taken above)
    if (stream.match(/^(?:==|~=|<=|>=|\/\/|<<|>>|[-+*\/%^#<>=&|~])/)) { s.afterDot = false; return "operator"; }
    stream.next();
    s.afterDot = false;
    if (c === "(") s.defining = false;
    return "punctuation";
  },
  languageData: { commentTokens: { line: "--", block: { open: "--[[", close: "]]" } } },
  tokenTable: {
    control: t.controlKeyword, declare: t.definitionKeyword, word: t.operatorKeyword, atom: t.atom, self: t.self,
    define: t.function(t.definition(t.variableName)), call: t.function(t.variableName), method: t.function(t.propertyName), field: t.propertyName,
    gs: t.namespace, standard: t.standard(t.variableName), class: t.className, variable: t.variableName,
    number: t.number, string: t.string, comment: t.lineComment, doc: t.docComment, operator: t.operator, punctuation: t.punctuation,
  },
};

export const luaLanguage = StreamLanguage.define(parser);
export const luaTokens = parser; // for the tests

const v = (name) => `var(--hl-${name})`;
export const luaHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: [t.controlKeyword, t.definitionKeyword, t.operatorKeyword], color: v("keyword") },
  { tag: t.atom, color: v("atom") },
  { tag: t.self, color: v("self"), fontStyle: "italic" },
  { tag: t.function(t.definition(t.variableName)), color: v("function"), fontWeight: "600" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: v("function") },
  { tag: t.propertyName, color: v("field") },
  { tag: [t.namespace, t.standard(t.variableName)], color: v("library") },
  { tag: t.className, color: v("class") },
  { tag: t.number, color: v("number") },
  { tag: t.string, color: v("string") },
  { tag: t.lineComment, color: v("comment"), fontStyle: "italic" },
  { tag: t.docComment, color: v("doc"), fontStyle: "italic" },
  { tag: t.operator, color: v("operator") },
  { tag: t.punctuation, color: v("punctuation") },
]));
