-- A small thing for the Lua side of the bench: it drifts, bounces off the screen's edges and off other movers.
local Mover = gs.entity{ sprite = "star", tags = { "mover" } }

function Mover:create()
  self.sx, self.sy = 0.25, 0.25
  self:set_velocity(gs.choose(-1, 1) * (30 + self.id % 40), gs.choose(-1, 1) * (20 + self.id % 50))
end

function Mover:update(dt)
  if self.x < 0 or self.x > 256 then self.vx = -self.vx end
  if self.y < 0 or self.y > 192 then self.vy = -self.vy end
end

function Mover:on_collide_mover(other)
  self.vx, self.vy = -self.vx, -self.vy
end

return Mover
