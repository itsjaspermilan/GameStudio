-- A pilot that plays by itself, for testing the game without a person (GS_BOT=1, see lib/debug.lua): it steers away from enemies and shots, toward
-- gems, dashes when something is about to hit it, and picks level-up cards by a simple score.
local run = require "lib.run"

local sqrt, cos, sin, random = math.sqrt, math.cos, math.sin, math.random

local M = {}

function M.dash()
  local P = run.P
  if P.dash_cd > 0 or P.inv > 0 then return false end
  local enemies = gs.all("enemy")
  for i = 1, #enemies do
    local e = enemies[i]
    local dx, dy = e.x - P.x, e.y - P.y
    local rr = e:radius() + 20
    if dx * dx + dy * dy < rr * rr then return true end
  end
  local bullets = gs.all("ebullet")
  for i = 1, #bullets do
    local b = bullets[i]
    local dx, dy = b.x - P.x, b.y - P.y
    if dx * dx + dy * dy < 18 * 18 then return true end
  end
  return false
end

function M.move()
  local P, R = run.P, run.R
  local mx, my = 0, 0
  local enemies = gs.all("enemy")
  for i = 1, #enemies do
    local e = enemies[i]
    local dx, dy = P.x - e.x, P.y - e.y
    local d2 = dx * dx + dy * dy
    if d2 < 55 * 55 then local d = sqrt(d2) + 1; mx, my = mx + dx / d * (55 - d) * 0.06, my + dy / d * (55 - d) * 0.06 end
  end
  local bullets = gs.all("ebullet")
  for i = 1, #bullets do
    local b = bullets[i]
    local dx, dy = P.x - b.x, P.y - b.y
    local d2 = dx * dx + dy * dy
    if d2 < 45 * 45 then local d = sqrt(d2) + 1; mx, my = mx + dx / d * (45 - d) * 0.1, my + dy / d * (45 - d) * 0.1 end
  end
  local strikes = gs.all("strike")
  for i = 1, #strikes do -- the red circles warn where lightning will land: step out of them
    local k = strikes[i]
    if not k.mine then
      local dx, dy = P.x - k.x, P.y - k.y
      local d = sqrt(dx * dx + dy * dy) + 0.5
      if d < k.r + 22 then mx, my = mx + dx / d * 4, my + dy / d * 4 end
    end
  end
  local best, bd = nil, 200 * 200
  local pickups = gs.all("pickup")
  for i = 1, #pickups do
    local g = pickups[i]
    local dx, dy = g.x - P.x, g.y - P.y
    local d2 = dx * dx + dy * dy
    if d2 < bd then best, bd = g, d2 end
  end
  if best then
    local dx, dy = best.x - P.x, best.y - P.y
    local d = sqrt(dx * dx + dy * dy) + 1
    mx, my = mx + dx / d * 1.2, my + dy / d * 1.2
  end
  local l = sqrt(mx * mx + my * my)
  if l > 0.3 then return mx / l, my / l end
  return cos(R.t), sin(R.t * 0.7)
end

-- which level-up card to take: the index
function M.choose(choices)
  local R = run.R
  local best, bs = 1, -1
  local score = { wup = 3, wnew = (#R.weapons < 3) and 2.6 or 0.5, pup = 2, pnew = 1.5, heal = 1, gold = 0.5 }
  for i, c in ipairs(choices) do
    local sc = score[c.kind] + random() * 0.5
    if sc > bs then best, bs = i, sc end
  end
  return best
end

return M
