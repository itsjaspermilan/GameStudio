-- What the player's weapons do. Every weapon has a cooldown and a fire function that makes entities (shots, rings, mines...) or hurts enemies
-- directly (the beam and the lightning). The orbit blades are the one weapon without a cooldown: their entities circle the player all the time.
local run = require "lib.run"
local audio = require "lib.audio"
local targets = require "lib.targets"

local cos, sin, atan, random, min, abs, sqrt = math.cos, math.sin, math.atan, math.random, math.min, math.abs, math.sqrt
local TAU = math.pi * 2

local M = {}
local fire = {}

function fire.pulse(w, s, P)
  local t = targets.nearest(P.x, P.y, 230)
  if not t then return false end
  local base = atan(t.y - P.y, t.x - P.x)
  for i = 1, s.count do
    local a = base + (i - (s.count + 1) / 2) * 0.13
    run.shot("bolt", P.x, P.y, { vx = cos(a) * s.speed, vy = sin(a) * s.speed, dmg = s.dmg, pierce = s.pierce, life = 1.3 })
  end
  audio.sfx("sfx_shoot", 3)
end

function fire.scatter(w, s, P)
  local t = targets.nearest(P.x, P.y, 170)
  if not t then return false end
  local base = atan(t.y - P.y, t.x - P.x)
  for _ = 1, s.count do
    local a = base + (random() - 0.5) * 0.75
    local speed = s.speed * (0.85 + random() * 0.3)
    run.shot("pellet", P.x, P.y, { vx = cos(a) * speed, vy = sin(a) * speed, dmg = s.dmg, pierce = s.pierce, life = 0.42 * (0.8 + s.area * 0.2) })
  end
  audio.sfx("sfx_shoot", 3)
end

function fire.missiles(w, s, P)
  local any = targets.nearest(P.x, P.y, 300)
  if not any then return false end
  for i = 1, s.count do
    local a = random() * TAU
    run.shot("missile", P.x, P.y, { vx = cos(a) * s.speed, vy = sin(a) * s.speed, dmg = s.dmg, life = 3.2, area = 24 * s.area, tgt = targets.nearest(P.x, P.y, 300, nil, min(i, 4)) or any })
  end
  audio.sfx("sfx_missile", 4)
end

function fire.nova(w, s, P)
  for i = 1, s.count do gs.spawn("weapons.ring", P.x, P.y, { t = -(i - 1) * 0.3, max = 72 * s.area, dmg = s.dmg }) end
  audio.sfx("sfx_nova", 4)
end

-- chain lightning: hits the nearest enemy, then jumps to the nearest one to that (pierce = extra jumps)
function fire.arc(w, s, P)
  local first = targets.nearest(P.x, P.y, 170)
  if not first then return false end
  for b = 1, s.count do
    local cur = (b == 1) and first or targets.nearest(P.x, P.y, 170, nil, b) or first
    local hit, px, py = {}, P.x, P.y
    for _ = 0, s.pierce do
      if not cur then break end
      hit[cur] = true
      cur:hurt(s.dmg, 0, 0)
      gs.spawn("weapons.lightning", px, py, { x1 = px, y1 = py, x2 = cur.x, y2 = cur.y })
      px, py = cur.x, cur.y
      local nxt, bd = nil, (70 * s.area) ^ 2
      local list = gs.all("enemy")
      for i = 1, #list do
        local e = list[i]
        if not e._dead and not hit[e] and not e.ghosted then
          local dx, dy = e.x - px, e.y - py
          local d = dx * dx + dy * dy
          if d < bd then nxt, bd = e, d end
        end
      end
      cur = nxt
    end
  end
  audio.sfx("sfx_zap", 3)
end

-- a beam that hurts everything along a line, however far
function fire.lance(w, s, P)
  local any = targets.nearest(P.x, P.y, 260)
  local list = gs.all("enemy")
  for b = 1, s.count do
    local t = any and (targets.nearest(P.x, P.y, 260, nil, b) or any)
    local ang = t and atan(t.y - P.y, t.x - P.x) or (P.face_a + (b - 1) * 0.4)
    local len, wd = 230, 5 * s.area
    local ca, sa = cos(ang), sin(ang)
    for i = 1, #list do
      local e = list[i]
      if not e._dead then
        local dx, dy = e.x - P.x, e.y - P.y
        local along = dx * ca + dy * sa
        if along > -4 and along < len then
          local off = abs(-dx * sa + dy * ca)
          if off <= wd + e:radius() then e:hurt(s.dmg, ca * 40, sa * 40) end
        end
      end
    end
    gs.spawn("weapons.beam", P.x, P.y, { ang = ang, len = len, w = wd, t = 0.2 * s.dur, life = 0.2 * s.dur })
  end
  audio.sfx("sfx_lance", 3)
end

function fire.mines(w, s, P)
  for _ = 1, s.count do gs.spawn("weapons.mine", P.x + random(-14, 14), P.y + random(-14, 14), { t = 9 * s.dur, dmg = s.dmg, r = 30 * s.area }) end
  audio.sfx("sfx_mine", 4)
end

function fire.well(w, s, P)
  local t = targets.nearest(P.x, P.y, 220)
  if not t then return false end
  for i = 1, s.count do
    local a = random() * TAU
    gs.spawn("weapons.well", t.x + cos(a) * 20 * (i - 1), t.y + sin(a) * 20 * (i - 1), { t = 3.5 * s.dur, r = 55 * s.area, dmg = s.dmg })
  end
  audio.sfx("sfx_hole", 4)
end

function fire.comet(w, s, P)
  local any = targets.nearest(P.x, P.y, 280)
  if not any then return false end
  for i = 1, s.count do
    local t = targets.nearest(P.x, P.y, 280, nil, min(i, 6)) or any
    local delay = 0.65 + 0.15 * i
    gs.spawn("strike", t.x + t.vx * 0.5, t.y + t.vy * 0.5, { t = delay, total = delay, r = 26 * s.area, dmg = s.dmg, mine = true })
  end
  audio.sfx("sfx_warn", 4)
end

-- the orbit blades: one entity per blade, moved around the player here
local function update_blades(w, s, P, dt)
  w.ang = (w.ang or 0) + 2.4 * s.speed * dt
  local n = s.count
  local rad = (34 + 4 * s.area) * (0.9 + s.area * 0.1)
  w.blades = w.blades or {}
  for i = 1, n do
    local b = w.blades[i]
    if not b or not b:is_alive() then b = gs.spawn("weapons.blade", P.x, P.y); w.blades[i] = b end
    local a = w.ang + (i - 1) * TAU / n
    b.x, b.y = P.x + cos(a) * rad, P.y + sin(a) * rad
    b.spin, b.dmg, b.sx, b.sy, b.look = a, s.dmg, s.area, s.area, 1 + (s.area - 1) * 0.5
  end
  for i = n + 1, #w.blades do w.blades[i]:destroy(); w.blades[i] = nil end
end

function M.update(P, dt)
  for _, w in ipairs(run.R.weapons) do
    local s = w.s
    if w.id == "shards" then update_blades(w, s, P, dt)
    else
      w.t = w.t - dt
      if w.t <= 0 then
        local fired = fire[w.id](w, s, P)
        w.t = (fired == false) and 0.15 or s.cd
      end
    end
  end
end

return M
