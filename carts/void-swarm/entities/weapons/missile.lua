-- A homing missile: it steers toward a target and blows up on the first enemy it touches, or when
-- its time runs out.
local Shot = require "entities.weapons.shot"
local run = require "lib.run"
local targets = require "lib.targets"

local Missile = gs.entity(Shot, { sprite = "spr_p_missile", hitbox = { r = 6 }, area = 24 })

function Missile:update(dt)
  local target = self.tgt
  if not target or not target:is_alive() then target = targets.nearest(self.x, self.y, 240); self.tgt = target end
  if target then
    local want = math.atan(target.y - self.y, target.x - self.x)
    local cur = math.atan(self.vy, self.vx)
    local d = (want - cur + math.pi) % (math.pi * 2) - math.pi
    cur = cur + math.max(-4.5 * dt, math.min(4.5 * dt, d))
    local speed = math.sqrt(self.vx * self.vx + self.vy * self.vy)
    self.vx, self.vy = math.cos(cur) * speed, math.sin(cur) * speed
    self.angle = math.deg(cur)
  end
  Shot.update(self, dt)
end

function Missile:expire()
  run.explode(self.x, self.y, self.area, self.dmg)
  self:destroy()
end

function Missile:on_collide_enemy(e)
  run.explode(self.x, self.y, self.area, self.dmg)
  self:destroy()
end

return Missile
