-- The player moves with the D-pad. Save the file while the game runs and the change shows at once.
local Player = gs.entity{
  tags = { "player" },
  speed = 90,                     -- pixels a second
}

function Player:update(dt)
  local dx, dy = gs.input.dir()
  self.x = self.x + dx * self.speed * dt
  self.y = self.y + dy * self.speed * dt
end

function Player:draw()
  gs.draw.rect(self.x - 8, self.y - 8, 16, 16, "#ea5a4b")
end

return Player
