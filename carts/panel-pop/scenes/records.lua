-- Your records: the layout has every label; this fills in the numbers from the save.
local ui = require "lib.ui"
local save = require "lib.save"
local PUZZLES = require "lib.puzzles"
local data = require "lib.data"

local Records = gs.scene{}

function Records:enter()
  self.tick = 0
  for i = 1, 3 do
    self["endless" .. i].text = ui.commas(save.get("endless", i))
    self["time" .. i].text = ui.commas(save.get("time", i))
    self["vs" .. i].text = save.get("vsbeat", i) .. "/" .. #data.OPPONENTS
  end
  self.stage.text = save.data.stage .. "/" .. data.STAGE_COUNT
  self.puzzles.text = save.solved_count() .. "/" .. #PUZZLES
end

function Records:update(dt)
  ui.tick()
  self.tick = self.tick + 1
  ui.drift(self.tick)
  self.pip.frame = (self.tick // 30) % 2 == 0 and 2 or 0
  self.star1.frame, self.star2.frame = (self.tick // 20) % 2, (self.tick // 20 + 1) % 2
  if ui.pressed("b") or ui.pressed("a") then ui.sfx("back", 1); gs.goto_scene("scenes.menu") end
end

return Records
