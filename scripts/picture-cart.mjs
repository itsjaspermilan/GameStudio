// A throwaway game that draws one picture, for the art tools (make-cart-art.mjs, make-panel-pop-art.mjs): a game.lua and one scene whose
// draw() is `body`, at a screen size of w x h. The body uses the runtime's own calls (gs.print, gs.rect, gs.tile, gs.image, ...).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function writePictureCart(dir, w, h, body, prelude = "") {
  mkdirSync(join(dir, "scenes"), { recursive: true });
  writeFileSync(join(dir, "game.lua"), `return gs.game{ title = "picture", console = "dot", start = "scenes.main" }\n`);
  writeFileSync(join(dir, "scenes", "main.lua"),
    `local W, H = ${w}, ${h}\n${prelude}\nlocal Main = gs.scene{}\nfunction Main:enter() gs.raw.set_resolution(W, H) end\nfunction Main:draw()\n${body}\nend\nreturn Main\n`);
}
