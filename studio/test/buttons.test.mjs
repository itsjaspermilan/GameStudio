import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUTTONS } from "../src/buttons.js";
import { buildButtons, luaText, studioText } from "../../scripts/make-buttons.mjs";
import { splitButtons, builtinWidth, buttonPixels, BUTTON_STYLES } from "../src/room-core.js";
import { buttonsOfGame, setButtonsInGame } from "../src/project-core.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("the runtime's and the studio's button icons are made by scripts/make-buttons.mjs", () => {
  const b = buildButtons();
  assert.equal(readFileSync(join(root, "engine/gs/buttons_art.lua"), "utf8"), luaText(b), "run node scripts/make-buttons.mjs");
  assert.equal(readFileSync(join(root, "studio/src/buttons.js"), "utf8"), studioText(b), "run node scripts/make-buttons.mjs");
  assert.deepEqual(BUTTON_STYLES, ["gba", "snes", "nes", "mono"]);
  for (const [size, most] of [["small", 10], ["tall", 12]]) for (const name of BUTTONS.order) {
    const ic = BUTTONS.sizes[size].icons[name];
    assert.ok(ic.rows.length <= most, `${size} ${name} fits beside its letters`);
    assert.ok(ic.rows.every((r) => r.length === ic.w && /^[.ofhls]+$/.test(r)), `${size} ${name}: rows as wide, known pixels only`);
    assert.ok(ic.rows.join("").includes("o"), `${size} ${name} has an outline`);
  }
});

test("text is split around button icons; other braces stay text", () => {
  assert.equal(splitButtons("Press A"), null);
  assert.equal(splitButtons("{nope} {}"), null);
  assert.deepEqual(splitButtons("Press {a} or {start}!"), ["Press ", { icon: "a" }, " or ", { icon: "start" }, "!"]);
  assert.deepEqual(splitButtons("{x}{nope}"), [{ icon: "x" }, "{nope}"]);
  // an icon is a letter's gap from its neighbours, as in the runtime (tests/framework checks the same sum there)
  assert.equal(builtinWidth("A{a}B"), builtinWidth("A") + builtinWidth("B") + 2 + 9);
  assert.equal(builtinWidth("{a}", "round_tall"), 11);
});

test("the mono style takes the text's colour, the others keep their own", () => {
  const solid = (p) => { for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) { const v = p.at(x, y); if (v) return v; } };
  assert.deepEqual(solid(buttonPixels("mono", "small", "a", [10, 20, 30])).slice(0, 3), [10, 20, 30]);
  assert.notDeepEqual(solid(buttonPixels("snes", "small", "a", [10, 20, 30])).slice(0, 3), [10, 20, 30]);
});

test("game.lua names the button style; the studio sets it under the console line", () => {
  const game = `return gs.game{\n  title = "Coin Dash",\n  console = "glow43",            -- 320x240\n  start = "scenes.title",\n}\n`;
  assert.equal(buttonsOfGame(game), "gba");
  const snes = setButtonsInGame(game, "snes");
  assert.match(snes, /console = "glow43",[^\n]*\n {2}buttons = "snes", +-- the look/);
  assert.equal(buttonsOfGame(snes), "snes");
  assert.equal(buttonsOfGame(setButtonsInGame(snes, "mono")), "mono");
  assert.equal(setButtonsInGame(`return gs.game{ console = "glow43", start = "a" }`, "nes"), `return gs.game{ console = "glow43", buttons = "nes", start = "a" }`);
  assert.equal(setButtonsInGame("return gs.game{ start = 'a' }", "nes"), null);
});
