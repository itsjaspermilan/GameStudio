import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FONT8, FONT8_FIRST } from "../src/font8.js";
import { readFont } from "../../scripts/make-font8.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("the studio's built-in font is the runtime's, letter for letter", { skip: !existsSync(join(root, "build/gs")) && "build/gs is missing: run scripts/build.sh" }, () => {
  assert.equal(FONT8_FIRST, 32);
  assert.equal(FONT8.length, 95, "the letters from space to ~");
  assert.deepEqual(readFont(join(root, "build/gs")), FONT8, "the runtime draws other letters now: run node scripts/make-font8.mjs");
});
