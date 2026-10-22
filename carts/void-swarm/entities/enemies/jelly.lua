-- Jelly: weaves from side to side as it comes.
local Enemy = require "entities.enemy"

local Jelly = gs.entity(Enemy, {
  kind = "jelly", sprite = "spr_e_jelly", hitbox = { r = 6 },
  hp = 18, spd = 46, dmg = 6, xp = 2,
})

function Jelly:think(dt, dx, dy, d, nx, ny)
  local w = math.sin(self.t * 4) * self.spd * 0.9
  return nx * self.spd - ny * w, ny * self.spd + nx * w
end

return Jelly
