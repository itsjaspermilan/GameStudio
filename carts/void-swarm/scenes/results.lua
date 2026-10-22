-- The screen after a run: what it earned.
local data = require "lib.data"
local run = require "lib.run"
local audio = require "lib.audio"
local ui = require "lib.ui"

local floor = math.floor
local spr, txt, txtc, txtr, box = ui.spr, ui.txt, ui.txtc, ui.txtr, ui.box

local Results = gs.scene{}

function Results:enter()
  self.tick = 0
end

function Results:update(dt)
  self.tick = self.tick + 1
  if gs.input.pressed("a") or gs.input.pressed("start") then
    audio.sfx("sfx_ok", 1)
    gs.goto_scene("scenes.hub", { fade = 0.25 }, 1)
  end
end

function Results:draw_ui()
  local R, P = run.R, run.P
  ui.menu_background(R.sdef.bg, self.tick, 0.15)
  box(30, 20, 260, 196, 0, R.win and 14 or 5, 225)
  txtc(R.win and "SECTOR CLEARED!" or (R.abandoned and "RUN ENDED" or "SHIP DESTROYED"), 30, R.win and 14 or 6, 2)
  txtc(R.sdef.name, 54, 2, 1)
  spr("spr_pilot_" .. R.pilot.id, 2 + floor(self.tick / 5) % 6, 160, 90, 2)
  local rows = { { "TIME", ui.fmt_time(R.t) }, { "LEVEL", tostring(P.lvl) }, { "ENEMIES", tostring(R.kills) }, { "COINS", tostring(R.coin_count) } }
  for i, r in ipairs(rows) do txt(r[1], 70, 120 + (i - 1) * 11, 2); txtr(r[2], 250, 120 + (i - 1) * 11, 3) end
  box(60, 168, 200, 1, 22)
  txt("CREDITS EARNED", 70, 176, 3)
  txtr("+" .. R.credits, 250, 176, 14)
  if R.newstage then txtc("NEW SECTOR: " .. data.STAGES[R.newstage].name, 192, 18, 1) end
  if floor(self.tick / 30) % 2 == 0 then txtc("PRESS A", 204, 3, 1) end
end

return Results
