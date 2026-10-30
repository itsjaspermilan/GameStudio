import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FONTS } from "../src/fonts.js";
import { buildFonts, headerText, studioText } from "../../scripts/make-fonts.mjs";
import { builtinWidth, textBox, glyphAlpha, glyphShadow } from "../src/room-core.js";
import { decodeBmp } from "../src/info-core.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("the runtime's and the studio's fonts are made from the letters in engine/fonts", () => {
  const fonts = buildFonts();
  assert.deepEqual(fonts.map((f) => f.name), ["round_small", "round_tall", "square_small", "square_tall", "bold_small", "bold_tall", "sans", "serif", "mono"]);
  assert.equal(readFileSync(join(root, "runtime/fonts.h"), "utf8"), headerText(fonts), "run node scripts/make-fonts.mjs");
  assert.equal(readFileSync(join(root, "studio/src/fonts.js"), "utf8"), studioText(fonts), "run node scripts/make-fonts.mjs");
  for (const f of fonts) for (const g of f.glyphs) assert.ok(g.rows.every((r) => r < 1 << g.w), `${f.name}: a glyph has ink outside its width`);
});

test("smooth fonts have soft edges, complete glyphs and predictable metrics", () => {
  for (const name of ["sans", "serif", "mono"]) {
    const font = FONTS[name];
    assert.equal(font.h, 16);
    assert.equal(font.line, 19);
    assert.equal(font.glyphs.length, 96);
    for (const [i, glyph] of font.glyphs.entries()) {
      assert.equal(glyph.length, 1 + glyph[0] * font.h);
      assert.ok(glyph.slice(1).every((a) => Number.isInteger(a) && a >= 0 && a <= 255));
      assert.equal(glyph.slice(1).some((a) => a > 0), i !== 0, `${name}: glyph ${i}`);
    }
    assert.ok(font.glyphs.some((g) => g.slice(1).some((a) => a > 0 && a < 255)));
    assert.equal(textBox({ text: "Hello", x: 0, y: 0, font: name })[3], 16);
  }
  assert.equal(new Set(FONTS.mono.glyphs.map((g) => g[0])).size, 1);
  for (const name of ["sans", "serif"]) assert.ok(builtinWidth("iii", name) < builtinWidth("WWW", name));
});

test("soft shadows retain coverage without filling the letters", () => {
  const font = { h: 2, coverage: true }, glyph = [2, 255, 85, 0, 0];
  assert.equal(glyphAlpha(font, glyph, 0, 0), 255);
  assert.equal(glyphAlpha(font, glyph, -1, 0), 0);
  assert.equal(glyphAlpha(font, glyph, 2, 0), 0);
  assert.equal(glyphShadow(font, glyph, 0, 0), 0);
  assert.equal(glyphShadow(font, glyph, 1, 0), 170);
  assert.equal(glyphShadow(font, glyph, 0, 1), 255);
});

test("bold keeps the gaps inside a letter open", () => {
  // the stems of an m: three runs of ink in the row under its top bar, in every style
  const runs = (r) => (r.toString(2).match(/1+/g) || []).length;
  for (const name of ["round_small", "bold_small", "bold_tall"]) {
    const m = FONTS[name].glyphs["m".charCodeAt(0) - 32], top = m.findIndex((r, i) => i > 0 && r !== 0);
    assert.equal(runs(m[top + 1]), 3, name);
  }
});

test("the studio measures text as the runtime draws it", { skip: !existsSync(join(root, "build/gs")) && "build/gs is missing: run scripts/build.sh" }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), "gs-fonts-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "scenes"));
  const samples = ["Hello, world!", "SCORE 01234", "mmm iii WWW", "naïve", "Press {a}", ""];
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

test("runtime font pixels and shadows match the layout editor, including opacity", { skip: !existsSync(join(root, "build/gs")) && "build/gs is missing: run scripts/build.sh" }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), "gs-font-pixels-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "scenes"));
  writeFileSync(join(dir, "game.lua"), 'return gs.game{ title = "font pixels", console = "glow43", start = "scenes.all" }\n');
  const text = "Agj MW!?012", draws = [], pixels = [[], []];
  for (const [i, [name, font]] of Object.entries(FONTS).entries()) {
    const y0 = 4 + i * 20;
    draws.push(`gs.draw.text("${text}", 4, ${y0}, "#e0b080", 1, { font = "${name}", shadow = "#102040", alpha = 0.6 })`);
    let x0 = 4;
    for (const char of text) {
      const glyph = font.glyphs[char.charCodeAt(0) - 32];
      for (let y = 0; y <= font.h; y++) for (let x = 0; x <= glyph[0]; x++) {
        for (const [pass, alpha] of [glyphShadow(font, glyph, x, y), glyphAlpha(font, glyph, x, y)].entries()) {
          if (alpha) pixels[pass].push(`{${x0 + x},${y0 + y},${Math.floor(alpha * 153 / 255)}}`);
        }
      }
      x0 += glyph[0] + 1;
    }
  }
  const plain = pixels.map((p, i) => `for _, p in ipairs({${p.join(",")}}) do gs.raw.rect(p[1], p[2], 1, 1, ${i ? "224,176,128" : "16,32,64"}, p[3]) end`).join("\n");
  const frames = [];
  for (const [i, code] of [draws.join("\n"), plain].entries()) {
    writeFileSync(join(dir, "scenes/all.lua"), `local All = gs.scene{}\nfunction All:draw()\ngs.draw.rect(0, 0, 256, 192, "#405060")\n${code}\nend\nreturn All\n`);
    const frame = join(dir, `${i}.bmp`);
    const r = spawnSync(join(root, "build/gs"), [dir], { env: { ...process.env, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_SAVE_DIR: dir, GS_MAX_FRAMES: "2", GS_DUMP_FRAME: frame }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /error:/i);
    frames.push(decodeBmp(readFileSync(frame)));
    const core = ["gs_libretro.dylib", "gs_libretro.so"].map((n) => join(root, "build", n)).find(existsSync);
    if (i === 0 && core && existsSync(join(root, "build/retro-run"))) {
      const coreFrame = join(dir, "core.bmp");
      const r = spawnSync(join(root, "build/retro-run"), [core, dir, "2", coreFrame], { env: { ...process.env, GS_SAVE_DIR: dir, RETRO_SAVE_DIR: dir }, encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
      frames.push(decodeBmp(readFileSync(coreFrame)));
    }
  }
  for (const frame of frames.slice(1)) {
    assert.equal(frames[0].width, frame.width);
    assert.equal(frames[0].height, frame.height);
    for (let i = 0; i < frames[0].data.length; i++) {
      assert.ok(Math.abs(frames[0].data[i] - frame.data[i]) <= 2, `pixel channel ${i}: runtime ${frames[0].data[i]}, comparison ${frame.data[i]}`);
    }
  }
});
