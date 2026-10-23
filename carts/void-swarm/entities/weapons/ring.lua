-- The plasma nova: a ring that grows from the player and shoves back what it passes. It hurts an
-- enemy once, when the ring reaches it.
local run = require "lib.run"
local ui = require "lib.ui"

local Ring = gs.entity{
  tags = { "ring" },
  depth = 14,
  hitbox = { r = 16 },                -- the hit area is scaled to the ring's size every step
  t = 0,                              -- negative: waiting to start (a second ring of the same nova)
  r = 8,
  max = 72,
  dmg = 1,
  visible = false,
}

function Ring:create() self.hit = {} end

function Ring:update(dt)
  self.t = self.t + dt
  if self.t < 0 then return end
  self.visible = true
  local p = math.min(1, self.t / 0.5)
  self.r = 8 + (self.max - 8) * p
  self.x, self.y = run.P.x, run.P.y
  self.sx = (self.r + 4) / 16
  self.sy = self.sx
  if p >= 1 then self:destroy() end
end

function Ring:on_collide_enemy(e)
  if self.t < 0 or self.hit[e] then return end
  local dx, dy = e.x - self.x, e.y - self.y
  local d = math.sqrt(dx * dx + dy * dy)
  if d >= self.r - 10 then
    self.hit[e] = true
    e:hurt(self.dmg, dx / (d + 0.01) * 140, dy / (d + 0.01) * 140)
  end
end

function Ring:draw()
  gs.draw.blend("add")
  ui.spr("spr_p_ring", 0, self.x, self.y, self.r / 48, false, 0, 255 * (1 - self.t / 0.6))
  gs.draw.blend()
end

return Ring
