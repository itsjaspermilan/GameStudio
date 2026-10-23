-- The rules of a day in the kitchen, as plain data and functions (no drawing, no buttons), so the
-- play scene, the bot and the self-test all run the same kitchen. Every action returns true when it
-- did something; otherwise it leaves a short message for the player in k.msg. Things worth a sound
-- or a sparkle are pushed onto k.events for the scene to pick up.
local data = require "lib.data"

local K = {}
K.PLATE_MAX = 6
K.MAX_TICKETS = 3
K.MISSES = 3            -- customers who may leave before the day ends early

function K.new(day_no, seed)
  return {
    day_no = day_no, day = data.DAYS[day_no], rng = gs.rng(seed or os.time()),
    time_left = data.DAYS[day_no].secs, clock = 0, over = false,
    coins = 0, served = 0, misses = 0, best_tip = 0,
    tickets = {}, next_order = 1.0, order_seq = 0, last_dish = nil,
    plate = {}, events = {}, msg = nil, msg_t = 0,
  }
end

local function event(k, kind, a, b) k.events[#k.events + 1] = { kind = kind, a = a, b = b } end
local function say(k, text) k.msg, k.msg_t = text, 2.0; event(k, "wrong") end

local function has(list, id) for _, v in ipairs(list) do if v == id then return true end end return false end
K.has = has

-- Is this food in the kitchen yet? (the D-pad foods arrive one a day)
function K.open(k, id) return data.FOOD[id].day <= k.day_no end

-- A face button or the D-pad: put that food on the plate.
function K.add(k, id)
  if not K.open(k, id) then say(k, "Nothing there yet"); return false end
  if has(k.plate, id) then say(k, data.FOOD[id].name .. " is already on"); return false end
  if #k.plate >= K.PLATE_MAX then say(k, "The plate is full"); return false end
  k.plate[#k.plate + 1] = id
  event(k, "add", id)
  return true
end

-- L: throw the plate away.
function K.bin(k)
  if #k.plate == 0 then return false end
  k.plate = {}
  event(k, "bin")
  return true
end

local function same(plate, items)
  if #plate ~= #items then return false end
  for _, id in ipairs(items) do if not has(plate, id) then return false end end
  return true
end
K.same = same

-- Is everything on the plate part of the dish? (the bot and the hints use it)
function K.fits(plate, items)
  for _, id in ipairs(plate) do if not has(items, id) then return false end end
  return true
end

-- R: hand the plate to whoever ordered exactly that; the one who has waited longest goes first. A
-- quick serve earns a tip of up to half the price.
function K.serve(k)
  if #k.plate == 0 then say(k, "The plate is empty"); return false end
  local best
  for i, t in ipairs(k.tickets) do
    if same(k.plate, t.dish.items) and (not best or t.wait < k.tickets[best].wait) then best = i end
  end
  if not best then
    for _, t in ipairs(k.tickets) do
      if K.fits(k.plate, t.dish.items) then say(k, "Not done yet!"); return false end
    end
    say(k, "Wrong dish! L bins it")
    return false
  end
  local t = table.remove(k.tickets, best)
  local tip = math.floor(t.dish.price * 0.5 * t.wait / t.max + 0.5)
  local pay = t.dish.price + tip
  k.coins, k.served = k.coins + pay, k.served + 1
  k.best_tip = math.max(k.best_tip, tip)
  k.plate = {}
  event(k, "serve", pay, best)
  return true
end

-- The dish the plate is heading for: the longest-waiting customer whose dish still fits the plate.
function K.goal(k)
  local best
  for _, t in ipairs(k.tickets) do
    if K.fits(k.plate, t.dish.items) and (not best or t.wait < best.wait) then best = t end
  end
  return best
end

local function new_order(k)
  local day, dishes = k.day, {}
  -- the dishes new today come up twice as often, so the day teaches them
  for _, id in ipairs(day.dishes) do
    dishes[#dishes + 1] = id
    if has(day.new, id) and #day.new < #day.dishes then dishes[#dishes + 1] = id end
  end
  local id
  for _ = 1, 4 do id = dishes[k.rng:int(1, #dishes)]; if id ~= k.last_dish then break end end
  k.last_dish = id
  k.order_seq = k.order_seq + 1
  local wait = day.wait + 2 * #data.DISHES[id].items - 4
  k.tickets[#k.tickets + 1] = { dish = data.DISHES[id], wait = wait, max = wait, face = k.rng:int(0, 3), id = k.order_seq }
  event(k, "order", #k.tickets)
end

function K.step(k, dt)
  if k.over then return end
  k.clock = k.clock + dt
  k.time_left = k.time_left - dt
  if k.msg_t > 0 then k.msg_t = k.msg_t - dt; if k.msg_t <= 0 then k.msg = nil end end
  for i = #k.tickets, 1, -1 do
    local t = k.tickets[i]
    t.wait = t.wait - dt
    if t.wait <= 0 then
      table.remove(k.tickets, i)
      k.misses = k.misses + 1
      event(k, "lost", i)
    end
  end
  k.next_order = k.next_order - dt
  -- the last few seconds bring nobody new: there would be no time to cook for them
  if k.next_order <= 0 and k.time_left > 6 then
    if #k.tickets < K.MAX_TICKETS then
      new_order(k)
      k.next_order = k.rng:float() * (k.day.gap[2] - k.day.gap[1]) + k.day.gap[1]
    else
      k.next_order = 1
    end
  end
  -- an empty rail calls the next customer soon
  if #k.tickets == 0 and k.next_order > 1.5 and k.time_left > 6 then k.next_order = 1.5 end
  if k.misses >= K.MISSES then k.over, k.ended = true, "misses"; event(k, "end")
  elseif k.time_left <= 0 then k.time_left, k.over, k.ended = 0, true, "time"; event(k, "end") end
end

-- 0 to 3 stars for the coins earned (none when too many customers left).
function K.stars(k)
  if k.ended == "misses" then return 0 end
  local n = 0
  for i, need in ipairs(k.day.stars) do if k.coins >= need then n = i end end
  return n
end

return K
