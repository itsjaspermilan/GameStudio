-- Something Wren can use with Up (or R): a console, a person, a note, the lift. The story (lib/story.lua) decides what happens:
-- use() calls story.use(self.what, self). `era` limits it to Now or Then; the "UP" prompt shows when Wren stands at it.
local lens = require "lib.lens"

local Usable = gs.entity{
  tags = { "usable" },
  depth = 30,
  hitbox = { -12, -32, 24, 32 },
  era = "both", what = "", prompt = "UP",
  t = 0, fps = 3, frames = 2,
}

function Usable:update(dt)
  self.t = self.t + dt
  if self.frames > 1 then self.frame = math.floor(self.t * self.fps) % self.frames end
end

function Usable:use(hero) require("lib.story").use(self.what, self, hero) end

function Usable:draw()
  local seen = lens.sees(self.era)
  if not seen and self.hidden_away then return end
  self.alpha = seen and 1 or 0.2
  self:draw_sprite()
  local hero = gs.first("hero")
  if seen and self.prompt and hero and hero:overlaps(self) and not require("lib.talk").busy then
    gs.draw.text(self.prompt, self.x - gs.draw.text_width(self.prompt) / 2, self.y - 44, math.floor(self.t * 3) % 2 == 0 and "#ffffff" or "#45d1c5")
  end
end

return Usable
