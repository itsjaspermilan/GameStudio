-- The game. The layout places the paddle, the ball, the wall of bricks and the score bar; this
-- code keeps the score bar up to date and ends the game when the wall is gone.
local state = require "lib.state"

local Play = gs.scene{}

function Play:enter()
  state.reset()
  gs.music("msc_main")
end

function Play:update(dt)
  self.score.text = "SCORE " .. state.score
  self.best.text = "BEST " .. state.best
  self.lives.text = "LIVES " .. state.lives
  self.launch.visible = not self.ball.launched
  if gs.count("brick") == 0 then
    gs.goto_scene("scenes.over", { fade = 0.3 }, true)
  end
end

return Play
