local Hero = gs.entity{ sprite = "hero", tags = { "hero" }, hitbox = { r = 7 } }

function Hero:create()
  self.t, self.gems = 0, 0
  self:every(0.1, function()
    local target = gs.nearest(self.x, self.y, "bat", 160)
    if target then
      local b = gs.spawn("bolt", self.x, self.y)
      b:move_toward(target, 220)
    end
  end)
end

function Hero:update(dt)
  self.t = self.t + dt
  self.vx, self.vy = math.cos(self.t * 0.5) * 50, math.sin(self.t * 0.5) * 50
end

function Hero:on_collide_gem(gem)
  self.gems = self.gems + 1
  gem:destroy()
end

return Hero
