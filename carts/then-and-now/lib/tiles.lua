-- A room's solid tile layers as walls, thin floors and hazards. Every room has two: "now" (the station as it is) and "then" (as it was,
-- seen through the Lens). Things that must never sink into a wall (the hero, walkers, shots) ask here instead of using hitboxes against
-- block entities: a room is thousands of tiles, far too many entities, and a tile lookup is one table read.
-- Tile numbers are the same in every biome's tilesets: 0-15 walls, 16 a thin floor (solid only from above), 17 a hazard (hurts, not solid),
-- 24 and on background. Functions take an optional era ("now" or "then"); without one they use the era the Lens shows.
local M = { era = "now" }
local floor = math.floor
local T = 16
local EPS = 0.01
local grids = { now = {}, ["then"] = {} }

function M.use(now_layer, then_layer)
  grids.now = now_layer and now_layer.data or {}
  grids["then"] = then_layer and then_layer.data or grids.now
end

local function grid(era) return grids[era or M.era] end
local function wall(t) return t ~= nil and t >= 0 and t < 16 end
local function thin(t) return t == 16 end
M.wall, M.thin = wall, thin

function M.tile(cx, cy, era) local row = grid(era)[cy + 1]; return row and row[cx + 1] end
function M.wall_at(x, y, era) return wall(M.tile(floor(x / T), floor(y / T), era)) end

-- Is any wall inside this box? Right and bottom are just outside it, so a box standing on a floor does not touch it.
function M.box_wall(l, t, r, b, era)
  local g = grid(era)
  for cy = floor(t / T), floor((b - EPS) / T) do
    local row = g[cy + 1]
    if row then
      for cx = floor(l / T), floor((r - EPS) / T) do
        local v = row[cx + 1]
        if v and v >= 0 and v < 16 then return true end
      end
    end
  end
  return false
end

-- Is any hazard tile inside this box?
function M.box_hazard(l, t, r, b, era)
  local g = grid(era)
  for cy = floor(t / T), floor((b - EPS) / T) do
    local row = g[cy + 1]
    if row then for cx = floor(l / T), floor((r - EPS) / T) do if row[cx + 1] == 17 then return true end end end
  end
  return false
end

-- Is there a thin floor along a row of tiles between two x positions?
function M.thin_row(l, r, cy, era)
  for cx = floor(l / T), floor((r - EPS) / T) do if thin(M.tile(cx, cy, era)) then return true end end
  return false
end

-- A thing with a box w wide and h tall standing at (x, y) (x the middle, y the feet) moves by dx: returns the new x and whether it hit a wall.
function M.move_x(x, y, w, h, dx, era)
  local hw = w / 2
  x = x + dx
  if not M.box_wall(x - hw, y - h, x + hw, y, era) then return x, false end
  if dx > 0 then return floor((x + hw - EPS) / T) * T - hw, true end
  return (floor((x - hw) / T) + 1) * T + hw, true
end

-- The same going up or down. Falling lands on thin floors too, unless through is true (dropping down).
-- Returns the new y and "floor", "ceiling" or nil.
function M.move_y(x, y, w, h, dy, through, era)
  local hw = w / 2
  local old = y
  y = y + dy
  if dy > 0 then
    local row = floor((y - EPS) / T)
    if M.box_wall(x - hw, y - h, x + hw, y, era) then return row * T, "floor" end
    if not through and old <= row * T + EPS and M.thin_row(x - hw, x + hw, row, era) then return row * T, "floor" end
  elseif dy < 0 and M.box_wall(x - hw, y - h, x + hw, y, era) then
    return (floor((y - h) / T) + 1) * T + h, "ceiling"
  end
  return y, nil
end

-- Standing on a thin floor only (so Down + B may drop through)?
function M.on_thin_only(x, y, w, era)
  local hw = w / 2
  local row = floor((y + 1) / T)
  return M.thin_row(x - hw, x + hw, row, era) and not M.box_wall(x - hw, y, x + hw, y + 1, era)
end

-- Is there ground (wall or thin floor) right under a point? Walkers use it to turn round at ledges.
function M.ground_at(x, y, era)
  local t = M.tile(floor(x / T), floor((y + 1) / T), era)
  return wall(t) or thin(t)
end

return M
