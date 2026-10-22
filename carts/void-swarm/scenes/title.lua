-- The title screen. (Development shortcuts such as GS_BOT and GS_SCREEN are in lib/debug.lua.)
local data = require "lib.data"
local save = require "lib.save"
local audio = require "lib.audio"
local ui = require "lib.ui"

local floor, sin = math.floor, math.sin
local spr, txt, txtc = ui.spr, ui.txt, ui.txtc

local Title = gs.scene{}

local PILOT_IDS = {}
for i, p in ipairs(data.PILOTS) do PILOT_IDS[i] = p.id end

function Title:enter()
  save.load()
  self.tick = 0
  if require("lib.debug").start() then return end
  audio.music("msc_title")
end

function Title:update(dt)
  self.tick = self.tick + 1
  if gs.input.pressed("a") or gs.input.pressed("start") then
    audio.sfx("sfx_ok", 1)
    gs.goto_scene("scenes.hub", { fade = 0.25 }, 1)
  end
end

function Title:draw_ui()
  local tick = self.tick
  ui.menu_background("ion", tick, 0.6)
  spr("spr_planet_a", 0, 252, 168, 2.2)
  spr("spr_planet_b", 0, 40, 205, 0.7)
  local y = 26 + floor(sin(tick / 40) * 3)
  txt("VOID", 83, y + 3, 28, 6); txt("VOID", 80, y, 23, 6)
  txt("SWARM", 63, y + 51, 28, 6); txt("SWARM", 60, y + 48, 14, 6)
  -- all the pilots march by
  for i = 1, #PILOT_IDS do
    local x = ((tick * 0.6 + i * 34) % (ui.SW + 40)) - 20
    spr("spr_pilot_" .. PILOT_IDS[i], 2 + floor(tick / 5 + i) % 6, x, 166 + floor(sin(tick / 9 + i) * 1.5), 1.5)
  end
  if floor(tick / 30) % 2 == 0 then txtc("PRESS A", 206, 3, 2) end
  txtc("SURVIVE THE SWARM", 228, 1)
end

return Title
