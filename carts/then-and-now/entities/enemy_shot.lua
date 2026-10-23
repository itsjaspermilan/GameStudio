-- An enemy's shot: belongs to an era like everything else, stops at that era's walls. gravity > 0
-- makes it fall (burning debris).
local tiles = require "lib.tiles"
local lens = require "lib.lens"

local Shot = gs.entity{
  sprite = "spr_eshot",
  tags = { "enemy_shot" },
  depth = 12,
  hitbox = { r = 3 },
  era = "now", damage = 1, life = 3, gravity = 0,
}

function Shot:update(dt)
  self.life = self.life - dt
  self.vy = self.vy + self.gravity * dt
  if self.life <= 0 or tiles.wall_at(self.x, self.y, self.era) then
    if lens.sees(self.era) then gs.burst(self.x, self.y, { count = 4, color = "#e8913a", speed = { 10, 40 }, spread = 360, life = 0.2, depth = 11 }) end
    self:destroy()
  end
end

function Shot:draw()
  self.alpha = lens.sees(self.era) and 1 or 0.25
  self:draw_sprite()
end

return Shot
