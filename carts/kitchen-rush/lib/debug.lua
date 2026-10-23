-- debug.lua: shortcuts for testing, read from the environment when the title screen starts.
--   GS_SELFTEST=1          run the self-tests (lib/tests.lua) and quit (GS_BOT_RATE=n: the bot's actions a second, to tune the stars)
--   GS_DAY=3               start that day at once (GS_SEED for the customers, GS_QUICK=1 skips the day's intro)
--   GS_BOT=1               with GS_DAY: the computer cook plays it
--   GS_SCREEN=days         open one screen (days, howto, results)
local tests = require "lib.tests"
local M = {}

function M.start()
  if os.getenv("GS_SELFTEST") then tests.selftest(); return true end
  local day = tonumber(os.getenv("GS_DAY") or "")
  if day then
    gs.goto_scene("scenes.play", nil, day, { seed = tonumber(os.getenv("GS_SEED") or "1"), bot = os.getenv("GS_BOT") ~= nil, quick = os.getenv("GS_QUICK") ~= nil })
    return true
  end
  local shot = os.getenv("GS_SCREEN")
  if shot == "results" then
    gs.goto_scene("scenes.results", nil, { day = 2, coins = 92, served = 9, misses = 1, stars = 2, ended = "time", best_tip = 5 })
    return true
  elseif shot then
    gs.goto_scene("scenes." .. shot)
    return true
  end
  return false
end
return M
