-- save.lua: the save file (lines of key=value, so older saves keep loading; keys the game no longer
-- uses are dropped) and the records in it.
local M = { data = nil }

local function defaults()
  return { endless = "0,0,0", time = "0,0,0", stage = 1, vsbeat = "0,0,0", puzzles = "" }
end
function M.load()
  local s = defaults()
  local text = gs.loadsave("panelpop_save")
  if text then for k, v in text:gmatch("([%w_]+)=([^\n]*)") do if s[k] ~= nil then s[k] = (type(s[k]) == "number") and (tonumber(v) or s[k]) or v end end end
  M.data = s
  return s
end
function M.write()
  local lines = {}
  for k, v in pairs(M.data) do lines[#lines + 1] = k .. "=" .. tostring(v) end
  table.sort(lines)
  gs.save("panelpop_save", table.concat(lines, "\n"))
end

-- records are "a,b,c" strings, one number per difficulty
function M.get(key, i) local n = 0; for v in (M.data[key] .. ","):gmatch("([^,]*),") do n = n + 1; if n == i then return tonumber(v) or 0 end end; return 0 end
function M.set(key, i, val)
  local t = {}; for k = 1, 3 do t[k] = M.get(key, k) end
  t[i] = val; M.data[key] = table.concat(t, ","); M.write()
end
-- true if val beat the old record (and stores it)
function M.best(key, i, val)
  if val > M.get(key, i) then M.set(key, i, val); return true end
  return false
end

-- the puzzles solved, as a set
function M.solved()
  local have = {}
  for v in (M.data.puzzles .. ","):gmatch("([^,]*),") do if v ~= "" then have[tonumber(v)] = true end end
  return have
end
-- marks puzzle i solved; true the first time
function M.solve(i)
  local have = M.solved()
  if have[i] then return false end
  have[i] = true
  local list = {}
  for k in pairs(have) do list[#list + 1] = k end
  table.sort(list)
  M.data.puzzles = table.concat(list, ","); M.write()
  return true
end
function M.solved_count() local n = 0; for _ in pairs(M.solved()) do n = n + 1 end; return n end
return M
