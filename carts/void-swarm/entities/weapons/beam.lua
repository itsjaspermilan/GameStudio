-- The lance's beam: lib/weapons.lua hurts everything along it the moment it is fired; this only
-- draws it, fading out.
local ui = require "lib.ui"

local Beam = gs.entity{
  tags = { "beam" },
  depth = 15,
  ang = 0,
  len = 230,
  w = 5,
  t = 0.2,
  life = 0.2,
}

function Beam:update(dt)
  self.t = self.t - dt
  if self.t <= 0 then self:destroy() end
end

function Beam:draw()
  local p = self.t / self.life
  local ca, sa = math.cos(self.ang), math.sin(self.ang)
  local ex, ey = self.x + ca * self.len, self.y + sa * self.len
  local th = math.max(1, math.floor(self.w * p))
  for k = -th, th do
    local ox, oy = -sa * k * 0.5, ca * k * 0.5
    gs.draw.line(self.x + ox, self.y + oy, ex + ox, ey + oy, { 120 + 80 * (1 - math.abs(k) / (th + 1)), 255, 160, 255 })
  end
end

return Beam
