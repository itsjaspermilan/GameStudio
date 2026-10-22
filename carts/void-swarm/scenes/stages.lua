-- Choose a sector. A sector opens when the one before it is cleared.
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
      gs.goto_scene("scenes.play", { fade = 0.3 }, save.data.sel, self.cur)
    else audio.sfx("sfx_error", 1); menu.say(self, "LOCKED") end
  end
end

function Stages:draw_ui()
  local s = save.data
  local sd = data.STAGES[self.cur]
  ui.menu_background(sd.bg, self.tick, 0.4)
  menu.header(self, "CHOOSE A SECTOR")
  for i, st in ipairs(data.STAGES) do
    local col, row = (i - 1) // 5, (i - 1) % 5
    local x, y = 6 + col * 156, 28 + row * 28
    local open = i <= s.cleared + 1
    local on = (i == self.cur)
    ui.box(x, y, 152, 25, on and 25 or 0, on and 26 or 1, 220)
    txt(string.format("%2d", i), x + 6, y + 9, open and 14 or 1)
    txt(st.name, x + 28, y + 5, open and 3 or 1, 1, x + 140)
    if not open then spr("spr_ico_lock", 0, x + 142, y + 17, 0.6)
    elseif s.cleared >= i then spr("spr_ico_star", 0, x + 142, y + 17, 0.6); txt(ui.fmt_time(s.best[i]), x + 28, y + 15, 22)
    else txt("NEW", x + 28, y + 15, 18) end
  end
  ui.box(6, 172, 308, 52, 0, 22, 215)
  local open = self.cur <= s.cleared + 1
  txt(sd.name, 12, 177, 14, 1, 262)
  txt(sd.blurb, 12, 188, 2, 1, 262)
  txt("BOSS: " .. gs.defaults("bosses." .. sd.boss).name, 12, 199, 6, 1, 262)
  txt("BOSS AT " .. ui.fmt_time(sd.time) .. "  PILOT " .. data.PILOTS[s.sel].name, 12, 210, 18, 1, 262)
  spr("spr_b_" .. sd.boss, 0, 288, 198, 0.75)
  menu.footer(self, open and "A: LAUNCH   B: BACK" or "CLEAR THE SECTOR BEFORE FIRST")
end

return Stages
