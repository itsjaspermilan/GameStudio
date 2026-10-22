-- Vortex Eye: drifts at the player and drags the player toward it when they are within 100 pixels.
local Enemy = require "entities.enemy"
local run = require "lib.run"

local Vortex = gs.entity(Enemy, {
  kind = "vortex", sprite = "spr_e_vortex", hitbox = { r = 7 },
  cap = 4, hp = 50, spd = 18, dmg = 5, xp = 6,
})

function Vortex:think(dt, dx, dy, d, nx, ny)
  if d < 100 then
    local P = run.P
    P.px, P.py = P.px + nx * 40 * dt * 60, P.py + ny * 40 * dt * 60     -- the player's own update turns this push into movement
  end
  return nx * self.spd, ny * self.spd
end

return Vortex
