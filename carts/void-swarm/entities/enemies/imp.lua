-- Imp: walks at the player and, every three seconds or so, blinks to a new spot 75 pixels from
-- them.
local Enemy = require "entities.enemy"
local run = require "lib.run"

local Imp = gs.entity(Enemy, {
  kind = "imp", sprite = "spr_e_imp", hitbox = { r = 9 },
  cap = 10, hp = 20, spd = 44, dmg = 6, xp = 3,
})

function Imp:think(dt, dx, dy, d, nx, ny)
  if self.t > 3 then
    self.t = math.random() * 0.8
    run.fx("pop", self.x, self.y, 0.3)
    local a = math.random() * math.pi * 2
    local P = run.P
    self.x, self.y = P.x + math.cos(a) * 75, P.y + math.sin(a) * 75
    run.fx("pop", self.x, self.y, 0.3)
  end
  return nx * self.spd, ny * self.spd
end

return Imp
