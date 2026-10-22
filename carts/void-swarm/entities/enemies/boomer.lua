-- Boomer: walks at the player; close up it lights a fuse and blows up after 0.7 seconds, hurting the player if they are still near.
local Enemy = require "entities.enemy"
local run = require "lib.run"
local audio = require "lib.audio"

local Boomer = gs.entity(Enemy, {
  kind = "boomer", sprite = "spr_e_boomer", hitbox = { r = 6 },
  cap = 10, hp = 16, spd = 52, dmg = 4, xp = 2,
})

function Boomer:setup() self:play("walk") end

-- self.st: 0 walking, 1 fuse lit
function Boomer:think(dt, dx, dy, d, nx, ny)
  local spd = self.spd
  if self.st == 0 then
    if d < 32 then self.st, self.fuse = 1, 0.7; self:play("fuse") end
    return nx * spd, ny * spd
  end
  self.fuse = self.fuse - dt
  if self.fuse <= 0 then
    run.fx("boom", self.x, self.y, 0.45, 2.2)
    audio.sfx("sfx_explode", 4)
    if d < 36 then run.hurt_player(18, "boomer") end
    run.drop(self)
    self:destroy()
    return 0, 0
  end
  return nx * spd * 0.3, ny * spd * 0.3
end

return Boomer
