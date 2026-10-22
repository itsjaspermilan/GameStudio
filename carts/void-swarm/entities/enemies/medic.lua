-- Medic Drone: stays 80 to 110 pixels away and heals the enemies around it (12% of their health
-- every 0.8 seconds).
local Enemy = require "entities.enemy"
local run = require "lib.run"

local Medic = gs.entity(Enemy, {
  kind = "medic", sprite = "spr_e_medic", hitbox = { r = 6 },
  cap = 3, hp = 26, spd = 36, dmg = 2, xp = 4,
})

function Medic:think(dt, dx, dy, d, nx, ny)
  local spd = self.spd
  local vx, vy = 0, 0
  if d > 110 then vx, vy = nx * spd, ny * spd elseif d < 80 then vx, vy = -nx * spd, -ny * spd end
  if self.t > 0.8 then
    self.t = 0
    local around = gs.in_radius(self.x, self.y, 66, "enemy", self.around)
    self.around = around
    for _, o in ipairs(around) do
      if o ~= self and not o.boss then o.hp = math.min(o.maxhp, o.hp + o.maxhp * 0.12) end
    end
    if #around > 1 then run.fx("pop", self.x, self.y, 0.3, 1.6) end
  end
  return vx, vy
end

return Medic
