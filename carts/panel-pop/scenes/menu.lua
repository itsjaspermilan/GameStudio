-- The main menu: seven rows from the layout (row1..row7 with item1..item7), a little picture of the
-- chosen mode in the top-right window and a few words about it under that.
local ui = require "lib.ui"
local floor = math.floor
local frame = ui.frame

local FADE = { fade = 0.2, look = "mosaic" }
local ITEMS = {
  { go = "endless", desc = "Keep the stack down as long as you can. It keeps speeding up." },
  { go = "time", desc = "Two minutes on the clock. Score as much as you can." },
  { go = "vs", desc = "Beat eight rivals. Combos and chains drop garbage on them." },
  { go = "stage", desc = "Break every garbage block to clear the stage." },
  { go = "puzzle", desc = "Clear the whole board in a set number of swaps." },
  { go = "howto", desc = "New here? Start with this." },
  { go = "records", desc = "Your best scores and how far you got." },
}

local Menu = gs.scene{}
local cur = 1 -- kept between visits, so coming back from a game lands on the same row

function Menu:enter()
  self.tick = 0
  ui.music("msc_menu")
  self:show()
end

function Menu:show()
  for i = 1, #ITEMS do ui.mark(self["row" .. i], i == cur) end
  self.arrow.y = self["row" .. cur].y + 11
  ui.lines(self, "desc", gs.draw.wrap(ITEMS[cur].desc, 106, 1, "round_tall"))
end

function Menu:update(dt)
  ui.tick()
  self.tick = self.tick + 1
  ui.drift(self.tick)
  local was = cur
  cur = ui.move(cur, #ITEMS)
  if cur ~= was then self:show() end
  self.arrow.x = 24 + (self.tick // 12) % 2
  if ui.pressed("b") then ui.sfx("back", 1); gs.goto_scene("scenes.title", FADE) end
  if ui.pressed("a") then
    ui.sfx("ok", 1)
    local go = ITEMS[cur].go
    if go == "howto" then gs.goto_scene("scenes.howto")
    elseif go == "records" then gs.goto_scene("scenes.records")
    elseif go == "puzzle" then gs.goto_scene("scenes.puzzles")
    else gs.goto_scene("scenes.setup", nil, go) end
  end
end

-- the picture in the top-right window (186, 30, 122 x 96)
function Menu:draw()
  local t, go = self.tick, ITEMS[cur].go
  if go == "endless" or go == "time" then
    for c = 0, 5 do
      local bob = ((t // 10 + c) % 6 == 0) and -2 or 0
      frame("spr_panels", c * 6, 207 + (c % 3) * 28, 50 + (c // 3) * 28 + bob)
    end
    if go == "time" then ui.text(ui.fmt_time(120 - (t // 60) % 120), 247, 108, ui.CORAL, "center") end
  elseif go == "vs" then
    ui.spr("spr_char_pip", (t // 40) % 2 == 0 and 0 or 2, 216, 78)
    ui.text("VS", 247, 70, ui.CORAL, "center", 1, "bold_tall")
    ui.spr("spr_char_kit", (t // 40) % 2, 278, 78)
  elseif go == "stage" then
    for c = 0, 4 do frame("spr_garbage", 9 + (c == 0 and 0 or c == 4 and 2 or 1), 207 + c * 16, 56) end
    frame("spr_garbage", 12, 207 + 32, 56)
    for c = 0, 4 do frame("spr_panels", ((c * 2) % 5) * 6, 207 + c * 16, 72) end
    for c = 0, 4 do frame("spr_panels", ((c * 3 + 1) % 5) * 6 + 4, 207 + c * 16, 88) end
  elseif go == "puzzle" then
    frame("spr_panels", 6, 231, 56); frame("spr_panels", 6, 247, 72)
    frame("spr_panels", 0, 231, 72); frame("spr_panels", 6, 263, 72)
    frame("spr_ico_star", (t // 20) % 2, 280, 50)
  elseif go == "howto" then
    ui.spr("spr_char_pip", 0, 230, 80, 2)
    ui.text("?", 280, 50 + floor(math.sin(t / 10) * 2), ui.CORAL, "left", 2, "bold_tall")
  else
    ui.spr("spr_char_pip", 2, 247, 84, 2)
    for i = 0, 2 do frame("spr_ico_star", (t // 20 + i) % 2, 214 + i * 30, 44) end
  end
end

return Menu
