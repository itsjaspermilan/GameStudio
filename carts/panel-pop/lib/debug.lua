-- debug.lua: shortcuts for testing, all read from the environment when the title screen starts.
--   GS_SELFTEST=1          run the self-tests (lib/tests.lua) and quit
--   GS_MODE=vs GS_OPP=3    start a game at once (endless, time, vs, stage, puzzle; also GS_DIFF, GS_STAGE, GS_PUZ, GS_SPEED, GS_SEED)
--   GS_BOT=1               every player is a computer player (prints BOT RESULT and quits; GS_FF=n plays n steps a frame)
--   GS_SCREEN=results      open one screen (menu, setup with GS_KIND, puzzles, howto, records, results, ending)
local save = require "lib.save"
local tests = require "lib.tests"
local PG = require "lib.game"
local M = {}
local SCREENS = { menu = "scenes.menu", setup = "scenes.setup", puzzles = "scenes.puzzles", howto = "scenes.howto", records = "scenes.records", results = "scenes.results", ending = "scenes.ending" }

-- true when it started something other than the title screen
function M.start()
  if os.getenv("GS_SELFTEST") then tests.selftest(); return true end
  local mode = os.getenv("GS_MODE")
  local n = function(k, d) return tonumber(os.getenv(k) or d) end
  if mode then
    math.randomseed(n("GS_SEED", 1))
    local o = { diff = n("GS_DIFF", 2), opp = n("GS_OPP", 1), stage = n("GS_STAGE", 1), puzzle = n("GS_PUZ", 1), speed = n("GS_SPEED", 4) }
    gs.goto_scene(mode == "vs" and "scenes.versus" or "scenes.play", nil, mode, o)
    return true
  end
  local shot = os.getenv("GS_SCREEN")
  if shot then
    save.data.stage = 6
    if shot == "results" then
      PG.result = { win = true, mode = "endless", score = 12345, time = 3600, panels = 100, chain = 4, combo = 6, record = true }
      PG.last = { mode = "endless", o = { diff = 2, speed = 4 } }
    end
    local scene = SCREENS[shot]
    if not scene then error("GS_SCREEN: no screen called " .. shot) end
    gs.goto_scene(scene, nil, os.getenv("GS_KIND") or "vs")
    return true
  end
  return false
end
return M
