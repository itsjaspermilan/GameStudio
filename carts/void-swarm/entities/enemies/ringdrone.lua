-- Ring Drone: closes in to about 44 pixels and then circles the player.
local Enemy = require "entities.enemy"

local RingDrone = gs.entity(Enemy, {
  kind = "ringdrone", sprite = "spr_e_ringdrone", hitbox = { r = 9 },
  hp = 14, spd = 58, dmg = 5, xp = 2,
})

function RingDrone:think(dt, dx, dy, d, nx, ny)
  local spd = self.spd
  local approach = math.min(spd, math.max(0, d - 44) * 1.2) * 0.8
  return nx * approach - ny * spd * self.dir, ny * approach + nx * spd * self.dir
end

return RingDrone
