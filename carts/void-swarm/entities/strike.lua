-- A blast that lands after a warning: a red circle (or, for the player's comet, a reticle) grows for `total` seconds, then it explodes.
-- Enemy strikes hurt the player if they are inside; the player's own (mine = true) hurt enemies.
local run = require "lib.run"
local audio = require "lib.audio"
local ui = require "lib.ui"

local Strike = gs.entity{
  tags = { "strike" },
  depth = 84,
  t = 1,
  total = 1,
  r = 22,
  dmg = 14,
  mine = false,
}

function Strike:update(dt)
  self.t = self.t - dt
  if self.t > 0 then return end
  if self.mine then
    run.explode(self.x, self.y, self.r, self.dmg, self.r / 14)
  else
    run.fx("boom", self.x, self.y, 0.4, self.r / 18)
    audio.sfx("sfx_explode", 4)
    local P = run.P
    local dx, dy = P.x - self.x, P.y - self.y
    if math.sqrt(dx * dx + dy * dy) < self.r + 3 then run.hurt_player(self.dmg, "strike") end
  end
  self:destroy()
end

function Strike:draw()
  local p = 1 - self.t / self.total
  ui.spr("spr_p_dangerzone", gs.world.step_id / 6, self.x, self.y, self.r / 8 * (0.7 + 0.3 * p), false, 0, 140 + 100 * p)
  if self.mine then ui.spr("spr_p_reticle", gs.world.step_id / 5, self.x, self.y, self.r / 14) end
end

return Strike
