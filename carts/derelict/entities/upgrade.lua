-- An upgrade capsule: touch it to gain an ability (gives = "dash", "double", "wall", "charge" or "missile").
local state = require "lib.state"
local art = require "lib.art"

local NAMES = {
  dash = "DASH: PRESS A",
  double = "DOUBLE JUMP: B IN THE AIR",
  wall = "WALL JUMP: B AGAINST A WALL",
  charge = "CHARGE SHOT: HOLD Y, LET GO",
  missile = "MISSILES: PRESS X",
}

local Upgrade = gs.entity{
  sprite = "spr_upgrade",
  tags = { "upgrade" },
  depth = 15,
  hitbox = { r = 7 },
  gives = "dash",
  t = 0,
}

function Upgrade:create()
  for i, id in ipairs(art.UPGRADES) do if id == self.gives then self.frame = i - 1 end end
  self.home_y = self.y
  if state.has[self.gives] then self:destroy() end
end

function Upgrade:update(dt)
  self.t = self.t + dt
  self.y = self.home_y + math.sin(self.t * 3) * 2
end

function Upgrade:on_collide_hero()
  state.has[self.gives] = true
  if self.gives == "missile" then state.missiles = state.missiles_max end
  state.say(NAMES[self.gives], 3)
  gs.sfx("sfx_upgrade", 0.6)
  gs.burst(self.x, self.y, { count = 16, color = "#fff6a8", speed = { 20, 80 }, spread = 360, life = 0.4, depth = 8 })
  self:destroy()
end

return Upgrade
