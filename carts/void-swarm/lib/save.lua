-- The progress that survives between runs: credits, which pilots are unlocked, the permanent ship and weapon ranks, the sectors cleared.
-- One table in the game's save file (gs.save). Games saved before the entity port wrote a text file; it is read once and converted.
local data = require "lib.data"

local M = { data = nil }

local function defaults()
  local s = { credits = 0, sel = 1, cleared = 0, runs = 0, kills = 0, unl = {}, ship = {}, wa = {}, wb = {}, best = {} }
  for i = 1, #data.PILOTS do s.unl[i] = (i == 1) and 1 or 0 end
  for i = 1, #data.SHIP_PATHS do s.ship[i] = 0 end
  for i = 1, #data.WEAPON_ORDER do s.wa[i], s.wb[i] = 0, 0 end
  for i = 1, #data.STAGES do s.best[i] = 0 end
  return s
end

local LISTS = { unl = "PILOTS", ship = "SHIP_PATHS", wa = "WEAPON_ORDER", wb = "WEAPON_ORDER", best = "STAGES" }

local function parse_list(str, t, n)
  local i = 0
  for v in (str .. ","):gmatch("([^,]*),") do i = i + 1; if i <= n then t[i] = tonumber(v) or 0 end end
end

-- the text format of the first version: "credits=12\nunl=1,0,0,..."
local function read_old(s)
  local text = gs.raw.loadsave and gs.raw.loadsave("void_save")
  if not text then return false end
  for k, v in text:gmatch("([%w_]+)=([^\n]*)") do
    if LISTS[k] then parse_list(v, s[k], #data[LISTS[k]]) elseif type(s[k]) == "number" then s[k] = tonumber(v) or s[k] end
  end
  return true
end

function M.load()
  local s = defaults()
  local stored = gs.save.get("progress")
  if type(stored) == "table" then
    for k, v in pairs(stored) do
      if LISTS[k] and type(v) == "table" then for i = 1, #s[k] do s[k][i] = tonumber(v[i]) or 0 end
      elseif type(s[k]) == "number" then s[k] = tonumber(v) or s[k] end
    end
  elseif read_old(s) then
    gs.save.set("progress", s)
  end
  s.unl[1] = 1
  M.data = s
  return s
end

function M.write()
  gs.save.set("progress", M.data)
end

return M
