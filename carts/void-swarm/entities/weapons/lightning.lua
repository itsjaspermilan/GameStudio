-- One jump of the arc coil's lightning: a jagged line from one point to another that is there for a moment.
local Lightning = gs.entity{
  tags = { "lightning" },
  depth = 15,
  t = 0.14,
}

local WHITE, BLUE = { 255, 246, 168 }, { 169, 212, 255, 160 }

function Lightning:update(dt)
  self.t = self.t - dt
  if self.t <= 0 then self:destroy() end
end

function Lightning:draw()
  local x1, y1, x2, y2 = self.x1, self.y1, self.x2, self.y2
  local mx, my = (x1 + x2) / 2 + math.random(-5, 5), (y1 + y2) / 2 + math.random(-5, 5)
  gs.draw.line(x1, y1, mx, my, WHITE); gs.draw.line(mx, my, x2, y2, WHITE)
  gs.draw.line(x1 + 1, y1, mx + 1, my, BLUE); gs.draw.line(mx + 1, my, x2 + 1, y2, BLUE)
end

return Lightning
