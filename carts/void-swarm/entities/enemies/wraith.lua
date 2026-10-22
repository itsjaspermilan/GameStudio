-- Wraith: fades out for part of every cycle. A faded wraith cannot be hurt, targeted or hurt the player.
local Enemy = require "entities.enemy"

local Wraith = gs.entity(Enemy, {
  kind = "wraith", sprite = "spr_e_wraith", hitbox = { r = 6 },
  cap = 12, hp = 22, spd = 52, dmg = 7, xp = 4,
})

function Wraith:think(dt, dx, dy, d, nx, ny)
  self.ghosted = self.t % 2.8 > 1.6
  self.alpha = self.ghosted and 90 / 255 or 1
  return nx * self.spd, ny * self.spd
end

return Wraith
