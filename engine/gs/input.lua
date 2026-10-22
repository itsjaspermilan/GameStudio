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

local function held(name)
  if sim_active then return sim_held[name] or false end
  return btn(name)
end
M.held = held
function M.pressed(name)
  if name == "any" then for _, b in ipairs(BUTTONS) do if pressed_now[b] then return true end end return false end
  return pressed_now[name] or false
end
function M.released(name) return (held_prev[name] and not held(name)) or false end
function M.dir()
  return (held("right") and 1 or 0) - (held("left") and 1 or 0), (held("down") and 1 or 0) - (held("up") and 1 or 0)
end

-- the engine calls these around its steps
function M.begin_frame() if not sim_active then for _, b in ipairs(BUTTONS) do if btnp(b) then pressed_now[b] = true end end end end
function M.end_step()
  for _, b in ipairs(BUTTONS) do held_prev[b] = held(b); pressed_now[b] = nil end
end

function M.sim_begin() sim_active = true end
function M.sim_hold(name, v) sim_held[name] = v and true or nil end
function M.sim_press(name) pressed_now[name] = true end

return M
