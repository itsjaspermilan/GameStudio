-- The title screen. What you see is in its layout (open the scene and click Layout); the code
-- blinks the prompt, shows the best score and starts the game.
local state = require "lib.state"

local Title = gs.scene{}

function Title:enter()
  gs.music("title")
  self.best.text = "BEST " .. state.best
end

function Title:update(dt)
  self.prompt.visible = gs.time() % 1 < 0.6
  if gs.input.pressed("a") or gs.input.pressed("start") then
    gs.goto_scene("scenes.play", { fade = 0.3 })
  end
end

return Title
