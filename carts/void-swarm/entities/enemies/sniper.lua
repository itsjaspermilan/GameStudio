-- Sniper: keeps far away (130 to 175 pixels). It takes aim for two seconds (a white line shows where) and then fires one fast, hard shot.
local Enemy = require "entities.enemy"
local run = require "lib.run"

local Sniper = gs.entity(Enemy, {
  kind = "sniper", sprite = "spr_e_sniper", hitbox = { r = 6 },
  cap = 3, hp = 24, spd = 28, dmg = 5, xp = 4,
})

local AIM = { 255, 255, 255, 140 }

function Sniper:think(dt, dx, dy, d, nx, ny)
  local spd = self.spd
  local vx, vy = 0, 0
  if d > 175 then vx, vy = nx * spd, ny * spd elseif d < 130 then vx, vy = -nx * spd, -ny * spd end
  if self.t > 3 then self.t = 0 end
  if self.t > 2 and not self.aim then self.aim = math.atan(dy, dx) end
  if self.t < 2 then self.aim = nil end
  if self.aim and self.t > 2.9 then
    self.t = 3.05
    run.enemy_bullet(self.x, self.y, self.aim, 230, 14, "bossshot", 2.4)
    self.aim = nil
  end
  return vx, vy
end

function Sniper:draw_extras()
  if self.aim then gs.draw.line(self.x, self.y, self.x + math.cos(self.aim) * 300, self.y + math.sin(self.aim) * 300, AIM) end
end

return Sniper
