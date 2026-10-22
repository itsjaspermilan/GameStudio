-- Saving. Values can be numbers, strings, booleans and tables of those. Everything is written to disk at once.
--   gs.save.set("best", 120)      gs.save.get("best", 0)      gs.save.slot(2).set("level", 3)
local M = {}

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
    local text = gs.raw.loadsave(prefix .. key)
    if text == nil then return default end
    local fn = load("return " .. text, "=save " .. key, "t", {})
    local ok, v = pcall(fn or function() end)
    if ok and v ~= nil then return v end
    return default
  end
  function api.set(key, value)
    if type(key) ~= "string" or not key:match("^[%w_%-%.]+$") then error("a save key is letters, digits and _ - . only, not '" .. tostring(key) .. "'", 2) end
    gs.raw.save(prefix .. key, encode(value, 0))
  end
  function api.has(key) return gs.raw.loadsave(prefix .. key) ~= nil end
  return api
end

local root = make("")
function M.get(key, default) return root.get(key, default) end
function M.set(key, value) root.set(key, value) end
function M.has(key) return root.has(key) end
function M.slot(n) return make("slot" .. tostring(math.floor(n)) .. "_") end

-- gs.save(key, text) is still the raw call older games make
return setmetatable(M, { __call = function(_, key, text) return gs.raw.save(key, text) end })
