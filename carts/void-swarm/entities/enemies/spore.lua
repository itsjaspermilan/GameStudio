-- Spore Cloud: a big slow cloud. Standing inside its aura hurts the player twice a second.
local Enemy = require "entities.enemy"
local run = require "lib.run"
local ui = require "lib.ui"

local Spore = gs.entity(Enemy, {
  kind = "spore", sprite = "spr_e_spore", hitbox = { r = 21 },
  cap = 5, hp = 90, spd = 16, dmg = 4, xp = 8,
  aura = 0,
})

function Spore:think(dt, dx, dy, d, nx, ny)
  if d < 44 then
    self.aura = self.aura - dt
    if self.aura <= 0 then self.aura = 0.5; run.hurt_player(3, "spore") end
  end
  return nx * self.spd, ny * self.spd
end

function Spore:draw_extras()
  ui.spr("spr_p_dangerzone", self.t * 3, self.x, self.y, 2.13, false, 0, 70)
end

return Spore
