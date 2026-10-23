-- A station terminal: press Up while standing at it. In the test room it refills missiles; later it will save the game.
local state = require "lib.state"

local Terminal = gs.entity{
  sprite = "spr_terminal",
  tags = { "terminal" },
  depth = 30,
  hitbox = { -12, -32, 24, 32 },
  t = 0,
}

function Terminal:update(dt)
  self.t = self.t + dt
  self.frame = math.floor(self.t * 4) % 2
end

function Terminal:use()
  state.missiles = state.missiles_max
  state.say(state.has.missile and "MISSILES REFILLED" or "TERMINAL ONLINE", 2)
  gs.sfx("sfx_terminal", 0.6)
end

function Terminal:draw()
  self:draw_sprite()
  local hero = gs.first("hero")
  if hero and hero:overlaps(self) then
    gs.draw.text("UP", self.x - 8, self.y - 44, math.floor(self.t * 3) % 2 == 0 and "#ffffff" or "#45d1c5")
  end
end

return Terminal
