import test from "node:test";
import assert from "node:assert/strict";
import { FIRST_STEPS, parseSteps, stringifySteps, showSteps } from "../src/steps-core.js";

test("first steps: saved progress round-trips, junk counts as nothing done", () => {
  const p = parseSteps(null);
  assert.equal(p.done.size, 0); assert.ok(showSteps(p));
  p.done.add("run");
  const back = parseSteps(stringifySteps(p));
  assert.ok(back.done.has("run"));
  assert.equal(parseSteps("{not json").done.size, 0);
  assert.equal(parseSteps('{"done":["run","bogus"]}').done.size, 1, "unknown ids are dropped");
  assert.ok(!showSteps({ done: new Set(FIRST_STEPS.map((s) => s.id)), hidden: false }), "all done: gone");
  assert.ok(!showSteps({ done: new Set(), hidden: true }), "hidden: gone");
});
