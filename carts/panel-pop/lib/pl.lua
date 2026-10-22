-- pl.lua: the Panel Pop board. Rules only (no drawing, no input devices): ui.lua feeds it button presses, plai.lua is a CPU player.
--
-- The grid is b.g[row][col], rows 1..NR top to bottom, 6 columns. Rows TOP..NR-1 are on screen, rows above are a hidden space where
-- garbage waits and falls in from, and the last row NR is the dim "incoming" row that scrolls up into view.
-- A cell is nil (empty), a panel { k = colour 1..6, st = state, tm = frames left, chain = bool } or garbage { gb = block }.
-- Panel states: idle, swap (4 frames), hover (waits before falling), fall, flash / face (being cleared), dim (the incoming row).
-- Things that happen are put in b.ev (a list) for the UI to turn into sounds and effects; the UI empties it every frame.
local PL = {}
local floor, max, min, random = math.floor, math.max, math.min, math.random

local COLS, VIS, HID = 6, 12, 16
local NR = HID + VIS + 1
local TOP = HID + 1
PL.COLS, PL.VIS, PL.HID, PL.NR, PL.TOP = COLS, VIS, HID, NR, TOP
local SWAP, HOVER, FALL, FLASH, FACE, POP, GFLASH = 4, 12, 3, 44, 15, 9, 59
PL.SWAP, PL.FALL, PL.FLASH, PL.FACE, PL.POP = SWAP, FALL, FLASH, FACE, POP
local PANIC_MAX = 170
PL.PANIC_MAX = PANIC_MAX

