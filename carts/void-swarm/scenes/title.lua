-- The title screen. What is on it is in its layout (scenes/title.layout.lua, the Layout tab): the
-- two background layers, the planets and the texts. This code only moves them: the sky drifts, the
-- title bobs, the prompt blinks, and the pilots march by. (Development shortcuts such as GS_BOT and
-- GS_SCREEN are in lib/debug.lua.)
local data = require "lib.data"
local save = require "lib.save"
local audio = require "lib.audio"
local ui = require "lib.ui"

local floor, sin = math.floor, math.sin
local spr = ui.spr

local Title = gs.scene{}

local PILOT_IDS = {}
for i, p in ipairs(data.PILOTS) do PILOT_IDS[i] = p.id end

function Title:enter()
  save.load()
  self.tick = 0
  self:place()
  if require("lib.debug").start() then return end
  audio.music("msc_title")
end

-- where everything that moves is at this tick
function Title:place()
  ui.drift(self.tick, 0.6)
  local y = 26 + floor(sin(self.tick / 40) * 3)
  self.void.y, self.void_shadow.y = y, y + 3
  self.swarm.y, self.swarm_shadow.y = y + 48, y + 51
  self.prompt.visible = floor(self.tick / 30) % 2 == 0
end

function Title:update(dt)
  self.tick = self.tick + 1
  self:place()
  if gs.input.pressed("a") or gs.input.pressed("start") then
    audio.sfx("sfx_ok", 1)
    gs.goto_scene("scenes.hub", { fade = 0.25 }, 1)
  end
end

function Title:draw_ui()
  -- all the pilots march by
  local tick = self.tick
  for i = 1, #PILOT_IDS do
    local x = ((tick * 0.6 + i * 34) % (ui.SW + 40)) - 20
    spr("spr_pilot_" .. PILOT_IDS[i], 2 + floor(tick / 5 + i) % 6, x, 166 + floor(sin(tick / 9 + i) * 1.5), 1.5)
  end
end

return Title
