-- The save: the best stars and coins for each day. One star on a day opens the next.
local data = require "lib.data"
local M = {}

-- A save that is not shaped like ours (another game's, or a broken file) counts as a fresh start.
local function load()
  local p = gs.save.get("kitchen_rush", nil)
  if type(p) ~= "table" or type(p.stars) ~= "table" or type(p.coins) ~= "table" then p = { stars = {}, coins = {} } end
  return p
end

function M.stars(day) return load().stars[day] or 0 end
function M.coins(day) return load().coins[day] or 0 end

-- The last day you may play.
function M.open_days()
  local p, n = load(), 1
  while n < #data.DAYS and (p.stars[n] or 0) > 0 do n = n + 1 end
  return n
end

-- Keeps the better result; returns true when the coins are a new record.
function M.record(day, stars, coins)
  local p = load()
  local record = coins > (p.coins[day] or 0)
  p.stars[day] = math.max(p.stars[day] or 0, stars)
  p.coins[day] = math.max(p.coins[day] or 0, coins)
  gs.save.set("kitchen_rush", p)
  return record
end

return M
