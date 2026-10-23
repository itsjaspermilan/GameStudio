-- A shot fired by the player's pulse blaster, scatter cannon or missile launcher. The kinds (bolt,
-- pellet, missile) build on this.
-- It flies straight (the engine moves it by vx and vy), hurts what it touches, and is used up when
-- it has pierced enough enemies or its time runs out.
local run = require "lib.run"

local Shot = gs.entity{
  tags = { "shot" },
  depth = 20,
  hitbox = { r = 6 },
  anim_speed = 20 / 6,
  dmg = 1,
  pierce = 0,
  life = 1,
  t = 0,
}

function Shot:create()
  if self.pierce > 0 then self.hit = {} end
  self.angle = math.deg(math.atan(self.vy, self.vx))
end

function Shot:update(dt)
  self.t = self.t + dt
  self.life = self.life - dt
  if self.life <= 0 then self:expire() end
end

function Shot:expire() self:destroy() end

function Shot:on_collide_enemy(e)
  if self.hit and self.hit[e] then return end
  e:hurt(self.dmg, self.vx * 0.12, self.vy * 0.12)
  run.fx("spark", self.x, self.y, 0.2)
  if self.pierce > 0 then
    self.hit[e] = true
    self.pierce = self.pierce - 1
  else
    self:destroy()
  end
end

return Shot
