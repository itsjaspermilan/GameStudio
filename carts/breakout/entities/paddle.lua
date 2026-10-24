-- The paddle slides left and right with the d-pad and stays on screen.
local Paddle = gs.entity{
  sprite = "spr_paddle",
  tags = { "paddle" },
  speed = 240,                       -- pixels a second
}

function Paddle:update(dt)
  local dx = gs.input.dir()
  self.x = gs.clamp(self.x + dx * self.speed * dt, 0, gs.screen() - self:width())
end

return Paddle
