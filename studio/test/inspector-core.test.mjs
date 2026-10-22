import test from "node:test";
import assert from "node:assert/strict";
import { parseInspectLine, commandText, classRows, fmtMs } from "../src/inspector-core.js";

test("inspector: lines in, commands out", () => {
  const r = parseInspectLine('@@gsi {"paused":true,"step":13,"classes":[{"name":"entities.a","count":2,"update_ms":0.5,"draw_ms":0.2,"collide_ms":0},{"name":"entities.enemies.b","count":9,"update_ms":1,"draw_ms":1,"collide_ms":1}]}');
  assert.equal(r.step, 13);
  assert.equal(parseInspectLine("@@gs {}"), null);
  assert.equal(parseInspectLine("@@gsi nope"), null);
  const rows = classRows(r);
  assert.deepEqual(rows.map((x) => x.short), ["enemies.b", "a"], "the most expensive kind first");
  assert.ok(Math.abs(rows[0].share - 3 / 3.7) < 1e-9);
  const c = JSON.parse(commandText({ open: true, paused: true, stepSeq: 2, speed: 3, cls: "entities.a", entity: 4, watch: ["e.hp", " ", "gs.count('x')"] }));
  assert.deepEqual(c, { open: true, paused: true, step_seq: 2, speed: 1, class: "entities.a", entity: 4, watch: ["e.hp", "gs.count('x')"] });
  assert.equal(fmtMs(0.004), "<0.01 ms"); assert.equal(fmtMs(2.345), "2.3 ms");
});
