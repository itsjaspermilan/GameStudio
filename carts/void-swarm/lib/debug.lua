-- Shortcuts for testing and screenshots, all through environment variables (nothing here runs in a
-- normal game):
--   GS_BOT=1            a bot plays a run by itself (GS_PILOT, GS_STAGE, GS_UPG upgrade ranks, GS_T0 start second, GS_SEED, GS_BOT_SECS time limit)
--   GS_SCREEN=name      start on a screen: hub, pilots, ship, weapons, stages, play, levelup, pause, results
--   GS_SEL, GS_CREDITS  the chosen pilot and the credits
--   GS_TEXTAUDIT=1      draw every screen and report text that had to be cut off (scenes/audit.lua)
-- Buttons can be scripted with GS_BOT_LUA=tests/keys-bot.lua GS_KEYS="a,down,a" (see
-- tests/keys-bot.lua).
local data = require "lib.data"
local run = require "lib.run"
local save = require "lib.save"

local M = {}

local BOT = os.getenv("GS_BOT") ~= nil
function M.bot_on() return BOT end

local function number(name, default) return tonumber(os.getenv(name) or default) end

-- called by the title scene once the save is loaded; true when a shortcut took over
function M.start()
  local s = save.data
  if os.getenv("GS_SEL") then s.sel = number("GS_SEL"); s.unl[s.sel] = 1 end
  if os.getenv("GS_CREDITS") then s.credits = number("GS_CREDITS") end
  if os.getenv("GS_TEXTAUDIT") then gs.goto_scene("scenes.audit"); return true end
  if BOT then
    for i = 1, #data.PILOTS do s.unl[i] = 1 end
    local up = number("GS_UPG", "0")
    for i = 1, #data.SHIP_PATHS do s.ship[i] = up end
    for i = 1, #data.WEAPON_ORDER do s.wa[i], s.wb[i] = up, up end
    s.cleared = 9
    math.randomseed(number("GS_SEED", "1"))
    gs.goto_scene("scenes.play", nil, number("GS_PILOT", "1"), number("GS_STAGE", "1"))
    return true
  end
  local shot = os.getenv("GS_SCREEN")
  if not shot then return false end
  if shot == "play" or shot == "levelup" or shot == "pause" or shot == "results" then
    s.cleared = 3
    if shot == "results" then
      local R = run.start(number("GS_PILOT", "1"), number("GS_STAGE", "1"))
      run.P = { lvl = 7, mods = { credits = 0 } }
      R.credits, R.kills, R.win, R.over, R.t, R.coin_count = 123, 321, true, true, 150, 40
      gs.goto_scene("scenes.results")
    else
      gs.goto_scene("scenes.play", nil, number("GS_PILOT", "1"), number("GS_STAGE", "1"))
    end
    return true
  end
  s.credits, s.cleared, s.ship[1], s.wa[1], s.unl[2] = 500, 3, 2, 2, 1
  gs.goto_scene("scenes." .. shot, nil, 1)
  return true
end

-- called by the play scene when a run starts
function M.run_started(scene)
  local R = run.R
  if BOT then R.t = number("GS_T0", "0") end
  local shot = os.getenv("GS_SCREEN")
  if shot == "levelup" then
    R.choices = { { kind = "wnew", new = true, id = "missiles", title = "HOMING MISSILES", text = data.WEAPONS.missiles.blurb, icon = "w_missiles" },
      { kind = "wup", id = "scatter", title = "SCATTER CANNON LV8", text = "+2 shots", icon = "w_scatter" },
      { kind = "pnew", new = true, id = "magnet", title = "TRACTOR", text = "+25% pickup range", icon = "p_magnet" } }
    scene.mode, scene.cur = "levelup", 1
    gs.pause(true)
  elseif shot == "pause" then
    scene.mode, scene.cur = "pause", 1
    gs.pause(true)
  end
end

-- called every step of a run: a test run can be told to stop after some seconds of play, finished
-- or not
local limit = number("GS_BOT_SECS", "0")
local finished = false -- quitting happens at the end of the frame, and with GS_FF several steps may still run before it
function M.run_step()
  if not BOT or limit <= 0 or finished then return end
  local R = run.R
  if R.t - number("GS_T0", "0") > limit then
    finished = true
    print(string.format("BOT pilot=%s stage=%d win=false time=%.0f (stopped after %d seconds)", R.pilot.id, R.stage, R.t, limit))
    gs.raw.quit()
  end
end

-- called when a run ends
function M.run_ended()
  if not BOT or finished then return end
  finished = true
  local R, P = run.R, run.P
  print(string.format("BOT pilot=%s stage=%d win=%s time=%.0f lvl=%d kills=%d hp=%.0f credits=%d boss=%s", R.pilot.id, R.stage, tostring(R.win), R.t, P.lvl, R.kills, P.hp, R.credits or 0,
    R.boss and string.format("%.0f%%", 100 * R.boss.hp / R.boss.maxhp) or "-"))
  local top, tv = "-", 0
  for k, v in pairs(R.hits or {}) do if v > tv then top, tv = k, v end end
  print("BOT damage taken mostly from " .. top .. " (" .. math.floor(tv) .. ")")
  gs.raw.quit()
end

return M
