-- The title: THEN & NOW flickering between the two looks, the station drifting behind, Continue
-- (with a save) and New game.
local state = require "lib.state"
local debug = require "lib.debug"

local Title = gs.scene{}

function Title:enter()
  self.t, self.pick = 0, 1
  if debug.start() then self.away = true return end
  self.items = state.has_save() and { "CONTINUE", "NEW GAME" } or { "NEW GAME" }
  self.stars = {}
  for i = 1, 70 do self.stars[i] = { gs.random(0, 319), gs.random(0, 239), gs.random(1, 3) } end
  gs.music("msc_title")
end

function Title:update(dt)
  if self.away then return end
  self.t = self.t + dt
  local I = gs.input
  if I.pressed("down") then self.pick = self.pick % #self.items + 1; self.sure = false; gs.sfx("sfx_select", 0.4) end
  if I.pressed("up") then self.pick = (self.pick - 2) % #self.items + 1; self.sure = false; gs.sfx("sfx_select", 0.4) end
  if I.pressed("a") or I.pressed("start") then
    -- a new game over a save asks once more
    if self.items[self.pick] == "NEW GAME" and state.has_save() and not self.sure then
      self.sure = true
      gs.sfx("sfx_buzz", 0.4)
      return
    end
    gs.sfx("sfx_ok", 0.6)
    if self.items[self.pick] == "CONTINUE" then state.load() else state.new_game(); state.save("dock") end
    gs.goto_scene("scenes.rooms." .. state.data.room, { fade = 0.8 })
  end
end

function Title:draw_ui()
  if self.away then return end
  local t = self.t
  gs.draw.rect(0, 0, 320, 240, "#05070f")
  for _, s in ipairs(self.stars) do
    local x = (s[1] - t * s[3] * 4) % 320
    gs.draw.rect(x, s[2], 1, 1, s[3] == 3 and "#ffffff" or s[3] == 2 and "#8a90a8" or "#3b3f55")
  end
  -- the station: a ring and a spine, slowly turning lights
  gs.draw.circle(230, 120, 46, "#14234f")
  gs.draw.circle(230, 120, 38, "#05070f")
  gs.draw.rect(226, 60, 8, 120, "#14234f")
  for i = 0, 7 do
    local a = t * 0.3 + i * math.pi / 4
    local lit = (i + math.floor(t)) % 3 == 0
    gs.draw.rect(230 + math.cos(a) * 42 - 1, 120 + math.sin(a) * 42 - 1, 3, 3, lit and "#f5d94a" or "#3b3f55")
  end
  -- the name: NOW is grey and steady, THEN glows and shimmers, & between
  local glitch = math.floor(t * 8) % 23 == 0
  gs.draw.text("THEN", 34 + (glitch and 2 or 0), 70, glitch and "#ffffff" or "#a6f4e6", 3)
  gs.draw.text("&", 34, 100, "#e8913a", 3)
  gs.draw.text("NOW", 34, 130, "#8a90a8", 3)
  gs.draw.text("VESPER STATION", 34, 162, "#3b3f55")
  for i, item in ipairs(self.items) do
    local on = i == self.pick
    gs.draw.text((on and "> " or "  ") .. item, 34, 186 + (i - 1) * 14, on and "#ffffff" or "#8a90a8")
  end
  if self.sure then gs.draw.text("THIS ERASES YOUR SAVE. PRESS A AGAIN.", 34, 222, "#ea5a4b") end
end

return Title
