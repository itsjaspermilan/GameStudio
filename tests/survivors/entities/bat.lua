local Bat = gs.entity{ sprite = "bat", tags = { "bat" }, hitbox = { r = 6 }, hp = 3 }
local STILL = os.getenv("GS_SV_STILL") -- bats that never move or fall: the same crowd every step, for comparing collision code

function Bat:update(dt)
  if STILL then return end
  local hero = gs.first("hero")
  if hero then self:move_toward(hero, 34) end
  self:face_motion()
end

-- bats push each other apart so the crowd spreads out instead of piling on one spot
function Bat:on_collide_bat(other)
  if STILL then return end
  local dx, dy = self.x - other.x, self.y - other.y
  local d = math.sqrt(dx * dx + dy * dy) + 0.01
  self.x, self.y = self.x + dx / d * 0.6, self.y + dy / d * 0.6
end

function Bat:hurt(n)
  if STILL then return end
  self.hp = self.hp - n
  self:flash(0.06)
  if self.hp <= 0 then
    gs.spawn("gem", self.x, self.y)
    gs.burst(self.x, self.y, { count = 6, color = "#c070ff", speed = { 20, 60 }, life = { 0.2, 0.4 } })
    self:destroy()
    local hero = gs.first("hero")
    if hero then require("scenes.main").spawn_bat(hero) end
  end
end

return Bat
