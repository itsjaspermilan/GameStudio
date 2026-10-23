-- What every enemy shares: an era (now, then or both: it only meets Wren and Wren's shots in that
-- era, and looks faint in the other), health, a white flicker when hit, contact damage, and a puff
-- when destroyed. Kinds build on it: gs.entity(Enemy, { ... }).
local lens = require "lib.lens"

local Enemy = gs.entity{
  tags = { "enemy" },
  depth = 20,
  era = "now",
  hp = 3,
  contact = 1,       -- hearts lost by touching it
  flash = 0,
  puff = "#ea5a4b",  -- the colour of the puff when it is destroyed
}

function Enemy:hurt(n, by)
  if self.dead then return end
  self.hp = self.hp - n
  self.flash = 0.1
  if self.hp > 0 then gs.sfx("sfx_hit", 0.4) return end
  self.dead = true
  gs.sfx("sfx_boom", 0.5)
  gs.burst(self.x, self.y - (self.mid or 8), { count = 16, color = self.puff, speed = { 30, 110 }, spread = 360, life = { 0.2, 0.5 }, gravity = 200, depth = 8 })
  if self.on_dead then self:on_dead() end
  self:destroy()
end

function Enemy:hero() return gs.first("hero") end

-- Can it see Wren: in its era, near enough, and (when level is set) at about the same height?
function Enemy:sees_hero(range, level)
  local h = self:hero()
  if not h or not lens.sees(self.era) then return nil end
  if math.abs(h.x - self.x) > range then return nil end
  if level and math.abs((h.y - 14) - (self.y - (self.mid or 8))) > level then return nil end
  return h
end

function Enemy:update_flash(dt) self.flash = math.max(0, self.flash - dt) end

function Enemy:draw()
  if self.flash > 0 and math.floor(self.flash * 40) % 2 == 0 then return end
  self.alpha = lens.sees(self.era) and 1 or 0.25
  self:draw_sprite()
end

return Enemy
