-- After beating the eighth rival: the whole cast hops along in a row with Pip in the middle.
local ui = require "lib.ui"
local floor, sin = math.floor, math.sin

local FADE = { fade = 0.3, look = "mosaic" }

local Ending = gs.scene{}

function Ending:enter()
  self.tick = 0
  ui.music("msc_ending")
end

function Ending:update(dt)
  ui.tick()
  local t = self.tick + 1
  self.tick = t
  ui.drift(t)
  self.pip.y = 112 - math.abs(floor(sin(t / 12) * 8))
  self.pip.frame = 2
  for i = 1, 8 do
    local c = self["c" .. i]
    c.y = 172 - math.abs(floor(sin(t / 10 + i * 0.8) * 6))
    c.frame = (t // 20 + i) % 4 == 0 and 2 or 0
  end
  self.prompt.visible = t > 120 and (t // 30) % 2 == 0
  if t > 120 and ui.ok() then ui.sfx("ok", 1); gs.goto_scene("scenes.menu", FADE) end
end

return Ending
