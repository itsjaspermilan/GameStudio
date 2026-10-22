-- game.lua: playing one game of any mode (Endless, Time Attack, Vs CPU, Stage Clear, Puzzle, Virus
-- Buster, Capsule Vs). ui.lua has the menus around it.
-- PG.start(mode, opts) begins, PG.step() / PG.draw() run it every frame. PG.step returns "results"
-- or "quit" when the player leaves; PG.result says how it went.
local PP = require "lib.util"
local PL = require "lib.pl"
local PLAI = require "lib.plai"
local DM = require "lib.dm"
local DRAW = require "lib.draw"
local PUZZLES = require "lib.puzzles"
local DMAI = DM.AI
local SW, SH = PP.SW, PP.SH
local art = require "lib.art"
local BG_COUNT, CHAR_IDS = art.BG_COUNT, art.CHAR_IDS
local data = require "lib.data"
local DIFFS, DM_OPPONENTS, DM_SPEEDS, OPPONENTS, STAGE_COUNT, STAGE_DEF = data.DIFFS, data.DM_OPPONENTS, data.DM_SPEEDS, data.OPPONENTS, data.STAGE_COUNT, data.STAGE_DEF
local floor, max, min, random, sin, abs = math.floor, math.max, math.min, math.random, math.sin, math.abs
local spr, txt, txtc, txtr, txts, txtcx, box, window, bar, frame = PP.spr, PP.txt, PP.txtc, PP.txtr, PP.txts, PP.txtcx, PP.box, PP.window, PP.bar, PP.frame
local sfx, fmt_time, commas = PP.sfx, PP.fmt_time, PP.commas
local TOP, NR, COLS = PL.TOP, PL.NR, PL.COLS
local PG = {}
local G

local BOT = os.getenv("GS_BOT") ~= nil
local pressed, held = PP.pressed, PP.held
-- a held direction repeats: once on the press, then after a pause every few frames
local function rep(rs, name, first, every)
  if held(name) then
    rs[name] = (rs[name] or 0) + 1
    local t = rs[name]
    return t == 1 or (t > first and (t - first) % every == 0)
  end
  rs[name] = 0
  return false
end

local CHAR_FRAME = { idle = 0, happy = 2, dizzy = 3 }

-- ---------------------------------------------------------------- setting a game up
local function new_player(o) o.rs = {}; o.face, o.face_t, o.hud, o.hud_t, o.doc_t = "idle", 0, "", 0, 0; return o end

local function place_stage(b, def)
  local y = NR - 1 - 3 - 1 -- just above where the stack ends
  local cum = 0
  for _, row in ipairs(def.rows) do
    local hh = 1
    for _, p in ipairs(row) do hh = max(hh, p.h) end
    if cum + hh > 6 then hh = 1 end
    for _, p in ipairs(row) do
      local h = min(p.h, hh)
      PL.place_garbage(b, p.x, y - h + 1, p.w, h, p.metal)
    end
    y = y - hh; cum = cum + hh
  end
end

