-- A mine: it arms after half a second and blows up when an enemy touches it (or after nine
-- seconds).
local run = require "lib.run"

local Mine = gs.entity{
  tags = { "mine" },
  depth = 85,
  hitbox = { r = 17 },
  sprite = "spr_p_mine",
  anim_speed = 0,
  t = 9,
  arm = 0.5,
  r = 30,                             -- the blast radius
  dmg = 1,
}

function Mine:update(dt)
  self.t = self.t - dt
  self.arm = self.arm - dt
  if self.arm <= 0 then self.anim_speed = 10 / 6 end
  if self.t <= 0 or (self.arm <= 0 and self:touching("enemy")) then
    run.explode(self.x, self.y, self.r, self.dmg)
    self:destroy()
  end
end

return Mine
