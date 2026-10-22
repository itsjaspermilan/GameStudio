-- Minelayer: circles the player at a distance and leaves mines behind (one every 1.5 seconds, each lasting nine).
local Enemy = require "entities.enemy"
local run = require "lib.run"

local Minelayer = gs.entity(Enemy, {
  kind = "minelayer", sprite = "spr_e_minelayer", hitbox = { r = 6 },
  cap = 4, hp = 24, spd = 42, dmg = 4, xp = 3,
})

function Minelayer:think(dt, dx, dy, d, nx, ny)
  local spd = self.spd
  local vx, vy
  if d > 120 then vx, vy = nx * spd, ny * spd else vx, vy = -ny * spd * self.dir, nx * spd * self.dir end
  if self.t > 1.5 then
    self.t = 0
    run.enemy_bullet(self.x, self.y, 0, 0, 9, "mine", 9)
  end
  return vx, vy
end

return Minelayer
