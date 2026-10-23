-- Win or lose: enter(won) says which.
local state = require "lib.state"
local backdrop = require "lib.backdrop"

local Over = gs.scene{}

function Over:enter(won)
  backdrop()
  self.won = won
  gs.music_stop()
  if won then gs.sfx("sfx_win") end
end

function Over:update(dt)
  if gs.input.pressed("a") then gs.goto_scene("scenes.play", { fade = 0.3 }) end
end

function Over:draw_ui()
  gs.draw.text_centered(self.won and "YOU WIN!" or "GAME OVER", 88, "#ffd08a", 2)
  gs.draw.text_centered("score " .. state.score .. "   best " .. state.best, 116, "#8a90a8")
  gs.draw.text_centered("press A to play again", 140, "#ffffff")
end

return Over
