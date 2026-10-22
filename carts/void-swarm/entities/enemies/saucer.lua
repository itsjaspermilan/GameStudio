-- Saucer: keeps its distance (100 to 125 pixels) and shoots at the player every few seconds.
local Enemy = require "entities.enemy"
local run = require "lib.run"

local Saucer = gs.entity(Enemy, {
  kind = "saucer", sprite = "spr_e_saucer", hitbox = { r = 6 },
  cap = 6, hp = 22, spd = 36, dmg = 4, xp = 3,
})

function Saucer:think(dt, dx, dy, d, nx, ny)
  local spd = self.spd
  local vx, vy
  if d > 125 then vx, vy = nx * spd, ny * spd
  elseif d < 90 then vx, vy = -nx * spd, -ny * spd
  else vx, vy = -ny * spd * 0.5 * self.dir, nx * spd * 0.5 * self.dir end
  if self.t > 3.0 then
    self.t = math.random() * 0.8
    run.enemy_bullet(self.x, self.y, math.atan(dy, dx), 85, 6, "shot")
  end
  return vx, vy
end

return Saucer
