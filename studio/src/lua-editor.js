// The CodeMirror side of the Lua intelligence in lua-intel-core.js: completion, hover help, warnings under the code, and ctrl/cmd-click on a name to open its file.
// hooks: { getApi(), getIndex(), getFile(), openResource(group, name), openHelp?(page, anchor), rename?(view, pos), references?(view, pos) }. Nothing here reads files; main.js keeps the index up to date.
import { EditorState } from "@codemirror/state";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { linter, lintGutter } from "@codemirror/lint";
import { startCompletion } from "@codemirror/autocomplete";
import { contextAt, complete, hoverAt, diagnose, closest, namesFor, ASSET_CALLS, assetTarget } from "./lua-intel-core.js";
import { group } from "./project-core.js";

const isLua = (file) => !!file && file.endsWith(".lua");

export function luaIntel(hooks) {
  const source = async (cx) => {
    const file = hooks.getFile();
    if (!isLua(file)) return null;
    const line = cx.state.doc.lineAt(cx.pos);
    const before = line.text.slice(0, cx.pos - line.from);
    const ctx = contextAt(before);
    const items = ctx ? complete(ctx, hooks.getApi(), hooks.getIndex(), cx.state.doc.toString(), file, cx.pos) : [];
    if (!items.length) return fromServer(cx, file, before, ctx);
    return {
      from: line.from + ctx.from,
      options: items.map((i) => ({
        label: i.label, type: i.type, detail: i.detail, boost: i.type === "constant" ? 10 : 0,
        info: i.info ? () => { const d = document.createElement("div"); d.className = "lua-doc"; d.textContent = i.info; return d; } : undefined,
      })),
      validFor: /^\w*$/,
    };
  };

  // everything else (locals, Lua's own library, the game's other files) comes from the language server when it is running
  async function fromServer(cx, file, before, ctx) {
    const server = hooks.server;
    if (!server || !server.ready || (ctx && ctx.type !== "member")) return null;
    const word = cx.matchBefore(/\w*/);
    if (!cx.explicit && (!word || word.from === word.to) && !/[.:]$/.test(before)) return null;
    const items = await server.completion(file, cx.state.doc.toString(), cx.pos, cx.explicit);
    if (!items.length) return null;
    return {
      from: word ? word.from : cx.pos,
      options: items.slice(0, 80).map((i) => ({
        label: i.label, type: i.type, detail: i.detail,
        info: i.info ? () => { const d = document.createElement("div"); d.className = "lua-doc"; d.textContent = i.info.replace(/```\w*\n?/g, ""); return d; } : undefined,
      })),
      validFor: /^\w*$/,
    };
  }

  const lint = linter((view) => {
    const file = hooks.getFile();
    if (!isLua(file)) return [];
    const text = view.state.doc.toString();
    const own = diagnose(text, file, hooks.getIndex()).map((d) => ({ from: d.from, to: Math.max(d.to, d.from + 1), severity: d.severity, message: d.message, source: "GameStudio" }));
    const theirs = hooks.server ? hooks.server.diagnostics(file, text).map((d) => ({ ...d, to: Math.max(d.to, d.from + 1) })) : [];
    // the same problem reported by both: keep ours (it explains more)
    return [...own, ...theirs.filter((t) => !own.some((o) => o.from === t.from && o.to === t.to))];
  }, { delay: 500 });

  const hover = hoverTooltip((view, pos) => {
    const file = hooks.getFile();
    if (!isLua(file)) return null;
    const line = view.state.doc.lineAt(pos);
    const text = view.state.doc.sliceString(0, line.from);
    const h = hoverAt(line.text, pos - line.from, hooks.getApi(), hooks.getIndex(), file, text);
    if (h) return { pos: line.from + h.from, end: line.from + h.to, above: true, create: () => ({ dom: tooltip(h, hooks.getIndex(), hooks.openHelp) }) };
    const server = hooks.server;
    if (!server || !server.ready) return null;
    const word = view.state.wordAt(pos);
    if (!word) return null;
    return server.hover(file, view.state.doc.toString(), pos).then((t) => (t ? { pos: word.from, end: word.to, above: true, create: () => { const d = document.createElement("div"); d.className = "lua-tip"; const x = document.createElement("div"); x.className = "lua-sig"; x.textContent = t.length > 700 ? t.slice(0, 700) + "\u2026" : t; d.appendChild(x); return { dom: d }; } } : null));
  }, { hideOnChange: true });

  // ctrl/cmd-click on a name inside a call opens what it names
  const click = EditorView.domEventHandlers({
    mousedown(e, view) {
      if (!(e.metaKey || e.ctrlKey) || e.button !== 0) return false;
      const file = hooks.getFile();
      if (!isLua(file)) return false;
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos == null) return false;
      const line = view.state.doc.lineAt(pos);
      const h = hoverAt(line.text, pos - line.from, hooks.getApi(), hooks.getIndex(), file, "");
      if (h && h.target && h.exists) { e.preventDefault(); hooks.openResource(h.target.group, h.target.name); return true; }
      if (h && h.kind !== "api") return false;
      e.preventDefault();
      goToDefinition(view, pos);
      return true;
    },
  });
  // where a name was defined, in the game's own files
  async function goToDefinition(view, pos) {
    const server = hooks.server, file = hooks.getFile();
    if (!server || !server.ready || !hooks.openLocation) return;
    const places = await server.definition(file, view.state.doc.toString(), pos);
    if (places.length) hooks.openLocation(places[0].rel, places[0].line, places[0].character);
  }
  const keys = keymap.of([
    { key: "F12", run: (view) => { goToDefinition(view, view.state.selection.main.head); return true; } },
    { key: "Shift-F12", run: (view) => { if (hooks.references) hooks.references(view, view.state.selection.main.head); return true; } },
    { key: "F2", run: (view) => { if (hooks.rename) hooks.rename(view, view.state.selection.main.head); return true; } },
  ]);

  // the list opens by itself after a quote, a dot or a colon (CodeMirror only does that after letters)
  const trigger = EditorView.updateListener.of((u) => {
    if (!u.docChanged || !isLua(hooks.getFile())) return;
    for (const tr of u.transactions) {
      if (!tr.isUserEvent("input.type")) continue;
      let typed = "";
      tr.changes.iterChanges((fa, ta, fb, tb, ins) => { typed = ins.toString(); });
      if (/^["'.:]/.test(typed)) setTimeout(() => startCompletion(u.view), 0);
    }
  });

  return [EditorState.languageData.of(() => [{ autocomplete: source }]), lint, lintGutter(), hover, click, trigger, keys];
}

function tooltip(h, index, openHelp) {
  const d = document.createElement("div"); d.className = "lua-tip";
  const row = (cls, text) => { const x = document.createElement("div"); x.className = cls; x.textContent = text; d.appendChild(x); return x; };
  if (h.kind === "api") {
    row("lua-sig", h.sym.sig || h.sym.path);
    if (h.sym.type && h.sym.kind === "field") row("lua-type", h.sym.type);
    if (h.sym.doc) row("lua-doc", h.sym.doc);
    for (const p of h.sym.params || []) if (p.desc || p.type) row("lua-param", `${p.name}${p.optional ? "?" : ""}: ${p.type}${p.desc ? "  " + p.desc : ""}`);
    if (h.sym.returns && h.sym.returns.length) row("lua-param", "returns " + h.sym.returns.join(", "));
    if (openHelp) {
      // the API page has an anchor for every documented name (help-core.js apiPageHtml)
      const more = document.createElement("a"); more.className = "lua-help"; more.href = "#"; more.textContent = "More in Help (F1)";
      more.onmousedown = (e) => { e.preventDefault(); openHelp("api", "api-" + h.sym.path); };
      d.appendChild(more);
    }
  } else if (h.kind === "layout") {
    row("lua-sig", `self.${h.name}`);
    row("lua-doc", h.text);
    row("lua-doc", "Placed and named in the layout editor; renaming it there renames it here too.");
  } else if (h.kind === "tag") {
    row("lua-sig", `tag '${h.name}'`);
    row("lua-doc", h.exists ? "Entities with this tag are found with gs.first / gs.each / gs.count." : "No entity has this tag yet.");
  } else {
    const g = group(h.kind);
    const label = h.kind === "module" ? "file" : h.kind === "layouts" ? "layout" : g ? g.single : h.kind;
    if (h.exists) { row("lua-sig", `${label} '${h.name}'`); if (h.target) row("lua-doc", "Ctrl-click (Cmd-click on a Mac) to open it."); }
    else {
      const names = namesFor(h.kind, ASSET_CALLS.find((c) => c.kind === h.kind), index);
      const guess = closest(h.name, names);
      row("lua-sig", `no ${label} called '${h.name}'`);
      if (guess) row("lua-doc", `Did you mean '${guess}'?`);
    }
  }
  return d;
}
