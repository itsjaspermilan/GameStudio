-- A terminal: stand at it and press Up to save. Saving heals, refills missiles and lets Static settle.
local state = require "lib.state"
local lens = require "lib.lens"

local Terminal = gs.entity{
  sprite = "spr_terminal",
  tags = { "usable" },
  depth = 30,
  hitbox = { -12, -32, 24, 32 },
  era = "both",
  t = 0,
}

function Terminal:update(dt)
  self.t = self.t + dt
  self.frame = math.floor(self.t * 4) % 2
end

function Terminal:use(hero)
  local d = state.data
  d.hp, d.missiles, d.static = d.hp_max, d.missiles_max, 0
  state.save(gs.world.scene.room_id)
  state.say("SAVED", 2)
  gs.sfx("sfx_save", 0.6)
  gs.burst(self.x, self.y - 20, { count = 14, color = "#a6f4e6", speed = { 20, 60 }, spread = 360, life = 0.4, depth = 8 })
end

function Terminal:draw()
  self:draw_sprite()
  local hero = gs.first("hero")
  if hero and hero:overlaps(self) then
    gs.draw.text("UP", self.x - 8, self.y - 44, math.floor(self.t * 3) % 2 == 0 and "#ffffff" or "#45d1c5")
  end
end

return Terminal