local function ev(b, t, a) a = a or {}; a.t = t; b.ev[#b.ev + 1] = a end

-- ---------------------------------------------------------------- scoring (numbers from the originals, roughly)
local COMBO_BONUS = { [4] = 20, [5] = 30, [6] = 50, [7] = 60, [8] = 70, [9] = 80, [10] = 100, [11] = 140, [12] = 170 }
local CHAIN_BONUS = { [2] = 50, [3] = 80, [4] = 150, [5] = 300, [6] = 400, [7] = 500, [8] = 700, [9] = 900, [10] = 1100, [11] = 1300, [12] = 1500 }
function PL.combo_bonus(n) return n < 4 and 0 or (COMBO_BONUS[n] or 170 + (n - 12) * 30) end
function PL.chain_bonus(n) return n < 2 and 0 or (CHAIN_BONUS[n] or 1500 + (n - 12) * 200) end

-- frames per row while the stack rises by itself, for speed level 1..99 (a row is 16 pixels)
function PL.frames_per_row(speed) return max(8, 400 * 0.93 ^ (speed - 1)) end

local function panel(k, st) return { k = k, st = st or "idle", tm = 0, chain = false, land = 0, dir = 0, fe = 0 } end

-- a colour for (r, c) that does not make three in a row with what is already around it
local function safe_color(b, r, c, ncol)
  local g = b.g
  local function at(rr, cc) local x = g[rr] and g[rr][cc]; return x and not x.gb and x.k or 0 end
  local bad = {}
  local l1, l2 = at(r, c - 1), at(r, c - 2)
  if l1 > 0 and l1 == l2 then bad[l1] = true end
  local r1, r2 = at(r, c + 1), at(r, c + 2)
  if r1 > 0 and r1 == r2 then bad[r1] = true end
  local a1, a2 = at(r - 1, c), at(r - 2, c)
  if a1 > 0 and a1 == a2 then bad[a1] = true end
  local d1, d2 = at(r + 1, c), at(r + 2, c)
  if d1 > 0 and d1 == d2 then bad[d1] = true end
  if l1 > 0 and l1 == r1 then bad[l1] = true end
  if a1 > 0 and a1 == d1 then bad[a1] = true end
  local ok = {}
  for k = 1, ncol do if not bad[k] then ok[#ok + 1] = k end end
  if #ok == 0 then return random(1, ncol) end
  return ok[random(1, #ok)]
end
PL.safe_color = safe_color

local function gen_incoming(b)
  b.g[NR] = {}
  for c = 1, COLS do b.g[NR][c] = panel(safe_color(b, NR, c, b.colors), "dim") end
end

-- o: colors (5 or 6), speed (level), rise (false = the stack never rises), height (starting rows), puzzle = { "......", ... } (a fixed layout)
function PL.new(o)
  local b = {
    g = {}, garbs = {}, pending = {}, ev = {}, t = 0, colors = o.colors or 5, speed = o.speed or 1, rise_on = o.rise ~= false,
    cur_r = TOP + 8, cur_c = 3, scroll = 0, stop = 0, chain = 0, panic = PANIC_MAX, score = 0, lost = false, moves = 0, rows_pushed = 0,
    spawn_wait = 0, nflash = 0, moving = false, anyflag = false, danger = false, cleared = 0, best_chain = 0, best_combo = 0, puzzle = o.puzzle ~= nil,
  }
  for r = 1, NR do b.g[r] = {} end
  if o.puzzle then
    local rows = o.puzzle
    for i = #rows, 1, -1 do
      local r = NR - 1 - (#rows - i)
      for c = 1, COLS do local ch = rows[i]:sub(c, c); local k = tonumber(ch); if k and k > 0 then b.g[r][c] = panel(k) end end
    end
    b.rise_on = false
    b.cur_r = NR - 1 - min(#rows, 5); b.cur_c = 3
    gen_incoming(b)
    return b
  end
  local h = o.height or 6
  for c = 1, COLS do
    local ch = max(2, min(VIS - 2, h - 2 + random(0, 2)))
    for k = 1, ch do local r = NR - k; b.g[r][c] = panel(safe_color(b, r, c, b.colors)) end
  end
  gen_incoming(b)
  b.cur_r = NR - 1 - 4
  return b
end

-- ---------------------------------------------------------------- garbage
-- a request for garbage: w wide, h high (metal = from a chain)
function PL.add_garbage(b, w, h, metal) b.pending[#b.pending + 1] = { w = w, h = min(h, 11), metal = metal } end
-- how a combo of n panels is sent: n-1 cells of garbage, in blocks of 3..6 wide
function PL.combo_blocks(n)
  local total, out = n - 1, {}
  if total <= 6 then out[1] = total
  else local pieces = (total + 5) // 6; local base, extra = total // pieces, total % pieces; for i = 1, pieces do out[i] = base + (i <= extra and 1 or 0) end end
  return out
end

local function spawn_garbage(b)
  if #b.pending == 0 or b.nflash > 0 or b.chain > 0 or b.spawn_wait > 0 or b.anyflag then return end
  local d = b.pending[1]
  local gx = d.w >= COLS and 1 or random(1, COLS - d.w + 1)
  local y0 = HID - d.h + 1
  for r = y0, HID do for c = gx, gx + d.w - 1 do if b.g[r][c] then return end end end
  local g = { x = gx, y = y0, w = d.w, h = d.h, metal = d.metal, st = "idle", tm = 0, fall = true }
  b.garbs[#b.garbs + 1] = g
  for r = y0, HID do for c = gx, gx + d.w - 1 do b.g[r][c] = { gb = g } end end
  table.remove(b.pending, 1)
  b.spawn_wait = 24
  ev(b, "spawn", { g = g })
end

-- a block put straight on the board (Stage Clear starts with some): x, y = top left cell, resting unless there is nothing under it
function PL.place_garbage(b, x, y, w, h, metal)
  local g = { x = x, y = y, w = w, h = h, metal = metal, st = "idle", tm = 0, fall = false }
  b.garbs[#b.garbs + 1] = g
  for r = y, y + h - 1 do for c = x, x + w - 1 do b.g[r][c] = { gb = g } end end
  return g
end

local function remove_garbage(b, g) for i, x in ipairs(b.garbs) do if x == g then table.remove(b.garbs, i); return end end end

local function dissolve(b, g)
  local br = g.y + g.h - 1
  for c = g.x, g.x + g.w - 1 do
    local p = panel(random(1, b.colors), "hover")
    p.k = safe_color(b, br, c, b.colors); p.tm = HOVER; p.chain = true
    b.g[br][c] = p
  end
  ev(b, "garb_break", { g = g, r = br })
  g.h = g.h - 1
  if g.h <= 0 then remove_garbage(b, g) else g.st = "idle"; g.tm = 0; g.fall = false end
end

local function garbage_update(b, g)
  if g.st == "flash" then g.tm = g.tm - 1; if g.tm <= 0 then dissolve(b, g) end; return end
  if g.tm > 0 then g.tm = g.tm - 1 end
  if g.tm > 0 then return end
  local br = g.y + g.h - 1
  local supported = br >= NR - 1
  if not supported then
    local below = b.g[br + 1]
    for c = g.x, g.x + g.w - 1 do if below[c] then supported = true; break end end
  end
  if supported then
    if g.fall then g.fall = false; ev(b, "garb_land", { g = g }) end
    return
  end
  for r = br, g.y, -1 do for c = g.x, g.x + g.w - 1 do b.g[r + 1][c] = b.g[r][c]; b.g[r][c] = nil end end
  g.y = g.y + 1; g.fall = true; g.tm = FALL
end

-- ---------------------------------------------------------------- the cursor and swapping
function PL.move(b, dr, dc)
  b.cur_r = max(TOP, min(NR - 1, b.cur_r + dr))
  b.cur_c = max(1, min(COLS - 1, b.cur_c + dc))
end
local function swappable(x) return x == nil or (not x.gb and x.st == "idle") end
function PL.can_swap(b, r, c)
  if r < TOP or r > NR - 1 then return false end
  local a, d = b.g[r][c], b.g[r][c + 1]
  if a == nil and d == nil then return false end
  return swappable(a) and swappable(d)
end
function PL.swap(b)
  local r, c = b.cur_r, b.cur_c
  if not PL.can_swap(b, r, c) then return false end
  local a, d = b.g[r][c], b.g[r][c + 1]
  b.g[r][c], b.g[r][c + 1] = d, a
  if d then d.st = "swap"; d.tm = SWAP; d.dir = -1 end
  if a then a.st = "swap"; a.tm = SWAP; a.dir = 1 end
  b.moves = b.moves + 1
  ev(b, "swap")
  return true
end

-- ---------------------------------------------------------------- matching
local function matchable(x) return x ~= nil and not x.gb and x.st == "idle" end

local function find_matches(b)
  local hit, list = {}, {}
  local g = b.g
  local function mark(r, c) local key = r * 8 + c; if not hit[key] then hit[key] = true; list[#list + 1] = { r = r, c = c } end end
  for r = 1, NR - 1 do
    local row = g[r]
    local c = 1
    while c <= COLS do
      local x = row[c]
      if matchable(x) then
        local e = c
        while e + 1 <= COLS and matchable(row[e + 1]) and row[e + 1].k == x.k do e = e + 1 end
        if e - c >= 2 then for cc = c, e do mark(r, cc) end end
        c = e + 1
      else c = c + 1 end
    end
  end
  for c = 1, COLS do
    local r = 1
    while r <= NR - 1 do
      local x = g[r][c]
      if matchable(x) then
        local e = r
        while e + 1 <= NR - 1 and matchable(g[e + 1][c]) and g[e + 1][c].k == x.k do e = e + 1 end
        if e - r >= 2 then for rr = r, e do mark(rr, c) end end
        r = e + 1
      else r = r + 1 end
    end
  end
  return list, hit
end

local function do_matches(b)
  local list, hit = find_matches(b)
  if #list == 0 then return end
  table.sort(list, function(p, q) if p.r ~= q.r then return p.r < q.r end return p.c < q.c end)
  local n = #list
  local has_chain = false
  for _, p in ipairs(list) do if b.g[p.r][p.c].chain then has_chain = true end end
  if has_chain then b.chain = b.chain + 1 elseif b.chain == 0 then b.chain = 1 end
  local sr, sc = 0, 0
  for i, p in ipairs(list) do
    local x = b.g[p.r][p.c]
    x.st = "flash"; x.chain = false; x.fe = FACE + (i - 1) * POP; x.tm = FLASH + x.fe; x.idx = i
    sr = sr + p.r; sc = sc + p.c
    for _, d in ipairs({ { -1, 0 }, { 1, 0 }, { 0, -1 }, { 0, 1 } }) do
      local nb = b.g[p.r + d[1]] and b.g[p.r + d[1]][p.c + d[2]]
      if nb and nb.gb and nb.gb.st ~= "flash" then nb.gb.st = "flash"; nb.gb.tm = GFLASH; nb.gb.fall = false end
    end
  end
  local gain = n * 10 + PL.combo_bonus(n) + PL.chain_bonus(b.chain)
  b.score = b.score + gain
  b.cleared = b.cleared + n
  b.best_combo = max(b.best_combo, n); b.best_chain = max(b.best_chain, b.chain)
  b.stop = max(b.stop, 30 + (n - 3) * 10 + (b.chain - 1) * 30)
  ev(b, "match", { n = n, chain = b.chain, r = sr / n, c = sc / n, gain = gain })
end

-- a panel is gone: the ones above it hang for a moment, then drop
local function pop_cell(b, r, c, x)
  b.g[r][c] = nil
  ev(b, "pop", { r = r, c = c, k = x.k, idx = x.idx })
  for rr = r - 1, 1, -1 do
    local y = b.g[rr][c]
    if y and not y.gb and y.st == "idle" then y.st = "hover"; y.tm = HOVER; y.chain = true
    elseif y and y.gb then break
    elseif y and y.st == "hover" then -- already waiting
    else break end
  end
end

-- ---------------------------------------------------------------- one frame
local function push_row(b)
  for r = 1, NR - 1 do b.g[r] = b.g[r + 1] end
  for _, g in ipairs(b.garbs) do g.y = g.y - 1 end
  b.cur_r = max(TOP, b.cur_r - 1)
  for c = 1, COLS do local x = b.g[NR - 1][c]; if x and x.st == "dim" then x.st = "idle" end end
  gen_incoming(b)
  b.rows_pushed = b.rows_pushed + 1
  ev(b, "push")
end

-- inp: { dr, dc, swap, raise } (presses; a held raise is a held button)
function PL.update(b, inp)
  b.t = b.t + 1
  if b.lost then return end
  inp = inp or {}
  if inp.dr or inp.dc then PL.move(b, inp.dr or 0, inp.dc or 0) end
  if inp.swap then PL.swap(b) end

  local nflash, moving, anyflag = 0, false, false
  for r = NR - 1, 1, -1 do
    local row = b.g[r]
    for c = 1, COLS do
      local x = row[c]
      if x then
        if x.gb then
          local g = x.gb
          if r == g.y + g.h - 1 and c == g.x then
            garbage_update(b, g)
            if g.st == "flash" then nflash = nflash + 1 end
            if g.fall then moving = true end
          end
        else
          local st = x.st
          if st == "swap" then
            moving = true
            x.tm = x.tm - 1
            if x.tm <= 0 then x.st = "idle"; x.dir = 0 end
          elseif st == "hover" then
            moving = true; anyflag = true
            x.tm = x.tm - 1
            if x.tm <= 0 then x.st = "fall"; x.tm = 0 end
          elseif st == "flash" or st == "face" then
            nflash = nflash + 1
            x.tm = x.tm - 1
            x.st = x.tm > x.fe and "flash" or "face"
            if x.tm <= 0 then pop_cell(b, r, c, x) end
          elseif st == "idle" then
            if x.land > 0 then x.land = x.land - 1 end
            if x.chain then anyflag = true end
            if r < NR and not b.g[r + 1][c] then x.st = "fall"; x.tm = 0; st = "fall" end
          end
          if x.st == "fall" then
            moving = true
            if x.chain then anyflag = true end
            if x.tm > 0 then x.tm = x.tm - 1 end
            if x.tm <= 0 then
              if r < NR and not b.g[r + 1][c] then b.g[r + 1][c] = x; row[c] = nil; x.tm = FALL
              else x.st = "idle"; x.land = 6; ev(b, "land", { r = r, c = c }) end
            end
          end
        end
      end
    end
  end
  b.nflash, b.moving, b.anyflag = nflash, moving, anyflag

  do_matches(b)
  -- chain flags are only kept while the panel is still on its way down
  anyflag = false
  for r = 1, NR - 1 do for c = 1, COLS do
    local x = b.g[r][c]
    if x and not x.gb then
      if x.chain and x.st == "idle" then x.chain = false end
      if x.chain then anyflag = true end
    end
  end end
  b.anyflag = anyflag
  if b.chain > 0 and not anyflag then
    local flashing = false
    for r = 1, NR - 1 do for c = 1, COLS do local x = b.g[r][c]; if x and ((not x.gb and (x.st == "flash" or x.st == "face")) or (x.gb and x.gb.st == "flash")) then flashing = true end end end
    if not flashing then
      if b.chain >= 2 then ev(b, "chain_end", { n = b.chain }) end
      b.chain = 0
    end
  end

  if b.spawn_wait > 0 then b.spawn_wait = b.spawn_wait - 1 end
  spawn_garbage(b)

  -- the stack rises; it waits while things are being cleared
  local top_busy = false
  for r = 1, TOP do for c = 1, COLS do if b.g[r][c] then top_busy = true end end end
  local resting_top = false
  for c = 1, COLS do
    local x = b.g[TOP][c]
    if x and ((x.gb and not x.gb.fall and x.gb.st ~= "flash") or (not x.gb and (x.st == "idle" or x.st == "swap"))) then resting_top = true end
  end
  if resting_top then
    if not b.moving and b.nflash == 0 then
      b.panic = b.panic - 1
      if b.panic % 30 == 0 then ev(b, "panic") end
      if b.panic <= 0 then b.lost = true; ev(b, "lost") end
    end
  else b.panic = min(PANIC_MAX, b.panic + 3) end
  b.danger = resting_top or b.panic < PANIC_MAX

  if b.rise_on and not b.lost then
    if b.nflash > 0 then
      -- paused
    elseif b.stop > 0 and not inp.raise then b.stop = b.stop - 1
    elseif not top_busy then
      b.stop = 0
      local v = inp.raise and 2.0 or 16 / PL.frames_per_row(b.speed)
      b.scroll = b.scroll + v
      if b.scroll >= 16 then b.scroll = inp.raise and 0 or b.scroll - 16; push_row(b) end
    end
  end
end

-- ---------------------------------------------------------------- questions about the board (for the CPU and the UI)
function PL.settled(b) return not b.moving and b.nflash == 0 and not b.anyflag and b.chain == 0 end
function PL.garbage_left(b) return #b.garbs + #b.pending end
-- number of panels (not garbage) on the board
function PL.count_panels(b)
  local n = 0
  for r = 1, NR - 1 do for c = 1, COLS do local x = b.g[r][c]; if x and not x.gb then n = n + 1 end end end
  return n
end
-- highest occupied row as a height 0..VIS
function PL.height(b)
  for r = TOP, NR - 1 do for c = 1, COLS do if b.g[r][c] then return NR - r end end end
  return 0
end
return PL
