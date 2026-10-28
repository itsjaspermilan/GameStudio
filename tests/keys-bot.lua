-- Plays a game from a list of button presses, for tests and screenshots (GS_BOT_LUA=tests/keys-bot.lua GS_KEYS="a,wait*30,left*20,a").
--   name        press the button for one step, then wait 6 steps
--   name*N      hold the button for N steps
--   a+b, a+b*N  several buttons at once (right+a*20: run and jump)
--   wait*N      do nothing for N steps
--   quit        end the run here (otherwise it goes on until GS_MAX_FRAMES)
local keys = {}
for k in (os.getenv("GS_KEYS") or ""):gmatch("[^,%s]+") do keys[#keys + 1] = k end
local i, left, held = 0, 0, {}

local function names(s) local out = {}; for n in s:gmatch("[^+]+") do out[#out + 1] = n end return out end

function bot_step()
  if left > 0 then
    left = left - 1
    if left == 0 then for _, n in ipairs(held) do gs.input.sim_hold(n, false) end; held = {} end
    return
  end
  i = i + 1
  local k = keys[i]
  if not k then return end
  if k == "quit" then gs.quit(); return end
  local what, count = k:match("^([%a%d+]+)%*(%d+)$")
  if what then
    left = tonumber(count)
    if what ~= "wait" then held = names(what); for _, n in ipairs(held) do gs.input.sim_hold(n, true) end end
  else
    for _, n in ipairs(names(k)) do gs.input.sim_press(n) end
    left = 6
  end
end
