-- The game: a paddle, a wall of bricks and a ball.
local state = require "lib.state"
local backdrop = require "lib.backdrop"

local Play = gs.scene{}

function Play:enter()
  backdrop()
  state.reset()
  gs.music("msc_main")
  gs.spawn("paddle", 140, 224)
  for row = 0, 5 do
    for col = 0, 7 do gs.spawn("brick", 32 + col * 32, 32 + row * 10, { row = row }) end
  end
  gs.spawn("ball", 0, 0)
end

function Play:update(dt)
  if gs.count("brick") == 0 then gs.goto_scene("scenes.over", { fade = 0.3 }, true) end
end

function Play:draw_ui()
  local d = gs.draw
  d.text("score " .. state.score, 8, 4, "#8a90a8")
  d.text("best " .. state.best, 124, 4, "#8a90a8")
  d.text("lives " .. state.lives, 248, 4, "#8a90a8")
  local ball = gs.first("ball")
  if ball and not ball.launched then d.text_centered("press A to launch", 150, "#ffffff") end
end

return Play
