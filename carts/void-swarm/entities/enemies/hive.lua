-- Hive: slow and sturdy, and it releases a gnat every 3.2 seconds.
local Enemy = require "entities.enemy"
local run = require "lib.run"
local audio = require "lib.audio"

local Hive = gs.entity(Enemy, {
  kind = "hive", sprite = "spr_e_hive", hitbox = { r = 14 },
  cap = 3, hp = 120, spd = 15, dmg = 8, xp = 10,
})

function Hive:think(dt, dx, dy, d, nx, ny)
  if self.t > 3.2 then
    self.t = 0
    run.spawn_enemy("gnat", self.x, self.y)
    audio.sfx("sfx_move", 6)
  end
  return nx * self.spd, ny * self.spd
end

return Hive
