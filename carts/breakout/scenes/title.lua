-- The title screen.
local backdrop = require "lib.backdrop"

local Title = gs.scene{}

function Title:enter()
  backdrop()
  gs.music("msc_title")
end

function Title:update(dt)
  if gs.input.pressed("a") then gs.goto_scene("scenes.play", { fade = 0.3 }) end
end

function Title:draw_ui()
  gs.draw.text_centered("BREAKOUT", 88, "#ffd08a", 2)
  if math.floor(gs.world.time * 2) % 2 == 0 then gs.draw.text_centered("press A to start", 140, "#ffffff") end
end

return Title
