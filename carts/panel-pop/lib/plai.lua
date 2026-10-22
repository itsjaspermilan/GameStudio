-- plai.lua: the CPU player for Panel Pop. It looks at a plain copy of the board (colours only), tries every swap that makes a match (and
-- what that sets falling), picks the best, then walks the cursor there at a speed set by the opponent's level. Weaker opponents move the
-- cursor slowly, pause between moves, ignore chains and sometimes pick a worse move.
local PL = require "lib.pl"
local PLAI = {}
local floor, max, min, random, abs = math.floor, math.max, math.min, math.random, math.abs
local COLS, VIS, TOP, NR = PL.COLS, PL.VIS, PL.TOP, PL.NR

-- ai: { gap = frames per cursor step, cool = frames after a swap, think = frames between decisions, err = chance of a worse move,
--       chains = looks for chains, raise = raises the stack when the board is low }
function PLAI.new(o)
  return { gap = o.gap or 8, cool = o.cool or 12, think = o.think or 20, err = o.err or 0.2, chains = o.chains or false, raise = o.raise ~= false,
    wait = 10, tr = nil, tc = nil, push0 = 0, clock = 0, step_t = 0, raising = false }
end

local function snapshot(b)
  local g = {}
  for r = 1, VIS do
    g[r] = {}
    for c = 1, COLS do
      local x = b.g[TOP + r - 1][c]
      local v = 0
      if x then
        if x.gb then v = -1
        elseif x.st == "flash" or x.st == "face" then v = 0
        else v = x.k end
      end
      g[r][c] = v
    end
  end
  return g
end

local function copy(g) local o = {}; for r = 1, VIS do local row, src = {}, g[r]; for c = 1, COLS do row[c] = src[c] end; o[r] = row end; return o end

local function gravity(g)
  for c = 1, COLS do
    local w = VIS
    for r = VIS, 1, -1 do
      local v = g[r][c]
      if v ~= 0 then if r ~= w then g[w][c] = v; g[r][c] = 0 end; w = w - 1 end
    end
  end
end

