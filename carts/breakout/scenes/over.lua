-- Win or lose: enter(won) says which. The words are in the layout; the code fills them in.
local state = require "lib.state"

local Over = gs.scene{}

function Over:enter(won)
  gs.music_stop()
  if won then gs.sfx("sfx_win") end
  self.result.text = won and "YOU WIN!" or "GAME OVER"
  self.score.text = "SCORE " .. state.score .. "   BEST " .. state.best
end

function Over:update(dt)
  self.prompt.visible = gs.time() % 1 < 0.6
  if gs.input.pressed("a") then
    gs.goto_scene("scenes.play", { fade = 0.3 })
  end
end

return Over
