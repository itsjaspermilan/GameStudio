-- Finding enemies for weapons to aim at. gs.nearest would do, but a ghost (a wraith in its faded
-- phase) cannot be targeted, and multi-shot weapons want the second, third... nearest.
local M = {}

-- the nth nearest targetable enemy within maxd of (x, y), or nil. `skip` is an enemy to leave out.
function M.nearest(x, y, maxd, skip, nth)
  local list = gs.all("enemy")
  local best, bd = nil, (maxd or 1e9) ^ 2
  nth = nth or 1
  if nth == 1 then
    for i = 1, #list do
      local e = list[i]
      if not e._dead and not e.ghosted and e ~= skip then
        local dx, dy = e.x - x, e.y - y
        local d = dx * dx + dy * dy
        if d < bd then best, bd = e, d end
      end
    end
    return best
  end
  local taken = {}
  for _ = 1, nth do
    best, bd = nil, (maxd or 1e9) ^ 2
    for i = 1, #list do
      local e = list[i]
      if not e._dead and not e.ghosted and not taken[e] then
        local dx, dy = e.x - x, e.y - y
        local d = dx * dx + dy * dy
        if d < bd then best, bd = e, d end
      end
    end
    if not best then return nil end
    taken[best] = true
  end
  return best
end

return M
