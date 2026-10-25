-- A brick. `row` (0 at the top) picks its color, and higher rows are worth more and ring higher.
local Brick = gs.entity{
  sprite = "brick",
  tags = { "brick" },
  row = 0,
}

-- the light colour of each row in the "bricks" colour bank (palette.json), for the sparks
local SPARK = { "bricks:4", "bricks:6", "bricks:8", "bricks:10", "bricks:12", "bricks:14" }

function Brick:create()
  self.frame = self.row      -- the sprite is a strip of six colors
end

function Brick:hit()
  local state = require("lib.state")
  state.add_score(10 * (6 - self.row))
  gs.sfx(self.row < 2 and "brick_hi" or self.row < 4 and "brick_mid" or "brick_lo")
  gs.burst(self.x + 16, self.y + 8, { count = 10, color = SPARK[self.row + 1], speed = { 20, 60 }, gravity = 160, life = { 0.25, 0.5 } })
  self:destroy()
end

return Brick
