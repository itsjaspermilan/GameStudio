-- A rivet turret (Now): hangs from the ceiling and fires a spread of three bolts at Wren when Wren
-- is below and near.
local Enemy = require "entities.enemy"

local Turret = gs.entity(Enemy, {
  sprite = "spr_turret",
  hitbox = { r = 7 },
  era = "now", hp = 4, mid = 0, contact = 1,
  t = 0, wait = 2.2,
})

function Turret:create() self.t = gs.random() * self.wait end

function Turret:update(dt)
  self:update_flash(dt)
  self.t = self.t + dt
  self.frame = self.t > self.wait - 0.3 and 1 or 0
  if self.t < self.wait then return end
  self.t = 0
  local h = self:sees_hero(180)
  if not h or h.y < self.y then return end
  local a = gs.angle(self.x, self.y + 6, h.x, h.y - 14)
  for _, off in ipairs({ -18, 0, 18 }) do
    local s = gs.spawn("enemy_shot", self.x, self.y + 6, { era = self.era, frame = 2 })
    if s then s:set_velocity(a + off, 110) end
  end
  gs.sfx("sfx_eshot", 0.4)
end

return Turret
