-- tests.lua: self-tests and the puzzle generator. Run them with the built player:
--   GS_SELFTEST=1 SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy GS_MAX_FRAMES=2 GS_SAVE_DIR=/tmp/pp-test build/gs carts/panel-pop
--   GS_GENPUZ=1 ... build/gs carts/panel-pop > puzzles.txt    (prints PUZZLES for puzdata.lua; every layout is proved solvable with the real board)
local PL = require "lib.pl"
local PLAI = require "lib.plai"
local PG = require "lib.game"
local PUZZLES = require "lib.puzzles"
local art = require "lib.art"
local MUSIC_NAMES, SFX_NAMES = art.MUSIC_NAMES, art.SFX_NAMES
local data = require "lib.data"
local STAGE_COUNT, STAGE_DEF = data.STAGE_COUNT, data.STAGE_DEF
local T = {}
local floor, random = math.floor, math.random
local COLS, NR, TOP = PL.COLS, PL.NR, PL.TOP

local fails, passes = 0, 0
local function check(name, ok, info)
  if ok then passes = passes + 1 else fails = fails + 1; print("FAIL: " .. name .. (info and (" (" .. tostring(info) .. ")") or "")) end
end
local function run(b, frames, inp) for _ = 1, frames do PL.update(b, inp); b.ev = {} end end
local function settle(b, max)
  for i = 1, max or 3000 do PL.update(b, nil); b.ev = {}; if PL.settled(b) and i > 2 then return i end end
  return nil
