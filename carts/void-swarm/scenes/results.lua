-- The screen after a run: what it earned. The panel, the headline, the pilot and the labels are in
-- its layout (results.layout.lua), fixed on the screen above the background, which this code draws
-- because it is the sector's; the code fills in the run's words and numbers.
local data = require "lib.data"
local run = require "lib.run"
local audio = require "lib.audio"
local ui = require "lib.ui"

local floor = math.floor
local txtc, txtr = ui.txtc, ui.txtr

local Results = gs.scene{}

-- the panel's tiles in ts_panel: a gold edge for a cleared sector, a red one otherwise
local GOLD, RED = 15, 18

function Results:enter()
  self.tick = 0
  local R = run.R
  self.panel.tile = R.win and GOLD or RED
  self.headline.text = R.win and "SECTOR CLEARED!" or (R.abandoned and "RUN ENDED" or "SHIP DESTROYED")
  self.headline.color = R.win and 14 or 6
  self.sector.text = R.sdef.name
  self.pilot.sprite = "spr_pilot_" .. R.pilot.id
  self:place()
end

-- what moves: the pilot walks, the prompt blinks
function Results:place()
  self.pilot.frame = 2 + floor(self.tick / 5) % 6
  self.prompt.visible = floor(self.tick / 30) % 2 == 0
end

function Results:update(dt)
  self.tick = self.tick + 1
  self:place()
  if gs.input.pressed("a") or gs.input.pressed("start") then
    audio.sfx("sfx_ok", 1)
    gs.goto_scene("scenes.hub", { fade = 0.25 }, 1)
  end
end

function Results:draw()
  ui.menu_background(run.R.sdef.bg, self.tick, 0.15)
end

function Results:draw_ui()
  local R, P = run.R, run.P
  local values = { ui.fmt_time(R.t), tostring(P.lvl), tostring(R.kills), tostring(R.coin_count) }
  for i, v in ipairs(values) do txtr(v, 250, 120 + (i - 1) * 11, 3) end
  txtr("+" .. R.credits, 250, 176, 14)
  if R.newstage then txtc("NEW SECTOR: " .. data.STAGES[R.newstage].name, 192, 18, 1) end
end

return Results
