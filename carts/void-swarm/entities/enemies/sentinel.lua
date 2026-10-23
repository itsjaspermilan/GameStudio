-- Sentinel: a slow turret. It keeps coming until it is 150 pixels away and then fires a ring of
-- eight shots every 2.4 seconds.
local Enemy = require "entities.enemy"
local run = require "lib.run"

local Sentinel = gs.entity(Enemy, {
  kind = "sentinel", sprite = "spr_e_sentinel", hitbox = { r = 11 },
  cap = 3, hp = 70, spd = 10, dmg = 8, xp = 6,
})

function Sentinel:think(dt, dx, dy, d, nx, ny)
  local vx, vy = 0, 0
  if d > 150 then vx, vy = nx * self.spd, ny * self.spd end
  if self.t > 2.4 then
    self.t = 0
    local o = math.random() * math.pi * 2
    for i = 0, 7 do run.enemy_bullet(self.x, self.y, o + i * math.pi / 4, 80, 7, "shot2") end
  end
  return vx, vy
end

return Sentinel
