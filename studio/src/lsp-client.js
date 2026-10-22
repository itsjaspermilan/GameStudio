// A small client for the language server protocol, enough for completion, hover, go to definition, references, rename and diagnostics.
// It knows nothing about how messages travel: give it `send(jsonText)` and call `receive(jsonText)` for every message that arrives.
// Documents are synced whole (the server is told the full text after each change), which is fine for game-sized files.

export const pathToUri = (p) => "file://" + p.split("/").map(encodeURIComponent).join("/");
export const uriToPath = (u) => decodeURIComponent(u.replace(/^file:\/\//, ""));

// LSP positions are a line and a character (UTF-16 units, the same as a JavaScript string index).
export function offsetToPos(text, offset) {
  let line = 0, last = -1;
  for (let i = text.indexOf("\n"); i !== -1 && i < offset; i = text.indexOf("\n", i + 1)) { line++; last = i; }
  return { line, character: offset - last - 1 };
}
export function posToOffset(text, pos) {
  let off = 0;
  for (let l = 0; l < pos.line; l++) { const i = text.indexOf("\n", off); if (i === -1) return text.length; off = i + 1; }
  const end = text.indexOf("\n", off);
  return Math.min(off + pos.character, end === -1 ? text.length : end);
}

export function createLspClient({ send, onDiagnostics, onClose } = {}) {
  let nextId = 1, ready = false, dead = false;
  const pending = new Map();
  const versions = new Map();
  const post = (msg) => { if (!dead) send(JSON.stringify({ jsonrpc: "2.0", ...msg })); };
  const request = (method, params, ms = 8000) => new Promise((resolve, reject) => {
    if (dead) { reject(new Error("the language server is not running")); return; }
    const id = nextId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, ms);
    pending.set(id, { resolve: (r) => { clearTimeout(timer); resolve(r); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    post({ id, method, params });
  });

  const client = {
    get ready() { return ready; },
    // Every message the server sends goes through here.
    receive(text) {
      let m; try { m = JSON.parse(text); } catch { return; }
      if (m.method && m.id !== undefined) { // the server asks us something: nothing here needs a real answer
        const result = m.method === "workspace/configuration" ? (m.params.items || []).map(() => null) : null;
        post({ id: m.id, result });
      } else if (m.method === "textDocument/publishDiagnostics") {
        onDiagnostics && onDiagnostics(m.params.uri, m.params.diagnostics || []);
      } else if (m.id !== undefined) {
        const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message || "language server error")); else p.resolve(m.result);
      }
    },
    async start(rootPath) {
      const rootUri = pathToUri(rootPath);
      await request("initialize", {
        processId: null, rootUri, workspaceFolders: [{ uri: rootUri, name: "game" }],
        capabilities: {
          textDocument: {
            synchronization: { didSave: true },
            completion: { completionItem: { documentationFormat: ["plaintext", "markdown"] } },
            hover: { contentFormat: ["markdown", "plaintext"] },
            definition: {}, references: {}, rename: { prepareSupport: false }, publishDiagnostics: {},
          },
          workspace: { configuration: true, didChangeWatchedFiles: { dynamicRegistration: false } },
        },
      }, 30000);
      post({ method: "initialized", params: {} });
      ready = true;
    },
    open(uri, text) { versions.set(uri, 1); post({ method: "textDocument/didOpen", params: { textDocument: { uri, languageId: "lua", version: 1, text } } }); },
    change(uri, text) {
      if (!versions.has(uri)) return client.open(uri, text);
      const v = versions.get(uri) + 1; versions.set(uri, v);
      post({ method: "textDocument/didChange", params: { textDocument: { uri, version: v }, contentChanges: [{ text }] } });
    },
    close(uri) { if (versions.delete(uri)) post({ method: "textDocument/didClose", params: { textDocument: { uri } } }); },
    // files created, changed (2) or deleted outside the open document: [{ uri, type: 1|2|3 }]
    watched(changes) { if (changes.length) post({ method: "workspace/didChangeWatchedFiles", params: { changes } }); },
    completion(uri, pos, explicit) {
      return request("textDocument/completion", { textDocument: { uri }, position: pos, context: { triggerKind: explicit ? 1 : 3 } }, 4000)
        .then((r) => (Array.isArray(r) ? r : (r && r.items) || []));
    },
    hover(uri, pos) { return request("textDocument/hover", { textDocument: { uri }, position: pos }, 4000); },
    definition(uri, pos) {
      return request("textDocument/definition", { textDocument: { uri }, position: pos }, 4000).then((r) => (r ? (Array.isArray(r) ? r : [r]) : []));
    },
    references(uri, pos) {
      return request("textDocument/references", { textDocument: { uri }, position: pos, context: { includeDeclaration: true } }, 8000).then((r) => r || []);
    },
    // a WorkspaceEdit: { changes: { uri: [TextEdit] } } or { documentChanges: [{ textDocument: { uri }, edits }] }
    rename(uri, pos, newName) {
      return request("textDocument/rename", { textDocument: { uri }, position: pos, newName }, 8000);
    },
    // The server has gone: pending requests fail and later calls are ignored.
    close_all() {
      dead = true; ready = false;
      for (const p of pending.values()) p.reject(new Error("the language server stopped"));
      pending.clear(); onClose && onClose();
    },
  };
  return client;
}

// What an LSP completion item or hover holds, as plain text for a tooltip.
export const docText = (d) => (!d ? "" : typeof d === "string" ? d : d.value || "");
export function hoverText(h) {
  if (!h || !h.contents) return "";
  const c = h.contents;
  const parts = Array.isArray(c) ? c : [c];
  return parts.map((p) => (typeof p === "string" ? p : p.value || "")).join("\n\n").replace(/```\w*\n?/g, "").trim();
}
// LSP completion kinds to CodeMirror's names.
const KINDS = { 2: "method", 3: "function", 4: "function", 5: "property", 6: "variable", 7: "class", 8: "interface", 9: "namespace", 10: "property", 14: "keyword", 15: "text", 17: "text", 21: "constant", 22: "class" };
export const cmKind = (k) => KINDS[k] || "variable";
