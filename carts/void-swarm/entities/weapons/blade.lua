-- One of the blades of the orbit weapon. lib/weapons.lua moves them around the player every step and sets their damage and size.
local run = require "lib.run"
local ui = require "lib.ui"

local Blade = gs.entity{
  tags = { "blade" },
  depth = 19,
  hitbox = { r = 8 },
  dmg = 1,
  spin = 0,                           -- the angle it is at, for knocking enemies sideways
  look = 1,                           -- how big the blade is drawn (the hit area follows sx and sy)
}

function Blade:on_collide_enemy(e)
  if e.bhit > 0 then return end
  e.bhit = 0.35                       -- one hit per enemy per third of a second
  e:hurt(self.dmg, math.cos(self.spin + 1.57) * 70, math.sin(self.spin + 1.57) * 70)
  run.fx("spark", self.x, self.y, 0.2)
end

function Blade:draw()
  ui.spr("spr_p_blade", gs.world.step_id / 3, self.x, self.y, self.look)
end

return Blade
