-- Ossie Okafor's echo. In the tower he only shows in Then; once released he waits in the Docking Bay, there in both eras.
local Usable = require "entities.usable"
local state = require "lib.state"

local Ossie = gs.entity(Usable, { sprite = "spr_ossie", what = "ossie", era = "then", hidden_away = true, prompt = "TALK", fps = 2, frames = 2,
  hitbox = { -14, -32, 28, 32 } })

function Ossie:create()
  local d = state.data
  local fate = d.crew.ossie
  -- the tower echo leaves once the launch has been cleared; the bay version only exists after he is let go
  if self.place == "scene" then return end -- placed by a cutscene, which looks after him
  if self.place == "dock" then
    if fate ~= "released" then self:destroy() return end
    self.era = "both"
  elseif d.flags.ossie_cleared then
    self:destroy()
  end
end

function Ossie:draw()
  -- echoes shimmer
  local seen = require("lib.lens").sees(self.era)
  if not seen then return end
  self.alpha = 0.8 + math.sin(self.t * 8) * 0.12
  self:draw_sprite()
  local hero = gs.first("hero")
  if self.prompt and hero and hero:overlaps(self) and not require("lib.talk").busy then
    gs.draw.text("TALK", self.x - 16, self.y - 44, math.floor(self.t * 3) % 2 == 0 and "#ffffff" or "#45d1c5")
  end
end

return Ossie
