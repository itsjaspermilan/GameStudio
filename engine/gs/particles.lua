-- Particles: sparks, dust, smoke. Small squares (or frames of a sprite) that fly, fall, fade and vanish by themselves. They are not entities:
-- they never collide or think, cost a few numbers each, and do not count toward the 512 entities (the console's `particles` limit caps them).
--   gs.burst(x, y)                                                        -- a puff of 12 white sparks
--   gs.burst(x, y, { count = 20, color = "#ffd08a", speed = { 30, 90 }, life = { 0.3, 0.7 }, gravity = 200 })
--   gs.burst(x, y, { count = 6, angle = 270, spread = 40, size = 3, shrink = true, depth = -10 })   -- upwards, in front of things
--   gs.burst(x, y, { sprite = "spark", count = 4 })                       -- a sprite instead of squares; its frames play over the life
--   gs.particle_count()
-- Options (all optional): count, color, size (pixels), speed and life ({ min, max } or one number), angle and spread (degrees: 0 right,
-- 90 down; spread 360 = every way), gravity (pixels/s², down), drag (0 to 1, how much speed is lost a second), fade (default true), shrink,
-- depth (like an entity's: bigger is further back; default 0), sprite, blend ("add" makes sparks and fire glow where they overlap).
local assets = require("gs.assets")
local draw = require("gs.draw")

local M = { limit = 300 }
local random, cos, sin, rad, floor, max = math.random, math.cos, math.sin, math.rad, math.floor, math.max

-- one array per field, so making and removing particles makes no garbage
local px, py, pvx, pvy, page, plife, psize, pgrav, pdrag, pdepth, pr, pg, pb, pa, pspr = {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}
local pfade, pshrink, pblend = {}, {}, {}
local n = 0
local warned = false

-- one number, or a random one between v[1] and v[2]; without v, between lo and hi
local function pick(v, lo, hi)
  if v == nil then return lo + ((hi or lo) - lo) * random() end
  if type(v) == "table" then return v[1] + (v[2] - v[1]) * random() end
  return v
end

function M.burst(x, y, o)
  o = o or {}
  local count = o.count or 12
  local r, g, b, a = draw.color(o.color or "#ffffff")
  local spread, angle = o.spread or 360, o.angle or 0
  local spr = o.sprite and assets.sprite(o.sprite) or false
  for _ = 1, count do
    if n >= M.limit then
      if not warned then warned = true; io.stderr:write("warning: more than " .. M.limit .. " particles at once (this console's limit); new ones are left out\n") end
      return
    end
    n = n + 1
    local dir = rad(angle + (random() - 0.5) * spread)
    local speed = pick(o.speed, 20, 70)
    px[n], py[n], pvx[n], pvy[n] = x, y, cos(dir) * speed, sin(dir) * speed
    page[n], plife[n] = 0, max(0.01, pick(o.life, 0.3, 0.6))
    psize[n], pgrav[n], pdrag[n], pdepth[n] = pick(o.size, 2), o.gravity or 0, o.drag or 0, o.depth or 0
    pr[n], pg[n], pb[n], pa[n], pspr[n] = r, g, b, a, spr
    pfade[n], pshrink[n], pblend[n] = o.fade ~= false, o.shrink or false, o.blend or "normal"
  end
end

-- move the last particle into slot i (order does not matter)
local function remove(i)
  px[i], py[i], pvx[i], pvy[i], page[i], plife[i] = px[n], py[n], pvx[n], pvy[n], page[n], plife[n]
  psize[i], pgrav[i], pdrag[i], pdepth[i], pr[i], pg[i], pb[i], pa[i], pspr[i] = psize[n], pgrav[n], pdrag[n], pdepth[n], pr[n], pg[n], pb[n], pa[n], pspr[n]
  pfade[i], pshrink[i], pblend[i] = pfade[n], pshrink[n], pblend[n]
  pspr[n] = false
  n = n - 1
end

function M.update(dt)
  local i = 1
  while i <= n do
    local age = page[i] + dt
    if age >= plife[i] then remove(i)
    else
      page[i] = age
      local d = pdrag[i]
      local vx, vy = pvx[i], pvy[i] + pgrav[i] * dt
      if d > 0 then local k = max(0, 1 - d * dt); vx, vy = vx * k, vy * k end
      pvx[i], pvy[i] = vx, vy
      px[i], py[i] = px[i] + vx * dt, py[i] + vy * dt
      i = i + 1
    end
  end
end

-- draws the particles of one depth (the world draws them in its depth order, with the camera already set)
local rect, sprite_draw = gs.raw.rect, assets.draw
local function draw_depth(item)
  local depth = item.depth
  for i = 1, n do
    if pdepth[i] == depth then
      if pblend[i] ~= draw.mode then draw.blend(pblend[i]) end
      local left = 1 - page[i] / plife[i]
      local alpha = pfade[i] and pa[i] * left or pa[i]
      local s = pspr[i]
      if s then
        sprite_draw(s, floor(page[i] / plife[i] * s.frames), px[i], py[i], 0, 1, 1, alpha / 255, false)
      else
        local size = pshrink[i] and psize[i] * left or psize[i]
        if size >= 0.5 then rect(floor(px[i] - size / 2 + 0.5), floor(py[i] - size / 2 + 0.5), size, size, pr[i], pg[i], pb[i], floor(alpha)) end
      end
    end
  end
end

-- one drawable per depth in use, handed to the world's depth buckets
local drawers, drawer_pool = {}, {}
function M.drawables(out)
  for i = 1, #out do drawers[out[i].depth] = nil end
  local seen = 0
  for i = 1, n do
    local d = pdepth[i]
    local dr = drawers[d]
    if not dr then
      seen = seen + 1
      dr = drawer_pool[seen]
      if not dr then dr = { draw = draw_depth }; drawer_pool[seen] = dr end
      dr.depth = d
      drawers[d], out[seen] = dr, dr
    end
  end
  for i = #out, seen + 1, -1 do out[i] = nil end
  return seen
end

function M.count() return n end
function M.clear() for i = 1, n do pspr[i] = false end n = 0 end

return M
