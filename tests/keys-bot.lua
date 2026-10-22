-- Plays a game from a list of button presses, for tests and screenshots (GS_BOT_LUA=tests/keys-bot.lua GS_KEYS="a,wait*30,left*20,a").
--   name        press the button for one step, then wait 6 steps
--   name*N      hold the button for N steps
--   wait*N      do nothing for N steps
local keys = {}
for k in (os.getenv("GS_KEYS") or ""):gmatch("[^,]+") do keys[#keys + 1] = k end
local i, left, held, gap = 0, 0, nil, 0

function bot_step()
  if left > 0 then
    left = left - 1
    if left == 0 and held then gs.input.sim_hold(held, false); held = nil end
    return
  end
  i = i + 1
  local k = keys[i]
  if not k then return end
  local name, count = k:match("^(%a%w*)%*(%d+)$")
  if name then
    count = tonumber(count)
    if name ~= "wait" then held = name; gs.input.sim_hold(name, true) end
    left = count
  else
    gs.input.sim_press(k)
    left = 6
  end
end
