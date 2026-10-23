-- The self-test (GS_SELFTEST=1): the kitchen's rules one by one, then the bot plays every day.
-- Prints KITCHEN RUSH TEST PASS.
local data = require "lib.data"
local K = require "lib.kitchen"
local B = require "lib.bot"
local save = require "lib.save"

local M = {}
local fails = 0
local function check(ok, what) if not ok then fails = fails + 1; print("FAIL " .. what) end end

local function rules()
  local k = K.new(1, 1)
  -- a button puts its food on the plate, once
  check(K.add(k, "bun") and K.add(k, "patty"), "X and A put a bun and a patty on the plate")
  check(not K.add(k, "bun"), "a second bun is refused")
  check(not K.add(k, "tomato"), "Monday has no tomato yet")
  check(K.open(K.new(2, 1), "tomato"), "Tuesday has")
  -- R serves the customer whose dish is on the plate
  k.tickets = { { dish = data.DISHES.cheesy, wait = 10, max = 20, face = 0, id = 1 } }
  check(not K.serve(k) and k.msg == "Not done yet!", "an unfinished dish is not served, and says so")
  K.add(k, "cheese")
  check(K.serve(k), "the cheesy burger is served")
  check(k.coins == data.DISHES.cheesy.price + math.floor(data.DISHES.cheesy.price * 0.25 + 0.5), "pay is the price plus a tip for half the wait left")
  check(#k.tickets == 0 and #k.plate == 0, "the ticket and the plate are cleared")
  -- L bins a wrong plate
  k.tickets = { { dish = data.DISHES.burger, wait = 10, max = 20, face = 0, id = 2 } }
  K.add(k, "lettuce")
  check(not K.serve(k), "nobody ordered lettuce")
  check(K.bin(k) and #k.plate == 0, "L empties the plate")
  -- every food has a button, and every dish of a day can be made that day
  for _, f in ipairs(data.FOODS) do check(data.BY_BUTTON[f.button] == f, "one food per button: " .. f.id) end
  for d, day in ipairs(data.DAYS) do
    for _, id in ipairs(day.dishes) do
      for _, food in ipairs(data.DISHES[id].items) do check(data.FOOD[food].day <= d, data.DAYS[d].name .. " can make " .. id) end
    end
  end
  -- customers who wait too long leave, and three of them end the day
  local k2 = K.new(1, 2)
  local guard = 0
  while not k2.over and guard < 60 * 200 do K.step(k2, 1 / 60); guard = guard + 1 end
  check(k2.ended == "misses" and K.stars(k2) == 0, "a day with nobody cooking ends when three customers leave")
end

local function saving()
  gs.save.set("kitchen_rush", "not ours")
  check(save.open_days() == 1 and save.stars(1) == 0, "a save of the wrong shape counts as a fresh start")
  save.record(1, 2, 77)
  check(not save.record(1, 1, 50), "a worse day is not a record")
  check(save.stars(1) == 2 and save.coins(1) == 77 and save.open_days() == 2, "the best day is kept and opens Tuesday")
  gs.save.set("kitchen_rush", nil)
end

local function bot_days()
  for d = 1, #data.DAYS do
    local day = data.DAYS[d]
    for _, seed in ipairs({ 3, 11 }) do
      local k = B.play_day(d, seed, tonumber(os.getenv("GS_BOT_RATE") or "5"))
      print(string.format("BOT day=%d seed=%d coins=%d served=%d missed=%d stars=%d (need %d/%d/%d)", d, seed, k.coins, k.served, k.misses, K.stars(k), day.stars[1], day.stars[2], day.stars[3]))
      check(k.ended == "time", "the bot lasts the whole of day " .. d)
      check(K.stars(k) >= 1, "the bot earns a star on day " .. d)
    end
  end
end

function M.selftest()
  rules()
  saving()
  bot_days()
  print(fails == 0 and "KITCHEN RUSH TEST PASS" or ("KITCHEN RUSH TEST FAILED: " .. fails))
  gs.quit()
end

return M
