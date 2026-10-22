// Runs the Lua language server for the open game and keeps it informed (see lsp-client.js for the protocol and src-tauri/src/lsp.rs for the process).
// It is optional: when it is not installed or fails, everything here quietly reports "not ready" and the editor uses lua-intel-core.js alone.
import { createLspClient, pathToUri, uriToPath, offsetToPos, posToOffset, hoverText, docText, cmKind } from "./lsp-client.js";

export function createLuaServer({ invoke, listen, note, onDiagnostics }) {
  let client = null, root = null, starting = null, listening = false, generation = 0;
  const diags = new Map();      // uri -> the server's diagnostics for that file
  const opened = new Map();     // rel -> last text sent
  const timers = new Map();
  const known = new Set();      // Lua files the server has been told about, to send created / deleted events

  const uri = (rel) => pathToUri(`${root}/${rel}`);
  const server = {
    get ready() { return !!client && client.ready; },
    async start(cart) {
      await server.stop();
      const mine = ++generation;
      starting = (async () => {
        let info;
        try { info = await invoke("lsp_start", { cart }); }
        catch (e) {
          const text = String(e);
          if (mine === generation && /not installed/.test(text)) note("For smarter Lua hints (types, any variable, go to definition) run scripts/fetch-luals.sh once.");
          else if (mine === generation && !/mock/.test(text)) note("The Lua language server did not start: " + text);
          return;
        }
        if (mine !== generation) { invoke("lsp_stop").catch(() => {}); return; }
        root = info.root;
        if (!listening) {
          listening = true;
          listen("lsp-message", (e) => { if (client) client.receive(e.payload); });
        }
        const c = createLspClient({
          send: (message) => invoke("lsp_send", { message }).catch(() => c.close_all()),
          onDiagnostics: (u, list) => { diags.set(u, list); const rel = relOf(u); if (rel) onDiagnostics(rel); },
        });
        client = c;
        try { await c.start(root); } catch (e) { if (client === c) { client = null; note("The Lua language server did not answer: " + e.message); } }
      })();
      await starting;
      return server.ready;
    },
    async stop() {
      generation++;
      for (const t of timers.values()) clearTimeout(t);
      timers.clear(); opened.clear(); diags.clear(); known.clear();
      if (client) { client.close_all(); client = null; await invoke("lsp_stop").catch(() => {}); }
    },
    open(rel, text) { if (!server.ready) return; opened.set(rel, text); client.open(uri(rel), text); },
    // typing: the server is told the whole text a moment after the last keystroke
    change(rel, text) {
      if (!server.ready) return;
      clearTimeout(timers.get(rel));
      timers.set(rel, setTimeout(() => { if (server.ready) { opened.set(rel, text); client.change(uri(rel), text); } }, 150));
    },
    close(rel) { if (!server.ready || !opened.has(rel)) return; clearTimeout(timers.get(rel)); opened.delete(rel); client.close(uri(rel)); diags.delete(uri(rel)); },
    // after the file list changed: tell the server about Lua files that appeared or went away
    files(luaFiles) {
      if (!server.ready) return;
      const now = new Set(luaFiles), changes = [];
      for (const f of now) if (!known.has(f) && known.size) changes.push({ uri: uri(f), type: 1 });
      for (const f of known) if (!now.has(f)) changes.push({ uri: uri(f), type: 3 });
      known.clear(); for (const f of now) known.add(f);
      client.watched(changes);
    },
    saved(rel) { if (server.ready) client.watched([{ uri: uri(rel), type: 2 }]); },
    diagnostics(rel, text) {
      if (!server.ready) return [];
      return (diags.get(uri(rel)) || []).filter((d) => d.severity !== 4).map((d) => ({
        from: posToOffset(text, d.range.start), to: posToOffset(text, d.range.end),
        severity: d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "info", message: d.message.replace(/\n- /g, "\n  "), source: "Lua",
      }));
    },
    async completion(rel, text, offset, explicit) {
      if (!server.ready) return [];
      await flush(rel, text);
      try {
        return (await client.completion(uri(rel), offsetToPos(text, offset), explicit)).map((i) => ({
          label: (i.filterText || i.label).replace(/^\s+/, "").replace(/\(.*$/, ""), type: cmKind(i.kind), detail: i.detail || (i.labelDetails && i.labelDetails.detail) || "", info: docText(i.documentation), insert: i.insertText || (i.textEdit && i.textEdit.newText) || null,
        }));
      } catch { return []; }
    },
    async hover(rel, text, offset) {
      if (!server.ready) return "";
      await flush(rel, text);
      try { return hoverText(await client.hover(uri(rel), offsetToPos(text, offset))); } catch { return ""; }
    },
    // where a name is defined: [{ rel, line, character }] for places inside the game
    async definition(rel, text, offset) {
      if (!server.ready) return [];
      await flush(rel, text);
      try {
        const places = await client.definition(uri(rel), offsetToPos(text, offset));
        return places.map((p) => ({ rel: relOf(p.uri || p.targetUri), range: p.range || p.targetSelectionRange })).filter((p) => p.rel).map((p) => ({ rel: p.rel, line: p.range.start.line, character: p.range.start.character }));
      } catch { return []; }
    },
    // every use of the name at offset: [{ rel, line, character }] (inside the game only)
    async references(rel, text, offset) {
      if (!server.ready) return [];
      await flush(rel, text);
      try {
        return (await client.references(uri(rel), offsetToPos(text, offset))).map((p) => ({ rel: relOf(p.uri), range: p.range })).filter((p) => p.rel)
          .map((p) => ({ rel: p.rel, line: p.range.start.line, character: p.range.start.character, length: p.range.end.character - p.range.start.character }));
      } catch { return []; }
    },
    // the edits renaming the name at offset makes: { rel: [{ range, newText }] }, or null (nothing to rename, or outside the game)
    async rename(rel, text, offset, newName) {
      if (!server.ready) return null;
      await flush(rel, text);
      const edit = await client.rename(uri(rel), offsetToPos(text, offset), newName);
      if (!edit) return null;
      const out = {};
      const add = (u, edits) => { const r = relOf(u); if (r) out[r] = (out[r] || []).concat(edits); };
      for (const [u, edits] of Object.entries(edit.changes || {})) add(u, edits);
      for (const dc of edit.documentChanges || []) if (dc.textDocument && dc.edits) add(dc.textDocument.uri, dc.edits);
      return Object.keys(out).length ? out : null;
    },
  };
  // the server answers about what it was last told, so make sure it knows the text the question is about
  async function flush(rel, text) {
    if (opened.get(rel) !== text) { clearTimeout(timers.get(rel)); opened.set(rel, text); if (opened.has(rel)) client.change(uri(rel), text); }
  }
  function relOf(u) {
    if (!u || !root) return null;
    const p = uriToPath(u);
    return p.startsWith(root + "/") ? p.slice(root.length + 1) : null;
  }
  return server;
}
