-- The ball rides on the paddle until A is pressed, then bounces off the walls, the paddle and the
-- bricks.
local state = require "lib.state"

local Ball = gs.entity{
  sprite = "spr_ball",
  tags = { "ball" },
  launched = false,
  max_speed = 330,                   -- pixels a second
}

function Ball:update(dt)
  if not self.launched then
    local paddle = gs.first("paddle")
    self.x = paddle.x + paddle:width() / 2 - self:width() / 2
    self.y = paddle.y - self:height() - 1
    if gs.input.pressed("a") then
      self.launched = true
      self:set_velocity(gs.choose(-70, -110), 200)          -- up and a little to one side
      gs.sfx("sfx_launch")
    end
    return
  end
  -- walls and ceiling (the score line takes the top 16 pixels)
  local w = self:width()
  if self.x < 0 then self.x, self.vx = 0, math.abs(self.vx); gs.sfx("sfx_wall")
  elseif self.x + w > 320 then self.x, self.vx = 320 - w, -math.abs(self.vx); gs.sfx("sfx_wall") end
  if self.y < 16 then self.y, self.vy = 16, math.abs(self.vy); gs.sfx("sfx_wall") end
  if self.y > 240 then self:lose_life() end
end

function Ball:lose_life()
  state.lives = state.lives - 1
  gs.sfx("sfx_lose")
  if state.lives <= 0 then gs.goto_scene("scenes.over", { fade = 0.3 }, false)
  else self.launched, self.vx, self.vy = false, 0, 0 end
end

-- hitting the paddle: where the ball lands decides the angle (the middle sends it straight up) and
-- it speeds up a little
function Ball:on_collide_paddle(paddle)
  if self.vy <= 0 then return end
  local hit = gs.clamp(((self.x + self:width() / 2) - (paddle.x + paddle:width() / 2)) / (paddle:width() / 2), -1, 1)
  local speed = math.min(self:speed() * 1.02, self.max_speed)
  self:set_velocity(270 + hit * 53, speed)
  self.y = paddle.y - self:height()
  gs.sfx("sfx_paddle")
end

function Ball:on_collide_brick(brick)
  -- bounce off the side we hit: a ball that is mostly beside the brick turns around sideways,
  -- otherwise upside down
  local cx, cy = self.x + self:width() / 2, self.y + self:height() / 2
  local bx, by = brick.x + brick:width() / 2, brick.y + brick:height() / 2
  if math.abs(cx - bx) / brick:width() > math.abs(cy - by) / brick:height() then self.vx = -self.vx else self.vy = -self.vy end
  brick:hit()
end

return Ball
