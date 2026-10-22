-- Plays any game at random, for tests that only want to know "does it run without errors" (GS_BOT_LUA=tests/random-bot.lua GS_SEED=3).
-- Every step it may change which direction is held and may press A, B, Start, X or Y. Slow and dumb on purpose: it explores menus and levels.
local state = tonumber(os.getenv("GS_SEED") or "1") % 2147483647
local function rnd(n) state = (state * 48271) % 2147483647; return state % n end
local dirs = { "left", "right", "up", "down" }
local held = {}
local tick = 0

function bot_step()
  tick = tick + 1
  if tick % 20 == 1 then
    for _, d in ipairs(dirs) do held[d] = rnd(3) == 0; gs.input.sim_hold(d, held[d]) end
  end
  if tick % 7 == 0 then
    local b = ({ "a", "a", "a", "b", "start", "x", "y" })[rnd(7) + 1]
    gs.input.sim_press(b)
  end
end
