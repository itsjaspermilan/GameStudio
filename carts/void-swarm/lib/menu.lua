-- Pieces the menu scenes share: moving a cursor, the header with the credits, the footer with hints and short messages.
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

-- call at the start of every update
function M.tick(scene)
  scene.tick = scene.tick + 1
  if scene.note_t and scene.note_t > 0 then scene.note_t = scene.note_t - 1 end
end

function M.header(scene, title)
  ui.box(0, 0, ui.SW, 22, 0, nil, 200)
  ui.box(0, 22, ui.SW, 1, 22)
  ui.txt(title, 8, 7, 14, 1)
  local credits = save.data.credits
  ui.spr("spr_pk_coin", scene.tick / 8, ui.SW - 10 - #tostring(credits) * 8 - 4, 11)
  ui.txtr(tostring(credits), ui.SW - 6, 7, 14)
end

function M.footer(scene, text)
  ui.box(0, 226, ui.SW, 14, 0, nil, 210)
  if scene.note_t and scene.note_t > 0 then ui.txt(scene.note, 6, 230, 6, 1, 314) else ui.txt(text, 6, 230, 2, 1, 314) end
end

-- the pips that show a rank out of `of`
function M.pips(x, y, n, of, ci)
  for i = 1, of do
    ui.box(x + (i - 1) * 11, y, 9, 7, i <= n and ci or 1, 2)
    if i <= n then ui.box(x + (i - 1) * 11 + 1, y + 1, 7, 2, 3, nil, 90) end
  end
end

return M
