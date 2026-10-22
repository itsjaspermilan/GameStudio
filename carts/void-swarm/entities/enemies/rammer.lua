-- Rammer: walks, then stops and aims (a red line shows where), then charges in a straight line at five times its speed.
local Enemy = require "entities.enemy"

local Rammer = gs.entity(Enemy, {
  kind = "rammer", sprite = "spr_e_rammer", hitbox = { r = 6 },
  cap = 10, hp = 28, spd = 40, dmg = 12, xp = 3,
})

local WARNING = { 234, 90, 75, 160 }

-- self.st: 0 walking, 1 aiming, 2 charging
function Rammer:think(dt, dx, dy, d, nx, ny)
  local spd = self.spd
  if self.st == 0 then
    if d < 120 and self.t > 1.2 then self.st, self.t, self.cx, self.cy = 1, 0, nx, ny end
    return nx * spd, ny * spd
  elseif self.st == 1 then
    self.cx, self.cy = nx, ny
    if self.t > 0.6 then self.st, self.t = 2, 0 end
    return 0, 0
  end
  if self.t > 0.5 then self.st, self.t = 0, 0 end
  return self.cx * spd * 5, self.cy * spd * 5
end

function Rammer:draw_extras()
  if self.st == 1 then gs.draw.line(self.x, self.y, self.x + self.cx * 90, self.y + self.cy * 90, WARNING) end
end

return Rammer
