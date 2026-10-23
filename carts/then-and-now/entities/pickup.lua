-- A pickup: "hull" (one more heart) or "battery" (the Lens takes more Static). Taken once: its id goes into state.items.
local state = require "lib.state"

local NAMES = { hull = "HULL PLATE: ONE MORE HEART", battery = "LENS BATTERY: MORE STATIC BEFORE OVERLOAD" }

local Pickup = gs.entity{
  sprite = "spr_pickup",
  tags = { "pickup" },
  depth = 15,
  hitbox = { r = 7 },
  what = "hull", id = "",
  t = 0,
}

function Pickup:create()
  if state.data.items[self.id] then self:destroy() return end
  self.home_y = self.y
end

function Pickup:update(dt)
  self.t = self.t + dt
  self.y = self.home_y + math.sin(self.t * 3) * 2
  self.frame = (self.what == "battery" and 2 or 0) + (math.floor(self.t * 4) % 4 == 0 and 1 or 0)
end

function Pickup:on_collide_hero()
  local d = state.data
  d.items[self.id] = true
  if self.what == "hull" then d.hp_max = d.hp_max + 1; d.hp = d.hp_max
  else d.static_max = d.static_max + 25 end
  state.say(NAMES[self.what], 3)
  gs.sfx("sfx_gain", 0.6)
  gs.burst(self.x, self.y, { count = 18, color = "#fff6a8", speed = { 20, 80 }, spread = 360, life = 0.4, depth = 8 })
  self:destroy()
end

return Pickup
