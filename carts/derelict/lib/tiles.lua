-- The room's "solid" tile layer as walls and thin floors. Things that must never sink into a wall (the hero, shots) ask here instead of
-- using hitboxes against block entities: a 60x30 room is 1800 tiles, far too many entities, and a tile lookup is one table read.
-- Tile numbers come from ts_station: 0-15 walls, 16-23 thin floors (solid only from above), anything else is not solid.
local M = {}
local floor = math.floor
local T = 16
local grid = {}
local EPS = 0.01

function M.use(layer) grid = layer and layer.data or {} end

local function tile(cx, cy) local row = grid[cy + 1]; return row and row[cx + 1] end
local function wall(t) return t ~= nil and t >= 0 and t < 16 end
local function thin(t) return t ~= nil and t >= 16 and t < 24 end
M.wall, M.thin = wall, thin

function M.wall_at(x, y) return wall(tile(floor(x / T), floor(y / T))) end

-- Is any wall inside this box? Right and bottom are just outside it, so a box standing on a floor does not touch it.
function M.box_wall(l, t, r, b)
  for cy = floor(t / T), floor((b - EPS) / T) do
    local row = grid[cy + 1]
    if row then
      for cx = floor(l / T), floor((r - EPS) / T) do
        local v = row[cx + 1]
        if v and v >= 0 and v < 16 then return true end
      end
    end
  end
  return false
end

-- Is there a thin floor along a row of tiles between two x positions?
function M.thin_row(l, r, cy)
  for cx = floor(l / T), floor((r - EPS) / T) do if thin(tile(cx, cy)) then return true end end
  return false
end

-- A thing with a box w wide and h tall standing at (x, y) (x the middle, y the feet) moves by dx: returns the new x and whether it hit a wall.
function M.move_x(x, y, w, h, dx)
  local hw = w / 2
  x = x + dx
  if not M.box_wall(x - hw, y - h, x + hw, y) then return x, false end
  if dx > 0 then return floor((x + hw - EPS) / T) * T - hw, true end
  return (floor((x - hw) / T) + 1) * T + hw, true
end

-- The same going up or down. Falling lands on thin floors too, unless through is true (dropping down).
-- Returns the new y and "floor", "ceiling" or nil.
function M.move_y(x, y, w, h, dy, through)
  local hw = w / 2
  local old = y
  y = y + dy
  if dy > 0 then
    local row = floor((y - EPS) / T)
    if M.box_wall(x - hw, y - h, x + hw, y) then return row * T, "floor" end
    if not through and old <= row * T + EPS and M.thin_row(x - hw, x + hw, row) then return row * T, "floor" end
  elseif dy < 0 and M.box_wall(x - hw, y - h, x + hw, y) then
    return (floor((y - h) / T) + 1) * T + h, "ceiling"
  end
  return y, nil
end

-- Standing on a thin floor only (so Down + B may drop through)?
function M.on_thin_only(x, y, w)
  local hw = w / 2
  local row = floor((y + 1) / T)
  return M.thin_row(x - hw, x + hw, row) and not M.box_wall(x - hw, y, x + hw, y + 1)
end

return M
