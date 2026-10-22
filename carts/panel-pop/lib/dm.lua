-- dm.lua: the Doc Capsule bottle (rules only) and its CPU player. 8 wide, 16 tall. Cells are nil or { t = "v" (virus) | "p" (half of a capsule),
-- c = colour 1..3, link = the other half of its capsule, ori = "s" single / "l" "r" "u" "d" (which half), flash = being cleared }.
-- The falling capsule is d.pill = { r, c, dir, a, b }: the pivot cell (r, c) has colour a, the other half sits at pivot + DIRS[dir] with colour b.
local DM = {}
local floor, max, min, random = math.floor, math.max, math.min, math.random
local W, H = 8, 16
DM.W, DM.H = W, H
local DIRS = { { 0, 1 }, { 1, 0 }, { 0, -1 }, { -1, 0 } } -- right, down, left, up (row, column)
local FALL_T, CLEAR_T = 4, 20
DM.DIRS = DIRS
local SPEEDS = { 40, 26, 15 } -- frames per row: low, med, hi

local function ev(d, t, a) a = a or {}; a.t = t; d.ev[#d.ev + 1] = a end

-- ---------------------------------------------------------------- grid helpers (also used on copies by the CPU)
local function newgrid() local g = {}; for r = 1, H do g[r] = {} end; return g end

local function find_runs(g)
  local hit, list = {}, {}
  local runs = 0
  local function mark(r, c) local key = r * 10 + c; if not hit[key] then hit[key] = true; list[#list + 1] = { r, c } end end
  for r = 1, H do
    local c = 1
    while c <= W do
      local x = g[r][c]
      if x and not x.flash then
        local e = c
        while e < W and g[r][e + 1] and not g[r][e + 1].flash and g[r][e + 1].c == x.c do e = e + 1 end
        if e - c >= 3 then runs = runs + 1; for cc = c, e do mark(r, cc) end end
        c = e + 1
      else c = c + 1 end
    end
  end
  for c = 1, W do
    local r = 1
    while r <= H do
      local x = g[r][c]
      if x and not x.flash then
        local e = r
        while e < H and g[e + 1][c] and not g[e + 1][c].flash and g[e + 1][c].c == x.c do e = e + 1 end
        if e - r >= 3 then runs = runs + 1; for rr = r, e do mark(rr, c) end end
        r = e + 1
      else r = r + 1 end
    end
  end
  return list, runs
end

-- removes every flashing cell; returns how many viruses and capsule halves went
local function remove_flashing(g)
  local viruses, halves = 0, 0
  for r = 1, H do for c = 1, W do
    local x = g[r][c]
    if x and x.flash then
      if x.t == "v" then viruses = viruses + 1 else halves = halves + 1 end
      if x.link then x.link.link = nil; x.link.ori = "s" end
      g[r][c] = nil
    end
  end end
  return viruses, halves
end

-- one step of gravity: every capsule piece with nothing under it drops a row. Returns true if anything moved.
local function gravity_step(g)
  local moved = false
  local done = {}
  for r = H - 1, 1, -1 do
    for c = 1, W do
      local x = g[r][c]
      if x and x.t == "p" and not done[x] then
        local parts = { { r, c, x } }
        if x.link then
          local lr, lc
          for _, d in ipairs(DIRS) do if g[r + d[1]] and g[r + d[1]][c + d[2]] == x.link then lr, lc = r + d[1], c + d[2] end end
          if lr then parts[2] = { lr, lc, x.link } end
        end
        for _, p in ipairs(parts) do done[p[3]] = true end
        local free = true
        for _, p in ipairs(parts) do
          local br = p[1] + 1
          if br > H then free = false
          else
            local below = g[br][p[2]]
            if below and below ~= parts[1][3] and below ~= (parts[2] and parts[2][3]) then free = false end
          end
        end
        if free then
          table.sort(parts, function(p, q) return p[1] > q[1] end)
          for _, p in ipairs(parts) do g[p[1] + 1][p[2]] = p[3]; g[p[1]][p[2]] = nil end
          moved = true
        end
      end
    end
  end
  return moved
end

local function copy_grid(g)
  local o, map = newgrid(), {}
  for r = 1, H do for c = 1, W do
    local x = g[r][c]
    if x then local n = { t = x.t, c = x.c, ori = x.ori }; map[x] = n; o[r][c] = n end
  end end
  for r = 1, H do for c = 1, W do local x = g[r][c]; if x and x.link then o[r][c].link = map[x.link] end end end
  return o
end

-- plays a position out at once: clears, drops, clears again. Returns viruses removed, halves removed, runs.
local function resolve(g)
  local tv, th, tr = 0, 0, 0
  while true do
    local list, runs = find_runs(g)
    if #list == 0 then break end
    tr = tr + runs
    for _, p in ipairs(list) do g[p[1]][p[2]].flash = true end
    local v, h = remove_flashing(g)
    tv = tv + v; th = th + h
    while gravity_step(g) do end
  end
  return tv, th, tr
end

-- ---------------------------------------------------------------- a new bottle
-- o: level 0..20 (virus count 4 * (level + 1)), speed 1..3 (low, med, hi), viruses (override the count)
function DM.new(o)
  local d = { g = newgrid(), ev = {}, t = 0, lvl = o.level or 0, speed = o.speed or 2, score = 0, pills = 0, phase = "spawn", pt = 30, gt = 0, soft = 0,
    incoming = {}, lost = false, won = false, runs = 0, cols = {}, kills = 0, vleft = 0, nextp = nil, das = 0, vkill_total = 0 }
  d.gf = SPEEDS[d.speed] or 26
  local count = o.viruses or min(84, 4 * (d.lvl + 1))
  local top = d.lvl >= 18 and 5 or d.lvl >= 15 and 6 or 7
  local placed, tries = 0, 0
  local order = { 1, 2, 3 }
  for i = 3, 2, -1 do local j = random(1, i); order[i], order[j] = order[j], order[i] end
  while placed < count and tries < 4000 do
    tries = tries + 1
    local r, c = random(top, H), random(1, W)
    if not d.g[r][c] then
      local col = order[placed % 3 + 1]
      d.g[r][c] = { t = "v", c = col, ori = "s" }
      local _, runs = find_runs(d.g)
      if runs > 0 then d.g[r][c] = nil
      else
        -- no three of a kind in a line to start with
        local function same(rr, cc) return d.g[rr] and d.g[rr][cc] and d.g[rr][cc].c == col end
        local bad = (same(r, c - 1) and same(r, c - 2)) or (same(r, c + 1) and same(r, c + 2)) or (same(r - 1, c) and same(r - 2, c)) or (same(r + 1, c) and same(r + 2, c))
        if bad then d.g[r][c] = nil else placed = placed + 1 end
      end
    end
  end
  d.vleft = placed
  d.vstart = placed
  d.nextp = { random(1, 3), random(1, 3) }
  return d
end

local function spawn_pill(d)
  local a, b = d.nextp[1], d.nextp[2]
  d.nextp = { random(1, 3), random(1, 3) }
  if d.g[1][4] or d.g[1][5] then d.lost = true; d.phase = "over"; ev(d, "lost"); return end
  d.pill = { r = 1, c = 4, dir = 1, a = a, b = b }
  d.gt = 0; d.das = 0
  d.pills = d.pills + 1
  if d.pills % 10 == 0 then d.gf = max(6, d.gf - 1) end
  d.phase = "play"
  ev(d, "spawn")
end

-- the two cells of the falling pill: (r, c, colour), (r2, c2, colour)
function DM.pill_cells(p)
  local o = DIRS[p.dir]
  return p.r, p.c, p.a, p.r + o[1], p.c + o[2], p.b
end
local function free(d, r, c) return r >= 1 and r <= H and c >= 1 and c <= W and not d.g[r][c] end
local function fits(d, r, c, dir)
  local o = DIRS[dir]
  return free(d, r, c) and free(d, r + o[1], c + o[2])
end

local function try_move(d, dc)
  local p = d.pill
  if fits(d, p.r, p.c + dc, p.dir) then p.c = p.c + dc; ev(d, "move"); return true end
  return false
end
local function try_rotate(d, cw)
  local p = d.pill
  local nd = cw and p.dir % 4 + 1 or (p.dir + 2) % 4 + 1
  if fits(d, p.r, p.c, nd) then p.dir = nd; ev(d, "rot"); return true end
  if nd == 1 and fits(d, p.r, p.c - 1, nd) then p.c = p.c - 1; p.dir = nd; ev(d, "rot"); return true end -- other half to the right is blocked: shift left
  if nd == 3 and fits(d, p.r, p.c + 1, nd) then p.c = p.c + 1; p.dir = nd; ev(d, "rot"); return true end
  if nd == 2 and p.r > 1 and fits(d, p.r - 1, p.c, nd) then p.r = p.r - 1; p.dir = nd; ev(d, "rot"); return true end
  return false
end

-- which half-sprite each cell of a placed capsule shows
local ORI = { [1] = { "l", "r" }, [2] = { "u", "d" }, [3] = { "r", "l" }, [4] = { "d", "u" } }
local function lock_pill(d)
  local p = d.pill
  local r1, c1, a, r2, c2, b = DM.pill_cells(p)
  local x = { t = "p", c = a, ori = ORI[p.dir][1] }
  local y = { t = "p", c = b, ori = ORI[p.dir][2] }
  x.link, y.link = y, x
  d.g[r1][c1], d.g[r2][c2] = x, y
  d.pill = nil
  d.runs, d.cols, d.kills = 0, {}, 0
  ev(d, "lock")
  d.phase = "fall"; d.pt = 0
end

local function mark_matches(d)
  local list, runs = find_runs(d.g)
  if #list == 0 then return false end
  for _, p in ipairs(list) do local x = d.g[p[1]][p[2]]; x.flash = true; d.cols[x.c] = true end
  d.runs = d.runs + runs
  d.phase = "clear"; d.pt = CLEAR_T
  ev(d, "clear", { n = #list })
  return true
end

local function drop_incoming(d)
  local pills = d.incoming
  d.incoming = {}
  for _, ab in ipairs(pills) do
    local cols = {}
    for c = 1, W - 1 do if not d.g[1][c] and not d.g[1][c + 1] then cols[#cols + 1] = c end end
    if #cols == 0 then d.lost = true; d.phase = "over"; ev(d, "lost"); return end
    local c = cols[random(1, #cols)]
    local x, y = { t = "p", c = ab[1], ori = "l" }, { t = "p", c = ab[2], ori = "r" }
    x.link, y.link = y, x
    d.g[1][c], d.g[1][c + 1] = x, y
  end
  ev(d, "garbage", { n = #pills })
end

-- inp: { dc = -1|0|1 (a move), rot = 1|-1|0, down = held }
function DM.update(d, inp)
  d.t = d.t + 1
  if d.lost or d.won then return end
  inp = inp or {}
  if d.phase == "spawn" then
    d.pt = d.pt - 1
    if d.pt <= 0 then
      if #d.incoming > 0 then drop_incoming(d); d.phase = "fall"; d.pt = 0
      else spawn_pill(d) end
    end
  elseif d.phase == "play" then
    local p = d.pill
    if inp.dc and inp.dc ~= 0 then try_move(d, inp.dc) end
    if inp.rot and inp.rot ~= 0 then try_rotate(d, inp.rot > 0) end
    d.gt = d.gt + (inp.down and 8 or 1)
    if d.gt >= d.gf then
      d.gt = 0
      if fits(d, p.r + 1, p.c, p.dir) then p.r = p.r + 1
      else ev(d, "land"); lock_pill(d) end
    end
  elseif d.phase == "clear" then
    d.pt = d.pt - 1
    if d.pt <= 0 then
      local v, h = remove_flashing(d.g)
      for _ = 1, v do
        d.kills = d.kills + 1
        d.score = d.score + 100 * (1 << (min(d.kills, 6) - 1)) * d.speed
        d.vleft = d.vleft - 1
      end
      ev(d, "gone", { v = v, h = h })
      d.phase = "fall"; d.pt = 0
    end
  elseif d.phase == "fall" then
    d.pt = d.pt - 1
    if d.pt <= 0 then
      if gravity_step(d.g) then d.pt = FALL_T
      elseif not mark_matches(d) then
        -- everything has settled
        if d.vleft <= 0 then d.won = true; d.phase = "over"; ev(d, "won"); return end
        local attack = min(4, max(0, d.runs - 1))
        if attack > 0 then
          local cols = {}
          for c in pairs(d.cols) do cols[#cols + 1] = c end
          table.sort(cols)
          ev(d, "attack", { n = attack, cols = cols })
        end
        d.runs, d.cols, d.kills = 0, {}, 0
        d.phase = "spawn"; d.pt = 18
      end
    end
  end
end

-- the virus colours still alive (for the magnifier)
function DM.virus_colors(d)
  local seen = { 0, 0, 0 }
  for r = 1, H do for c = 1, W do local x = d.g[r][c]; if x and x.t == "v" then seen[x.c] = seen[x.c] + 1 end end end
  return seen
end
function DM.height(d) for r = 1, H do for c = 1, W do if d.g[r][c] then return H - r + 1 end end end; return 0 end

-- ---------------------------------------------------------------- the CPU player
local DMAI = {}
-- o: gap (frames between key presses), err (chance of a worse placement), think (frames to "look" at a new capsule), look (also plans the next capsule)
function DMAI.new(o) return { gap = o.gap or 8, err = o.err or 0.2, think = o.think or 20, look = o.look or false, t = 0, target = nil } end

-- how many pieces sit above viruses (those viruses are harder to reach)
local function burial(g)
  local total = 0
  for c = 1, W do
    local n = 0
    for r = 1, H do
      local x = g[r][c]
      if x then if x.t == "v" then total = total + min(n, 6) else n = n + 1 end end
    end
  end
  return total
end

-- windows of four cells holding one colour and nothing else: the closer to full, the better
local function potential(g)
  local total = 0
  for r = 1, H do
    local row = g[r]
    for c = 1, W - 3 do
      local col, n, ok = 0, 0, true
      for k = c, c + 3 do
        local x = row[k]
        if x then if col == 0 or x.c == col then col = x.c; n = n + 1 else ok = false; break end end
      end
      if ok and n >= 2 then total = total + n * n end
    end
  end
  for c = 1, W do
    for r = 1, H - 3 do
      local col, n, ok = 0, 0, true
      for k = r, r + 3 do
        local x = g[k][c]
        if x then if col == 0 or x.c == col then col = x.c; n = n + 1 else ok = false; break end end
      end
      if ok and n >= 2 then total = total + n * n end
    end
  end
  return total
end

-- drops capsule (colours pa, pb, facing dir) down column col of a copy of g0 and plays it out. Returns a score and the board afterwards.
local function evaluate(g0, pa, pb, dir, col, base)
  local g = copy_grid(g0)
  local o = DIRS[dir]
  local r = 1
  local function ok(rr, cc)
    local r2, c2 = rr + o[1], cc + o[2]
    return rr >= 1 and rr <= H and cc >= 1 and cc <= W and r2 >= 1 and r2 <= H and c2 >= 1 and c2 <= W and not g[rr][cc] and not g[r2][c2]
  end
  if not ok(1, col) then return nil end
  while ok(r + 1, col) do r = r + 1 end
  local r2, c2 = r + o[1], col + o[2]
  local x = { t = "p", c = pa, ori = ORI[dir][1] }
  local y = { t = "p", c = pb, ori = ORI[dir][2] }
  x.link, y.link = y, x
  g[r][col], g[r2][c2] = x, y
  local near = 0
  local function touch(cr, cc, colr)
    for _, dd in ipairs(DIRS) do
      local n = g[cr + dd[1]] and g[cr + dd[1]][cc + dd[2]]
      if n and n ~= x and n ~= y and n.c == colr then near = near + (n.t == "v" and 6 or 3) end
    end
  end
  touch(r, col, pa); touch(r2, c2, pb)
  local v, h, runs = resolve(g)
  -- column heights afterwards: tall stacks near the entry point end the game
  local sumsq, maxh = 0, 0
  for c = 1, W do
    local top = H + 1
    for rr = 1, H do if g[rr][c] then top = rr; break end end
    local ch = H - top + 1
    sumsq = sumsq + ch * ch * ((c >= 3 and c <= 6) and 1.6 or 1)
    maxh = max(maxh, ch)
  end
  local score = v * 1000 + h * 60 + near * 12 + runs * 40 - (burial(g) - base) * 9 - sumsq * 0.1 - max(0, maxh - 9) * 80 + potential(g) * 5
  return score, g
end

-- the thinking is done in slices (a coroutine) so a hard opponent never stalls a frame: after every few placements it gives the frame back
local evals = 0
local function slice()
  evals = evals + 1
  if evals % 20 == 0 and coroutine.isyieldable() then coroutine.yield() end
end

local function all_placements(g, pa, pb, base)
  local list = {}
  for dir = 1, 4 do
    for col = 1, W do
      slice()
      local s, after = evaluate(g, pa, pb, dir, col, base)
      if s then list[#list + 1] = { dir = dir, col = col, s = s, g = after } end
    end
  end
  table.sort(list, function(p, q) return p.s > q.s end)
  return list
end

-- picks where to put the current capsule: ai.target = { dir, col }
function DMAI.plan(d, ai)
  local pill_no = d.pills
  local base = burial(d.g)
  local p = d.pill
  local cands = all_placements(d.g, p.a, p.b, base)
  if ai.look and #cands > 0 then
    -- the best few placements, each judged by the best way to place the capsule after it
    for i = 1, min(5, #cands) do
      local c = cands[i]
      local nxt = all_placements(c.g, d.nextp[1], d.nextp[2], burial(c.g))
      c.s = c.s + (nxt[1] and nxt[1].s * 0.8 or -500)
    end
    table.sort(cands, function(a, b) return a.s > b.s end)
  end
  local best = cands[1]
  if best and #cands > 1 and random() < ai.err then best = cands[random(1, min(#cands, 6))] end
  if d.pills == pill_no and d.pill then ai.target = best end -- (the capsule may have landed while we were thinking)
  ai.t = ai.think
end

function DMAI.input(d, ai)
  local inp = {}
  if d.phase ~= "play" or not d.pill then ai.target = nil; ai.co = nil; return inp end
  if not ai.target then
    if ai.t == nil or ai.t <= 0 then
      if not ai.co then ai.co = coroutine.create(function() DMAI.plan(d, ai) end) end
      local ok, err = coroutine.resume(ai.co)
      if not ok then ai.co = nil; error(err) end
      if coroutine.status(ai.co) == "dead" then ai.co = nil end
    else ai.t = ai.t - 1 end
    return inp
  end
  ai.t = (ai.t or 0) - 1
  if ai.t > 0 then return inp end
  ai.t = ai.gap
  local p, tg = d.pill, ai.target
  if p.dir ~= tg.dir then
    inp.rot = 1
    if (p.dir - tg.dir) % 4 == 1 then inp.rot = -1 end
  elseif p.c ~= tg.col then inp.dc = tg.col > p.c and 1 or -1
  else inp.down = true; ai.t = 0 end
  return inp
end
function DMAI.reset(ai) ai.target = nil; ai.co = nil; ai.t = ai.think end
DM.AI = DMAI
return DM
