-- Comet: a warning line shows where it will fly, then it streaks across at great speed and is gone.
local Enemy = require "entities.enemy"
local audio = require "lib.audio"

local Comet = gs.entity(Enemy, {
  kind = "comet", sprite = "spr_e_comet", hitbox = { r = 9 },
  cap = 5, hp = 14, spd = 190, dmg = 10, xp = 2,
  strays = false, turns = false,
})

function Comet:setup() self.warn = 0.9 end

function Comet:think(dt, dx, dy, d, nx, ny)
  local vx, vy = 0, 0
  if self.warn > 0 then
    self.warn = self.warn - dt
    if not self.dx then self.dx, self.dy = nx, ny; self.angle = math.deg(math.atan(ny, nx)) end   -- locks on to where the player is now
    if self.warn <= 0 then audio.sfx("sfx_meteor", 6) end
  else
    vx, vy = self.dx * self.spd, self.dy * self.spd
  end
  if d > 400 then self:destroy() end
  return vx, vy
end

function Comet:draw_extras()
  if self.warn > 0 and self.dx then gs.draw.line(self.x, self.y, self.x + self.dx * 400, self.y + self.dy * 400, "#ea5a4b78") end
end

return Comet
