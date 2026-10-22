-- gs.say and gs.ask: the world stands still while the box is up, the script waits, the answer comes back. Presses are made here (the
-- scene's update runs while the world stands still) and handed straight to the box.
local Talks = gs.scene{}
local talk = require("gs.talk")

function Talks:enter()
  self.steps, self.moved = 0, false
  self.mover = gs.spawn("dummy", 0, 0)
  self.mover.vx = 100
  gs.go(function()
    gs.say("BOB", "Hello there. This is a long line that has to wrap onto more than one line, and then onto another page of the box.")
    self.after_say = gs.world.paused
    self.answer = gs.ask("Which one?", { "ONE", "TWO", "THREE" })
    self.finished = true
  end)
end

function Talks:update(dt)
  self.steps = self.steps + 1
  local t = talk.active
  if t then
    self.saw_pause = self.saw_pause or gs.world.paused
    self.x_during = self.x_during or self.mover.x
    self.pages = math.max(self.pages or 0, #t.pages)
    if self.steps % 3 == 0 then
      local letters = 0
      for _, l in ipairs(t.pages[t.page]) do letters = letters + #l end
      local choosing = t.answers and t.page == #t.pages and t.shown >= letters
      if choosing and not self.moved then self.moved = true; gs.input.sim_press("down") else gs.input.sim_press("a") end
      talk.update(0)
    end
    if not self.drawn then self.drawn = true; gs.world.draw() end
    self.still = self.mover.x == self.x_during
  end
  if self.finished or self.steps > 600 then
    local check = _G.LAYOUT_CHECK
    check("a conversation finishes", self.finished, self.steps)
    check("the box's pattern is not shown by itself", self.dialogue_box.visible == false and self.dialogue_text.visible == false)
    check("the world stands still while the box is up", self.saw_pause and self.still)
    check("a long line runs onto more pages", (self.pages or 0) >= 2, self.pages)
    check("gs.ask returns the answer picked", self.answer == 2, self.answer)
    check("the world goes on afterwards", not gs.world.paused and self.after_say == false)
    gs.goto_scene("plain")
  end
end

return Talks
