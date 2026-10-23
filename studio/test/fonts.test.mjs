import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FONTS } from "../src/fonts.js";
import { buildFonts, headerText, studioText } from "../../scripts/make-fonts.mjs";
import { builtinWidth, textBox } from "../src/room-core.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("the runtime's and the studio's fonts are made from the letters in engine/fonts", () => {
  const fonts = buildFonts();
  assert.deepEqual(fonts.map((f) => f.name), ["round_small", "round_tall", "square_small", "square_tall", "bold_small", "bold_tall"]);
  assert.equal(readFileSync(join(root, "runtime/fonts.h"), "utf8"), headerText(fonts), "run node scripts/make-fonts.mjs");
  assert.equal(readFileSync(join(root, "studio/src/fonts.js"), "utf8"), studioText(fonts), "run node scripts/make-fonts.mjs");
  for (const f of fonts) for (const g of f.glyphs) assert.ok(g.rows.every((r) => r < 1 << g.w), `${f.name}: a glyph has ink outside its width`);
});

test("bold keeps the gaps inside a letter open", () => {
  // the stems of an m: three runs of ink in the row under its top bar, in every style
  const runs = (r) => (r.toString(2).match(/1+/g) || []).length;
  for (const name of ["round_small", "bold_small", "bold_tall"]) {
    const m = FONTS[name].glyphs["m".charCodeAt(0) - 32], top = m.findIndex((r, i) => i > 0 && r !== 0);
    assert.equal(runs(m[top + 1]), 3, name);
  }
});

test("the studio measures text as the runtime draws it", { skip: !existsSync(join(root, "build/gs")) && "build/gs is missing: run scripts/build.sh" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "gs-fonts-"));
  mkdirSync(join(dir, "scenes"));
  const samples = ["Hello, world!", "SCORE 01234", "mmm iii WWW", "naïve", ""];
  writeFileSync(join(dir, "game.lua"), 'return gs.game{ title = "fonts", console = "glow43", start = "scenes.all" }\n');
  writeFileSync(join(dir, "scenes/all.lua"), `local All = gs.scene{}
function All:enter()
  for _, f in ipairs({ ${Object.keys(FONTS).map((n) => `"${n}"`).join(", ")} }) do
    for _, s in ipairs({ ${samples.map((s) => JSON.stringify(s)).join(", ")} }) do print("W", f, gs.draw.text_width(s, 1, f)) end
  end
end
return All
`);
  const r = spawnSync(join(root, "build/gs"), [dir], { env: { ...process.env, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_SAVE_DIR: dir, GS_MAX_FRAMES: "2" }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const got = r.stdout.split("\n").filter((l) => l.startsWith("W\t")).map((l) => Number(l.split("\t")[2]));
  const want = Object.keys(FONTS).flatMap((f) => samples.map((s) => builtinWidth(s, f)));
  assert.deepEqual(got, want);
  assert.equal(textBox({ text: "Hello, world!", x: 0, y: 0 })[2], builtinWidth("Hello, world!", "round_small"));
});
