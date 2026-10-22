-- GS_TEXTAUDIT=1: draws every menu screen with every cursor position, with all ranks and a few
-- pilots, and prints each piece of text that had to be cut off.
-- Scenes are classes, so their draw_ui can be called with a made-up `self`: no need to go to the
-- screens one by one.
local data = require "lib.data"
local run = require "lib.run"
local save = require "lib.save"
local ui = require "lib.ui"

local Audit = gs.scene{}

local SCREENS = {
  { "title", 1 }, { "hub", 4 }, { "pilots", #data.PILOTS }, { "ship", #data.SHIP_PATHS }, { "weapons", #data.WEAPON_ORDER }, { "stages", #data.STAGES },
}

function Audit:enter()
  local bad, where = 0, ""
  ui.audit = function(s, x, limit) bad = bad + 1; print(string.format("TEXT OVERFLOW on %s: '%s' at x=%d limit %d", where, s, x, limit)) end
  local s = save.data
  s.cleared = 9
  for i = 1, #data.PILOTS do s.unl[i] = (i % 2 == 0) and 1 or 0 end
  for _, sc in ipairs(SCREENS) do
    local class = require("scenes." .. sc[1])
    for cur = 1, sc[2] do
      for sub = 1, 2 do
        for rank = 0, 5 do
          for i = 1, #data.SHIP_PATHS do s.ship[i] = rank end
          for i = 1, #data.WEAPON_ORDER do s.wa[i], s.wb[i] = rank, rank end
          for _, sel in ipairs({ 1, 2, 10 }) do
            s.sel = sel
            where = sc[1] .. " (" .. cur .. ")"
            class.draw_ui({ cur = cur, sub = sub, tick = 10, note = "", note_t = 0 })
          end
        end
      end
    end
  end
  -- the run's screens: every card of the level-up, the heads-up display, the results
  local Play, Results = require "scenes.play", require "scenes.results"
  for stage = 1, #data.STAGES do
    for pilot = 1, #data.PILOTS do
      local R = run.start(pilot, stage)
      local p = gs.spawn("player", 0, 0, { sprite = "spr_pilot_" .. data.PILOTS[pilot].id })
      local all = {}
      for _, id in ipairs(data.WEAPON_ORDER) do
        for lv = 1, 8 do
          local w = data.WEAPONS[id]
          all[#all + 1] = { kind = lv == 1 and "wnew" or "wup", new = lv == 1, id = id, title = w.name .. " LV" .. lv, text = lv == 1 and w.blurb or run.describe(w.up[lv - 1][1], w.up[lv - 1][2]), icon = w.icon }
        end
      end
      for _, id in ipairs(data.PASSIVE_ORDER) do all[#all + 1] = { kind = "pnew", new = true, id = id, title = data.PASSIVES[id].name .. " LV5", text = data.PASSIVES[id].text, icon = data.PASSIVES[id].icon } end
      if stage == 1 then
        where = "levelup"
        for i = 1, #all, 3 do R.choices = { all[i], all[i + 1] or all[i], all[i + 2] or all[i] }; Play.draw_levelup({ cur = 1 }) end
      end
      R.boss_alert, R.t = 1, 10
      where = "play"
      Play.draw_hud({ tick = 10 })
      where = "results"
      R.win, R.newstage, R.credits, R.kills = true, (stage < #data.STAGES) and stage + 1 or nil, 99999, 99999
      Results.draw_ui({ tick = 10 })
      p:destroy()
    end
  end
  print("TEXT AUDIT DONE, overflows: " .. bad)
  gs.raw.quit()
end

return Audit
