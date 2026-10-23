-- A hazard from the sector: a reticle shows where it comes from (at the edge of the screen) for
-- `delay` seconds, then it streaks through.
local EBullet = require "entities.bullets.ebullet"
local ui = require "lib.ui"

local Meteor = gs.entity(EBullet, { kind = "meteor", sprite = "spr_p_meteor", hitbox = { r = 9 }, delay = 0.8, life = 3 })

function Meteor:create()
  EBullet.create(self)
  self.start_vx, self.start_vy = self.vx, self.vy
  self.vx, self.vy = 0, 0                         -- waits while the reticle shows
  self.angle = math.deg(math.atan(self.start_vy, self.start_vx))
end

function Meteor:update(dt)
  if self.delay > 0 then
    self.delay = self.delay - dt
    if self.delay <= 0 then self.vx, self.vy = self.start_vx, self.start_vy end
    return
  end
  EBullet.update(self, dt)
end

function Meteor:on_collide_player(p)
  if self.delay > 0 then return end
  EBullet.on_collide_player(self, p)
end

function Meteor:draw()
  if self.delay > 0 then
    local cam = gs.camera
    local ex, ey = math.max(cam.x + 10, math.min(cam.x + 320 - 10, self.x)), math.max(cam.y + 10, math.min(cam.y + 240 - 10, self.y))
    ui.spr("spr_p_reticle", gs.world.step_id / 6, ex, ey)
  else
    self:draw_sprite()
  end
end

return Meteor
