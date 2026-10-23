-- A target drone for the test room: it bobs in place, takes a few hits and comes back a little later.
local Drone = gs.entity{
  sprite = "spr_drone",
  tags = { "drone" },
  depth = 20,
  hitbox = { r = 9 },
  hp = 3,
  t = 0,
}

function Drone:create()
  self.home_x, self.home_y = self.x, self.y
  self.t = gs.random() * 6
end

function Drone:update(dt)
  self.t = self.t + dt
  self.y = self.home_y + math.sin(self.t * 2) * 3
  self.frame = math.floor(self.t * 3) % 2
  if self.flash then self.flash = self.flash - dt; if self.flash <= 0 then self.flash = nil end end
end

function Drone:hurt(n)
  self.hp = self.hp - n
  self.flash = 0.08
  gs.sfx("sfx_hit", 0.4)
  if self.hp > 0 then return end
  gs.sfx("sfx_boom", 0.5)
  gs.burst(self.x, self.y, { count = 18, color = "#a56be0", speed = { 30, 110 }, spread = 360, life = { 0.2, 0.5 }, gravity = 200, depth = 8 })
  gs.camera:shake(2, 0.15)
  local x, y = self.home_x, self.home_y
  gs.after(3, function() gs.spawn("drone", x, y) end)
  self:destroy()
end

function Drone:draw()
  if self.flash then gs.draw.circle(self.x, self.y, 10, "#ffffff") else self:draw_sprite() end
end

return Drone
