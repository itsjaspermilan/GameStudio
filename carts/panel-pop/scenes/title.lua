-- The title screen. What is on it is in its layout (scenes/title.layout.lua): the logo's letter
-- panels, the cast and the words. This code only moves them: the letters bob one after another,
-- Pip bounces, the rivals sway, panels drift by behind and the prompt blinks. Shortcuts for testing
-- (GS_SELFTEST, GS_MODE, GS_SCREEN) are in lib/debug.lua.
local ui = require "lib.ui"
local save = require "lib.save"
local floor, sin = math.floor, math.sin

local FADE = { fade = 0.2, look = "mosaic" }

local Title = gs.scene{}

function Title:enter()
  save.load()
  if require("lib.debug").start() then return end
  self.tick = 0
  self.home = {}
  for i = 1, 8 do self.home[i] = self["l" .. i].y end
  -- a few panels float up behind the logo (pictures made here, further back than the layout's)
  self.floaters = {}
  for i = 1, 8 do
    self.floaters[i] = gs.spawn(gs.world.Picture, 0, 0, { sprite = "spr_panels", frame = ((i - 1) % 6) * 6, depth = 50 })
  end
  ui.music("msc_title")
  self:place()
end

-- where everything that moves is at this tick
function Title:place()
  local t = self.tick
  for i = 1, 8 do self["l" .. i].y = self.home[i] + floor(sin(t / 18 - i * 0.6) * 3) end
  self.pip.y = 150 - math.abs(floor(sin(t / 14) * 6))
  self.pip.frame = (t // 70) % 2 == 1 and t % 70 < 6 and 1 or 0
  for i = 1, 4 do
    local r = self["rival" .. i]
    r.y = (i % 2 == 1 and 168 or 176) + floor(sin(t / 20 + i) * 2)
  end
  for i, p in ipairs(self.floaters) do
    p.x = (i * 41 + floor(sin(t / 60 + i) * 10)) % 340 - 10
    p.y = 260 - (t * (0.3 + (i % 3) * 0.1) + i * 37) % 290
  end
  ui.ink(self.prompt, (t // 30) % 2 == 0 and ui.WHITE or ui.GOLD)
  ui.drift(t)
end

function Title:update(dt)
  if not self.home then return end -- a test shortcut took over (lib/debug.lua)
  ui.tick()
  self.tick = self.tick + 1
  self:place()
  if ui.ok() then ui.sfx("ok", 1); gs.goto_scene("scenes.menu", FADE) end
end

return Title
