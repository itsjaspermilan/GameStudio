-- Pieces the menu scenes share: moving a cursor, the credits in the header, the footer's hint and
-- short messages. The bars themselves, the screen's title and the background are in each menu's
-- layout (scenes/<menu>.layout.lua).
local audio = require "lib.audio"
local save = require "lib.save"
local ui = require "lib.ui"

local M = {}

-- the cursor after up / down was pressed (or other buttons), with a click
function M.move(i, n, up, down)
  if gs.input.pressed(up or "up") then audio.sfx("sfx_move", 1); return (i - 2) % n + 1 end
  if gs.input.pressed(down or "down") then audio.sfx("sfx_move", 1); return i % n + 1 end
  return i
end

-- a message at the bottom for about two and a half seconds ("not enough credits")
function M.say(scene, msg) scene.note, scene.note_t = msg, 150 end

-- call at the start of every update; scene.drift is how fast its layout's background drifts
function M.tick(scene)
  scene.tick = scene.tick + 1
  if scene.note_t and scene.note_t > 0 then scene.note_t = scene.note_t - 1 end
  if scene.drift then ui.drift(scene.tick, scene.drift) end
end

-- the credits, in the header bar
function M.credits(scene)
  local credits = save.data.credits
  local w = gs.draw.text_width(tostring(credits), 1, "bold_small")
  ui.spr("spr_pk_coin", scene.tick / 8, ui.SW - 8 - w - 10, 11)
  ui.txtr(tostring(credits), ui.SW - 8, 7, 14, 1, "bold_small")
end

-- the hint in the footer bar, or a short message while there is one
function M.footer(scene, text)
  if scene.note_t and scene.note_t > 0 then ui.txt(scene.note, 8, 227, 6, 1, 312) else ui.txt(text, 8, 227, 2, 1, 312) end
end

-- the pips that show a rank out of `of`
function M.pips(x, y, n, of, ci)
  for i = 1, of do
    ui.box(x + (i - 1) * 11, y, 9, 7, i <= n and ci or 1, 2)
    if i <= n then ui.box(x + (i - 1) * 11 + 1, y + 1, 7, 2, 3, nil, 90) end
  end
end

return M
