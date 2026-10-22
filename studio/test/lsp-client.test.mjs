import test from "node:test";
import assert from "node:assert/strict";
import { createLspClient, pathToUri, uriToPath, offsetToPos, posToOffset, hoverText, cmKind } from "../src/lsp-client.js";

// a fake server on the other end of send()
function fake() {
  const sent = [];
  let client;
  const diags = [];
  const reply = (id, result) => setTimeout(() => client.receive(JSON.stringify({ jsonrpc: "2.0", id, result })), 0);
  client = createLspClient({
    send: (text) => {
      const m = JSON.parse(text); sent.push(m);
      if (m.method === "initialize") reply(m.id, { capabilities: {} });
      if (m.method === "textDocument/completion") reply(m.id, { items: [{ label: "draw", kind: 5 }] });
      if (m.method === "textDocument/hover") reply(m.id, { contents: { kind: "markdown", value: "```lua\nfunction gs.sfx()\n```" } });
      if (m.method === "textDocument/definition") reply(m.id, null);
    },
    onDiagnostics: (uri, d) => diags.push([uri, d]),
  });
  return { client, sent, diags };
}

test("start handshake, document sync and requests", async () => {
  const { client, sent } = fake();
  await client.start("/ws/my game");
  assert.ok(client.ready);
  assert.equal(sent[0].params.rootUri, "file:///ws/my%20game");
  assert.equal(sent[1].method, "initialized");
  const uri = pathToUri("/ws/my game/a.lua");
  client.open(uri, "x = 1");
  client.change(uri, "x = 2");
  client.change(pathToUri("/ws/b.lua"), "never opened"); // changing an unopened document opens it
  client.close(uri);
  client.close(uri); // closing twice is harmless
  const methods = sent.map((m) => m.method);
  assert.deepEqual(methods.slice(2), ["textDocument/didOpen", "textDocument/didChange", "textDocument/didOpen", "textDocument/didClose"]);
  assert.equal(sent[3].params.textDocument.version, 2);
  assert.deepEqual(sent[3].params.contentChanges, [{ text: "x = 2" }]);
  const items = await client.completion(uri, { line: 0, character: 3 }, false);
  assert.deepEqual(items.map((i) => i.label), ["draw"]);
  assert.equal(hoverText(await client.hover(uri, { line: 0, character: 1 })), "function gs.sfx()");
  assert.deepEqual(await client.definition(uri, { line: 0, character: 1 }), []);
});

test("diagnostics and server requests", async () => {
  const { client, sent, diags } = fake();
  await client.start("/ws");
  client.receive(JSON.stringify({ method: "textDocument/publishDiagnostics", params: { uri: "file:///ws/a.lua", diagnostics: [{ message: "bad" }] } }));
  assert.equal(diags[0][1][0].message, "bad");
  client.receive(JSON.stringify({ id: 99, method: "workspace/configuration", params: { items: [{}, {}] } }));
  const answer = sent.find((m) => m.id === 99);
  assert.deepEqual(answer.result, [null, null]);
  client.receive("not json"); // ignored
});

test("a stopped server fails pending and later requests", async () => {
  const client = createLspClient({ send: () => {} });
  const p = client.hover("file:///a.lua", { line: 0, character: 0 });
  client.close_all();
  await assert.rejects(p, /stopped/);
  await assert.rejects(client.hover("file:///a.lua", { line: 0, character: 0 }), /not running/);
});

test("positions and paths", () => {
  const t = "ab\ncde\n\nf";
  assert.deepEqual(offsetToPos(t, 0), { line: 0, character: 0 });
  assert.deepEqual(offsetToPos(t, 4), { line: 1, character: 1 });
  assert.deepEqual(offsetToPos(t, 8), { line: 3, character: 0 });
  for (let i = 0; i <= t.length; i++) assert.equal(posToOffset(t, offsetToPos(t, i)), i);
  assert.equal(posToOffset(t, { line: 1, character: 99 }), 6);
  assert.equal(uriToPath(pathToUri("/a b/c.lua")), "/a b/c.lua");
  assert.equal(cmKind(3), "function"); assert.equal(cmKind(999), "variable");
});
