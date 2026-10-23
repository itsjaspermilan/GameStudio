-- A Hollow (Then): the shape of a Wren who did not make it. Only comes when Static is high, drifts
-- through walls toward Wren, and fades away again when Static falls.
local Enemy = require "entities.enemy"
local lens = require "lib.lens"

local Hollow = gs.entity(Enemy, {
  sprite = "spr_hollow",
  hitbox = { r = 9 },
  era = "then", hp = 3, mid = 0, puff = "#6a3fb5", depth = 15,
  t = 0, fade = 0,
})

function Hollow:update(dt)
  self:update_flash(dt)
  self.t = self.t + dt
  self.fade = math.min(1, self.fade + dt)
  local h = self:hero()
  if h then self:move_toward(h.x, h.y - 14, lens.era == "then" and 38 or 15) end
  self.flip = h and h.x < self.x
  self.frame = math.floor(self.t * 3) % 2
  if lens.unease() <= 0 then
    self.fade = self.fade - dt * 3
    if self.fade <= -1 then self:destroy() end
  end
end

function Hollow:draw()
  if self.flash > 0 and math.floor(self.flash * 40) % 2 == 0 then return end
  local a = math.max(0, math.min(1, self.fade)) * (lens.sees(self.era) and 0.85 or 0.2)
  self.alpha = a
  self:draw_sprite()
end

return Hollow