end
local function cell_k(b, r, c) local x = b.g[r][c]; return x and not x.gb and x.k or 0 end
-- puzzle rows are bottom aligned, so row i of n is at NR - 1 - (n - i)
local function row_of(b, rows, i) return NR - 1 - (#rows - i) end

-- ---------------------------------------------------------------- the puzzle solver (a static copy
-- of the rules, then checked on the real board)
local PR, PC = 6, 6
local function pcopy(g) local o = {}; for r = 1, PR do o[r] = {}; for c = 1, PC do o[r][c] = g[r][c] end end; return o end
local function pgravity(g)
  for c = 1, PC do
    local w = PR
    for r = PR, 1, -1 do local v = g[r][c]; if v ~= 0 then if r ~= w then g[w][c] = v; g[r][c] = 0 end; w = w - 1 end end
  end
end
local function pclear(g)
  local hit = {}
  local n = 0
  for r = 1, PR do for c = 1, PC do
    local v = g[r][c]
    if v ~= 0 then
      if c + 2 <= PC and g[r][c + 1] == v and g[r][c + 2] == v then hit[r * 10 + c] = true; hit[r * 10 + c + 1] = true; hit[r * 10 + c + 2] = true end
      if r + 2 <= PR and g[r + 1][c] == v and g[r + 2][c] == v then hit[r * 10 + c] = true; hit[(r + 1) * 10 + c] = true; hit[(r + 2) * 10 + c] = true end
    end
  end end
  for key in pairs(hit) do g[key // 10][key % 10] = 0; n = n + 1 end
  return n
end
local function psettle(g) pgravity(g); while pclear(g) > 0 do pgravity(g) end end
local function pempty(g) for r = 1, PR do for c = 1, PC do if g[r][c] ~= 0 then return false end end end; return true end
local function pcount(g) local n = 0; for r = 1, PR do for c = 1, PC do if g[r][c] ~= 0 then n = n + 1 end end end; return n end
-- returns the list of swaps {r, c} that clears the board in at most k swaps, or nil
local function solve(g, k, path)
  if k == 0 then return nil end
  for r = PR, 1, -1 do
    local any = false
    for c = 1, PC do if g[r][c] ~= 0 then any = true end end
    if not any then break end
    for c = 1, PC - 1 do
      if g[r][c] ~= g[r][c + 1] then
        local h = pcopy(g)
        h[r][c], h[r][c + 1] = h[r][c + 1], h[r][c]
        psettle(h)
        path[#path + 1] = { r, c }
        if pempty(h) then return path end
        if k > 1 and pcount(h) >= 3 then local p = solve(h, k - 1, path); if p then return p end end
        path[#path] = nil
      end
    end
  end
  return nil
end

-- plays the swaps on the real board; true if every panel is gone at the end
local function live_check(rows, path)
  local b = PL.new({ puzzle = rows, colors = 6 })
  if not settle(b, 600) then return false end
  for _, m in ipairs(path) do
    local r, c = m[1], m[2]
    -- the static board has PR rows, bottom aligned like the puzzle: row r of PR is at NR - 1 - (PR
    -- - r)
    b.cur_r, b.cur_c = NR - 1 - (PR - r), c
    if not PL.swap(b) then return false end
    if not settle(b, 3000) then return false end
  end
  return PL.count_panels(b) == 0
end

-- npanels panels dropped into random columns, colours in threes so a clear is possible at all
local function random_layout(ncolors, extra, height)
  local g = {}
  for r = 1, PR do g[r] = {}; for c = 1, PC do g[r][c] = 0 end end
  local bag = {}
  for k = 1, ncolors do for _ = 1, 3 + (k <= extra and 3 or 0) do bag[#bag + 1] = k end end
  for i = #bag, 2, -1 do local j = random(1, i); bag[i], bag[j] = bag[j], bag[i] end
  for _, k in ipairs(bag) do
    local placed = false
    for _ = 1, 30 do
      local c = random(1, PC)
      local r = PR
      while r >= 1 and g[r][c] ~= 0 do r = r - 1 end
      if r >= PR - height + 1 then g[r][c] = k; placed = true; break end
    end
    if not placed then return nil end
  end
  return g
end
local function to_rows(g)
  local top = 1
  while top < PR do local any = false; for c = 1, PC do if g[top][c] ~= 0 then any = true end end; if any then break end; top = top + 1 end
  local rows = {}
  for r = top, PR do local s = ""; for c = 1, PC do s = s .. g[r][c] end; rows[#rows + 1] = s end
  return rows
end

-- tiers: { swaps, how many, colours, extra threes, height }
local function generate()
  math.randomseed(2024)
  local tiers = { { 1, 5, 2, 0, 3 }, { 2, 10, 2, 1, 4 }, { 2, 0, 3, 0, 3 }, { 3, 14, 3, 0, 4 }, { 4, 12, 3, 0, 4 } }
  local got, need = {}, {}
  for _, t in ipairs(tiers) do need[t[1]] = (need[t[1]] or 0) + t[2]; got[t[1]] = got[t[1]] or {} end
  local seen = {}
  local attempts, start = 0, gs.clock()
  while attempts < 300000 and gs.clock() - start < 240 do
    attempts = attempts + 1
    local t = tiers[random(1, #tiers)]
    if #got[t[1]] < need[t[1]] then
      local g = random_layout(t[3], t[4], t[5])
      if g then
        local np = pcount(g)
        local h = pcopy(g); psettle(h)
        if pcount(h) == np then -- nothing clears on its own
          local path
          for k = 1, t[1] do path = solve(g, k, {}); if path then break end end
          if path and #path == t[1] then
            local rows = to_rows(g)
            local key = table.concat(rows, "|")
            if not seen[key] and live_check(rows, path) then got[t[1]][#got[t[1]] + 1] = { moves = t[1], rows = rows }; seen[key] = true end
          end
        end
      end
    end
    local done = true
    for k, n in pairs(need) do if #got[k] < n then done = false end end
    if done then break end
  end
  print("-- generated in " .. attempts .. " attempts")
  print("PUZZLES = {")
  for k = 1, 4 do
    local list = got[k] or {}
    table.sort(list, function(a, b) local pa, pb = #table.concat(a.rows), #table.concat(b.rows); if pa ~= pb then return pa < pb end return a.rows[#a.rows] < b.rows[#b.rows] end)
    for _, p in ipairs(list) do
      local q = {}
      for _, r in ipairs(p.rows) do q[#q + 1] = '"' .. r .. '"' end
      print("  { moves = " .. p.moves .. ", rows = { " .. table.concat(q, ", ") .. " } },")
    end
  end
  print("}")
end

-- ---------------------------------------------------------------- the tests
local function t_swap_clears()
  local b = PL.new({ puzzle = { "110100" }, colors = 5 })
  settle(b, 600)
  check("puzzle starts with 3 panels", PL.count_panels(b) == 3)
  b.cur_r, b.cur_c = NR - 1, 3
  check("swap is allowed", PL.swap(b))
  settle(b, 600)
  check("swap clears the three in a row", PL.count_panels(b) == 0, PL.count_panels(b))
  check("score added", b.score >= 30, b.score)
end
local function t_gravity_chain()
  local rows = { "020000", "020000", "113100", "323300" }
  local b = PL.new({ puzzle = rows, colors = 5 })
  check("chain layout is stable", settle(b, 600) ~= nil and PL.count_panels(b) == 10, PL.count_panels(b))
  b.cur_r, b.cur_c = row_of(b, rows, 3), 3
  check("chain swap allowed", PL.swap(b))
  settle(b, 3000)
  check("a chain of 2 happened", b.best_chain == 2, b.best_chain)
  check("both matches cleared", b.cleared == 6, b.cleared)
  check("the 2s are gone", cell_k(b, NR - 1, 2) == 0 and cell_k(b, NR - 2, 2) == 0)
end
local function t_garbage()
  local b = PL.new({ puzzle = { "111000" }, colors = 5 })
  PL.place_garbage(b, 1, NR - 2, 3, 1, false)
  check("garbage placed", #b.garbs == 1)
  settle(b, 3000)
  check("garbage dissolved next to the match", #b.garbs == 0, #b.garbs)
  check("its panels dropped in", PL.count_panels(b) == 3, PL.count_panels(b))
  -- tall garbage shrinks a row at a time
  local c = PL.new({ puzzle = { "111000" }, colors = 5 })
  PL.place_garbage(c, 1, NR - 4, 3, 3, false)
  settle(c, 3000)
  check("a 3 high block loses one row", #c.garbs == 1 and c.garbs[1].h == 2, c.garbs[1] and c.garbs[1].h)
end
local function t_garbage_falls()
  local b = PL.new({ colors = 5, speed = 1 })
  PL.add_garbage(b, 6, 2, true)
  local frames = 0
  while #b.garbs == 0 and frames < 200 do PL.update(b, nil); frames = frames + 1 end
  check("pending garbage spawns", #b.garbs == 1)
  run(b, 400)
  local g = b.garbs[1]
  check("garbage landed on the stack", g and not g.fall)
  check("rows kept in order", g and g.y + g.h - 1 < NR)
end
local function t_rising()
  local b = PL.new({ colors = 5, speed = 20 })
  local before = b.rows_pushed
  run(b, 600)
  check("stack rises", b.rows_pushed > before, b.rows_pushed)
  local frames = 0
  while not b.lost and frames < 60000 do PL.update(b, nil); b.ev = {}; frames = frames + 1 end
  check("the stack eventually tops out", b.lost, frames)
  for r = 1, NR do for c = 1, COLS do
    local x = b.g[r][c]
    if x and not x.gb then check("no stray panel kinds", x.k >= 1 and x.k <= 5, x.k) end
  end end
end
local function t_no_initial_match()
  for i = 1, 40 do
    local b = PL.new({ colors = i % 2 == 0 and 5 or 6 })
    local list = 0
    for r = TOP, NR do for c = 1, COLS - 2 do
      local a, bb, cc = cell_k(b, r, c), cell_k(b, r, c + 1), cell_k(b, r, c + 2)
      if a > 0 and a == bb and bb == cc then list = list + 1 end
    end end
    for c = 1, COLS do for r = TOP, NR - 2 do
      local a, bb, cc = cell_k(b, r, c), cell_k(b, r + 1, c), cell_k(b, r + 2, c)
      if a > 0 and a == bb and bb == cc then list = list + 1 end
    end end
    check("new board " .. i .. " has no match", list == 0, list)
  end
end
local function t_vs_ai()
  math.randomseed(5)
  local a, b = PL.new({ colors = 5, speed = 3 }), PL.new({ colors = 5, speed = 3 })
  local ai1 = PLAI.new({ gap = 4, cool = 6, think = 10, err = 0.05, chains = true })
  local ai2 = PLAI.new({ gap = 6, cool = 10, think = 14, err = 0.2 })
  local frames = 0
  local worst, total = 0, 0
  while not a.lost and not b.lost and frames < 20000 do
    local t0 = gs.clock()
    local i1, i2 = PLAI.input(a, ai1), PLAI.input(b, ai2)
    local dt = gs.clock() - t0
    total = total + dt; worst = math.max(worst, dt)
    PL.update(a, i1); PL.update(b, i2)
    for _, bb in ipairs({ a, b }) do
      for _, e in ipairs(bb.ev) do
        local other = bb == a and b or a
        if e.t == "match" and e.n >= 4 then for _, w in ipairs(PL.combo_blocks(e.n)) do PL.add_garbage(other, w, 1) end end
        if e.t == "chain_end" then PL.add_garbage(other, 6, e.n - 1, true) end
      end
      bb.ev = {}
    end
    frames = frames + 1
  end
  check("the CPU scores", a.score > 200 and b.score > 100, a.score .. "/" .. b.score)
  check("a CPU game ends or runs long", frames > 600, frames)
  print(string.format("  CPU thinking time per frame (two players): average %.3f ms, worst %.2f ms", total / frames * 1000, worst * 1000))
  print(string.format("  vs test: %d frames, scores %d / %d, best chain %d / %d, lost %s / %s", frames, a.score, b.score, a.best_chain, b.best_chain, tostring(a.lost), tostring(b.lost)))
end
local function t_stages()
  for i = 1, STAGE_COUNT do
    local def = STAGE_DEF(i)
    check("stage " .. i .. " has rows", #def.rows >= 2)
    PG.start("stage", { diff = 2, stage = i })
    local g = PG.game()
    check("stage " .. i .. " has garbage", #g.ps[1].b.garbs >= 2, #g.ps[1].b.garbs)
    for _ = 1, 400 do PG.step() end
  end
end
local function t_puzzles()
  for i, p in ipairs(PUZZLES) do
    local g = {}
    for r = 1, PR do g[r] = {}; for c = 1, PC do g[r][c] = 0 end end
    for k, row in ipairs(p.rows) do for c = 1, PC do g[PR - #p.rows + k][c] = tonumber(row:sub(c, c)) end end
    local path = solve(g, p.moves, {})
    check("puzzle " .. i .. " is solvable in " .. p.moves, path ~= nil and live_check(p.rows, path))
  end
end

local function t_sounds()
  for _, n in ipairs(SFX_NAMES) do local ok, err = pcall(gs.sfx, n); check("sound effect " .. n .. " plays", ok, err) end
  for _, n in ipairs(MUSIC_NAMES) do local ok, err = pcall(gs.music, n); check("song " .. n .. " plays", ok, err) end
  gs.music_stop(0)
end

function T.selftest()
  if os.getenv("GS_GENPUZ") then generate(); gs.quit(); return end
  local tests = { t_sounds, t_swap_clears, t_gravity_chain, t_garbage, t_garbage_falls, t_rising, t_no_initial_match, t_vs_ai, t_puzzles, t_stages }
  for i, t in ipairs(tests) do
    local ok, err = pcall(t)
    if not ok then fails = fails + 1; print("ERROR in test " .. i .. ": " .. tostring(err)) end
  end
  print(string.format("PANEL POP TESTS: %d passed, %d failed", passes, fails))
  print(fails == 0 and "PANEL POP TEST PASS" or "PANEL POP TEST FAIL")
  gs.quit()
end

return T
