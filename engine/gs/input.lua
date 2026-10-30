-- Buttons. Names: up down left right a b x y l r start select (and l2 r2 l3 r3 where the device has them).
--   gs.input.held("left")      -- is it down right now
--   gs.input.pressed("a")      -- went down since the last step (true for exactly one step, even if the game runs several steps a frame)
--   gs.input.released("a")
--   gs.input.dir()             -- x, y of the d-pad as -1, 0 or 1
-- A test can play the game with gs.input.sim_hold / sim_press (used by the bot hook; real buttons are ignored while a bot plays).
local M = {}
local BUTTONS = { "up", "down", "left", "right", "a", "b", "x", "y", "l", "r", "start", "select", "l2", "r2", "l3", "r3" }
local btn, btnp = gs.btn, gs.btnp
local pressed_now, held_prev, sim_held, sim_active = {}, {}, {}, false
local network_now, network_prev
local bits = {}
for i, name in ipairs(BUTTONS) do bits[name] = 1 << (i - 1) end

local function local_held(name)
  if sim_active then return sim_held[name] or false end
  return btn(name)
end
local function player_number(player)
  if player == nil then player = 1 end
  if math.type(player) ~= "integer" or player < 1 or player > 4 then error("player must be 1 to 4", 3) end
  return player
end
local function held(name, player)
  if network_now then
    if not bits[name] then error("unknown button '" .. tostring(name) .. "'", 2) end
    return ((network_now[player_number(player)] or 0) & bits[name]) ~= 0
  end
  if player ~= nil and player_number(player) ~= 1 then return false end
  return local_held(name)
end
M.held = held
function M.pressed(name, player)
  if network_now then
    local p = player_number(player)
    local mask = (network_now[p] or 0) & ~(network_prev[p] or 0)
    return name == "any" and mask ~= 0 or (mask & (bits[name] or 0)) ~= 0
  end
  if player ~= nil and player_number(player) ~= 1 then return false end
  if name == "any" then for _, b in ipairs(BUTTONS) do if pressed_now[b] then return true end end return false end
  return pressed_now[name] or false
end
function M.released(name, player)
  if network_now then
    local p = player_number(player)
    return ((network_prev[p] or 0) & ~(network_now[p] or 0) & (bits[name] or 0)) ~= 0
  end
  if player ~= nil and player_number(player) ~= 1 then return false end
  return (held_prev[name] and not local_held(name)) or false
end
function M.dir(player)
  return (held("right", player) and 1 or 0) - (held("left", player) and 1 or 0),
    (held("down", player) and 1 or 0) - (held("up", player) and 1 or 0)
end

-- the engine calls these around its steps
function M.begin_frame() if not sim_active then for _, b in ipairs(BUTTONS) do if btnp(b) then pressed_now[b] = true end end end end
function M.end_step()
  for _, b in ipairs(BUTTONS) do held_prev[b] = local_held(b); pressed_now[b] = nil end
  if network_now then for p = 1, 4 do network_prev[p] = network_now[p] or 0 end end
end

function M.local_mask()
  local mask = 0
  for _, b in ipairs(BUTTONS) do if local_held(b) or pressed_now[b] then mask = mask | bits[b] end end
  return mask
end
function M.network(masks)
  network_now = masks
  if masks then network_prev = network_prev or {} else network_prev = nil end
end
function M.reset()
  M.network(nil)
  pressed_now, held_prev = {}, {}
end

function M.sim_begin() sim_active = true end
function M.sim_hold(name, v) sim_held[name] = v and true or nil end
function M.sim_press(name) pressed_now[name] = true end

return M