function PG.start(mode, o)
  o = o or {}
  PP.tick_game = 0
  G = { mode = mode, o = o, phase = "countdown", t = 190, tick = 0, ps = {}, paused = false, pcur = 1, shake = 0, secs = 0, result = nil, over_t = 0 }
  PG.result = nil
  local diff = DIFFS[o.diff or 2]
  G.diff = diff
  if mode == "endless" or mode == "time" then
    local b = PL.new({ colors = diff.colors, speed = o.speed or diff.speed })
    G.ps[1] = new_player({ b = b, human = true, x = 112, y = 24, char = 1, name = "PIP" })
    G.limit = mode == "time" and 120 * 60 or nil
    G.base_music = mode == "time" and "msc_time" or "msc_endless"
    PP.music(G.base_music)
    G.bg = mode == "time" and 7 or 2
  elseif mode == "vs" then
    local opp = OPPONENTS[o.opp]
    G.opp = opp
    local lvl = o.opp + diff.cpu * 3
    local sp = max(1, floor(opp.speed + diff.cpu * 6))
    local b1 = PL.new({ colors = diff.colors, speed = sp })
    local b2 = PL.new({ colors = diff.colors, speed = sp })
    local scale = 1 - diff.cpu * 0.6
    local ai = PLAI.new({ gap = max(2, floor(opp.gap * scale)), cool = max(2, floor(opp.cool * scale)), think = max(6, floor(opp.think * scale)), err = max(0.01, opp.err * scale), chains = opp.chains, raise = opp.raise })
    G.ps[1] = new_player({ b = b1, human = true, x = 16, y = 24, char = 1, name = "PIP", other = 2 })
    G.ps[2] = new_player({ b = b2, ai = ai, x = 208, y = 24, char = opp.char, name = opp.name, other = 1 })
    G.bg = opp.bg
    G.base_music = "msc_vs"
    PP.music("msc_vs")
  elseif mode == "stage" then
    local def = STAGE_DEF(o.stage)
    G.def = def
    local sp = max(1, def.speed + diff.cpu * 4)
    local b = PL.new({ colors = def.colors, speed = floor(sp), height = 3 })
    place_stage(b, def)
    G.ps[1] = new_player({ b = b, human = true, x = 112, y = 24, char = 1, name = "PIP" })
    G.bg = def.bg
    G.rain_t = 0
    G.base_music = "msc_stage"
    PP.music("msc_stage")
  elseif mode == "puzzle" then
    local P = PUZZLES[o.puzzle]
    G.puz = P
    local b = PL.new({ puzzle = P.rows, colors = 6 })
    G.ps[1] = new_player({ b = b, human = true, x = 112, y = 24, char = 1, name = "PIP" })
    G.bg = (o.puzzle - 1) // 6 % BG_COUNT + 1
    PP.music("msc_puzzle")
  elseif mode == "dm" then
    local d = DM.new({ level = o.level, speed = o.speed })
    G.ps[1] = new_player({ d = d, human = true, x = 112, y = 24, char = 1, name = "DOC", dm = true })
    G.bg = (o.level // 3) % BG_COUNT + 1
    PP.music(o.song == 2 and "msc_dm_b" or "msc_dm_a")
  elseif mode == "dmvs" then
    local opp = DM_OPPONENTS[o.opp]
    local d1 = DM.new({ level = o.level, speed = o.speed })
    local d2 = DM.new({ level = o.level, speed = o.speed })
    G.ps[1] = new_player({ d = d1, human = true, x = 16, y = 24, char = 1, name = "DOC", dm = true, other = 2 })
    G.ps[2] = new_player({ d = d2, ai = DMAI.new({ gap = opp.gap, err = opp.err, think = opp.think, look = opp.look }), x = 208, y = 24, char = 1 + o.opp, name = OPPONENTS[o.opp].name, dm = true, other = 1 })
    G.bg = OPPONENTS[o.opp].bg
    PP.music("msc_dm_vs")
  end
  if BOT then -- every player is a computer player
    for _, p in ipairs(G.ps) do
      p.human = false
      if p.dm then p.ai = p.ai or DMAI.new({ gap = 4, err = 0.05, think = 8, look = true })
      else p.ai = p.ai or PLAI.new({ gap = 4, cool = 6, think = 10, err = 0.05, chains = true, raise = true }) end
    end
  end
  PP.sfx("tick", 1)
end

function PG.active() return G ~= nil end
function PG.mode() return G and G.mode end

-- ---------------------------------------------------------------- input
local function human_pl(ps)
  local rs, inp = ps.rs, {}
  if rep(rs, "left", 12, 3) then inp.dc = -1 elseif rep(rs, "right", 12, 3) then inp.dc = 1 end
  if rep(rs, "up", 12, 3) then inp.dr = -1 elseif rep(rs, "down", 12, 3) then inp.dr = 1 end
  if pressed("a") or pressed("x") then inp.swap = true end
  inp.raise = held("b") or held("l") or held("r") or held("y")
  if inp.dc or inp.dr then PP.sfx("move", 2) end
  return inp
end
local function human_dm(ps)
  local rs, inp = ps.rs, {}
  if rep(rs, "left", 14, 5) then inp.dc = -1 elseif rep(rs, "right", 14, 5) then inp.dc = 1 end
  if pressed("a") or pressed("x") then inp.rot = 1 elseif pressed("b") or pressed("y") then inp.rot = -1 end
  inp.down = held("down")
  return inp
end

-- ---------------------------------------------------------------- reacting to what happened on a
-- board
local function face(ps, f, t) ps.face = f; ps.face_t = t end

local function send_garbage(from, to, w, h, metal)
  PL.add_garbage(to.b, w, h, metal)
  if from.human then sfx("send", 4) end
  face(from, "happy", 70)
end

local function pl_events(ps)
  local b = ps.b
  local other = ps.other and G.ps[ps.other]
  local mine = ps.human
  local sy = floor(b.scroll)
  for _, e in ipairs(b.ev) do
    local t = e.t
    if t == "match" then
      if mine or not other then
        if e.chain >= 2 then sfx("chain" .. min(e.chain, 5), 1) elseif e.n >= 4 then sfx("combo", 1) else sfx("clear", 1) end
      end
      local cx, cy = (e.c - 1) * 16 + 8, (e.r - TOP) * 16 - sy
      if e.chain >= 2 then DRAW.fx_text(b, cx, cy - 6, "CHAIN x" .. e.chain, 14, 70, 1); ps.hud, ps.hud_t = "CHAIN x" .. e.chain, 120; face(ps, "happy", 80) end
      if e.n >= 4 then DRAW.fx_text(b, cx, cy + 6, "COMBO " .. e.n, 22, 70, 1); ps.hud, ps.hud_t = "COMBO " .. e.n, 120; face(ps, "happy", 80) end
      DRAW.fx_text(b, cx, cy - 16, "+" .. e.gain, 3, 40, 1)
      if other and e.n >= 4 then for _, w in ipairs(PL.combo_blocks(e.n)) do send_garbage(ps, other, w, 1, false) end end
    elseif t == "chain_end" then
      if other and e.n >= 2 then send_garbage(ps, other, 6, e.n - 1, true) end
    elseif t == "pop" then
      DRAW.fx_sparks(b, (e.c - 1) * 16 + 8, (e.r - TOP) * 16 + 8 - sy, DRAW.PCOL[e.k], 4)
      if mine or not other then sfx("pop" .. min(e.idx or 1, 8), 1) end
    elseif t == "swap" then if mine then sfx("swap", 1) end
    elseif t == "land" then if mine then sfx("land", 5) end
    elseif t == "garb_land" then
      if mine then sfx("garb_land", 3); G.shake = 10 end
    elseif t == "garb_break" then if mine or not other then sfx("garb_break", 2) end
    elseif t == "panic" then if mine then sfx("panic", 10) end
    end
  end
  b.ev = {}
end

local function dm_events(ps)
  local d = ps.d
  local other = ps.other and G.ps[ps.other]
  local mine = ps.human
  for _, e in ipairs(d.ev) do
    local t = e.t
    if t == "move" then if mine then sfx("pill_move", 1) end
    elseif t == "rot" then if mine then sfx("pill_rot", 1) end
    elseif t == "land" then if mine then sfx("pill_land", 1) end
    elseif t == "spawn" then ps.doc_t = 22
    elseif t == "clear" then if mine or not other then sfx("pill_clear", 1) end
    elseif t == "gone" then
      if e.v > 0 then
        if mine or not other then sfx("virus_pop", 1) end
        face(ps, "happy", 60)
        DRAW.fx_text(d, 48, 90, "+" .. commas(d.score), 14, 50, 1)
      end
    elseif t == "attack" then
      if other then
        for i = 1, e.n do
          local cols = e.cols
          other.d.incoming[#other.d.incoming + 1] = { cols[random(1, #cols)], cols[random(1, #cols)] }
        end
        if mine then sfx("send", 3) end
        face(ps, "happy", 70)
      end
    elseif t == "garbage" then if mine then sfx("garb_land", 3); G.shake = 8 end
    end
  end
  d.ev = {}
end

-- ---------------------------------------------------------------- one frame of play
local function finish(win, extra)
  G.phase = "over"; G.over_t = 0
  G.result = extra or {}
  G.result.win = win
  G.result.mode = G.mode
  PP.stop_music(200)
  if G.mode == "vs" or G.mode == "dmvs" then if win then PP.music("msc_win") else PP.music("msc_lose") end
  elseif win then PP.music("msc_win") else PP.music("msc_lose") end
  if win then sfx("win", 1) else sfx("lose", 1) end
end

local function run_pl()
  G.secs = G.secs + 1
  local fast = false
  for i, ps in ipairs(G.ps) do
    local b = ps.b
    local inp
    if ps.human then inp = human_pl(ps) else inp = PLAI.input(b, ps.ai) end
    PL.update(b, inp)
    DRAW.fx_step(b)
    pl_events(ps)
    if ps.face_t > 0 then ps.face_t = ps.face_t - 1; if ps.face_t == 0 then ps.face = "idle" end end
    if ps.hud_t > 0 then ps.hud_t = ps.hud_t - 1 end
    -- the music speeds up when the player's stack is about to top out
    if ps.human and G.base_music then
      local want = (b.danger and b.panic < 100) and "msc_panic" or G.base_music
      if want ~= G.cur_music then G.cur_music = want; PP.music(want) end
    end
  end
  local mode = G.mode
  local p1 = G.ps[1]
  -- the stacks get faster as the game goes on
  if (mode == "endless" or mode == "time" or mode == "vs") and G.secs % (20 * 60) == 0 then
    for _, ps in ipairs(G.ps) do ps.b.speed = min(40, ps.b.speed + 1) end
    sfx("speedup", 1); G.speed_t = 90
  end
  if mode == "endless" then
    if p1.b.lost then
      local rec = PP.rec_best("endless", G.o.diff or 2, p1.b.score)
      finish(false, { score = p1.b.score, time = G.secs, record = rec, panels = p1.b.cleared, chain = p1.b.best_chain, combo = p1.b.best_combo })
    end
  elseif mode == "time" then
    if p1.b.lost or G.secs >= G.limit then
      local rec = PP.rec_best("time", G.o.diff or 2, p1.b.score)
      finish(true, { score = p1.b.score, time = G.secs, record = rec, panels = p1.b.cleared, chain = p1.b.best_chain, combo = p1.b.best_combo, timeup = not p1.b.lost })
    end
  elseif mode == "vs" then
    local a, b = G.ps[1].b, G.ps[2].b
    if a.lost or b.lost then
      local win = b.lost and not a.lost
      if win then face(G.ps[1], "happy", 9999); face(G.ps[2], "dizzy", 9999) else face(G.ps[1], "dizzy", 9999); face(G.ps[2], "happy", 9999) end
      local rec = false
      if win then
        local n = PP.rec_get("vsbeat", G.o.diff or 2)
        if G.o.opp > n then PP.rec_set("vsbeat", G.o.diff or 2, G.o.opp); rec = true end
      end
      finish(win, { score = a.score, time = G.secs, record = rec, opp = G.o.opp })
    end
  elseif mode == "stage" then
    local b = p1.b
    G.rain_t = G.rain_t + 1
    if G.def.rain > 0 and G.rain_t >= G.def.rain * 60 and #b.pending == 0 and PL.garbage_left(b) > 0 then
      G.rain_t = 0; PL.add_garbage(b, 3 + random(0, 2), 1, false)
    end
    if b.lost then finish(false, { score = b.score, time = G.secs, stage = G.o.stage })
    elseif PL.garbage_left(b) == 0 and PL.settled(b) then
      local rec = false
      if G.o.stage >= PP.save.stage and G.o.stage < STAGE_COUNT then PP.save.stage = G.o.stage + 1; PP.save_game(); rec = true end
      finish(true, { score = b.score, time = G.secs, stage = G.o.stage, record = rec })
    end
  elseif mode == "puzzle" then
    local b = p1.b
    if PL.settled(b) then
      if PL.count_panels(b) == 0 then
        sfx("solved", 1)
        local s = PP.save.puzzles
        local have = {}
        for v in (s .. ","):gmatch("([^,]*),") do if v ~= "" then have[tonumber(v)] = true end end
        local rec = not have[G.o.puzzle]
        have[G.o.puzzle] = true
        local list = {}
        for k in pairs(have) do list[#list + 1] = k end
        table.sort(list)
        PP.save.puzzles = table.concat(list, ","); PP.save_game()
        finish(true, { puzzle = G.o.puzzle, moves = b.moves, record = rec })
      elseif b.moves >= G.puz.moves then
        finish(false, { puzzle = G.o.puzzle, moves = b.moves })
      end
    end
  end
end

local function run_dm()
  G.secs = G.secs + 1
  for i, ps in ipairs(G.ps) do
    local d = ps.d
    local inp
    if ps.human then inp = human_dm(ps) else inp = DMAI.input(d, ps.ai) end
    DM.update(d, inp)
    DRAW.fx_step(d)
    dm_events(ps)
    if ps.face_t > 0 then ps.face_t = ps.face_t - 1; if ps.face_t == 0 then ps.face = "idle" end end
    if ps.doc_t > 0 then ps.doc_t = ps.doc_t - 1 end
  end
  if G.mode == "dm" then
    local d = G.ps[1].d
    if d.won or d.lost then
      local key = G.o.speed
      local rec = false
      if d.won then
        rec = PP.rec_best("dmscore", key, d.score)
        if G.o.level + 1 > PP.rec_get("dmlevel", key) then PP.rec_set("dmlevel", key, G.o.level + 1); rec = true end
      end
      finish(d.won, { score = d.score, time = G.secs, level = G.o.level, record = rec, viruses = d.vstart - d.vleft })
    end
  else
    local a, b = G.ps[1].d, G.ps[2].d
    if a.won or a.lost or b.won or b.lost then
      local win = (a.won or b.lost) and not a.lost
      if win then face(G.ps[1], "happy", 9999); face(G.ps[2], "dizzy", 9999) else face(G.ps[1], "dizzy", 9999); face(G.ps[2], "happy", 9999) end
      local rec = false
      if win and G.o.opp > PP.rec_get("vsdm", G.o.speed) then PP.rec_set("vsdm", G.o.speed, G.o.opp); rec = true end
      finish(win, { score = a.score, time = G.secs, record = rec, opp = G.o.opp })
    end
  end
end

local pause_items = { "RESUME", "RESTART", "QUIT" }
function PG.step()
  if not G then return nil end
  G.tick = G.tick + 1
  PP.tick_game = G.tick
  if G.shake > 0 then G.shake = G.shake - 1 end
  if G.paused then
    if pressed("up") then G.pcur = (G.pcur - 2) % #pause_items + 1; sfx("select", 1) end
    if pressed("down") then G.pcur = G.pcur % #pause_items + 1; sfx("select", 1) end
    if pressed("start") or pressed("b") then G.paused = false; sfx("back", 1) end
    if pressed("a") then
      sfx("ok", 1)
      if G.pcur == 1 then G.paused = false
      elseif G.pcur == 2 then local m, o = G.mode, G.o; PG.start(m, o)
      else PP.stop_music(200); PG.last = { mode = G.mode, o = G.o }; G = nil; return "quit" end
    end
    return nil
  end
  if G.phase == "countdown" then
    G.t = G.t - 1
    if G.t % 60 == 59 and G.t > 0 then sfx("tick", 1) end
    if G.t <= 0 then G.phase = "run"; sfx("go", 1) end
    for _, ps in ipairs(G.ps) do if ps.b then DRAW.fx_step(ps.b) end end
  elseif G.phase == "run" then
    if pressed("start") and not BOT then G.paused = true; G.pcur = 1; sfx("ok", 1); return nil end
    if (G.mode == "puzzle" or G.mode == "stage") and pressed("select") then local m, o = G.mode, G.o; PG.start(m, o); return nil end
    if G.mode == "dm" or G.mode == "dmvs" then run_dm() else run_pl() end
  elseif G.phase == "over" then
    G.over_t = G.over_t + 1
    for _, ps in ipairs(G.ps) do
      if ps.b then DRAW.fx_step(ps.b) end
      if ps.d then DRAW.fx_step(ps.d) end
      if ps.face_t > 0 then ps.face_t = ps.face_t - 1 end
    end
    if BOT and G.over_t > 30 and not G.printed then
      G.printed = true
      local r = G.result
      print(string.format("BOT RESULT mode=%s win=%s score=%s time=%.0fs opp=%s level=%s", G.mode, tostring(r.win), tostring(r.score), (r.time or G.secs) / 60, tostring(G.o.opp), tostring(G.o.level)))
      gs.quit()
    end
    if (G.over_t > 100 and (pressed("a") or pressed("start"))) then
      PG.result = G.result
      PP.stop_music(300)
      PG.last = { mode = G.mode, o = G.o }
      G = nil
      return "results"
    end
  end
  return nil
end

-- ---------------------------------------------------------------- drawing
local function portrait(ps, x, y, sc)
  if ps.dm and ps.human or (ps.dm and ps.char == 1) then
    local f = ps.face == "happy" and 3 or ps.face == "dizzy" and 4 or 0
    spr("spr_doc", f, x, y, sc)
    return
  end
  local id = CHAR_IDS[ps.char]
  local f = CHAR_FRAME[ps.face] or 0
  if f == 0 and (G.tick // 90) % 2 == 1 and G.tick % 90 < 6 then f = 1 end
  if (ps.b and ps.b.danger and ps.face == "idle") or (ps.d and ps.d.pill == nil and false) then f = 3 end
  local bob = (G.tick // 20) % 2
  spr("spr_char_" .. id, f, x, y - bob, sc)
end

local function side_box(x, y, w, h) window(x, y, w, h, 2, 0) end

local function draw_countdown()
  if G.phase ~= "countdown" then return end
  local n = G.t // 60
  local s = G.t > 60 and tostring(n) or (G.t > 0 and "1" or "GO!")
  if G.t <= 10 then s = "GO!" end
  local sc = 4
  txts(s, (SW - #s * 8 * sc) / 2, 96, 14, sc)
end

local function draw_over(banner, color, sub)
  local y = 86
  box(0, y - 8, SW, 52, 0, nil, 200)
  txts(banner, (SW - #banner * 16) / 2, y, color, 2)
  if sub then txtc(sub, y + 24, 3, 1) end
  if G.over_t > 100 and (G.over_t // 20) % 2 == 0 then txtc("PRESS A", y + 34, 2, 1) end
end

local function pl_hud_single()
  local ps = G.ps[1]
  local b = ps.b
  local m = G.mode
  side_box(6, 24, 98, 100)
  local y = 30
  local function row(label, value, col) txt(label, 12, y, 2); txtr(value, 98, y + 9, col or 3); y = y + 22 end
  if m == "endless" then
    row("SCORE", commas(b.score)); row("LEVEL", tostring(b.speed)); row("TIME", fmt_time(G.secs / 60)); row("BEST", commas(PP.rec_get("endless", G.o.diff or 2)), 14)
  elseif m == "time" then
    local left = max(0, (G.limit - G.secs) / 60)
    row("TIME LEFT", fmt_time(left), left < 15 and 6 or 3); row("SCORE", commas(b.score)); row("LEVEL", tostring(b.speed)); row("BEST", commas(PP.rec_get("time", G.o.diff or 2)), 14)
  elseif m == "stage" then
    row("STAGE", tostring(G.o.stage) .. "/" .. STAGE_COUNT); row("BLOCKS", tostring(#b.garbs + #b.pending), 18); row("SCORE", commas(b.score)); row("TIME", fmt_time(G.secs / 60))
  elseif m == "puzzle" then
    row("PUZZLE", tostring(G.o.puzzle)); row("MOVES", tostring(max(0, G.puz.moves - b.moves)), (G.puz.moves - b.moves) <= 1 and 6 or 14); row("TIME", fmt_time(G.secs / 60))
  end
  -- the character and the last big thing
  side_box(216, 24, 98, 100)
  portrait(ps, 265, 62, 2)
  if ps.hud_t > 0 then txtcx(ps.hud, 265, 100, 14); end
  side_box(216, 130, 98, 86)
  txtcx("A SWAP", 265, 138, 3)
  txtcx("B RAISE", 265, 150, 3)
  txtcx("START PAUSE", 265, 162, 2)
  if m == "puzzle" or m == "stage" then txtcx("SEL: RETRY", 265, 174, 2) end
  if b.rise_on then
    txt("SPEED", 222, 190, 2)
    bar(222, 200, 86, 8, b.speed, 40, 22, 1, 2)
  end
  if G.speed_t and G.speed_t > 0 then G.speed_t = G.speed_t - 1; txtcx("SPEED UP!", 160, 6, 14) end
  -- panic
  if b.panic < PL.PANIC_MAX then bar(6, 130, 98, 6, b.panic, PL.PANIC_MAX, 6, 4, 0) end
end

local function pl_hud_vs()
  local p1, p2 = G.ps[1], G.ps[2]
  -- centre column between the two boards
  box(114, 22, 92, 196, 0, nil, 150)
  portrait(p1, 160, 64, 2)
  txtcx(p1.name, 160, 92, 3)
  txtcx(commas(p1.b.score), 160, 104, 14)
  txts("VS", 160 - 8, 118, 14, 1)
  portrait(p2, 160, 170, 2)
  txtcx(p2.name, 160, 198, 3)
  txtcx(commas(p2.b.score), 160, 208, 14)
  for i, ps in ipairs({ p1, p2 }) do
    if ps.hud_t > 0 then txtcx(ps.hud, 160, i == 1 and 28 or 130, 22) end
  end
end

local function pl_draw_boards()
  local sx = G.shake > 0 and (G.shake % 2 == 0 and 1 or -1) or 0
  for _, ps in ipairs(G.ps) do
    local b = ps.b
    DRAW.pl_board(b, ps.x + (ps.human and sx or 0), ps.y, { tick = G.tick, hide_incoming = b.puzzle })
  end
end

local function dm_next(x, y, ps)
  local d = ps.d
  local np = d.nextp
  frame("spr_pills", (np[1] - 1) * 6 + 1, x, y, 1, false, 255, 12, 12)
  frame("spr_pills", (np[2] - 1) * 6 + 2, x + 12, y, 1, false, 255, 12, 12)
end

local function dm_magnifier(x, y, d, tick)
  window(x, y, 98, 90, 2, 0)
  txt("VIRUS", x + 8, y + 4, 2)
  local left = DM.virus_colors(d)
  local pos = { { 14, 20 }, { 52, 20 }, { 33, 50 } }
  for c = 1, 3 do
    local alive = left[c] > 0
    local f = (c - 1) * 4
    local fr = alive and ((tick // 20 + c) % 2) or 3
    if d.won then fr = 3 end
    if d.lost then fr = 2 end
    frame("spr_bigvirus", f + fr, x + pos[c][1], y + pos[c][2] - (alive and ((tick // 20 + c) % 2) * 2 or 0), 1, false, alive and 255 or 120)
  end
end

local function dm_hud_single()
  local ps = G.ps[1]
  local d = ps.d
  -- the doctor on the left
  side_box(6, 24, 98, 100)
  local f = (ps.doc_t > 12 and 1 or ps.doc_t > 0 and 2 or 0)
  if d.won then f = 3 elseif d.lost then f = 4 end
  spr("spr_doc", f, 55, 62, 2)
  txtcx("NEXT", 55, 104, 2)
  dm_next(43, 112, ps)
  side_box(6, 130, 98, 86)
  local y = 136
  local bx = 12
  local function row(label, value, col) txt(label, bx, y, 2); txtr(value, bx + 86, y + 9, col or 3); y = y + 20 end
  row("SCORE", commas(d.score)); row("TOP", commas(PP.rec_get("dmscore", G.o.speed)), 14); row("LEVEL", tostring(G.o.level))
  dm_magnifier(216, 24, d, G.tick)
  side_box(216, 120, 98, 96)
  y = 126; bx = 222
  row("VIRUS", tostring(d.vleft), 22); row("SPEED", DM_SPEEDS[G.o.speed]); txtcx("START PAUSE", 265, 192, 2)
  txtcx("A/B TURN", 265, 204, 2)
end

local function dm_hud_vs()
  local p1, p2 = G.ps[1], G.ps[2]
  box(114, 22, 92, 196, 0, nil, 150)
  local ys = { 54, 156 }
  for i, ps in ipairs({ p1, p2 }) do
    local y = ys[i]
    portrait(ps, 160, y, 2)
    txtcx(ps.name, 160, y + 28, 3)
    txtcx("VIRUS " .. ps.d.vleft, 160, y + 38, 22)
    dm_next(148, y + 50, ps)
    local inc = #ps.d.incoming
    if inc > 0 then txtcx("+" .. inc .. " PILLS", 160, y + 64, 6) end
  end
  txts("VS", 152, 120, 14, 1)
end

function PG.draw()
  if not G then return end
  PP.background(G.bg or 1, G.tick)
  local m = G.mode
  if m == "dm" or m == "dmvs" then
    local sx = G.shake > 0 and (G.shake % 2 == 0 and 1 or -1) or 0
    for _, ps in ipairs(G.ps) do DRAW.dm_bottle(ps.d, ps.x + (ps.human and sx or 0), ps.y, { tick = G.tick }) end
    if m == "dm" then dm_hud_single() else dm_hud_vs() end
  else
    pl_draw_boards()
    if m == "vs" then pl_hud_vs() else pl_hud_single() end
  end
  draw_countdown()
  if G.phase == "over" then
    local r = G.result
    local banner, color, sub = "GAME OVER", 6, nil
    if m == "time" then banner, color = "TIME UP!", 14
    elseif m == "vs" or m == "dmvs" then banner, color = r.win and "YOU WIN!" or "YOU LOSE", r.win and 14 or 6
    elseif m == "stage" then banner, color = r.win and "STAGE CLEAR!" or "GAME OVER", r.win and 18 or 6
    elseif m == "puzzle" then banner, color = r.win and "SOLVED!" or "OUT OF MOVES", r.win and 18 or 6
    elseif m == "dm" then banner, color = r.win and "ALL CLEAR!" or "BOTTLE FULL", r.win and 18 or 6 end
    draw_over(banner, color, sub)
  end
  if G.paused then
    box(0, 0, SW, SH, 0, nil, 170)
    window(100, 70, 120, 90, 2, 1)
    txtc("PAUSED", 78, 14, 2)
    for i, s in ipairs(pause_items) do
      local on = i == G.pcur
      txt((on and "> " or "  ") .. s, 120, 104 + (i - 1) * 16, on and 3 or 2)
    end
  end
end

-- used by the tests and by screenshots
function PG.game() return G end
return PG
