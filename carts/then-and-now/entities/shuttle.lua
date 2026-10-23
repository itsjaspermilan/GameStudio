-- The boss of the Hangar Ring: Ossie's last launch. It exists in both eras at once. In Then it is the shuttle trying to launch, its
-- engine lit, and only there can Wren's shots hurt it; in Now it is the burning wreck, which only rains debris. So Wren has to stay in
-- Then to fight it, while Static climbs, and flip back to Now to let Static settle, dodging what falls.
--   phase 1: drifts across the top; Then fires a fan of the memory's flame, Now drops debris
--   phase 2 (under 2/3 health): faster, more of both
--   phase 3 (under 1/3): also dives across the bay (it hurts in both eras), flashing first
local Enemy = require "entities.enemy"
local lens = require "lib.lens"

local Shuttle = gs.entity(Enemy, {
  sprite = "spr_shuttle",
  hitbox = { -26, -10, 52, 22 },
  era = "both", hp = 44, contact = 1, depth = 25, mid = 0,
  hp_max = 44, t = 0, attack = 2, debris = 1.2, phase = 1,
  dive = nil, warn = 0, dir = 1, intro = 1.5, dying = nil,
})

function Shuttle:create()
  self.home_y = self.y
  self.hp_max = self.hp
end

function Shuttle:phase_now()
  local f = self.hp / self.hp_max
  return f > 2 / 3 and 1 or f > 1 / 3 and 2 or 3
end

function Shuttle:hurt(n, by)
  if self.dead or self.dying or self.intro > 0 then return end
  -- only the shuttle as it was can be hurt: in Now there is nothing left to break
  if by and by.era ~= "then" then
    gs.sfx("sfx_ping", 0.4)
    return
  end
  self.hp = self.hp - n
  self.flash = 0.08
  gs.sfx("sfx_hit", 0.4)
  local p = self:phase_now()
  if p ~= self.phase then
    self.phase = p
    gs.camera:shake(4, 0.3)
    gs.sfx("sfx_alarm", 0.6)
  end
  if self.hp <= 0 then self:start_dying() end
end

function Shuttle:start_dying()
  self.dying, self.vx, self.vy, self.dive = 2.4, 0, 0, nil
  self.contact = 0
  gs.sfx("sfx_big_boom", 0.8)
end

function Shuttle:fan()
  local n = self.phase == 1 and 5 or 7
  for i = 0, n - 1 do
    local a = 50 + i * (80 / (n - 1))
    local s = gs.spawn("enemy_shot", self.x + (self.flip and 22 or -22), self.y + 4, { era = "then", frame = 1 })
    if s then s:set_velocity(a, 95 + self.phase * 10) end
  end
  gs.sfx("sfx_eshot", 0.5)
end

function Shuttle:drop()
  local x = gs.random(24, gs.limits.screen_w - 24)
  local s = gs.spawn("enemy_shot", x, 20, { era = "now", frame = 0, gravity = 220, life = 2.5 })
  if s then s.vy = 20 end
end

function Shuttle:update(dt)
  self:update_flash(dt)
  self.t = self.t + dt
  self.frame = lens.era == "then" and 0 or 1
  local W = gs.limits.screen_w
  if self.dying then
    self.dying = self.dying - dt
    if math.floor(self.dying * 10) % 2 == 0 then
      gs.burst(self.x + gs.random(-26, 26), self.y + gs.random(-10, 10), { count = 6, color = gs.choose("#ea5a4b", "#f5d94a", "#ffffff"), speed = { 20, 90 }, spread = 360, life = 0.4, depth = 8 })
    end
    self.y = self.y + 20 * dt
    if self.dying <= 0 then
      self.dead = true
      gs.camera:shake(6, 0.6)
      gs.sfx("sfx_big_boom", 0.9)
      gs.burst(self.x, self.y, { count = 60, color = "#ffd08a", speed = { 40, 160 }, spread = 360, life = { 0.3, 0.8 }, gravity = 120, depth = 8 })
      gs.send(gs.world.scene, "boss_down")
      self:destroy()
    end
    return
  end
  if self.intro > 0 then
    self.intro = self.intro - dt
    self.y = self.home_y - 40 * self.intro
    return
  end
  if self.dive then
    -- a dive: low across the bay and back up
    local d = self.dive
    d.t = d.t + dt
    local k = d.t / 1.4
    self.x = d.x0 + (d.x1 - d.x0) * k
    self.y = self.home_y + math.sin(k * math.pi) * 110
    self.flip = d.x1 < d.x0
    if k >= 1 then self.dive, self.y = nil, self.home_y end
    return
  end
  -- drift across the top
  local speed = 36 + self.phase * 14
  self.x = self.x + self.dir * speed * dt
  if self.x > W - 40 then self.dir = -1 elseif self.x < 40 then self.dir = 1 end
  self.y = self.home_y + math.sin(self.t * 2) * 8
  self.flip = self.dir < 0
  self.attack = self.attack - dt
  self.debris = self.debris - dt
  if self.warn > 0 then
    self.warn = self.warn - dt
    if self.warn <= 0 then self.dive = { t = 0, x0 = self.x, x1 = self.x < W / 2 and W - 40 or 40 } end
    return
  end
  if self.attack <= 0 then
    self.attack = self.phase == 1 and 2.4 or self.phase == 2 and 1.8 or 1.6
    if self.phase == 3 and gs.random() < 0.4 then
      self.warn = 0.8
      gs.sfx("sfx_alarm", 0.6)
    else
      self:fan()
    end
  end
  if self.debris <= 0 then
    self.debris = self.phase == 1 and 1.3 or self.phase == 2 and 0.9 or 0.7
    self:drop()
    if self.phase >= 2 then self:drop() end
  end
end

function Shuttle:draw()
  if self.flash > 0 and math.floor(self.flash * 40) % 2 == 0 then return end
  if self.warn > 0 and math.floor(self.warn * 12) % 2 == 0 then return end
  self.alpha = 1
  self:draw_sprite()
  -- the engine glows in Then: that is where it can be hurt
  if lens.era == "then" and not self.dying then
    local ex = self.flip and self.x + 31 or self.x - 31
    gs.draw.circle(ex, self.y + 2, 3 + math.floor(self.t * 12) % 2, "#a6f4e6")
  end
end

return Shuttle
