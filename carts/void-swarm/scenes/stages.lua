-- Choose a sector. A sector opens when the one before it is cleared. The bars, the title and the
-- bottom panel are in its layout (stages.layout.lua), fixed on the screen above the background,
-- which this code draws because it is the chosen sector's.
local data = require "lib.data"
local save = require "lib.save"
local audio = require "lib.audio"
local ui = require "lib.ui"
local menu = require "lib.menu"

local spr, txt = ui.spr, ui.txt

local Stages = gs.scene{}

function Stages:enter(cur)
  self.cur, self.tick = cur or 1, 0
end

function Stages:update(dt)
  menu.tick(self)
  if gs.input.pressed("left") or gs.input.pressed("right") then self.cur = (self.cur + 4) % 10 + 1; audio.sfx("sfx_move", 1) end
  self.cur = menu.move(self.cur, #data.STAGES)
  if gs.input.pressed("b") then audio.sfx("sfx_back", 1); gs.goto_scene("scenes.hub", { fade = 0.2 }, 1) end
  if gs.input.pressed("a") then
    if self.cur <= save.data.cleared + 1 then
      audio.sfx("sfx_ok", 1)
      gs.goto_scene("scenes.play", { fade = 0.35, look = "mosaic" }, save.data.sel, self.cur)
    else audio.sfx("sfx_error", 1); menu.say(self, "Locked") end
  end
end

function Stages:draw()
  ui.menu_background(data.STAGES[self.cur].bg, self.tick, 0.4)
end

function Stages:draw_ui()
  local s = save.data
  local sd = data.STAGES[self.cur]
  menu.credits(self)
  for i, st in ipairs(data.STAGES) do
    local col, row = (i - 1) // 5, (i - 1) % 5
    local x, y = 8 + col * 154, 28 + row * 28
    local open = i <= s.cleared + 1
    local on = (i == self.cur)
    ui.item(x, y, 150, 25, on, 220)
    txt(string.format("%2d", i), x + 6, y + 9, open and 14 or 1)
    txt(st.name, x + 28, y + 5, open and 3 or 1, 1, x + 132)
    if not open then spr("spr_ico_lock", 0, x + 140, y + 13, 0.6)
    elseif s.cleared >= i then spr("spr_ico_star", 0, x + 140, y + 13, 0.6); txt(ui.fmt_time(s.best[i]), x + 28, y + 15, 22)
    else txt("New", x + 28, y + 15, 18) end
  end
  local open = self.cur <= s.cleared + 1
  txt(sd.name, 16, 175, 14, 1, 258)
  txt(sd.blurb, 16, 185, 2, 1, 258)
  txt("Boss: " .. gs.defaults("bosses." .. sd.boss).name, 16, 195, 6, 1, 258)
  txt("Boss at " .. ui.fmt_time(sd.time) .. "  Pilot " .. data.PILOTS[s.sel].name, 16, 205, 18, 1, 258)
  spr("spr_b_" .. sd.boss, 0, 284, 195, 0.7)
  menu.footer(self, open and "A: Launch   B: Back" or "Clear the sector before it first")
end

return Stages
