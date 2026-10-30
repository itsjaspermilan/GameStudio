local P = require "lib.playground"
local course = require "lib.course"
-- The scene draws runners above the course, with numbered labels.
local Runner = gs.entity{ sprite = "runner", tags = { "runner" }, visible = false }

function Runner:create()
  self.bank, self.score, self.jump_speed = P.banks[self.player], 0, 0
  self.grounded, self.walking = true, false
end

function Runner:update()
  if gs.world.scene.winner ~= 0 then return end
  local dx = select(1, gs.input.dir(self.player))
  self.x = math.max(16, math.min(240, self.x + dx * 2))
  self.walking = dx ~= 0
  if dx ~= 0 then self.flip = dx < 0 end
  if self.grounded and gs.input.pressed("a", self.player) then
    self.jump_speed, self.grounded = -5, false
    gs.sfx("jump")
  end
  local previous = self.y
  self.jump_speed = self.jump_speed + 0.25
  self.y, self.grounded = self.y + self.jump_speed, false
  if self.jump_speed >= 0 then
    for i, platform in ipairs(course.platforms) do
      local dropping = i > 1 and gs.input.held("down", self.player)
      if not dropping and previous <= platform.y and self.y >= platform.y and self.x + 7 > platform.x and self.x - 7 < platform.x + platform.w then
        self.y, self.jump_speed, self.grounded = platform.y, 0, true
        break
      end
    end
  end
  if not self.grounded then self:play("jump")
  elseif self.walking then self:play("walk")
  else self:play("idle") end
end

return Runner
