-- A pilot echo (Then): a crew member re-living the day of the launch. It paces its floor and runs at Wren when Wren comes near in Then.
local Enemy = require "entities.enemy"
local tiles = require "lib.tiles"

local Echo = gs.entity(Enemy, {
  sprite = "spr_echo_pilot",
  hitbox = { -6, -28, 12, 28 },
  era = "then", hp = 2, mid = 16, puff = "#a6f4e6",
  dir = 1, pace = 35, run = 115, t = 0, fall = 0,
})

function Echo:update(dt)
  self:update_flash(dt)
  self.t = self.t + dt
  local h = self:sees_hero(130, 40)
  local speed = self.pace
  if h then self.dir, speed = gs.sign(h.x - self.x), self.run end
  if self.dir == 0 then self.dir = 1 end
  local nx, hit = tiles.move_x(self.x, self.y, 12, 28, self.dir * speed * dt, self.era)
  if hit or not tiles.ground_at(nx + self.dir * 7, self.y, self.era) then
    if not h then self.dir = -self.dir end
  else
    self.x = nx
  end
  self.flip = self.dir < 0
  self.frame = math.floor(self.t * (speed > 50 and 12 or 6)) % 4
end

-- echoes shimmer: drawn a little see-through even in Then
function Echo:draw()
  if self.flash > 0 and math.floor(self.flash * 40) % 2 == 0 then return end
  self.alpha = require("lib.lens").sees(self.era) and (0.75 + math.sin(self.t * 9) * 0.15) or 0.2
  self:draw_sprite()
end

return Echo
