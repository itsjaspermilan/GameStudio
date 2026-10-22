-- A short animation (an explosion, a spark, a puff): it plays its sprite once over `life` seconds
-- and goes away. Made by run.fx.
local Fx = gs.entity{
  tags = { "fx" },
  depth = 10,
  life = 0.4,
  anim_speed = 0,                     -- the frame follows the lifetime, not the sprite's own speed
  t = 0,
}

function Fx:update(dt)
  self.t = self.t + dt
  if self.t >= self.life then self:destroy() return end
  local frames = gs.assets.sprite(self.sprite).frames
  self.frame = math.min(frames - 1, math.floor(self.t / self.life * frames))
end

return Fx
