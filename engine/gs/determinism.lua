-- Foundations for lockstep. Ordinary single-player games keep Lua's usual random stream until seed() is called.
local M = {}
local game_random, game_seed = math.random, math.randomseed
local source = require("gs.random_source")
local drawing, enabled = false, false

local function random(...) return (enabled and drawing and source.random or game_random)(...) end
local function randomseed(...) return (enabled and drawing and source.randomseed or game_seed)(...) end
-- Games may cache math.random in a menu before a session begins.
math.random, math.randomseed = random, randomseed

function M.seed(seed)
  assert(math.type(seed) == "integer", "session seed must be an integer")
  game_seed(seed)
  source.randomseed(seed, 0x44524157)
  enabled = true
end

function M.drawing(on) drawing = on end
function M.stop() enabled = false end

-- A diagnostic fingerprint, not a save format: scalar instance fields only, never pointers, closures, camera or profiling data.
-- Nested tables, timers, particles and RNG internals are not covered yet; equal hashes are not proof of complete state equality.
function M.checksum(world)
  local hash = 0xcbf29ce484222325
  local function bytes(s)
    for i = 1, #s do hash = (hash ~ s:byte(i)) * 0x100000001b3 end
  end
  local function scalar(v)
    local t = type(v)
    if t == "number" then
      bytes(math.type(v) == "integer" and "i" .. string.pack("<i8", v) or "d" .. string.pack("<d", v))
    elseif t == "string" then bytes("s" .. string.pack("<I8", #v) .. v)
    elseif t == "boolean" then bytes(v and "t" or "f")
    else bytes("n") end
  end
  local function fields(obj)
    local keys = {}
    for k, v in pairs(obj) do
      local kt, vt = type(k), type(v)
      if (kt == "number" or kt == "string" or kt == "boolean") and
        (vt == "number" or vt == "string" or vt == "boolean") then keys[#keys + 1] = k end
    end
    table.sort(keys, function(a, b)
      local ta, tb = type(a), type(b)
      if ta ~= tb then return ta < tb end
      if ta == "boolean" then return not a and b end
      return a < b
    end)
    scalar(#keys)
    for _, k in ipairs(keys) do scalar(k); scalar(obj[k]) end
  end
  scalar(world.step_id); scalar(world.time); scalar(world.next_id); scalar(world.paused)
  scalar(world.scene_name)
  fields(world.scene or {})
  local count = 0
  for _, e in ipairs(world.all) do if not e._dead then count = count + 1 end end
  scalar(count)
  for _, e in ipairs(world.all) do
    if not e._dead then
      scalar(getmetatable(e).__name or "")
      fields(e)
    end
  end
  return string.format("%016x", hash)
end

return M
