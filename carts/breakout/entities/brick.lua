-- A brick. `row` (0 at the top) picks its color, and higher rows are worth more and ring higher.
local Brick = gs.entity{
  sprite = "spr_brick",
  tags = { "brick" },
  row = 0,
}

-- the color of each row as a place in Dot's palette, for the sparks
local SPARK = { 6, 10, 14, 18, 22, 30 }

function Brick:create()
  self.frame = self.row      -- the sprite is a strip of six colors
end

function Brick:hit()
  local state = require("lib.state")
  state.add_score(10 * (6 - self.row))
  gs.sfx(self.row < 2 and "sfx_brick_hi" or self.row < 4 and "sfx_brick_mid" or "sfx_brick_lo")
  gs.burst(self.x + 12, self.y + 4, { count = 10, color = SPARK[self.row + 1], speed = { 20, 60 }, gravity = 160, life = { 0.25, 0.5 } })
  self:destroy()
end

return Brick