local function find(g)
  local hit, list = {}, {}
  local function mark(r, c) local key = r * 8 + c; if not hit[key] then hit[key] = true; list[#list + 1] = key end end
  for r = 1, VIS do
    local c = 1
    while c <= COLS do
      local v = g[r][c]
      if v > 0 then
        local e = c
        while e < COLS and g[r][e + 1] == v do e = e + 1 end
        if e - c >= 2 then for cc = c, e do mark(r, cc) end end
        c = e + 1
      else c = c + 1 end
    end
  end
  for c = 1, COLS do
    local r = 1
    while r <= VIS do
      local v = g[r][c]
      if v > 0 then
        local e = r
        while e < VIS and g[e + 1][c] == v do e = e + 1 end
        if e - r >= 2 then for rr = r, e do mark(rr, c) end end
        r = e + 1
      else r = r + 1 end
    end
  end
  return list
end

-- would swapping (r,c) with (r,c+1) make a match right away (or let something fall)?
local function quick(g, r, c)
  local a, d = g[r][c], g[r][c + 1]
  if a == 0 or d == 0 then return true end
  local function run(rr, cc, v)
    local n = 1
    local x = cc - 1; while x >= 1 and (x == c and d or (x == c + 1 and a or g[rr][x])) == v do n = n + 1; x = x - 1 end
    x = cc + 1; while x <= COLS and (x == c and d or (x == c + 1 and a or g[rr][x])) == v do n = n + 1; x = x + 1 end
    if n >= 3 then return true end
    n = 1
    local y = rr - 1; while y >= 1 and g[y][cc] == v do n = n + 1; y = y - 1 end
    y = rr + 1; while y <= VIS and g[y][cc] == v do n = n + 1; y = y + 1 end
    return n >= 3
  end
  return (a > 0 and run(r, c + 1, a)) or (d > 0 and run(r, c, d))
end

local function simulate(g0, r, c)
  local g = copy(g0)
  g[r][c], g[r][c + 1] = g[r][c + 1], g[r][c]
  gravity(g)
  local cleared, chain, gh = 0, 0, 0
  while true do
    local list = find(g)
    if #list == 0 then break end
    chain = chain + 1; cleared = cleared + #list
    local seen = {}
    for _, key in ipairs(list) do
      local rr, cc = key // 8, key % 8
      for _, d in ipairs({ { -1, 0 }, { 1, 0 }, { 0, -1 }, { 0, 1 } }) do
        local y, x = rr + d[1], cc + d[2]
        if g[y] and g[y][x] == -1 and not seen[y * 8 + x] then seen[y * 8 + x] = true; gh = gh + 1 end
      end
    end
    for _, key in ipairs(list) do g[key // 8][key % 8] = 0 end
    gravity(g)
  end
  return cleared, chain, gh
end

-- how many neighbouring pairs of one colour there are: a cheap guess at "closer to a match"
local function pairs_score(g)
  local n = 0
  for r = 1, VIS do for c = 1, COLS do
    local v = g[r][c]
    if v > 0 then
      if c < COLS and g[r][c + 1] == v then n = n + 1 end
      if r < VIS and g[r + 1][c] == v then n = n + 1 end
      if c < COLS - 1 and g[r][c + 2] == v then n = n + 0.4 end
    end
  end end
  return n
end

local function think(b, ai)
  local g = snapshot(b)
  local cr, cc = b.cur_r - TOP + 1, b.cur_c
  local cands = {}
  for r = 1, VIS do for c = 1, COLS - 1 do
    local a, d = g[r][c], g[r][c + 1]
    if a ~= d and a >= 0 and d >= 0 and PL.can_swap(b, TOP + r - 1, c) and quick(g, r, c) then
      local cleared, chain, gh = simulate(g, r, c)
      if cleared > 0 then
        local dist = abs(r - cr) + abs(c - cc)
        local score = cleared * 10 + gh * 14 - dist * (ai.gap > 6 and 3 or 1.2)
        if ai.chains then score = score + (chain - 1) * 45 end
        cands[#cands + 1] = { r = r, c = c, s = score }
      end
    end
  end end
  if #cands > 0 then
    table.sort(cands, function(p, q) return p.s > q.s end)
    local pick = cands[1]
    if #cands > 1 and random() < ai.err then pick = cands[random(1, #cands)] end
    return pick.r, pick.c
  end
  -- nothing to match: arrange neighbours, else raise
  local base, best, bs = pairs_score(g), nil, 0.01
  for r = 1, VIS do for c = 1, COLS - 1 do
    local a, d = g[r][c], g[r][c + 1]
    if a ~= d and a >= 0 and d >= 0 and a + d > 0 and PL.can_swap(b, TOP + r - 1, c) then
      local t = copy(g); t[r][c], t[r][c + 1] = d, a; gravity(t)
      local s = pairs_score(t) - base - (abs(r - cr) + abs(c - cc)) * 0.05
      if s > bs then bs = s; best = { r = r, c = c } end
    end
  end end
  if best and random() > ai.err * 0.5 then return best.r, best.c end
  return nil
end

-- one frame: returns the button presses for PL.update
function PLAI.input(b, ai)
  ai.clock = ai.clock + 1
  local inp = {}
  if b.lost then return inp end
  if ai.tr then
    -- the rows scroll up as the stack rises
    local tr = ai.tr - (b.rows_pushed - ai.push0)
    if tr < TOP or not PL.can_swap(b, tr, ai.tc) then ai.tr = nil
    else
      if b.cur_r == tr and b.cur_c == ai.tc then
        inp.swap = true; ai.tr = nil; ai.wait = ai.cool
      else
        ai.step_t = ai.step_t - 1
        if ai.step_t <= 0 then
          ai.step_t = ai.gap
          local dr, dc = tr - b.cur_r, ai.tc - b.cur_c
          if abs(dc) >= abs(dr) and dc ~= 0 then inp.dc = dc > 0 and 1 or -1 elseif dr ~= 0 then inp.dr = dr > 0 and 1 or -1 end
        end
      end
    end
    return inp
  end
  if ai.wait > 0 then ai.wait = ai.wait - 1 end
  if ai.wait <= 0 and ai.clock % ai.think == 0 then
    local r, c = think(b, ai)
    if r then ai.tr, ai.tc, ai.push0, ai.step_t = TOP + r - 1, c, b.rows_pushed, 0; ai.tr = TOP + r - 1
    else ai.wait = 8 end
  end
  -- hold the raise button when the stack is low
  local h = PL.height(b)
  if ai.raise and not ai.tr and PL.settled(b) and h < 6 and not b.puzzle then inp.raise = true end
  return inp
end
return PLAI
