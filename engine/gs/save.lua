-- Saving. Values can be numbers, strings, booleans and tables of those. A save is written to disk at the end of the frame that made it
-- (a write to an SD card can take several ms: one in the middle of a step made that frame late), and at once when the game quits.
--   gs.save.set("best", 120)      gs.save.get("best", 0)      gs.save.slot(2).set("level", 3)      gs.save.delete("best")
local M = {}
local pending, waiting = {}, false -- full key -> text to write, or false to remove the save

local function encode(v, depth)
  local t = type(v)
  if t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "0" end
    return string.format("%.17g", v)
  elseif t == "boolean" then return tostring(v)
  elseif t == "string" then return string.format("%q", v)
  elseif t == "table" and depth < 8 then
    local out = {}
    for k, x in pairs(v) do
      local kt, xt = type(k), type(x)
      if (kt == "string" or kt == "number") and (xt == "number" or xt == "string" or xt == "boolean" or xt == "table") then
        out[#out + 1] = "[" .. encode(k, depth + 1) .. "]=" .. encode(x, depth + 1)
      end
    end
    return "{" .. table.concat(out, ",") .. "}"
  end
  return "nil"
end

local function make(prefix)
  local api = {}
  function api.get(key, default)
    local text = pending[prefix .. key]
    if text == false then return default end
    if text == nil then text = gs.raw.loadsave(prefix .. key) end
    if text == nil then return default end
    local fn = load("return " .. text, "=save " .. key, "t", {})
    local ok, v = pcall(fn or function() end)
    if ok and v ~= nil then return v end
    return default
  end
  function api.set(key, value)
    if type(key) ~= "string" or not key:match("^[%w_%-%.]+$") then error("a save key is letters, digits and _ - . only, not '" .. tostring(key) .. "'", 2) end
    pending[prefix .. key], waiting = encode(value, 0), true
  end
  function api.has(key)
    local text = pending[prefix .. key]
    if text ~= nil then return text ~= false end
    return gs.raw.loadsave(prefix .. key) ~= nil
  end
  function api.delete(key) pending[prefix .. key], waiting = false, true end
  return api
end

local root = make("")
function M.get(key, default) return root.get(key, default) end
function M.set(key, value) root.set(key, value) end
function M.has(key) return root.has(key) end
function M.delete(key) root.delete(key) end
-- write what was saved since the last time (the framework calls it after every frame and before quitting)
function M.flush()
  if not waiting then return end
  for k, text in pairs(pending) do
    if text then gs.raw.save(k, text) else gs.raw.save(k, nil) end
  end
  pending, waiting = {}, false
end
function M.slot(n) return make("slot" .. tostring(math.floor(n)) .. "_") end

-- gs.save(key, text) is still the raw call older games make
return setmetatable(M, { __call = function(_, key, text) return gs.raw.save(key, text) end })
