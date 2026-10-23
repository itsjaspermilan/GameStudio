-- A computer cook for the self-test and GS_BOT=1: it cooks for the customer who has waited longest
-- whose dish still fits the plate. Each call is one button press and returns the button (nil =
-- wait).
local data = require "lib.data"
local K = require "lib.kitchen"

local B = {}

function B.act(k)
  local t = K.goal(k)
  if not t then
    if #k.plate > 0 then K.bin(k); return "l" end
    return nil
  end
  if K.same(k.plate, t.dish.items) then K.serve(k); return "r" end
  for _, id in ipairs(t.dish.items) do
    if not K.has(k.plate, id) then K.add(k, id); return data.FOOD[id].button end
  end
  return nil
end

-- Plays a whole day at `rate` presses a second; returns the kitchen at closing time.
function B.play_day(day_no, seed, rate)
  local k = K.new(day_no, seed)
  local dt, gap, wait = 1 / 60, 1 / (rate or 5), 0
  while not k.over do
    K.step(k, dt)
    wait = wait - dt
    if wait <= 0 then B.act(k); wait = gap end
    k.events = {}
  end
  return k
end

return B
