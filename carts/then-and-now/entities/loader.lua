-- A loader drone (Now): rolls back and forth on its floor, turning at walls and ledges, and charges when it sees Wren on its level.
local Enemy = require "entities.enemy"
local tiles = require "lib.tiles"

local Loader = gs.entity(Enemy, {
  sprite = "spr_loader",
  hitbox = { -10, -20, 20, 20 },
  era = "now", hp = 3, mid = 10, puff = "#e8913a",
  dir = -1, roll = 30, rush = 120, rushing = 0, t = 0,
})

function Loader:update(dt)
  self:update_flash(dt)
  self.t = self.t + dt
  local h = self:sees_hero(140, 20)
  if h and self.rushing <= 0 and gs.sign(h.x - self.x) == self.dir then self.rushing = 1.2; gs.sfx("sfx_alarm", 0.3) end
  self.rushing = self.rushing - dt
  local speed = self.rushing > 0 and self.rush or self.roll
  local nx, hit = tiles.move_x(self.x, self.y, 20, 20, self.dir * speed * dt, self.era)
  -- turn round at walls and at the edge of its floor
  if hit or not tiles.ground_at(nx + self.dir * 11, self.y, self.era) then
    self.dir, self.rushing = -self.dir, 0
  else
    self.x = nx
  end
  self.flip = self.dir < 0
  self.frame = self.rushing > 0 and 2 or math.floor(self.t * 6) % 2
end

return Loader
