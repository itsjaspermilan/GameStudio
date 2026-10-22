-- game.lua: playing one game of any mode (Endless, Time Attack, Vs CPU, Stage Clear, Puzzle). The
-- play scene (scenes/play.lua) runs it: PG.start(mode, opts) begins, PG.step() every step returns
-- "results" or "quit" when the player leaves, PG.draw() draws the boards and PG.result says how it
-- went. What is around the boards (the windows, the words, the faces) is the scene's layout.
local ui = require "lib.ui"
local save = require "lib.save"
local PL = require "lib.pl"
local PLAI = require "lib.plai"
local BOARD = require "lib.board"
local PUZZLES = require "lib.puzzles"
local data = require "lib.data"
local DIFFS, OPPONENTS, STAGE_COUNT, STAGE_DEF = data.DIFFS, data.OPPONENTS, data.STAGE_COUNT, data.STAGE_DEF
local floor, max, min, random = math.floor, math.max, math.min, math.random
local sfx = ui.sfx
local TOP, NR = PL.TOP, PL.NR
local PG = {}
local G

local BOT = os.getenv("GS_BOT") ~= nil
local pressed, held = ui.pressed, ui.held
-- a held direction repeats: once on the press, then after a pause every few steps
local function rep(rs, name, first, every)
  if held(name) then
    rs[name] = (rs[name] or 0) + 1
    local t = rs[name]
    return t == 1 or (t > first and (t - first) % every == 0)
  end
  rs[name] = 0
  return false
end

-- ---------------------------------------------------------------- setting a game up
local function new_player(o) o.rs = {}; o.face, o.face_t, o.shout, o.shout_t = "idle", 0, "", 0; return o end

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

-- the sky behind each mode (a pattern of ts_sky, see lib/ui.lua)
local SKY = { endless = 1, time = 4, stage = 2, puzzle = 3 }
-- seconds between speed-ups: Endless is a long game, so it climbs slowly; a two-minute Time Attack
-- and a Vs match climb faster
local SPEEDUP = { endless = 45, time = 20, vs = 30 }

function PG.start(mode, o)
  o = o or {}
  G = { mode = mode, o = o, phase = "countdown", t = 190, tick = 0, ps = {}, paused = false, pcur = 1, shake = 0, secs = 0, result = nil, over_t = 0 }
  PG.result = nil
  local diff = DIFFS[o.diff or 2]
  G.diff = diff
  G.sky = SKY[mode] or 1
  G.speedup = SPEEDUP[mode] and SPEEDUP[mode] * 60
  if mode == "endless" or mode == "time" then
    local b = PL.new({ colors = diff.colors, speed = o.speed or diff.speed })
    G.ps[1] = new_player({ b = b, human = true, x = 112, y = 24, char = 1, name = "PIP" })
    G.limit = mode == "time" and 120 * 60 or nil
    G.base_music = mode == "time" and "msc_time" or "msc_endless"
  elseif mode == "vs" then
    local opp = OPPONENTS[o.opp]
    G.opp = opp
    local sp = max(1, floor(opp.speed + diff.cpu * 6))
    local b1 = PL.new({ colors = diff.colors, speed = sp })
    local b2 = PL.new({ colors = diff.colors, speed = sp })
    local scale = 1 - diff.cpu * 0.6
    local ai = PLAI.new({ gap = max(2, floor(opp.gap * scale)), cool = max(2, floor(opp.cool * scale)), think = max(6, floor(opp.think * scale)), err = max(0.01, opp.err * scale), chains = opp.chains, raise = opp.raise })
    G.ps[1] = new_player({ b = b1, human = true, x = 16, y = 24, char = 1, name = "PIP", other = 2 })
    G.ps[2] = new_player({ b = b2, ai = ai, x = 208, y = 24, char = opp.char, name = opp.name, other = 1 })
    G.sky = opp.sky
    G.base_music = "msc_vs"
  elseif mode == "stage" then
    local def = STAGE_DEF(o.stage)
    G.def = def
    local sp = max(1, def.speed + diff.cpu * 4)
    local b = PL.new({ colors = def.colors, speed = floor(sp), height = 3 })
    place_stage(b, def)
    G.ps[1] = new_player({ b = b, human = true, x = 112, y = 24, char = 1, name = "PIP" })
    G.sky = def.sky
    G.rain_t = 0
    G.base_music = "msc_stage"
  elseif mode == "puzzle" then
    local P = PUZZLES[o.puzzle]
    G.puz = P
    G.ps[1] = new_player({ b = PL.new({ puzzle = P.rows, colors = 6 }), human = true, x = 112, y = 24, char = 1, name = "PIP" })
    ui.music("msc_puzzle")
  end
  if G.base_music then ui.music(G.base_music) end
  if BOT then -- every player is a computer player
    for _, p in ipairs(G.ps) do
      p.human = false
      p.ai = p.ai or PLAI.new({ gap = 4, cool = 6, think = 10, err = 0.05, chains = true, raise = true })
    end
  end
  sfx("tick", 1)
end

function PG.mode() return G and G.mode end
-- seconds until the stacks speed up again (nil in modes that do not)
function PG.next_speedup() return G.speedup and (G.speedup - G.secs % G.speedup) // 60 end

-- ---------------------------------------------------------------- input
local function human(ps)
  local rs, inp = ps.rs, {}
  if rep(rs, "left", 12, 3) then inp.dc = -1 elseif rep(rs, "right", 12, 3) then inp.dc = 1 end
  if rep(rs, "up", 12, 3) then inp.dr = -1 elseif rep(rs, "down", 12, 3) then inp.dr = 1 end
  if pressed("a") or pressed("x") then inp.swap = true end
  inp.raise = held("b") or held("l") or held("r") or held("y")
  if inp.dc or inp.dr then sfx("move", 2) end
  return inp
end

-- ---------------------------------------------------------------- reacting to what happened on a
-- board
local function face(ps, f, t) ps.face = f; ps.face_t = t end
local function shout(ps, s) ps.shout, ps.shout_t = s, 120 end

local function send_garbage(from, to, w, h, metal)
  PL.add_garbage(to.b, w, h, metal)
  if from.human then sfx("send", 4) end
  face(from, "happy", 70)
end

local function events(ps)
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
      if e.chain >= 2 then BOARD.fx_text(b, cx, cy - 6, "CHAIN X" .. e.chain, ui.GOLD, 70); shout(ps, "CHAIN X" .. e.chain); face(ps, "happy", 80) end
      if e.n >= 4 then BOARD.fx_text(b, cx, cy + 6, "COMBO " .. e.n, ui.GOLD, 70); shout(ps, "COMBO " .. e.n); face(ps, "happy", 80) end
      BOARD.fx_text(b, cx, cy - 16, "+" .. e.gain, ui.WHITE, 40)
      if other and e.n >= 4 then for _, w in ipairs(PL.combo_blocks(e.n)) do send_garbage(ps, other, w, 1, false) end end
    elseif t == "chain_end" then
      if other and e.n >= 2 then send_garbage(ps, other, 6, e.n - 1, true) end
    elseif t == "pop" then
      BOARD.fx_sparks(b, (e.c - 1) * 16 + 8, (e.r - TOP) * 16 + 8 - sy, 3)
      if mine or not other then sfx("pop" .. min(e.idx or 1, 8), 1) end
    elseif t == "swap" then if mine then sfx("swap", 1) end
    elseif t == "land" then if mine then sfx("land", 5) end
    elseif t == "garb_land" then if mine then sfx("garb_land", 3); G.shake = 10 end
    elseif t == "garb_break" then if mine or not other then sfx("garb_break", 2) end
    elseif t == "panic" then if mine then sfx("panic", 10) end
    end
  end
  b.ev = {}
end

-- ---------------------------------------------------------------- one step of play
local function finish(win, extra)
  G.phase = "over"; G.over_t = 0
  G.result = extra or {}
  G.result.win = win
  G.result.mode = G.mode
  ui.stop_music(200)
  ui.music(win and "msc_win" or "msc_lose")
  sfx(win and "win" or "lose", 1)
end

local function run()
  G.secs = G.secs + 1
  for _, ps in ipairs(G.ps) do
    local b = ps.b
    PL.update(b, ps.human and human(ps) or PLAI.input(b, ps.ai))
    BOARD.fx_step(b)
    events(ps)
    if ps.face_t > 0 then ps.face_t = ps.face_t - 1; if ps.face_t == 0 then ps.face = "idle" end end
    if ps.shout_t > 0 then ps.shout_t = ps.shout_t - 1 end
    -- the music speeds up when the player's stack is about to top out
    if ps.human and G.base_music then
      local want = (b.danger and b.panic < 100) and "msc_panic" or G.base_music
      if want ~= G.cur_music then G.cur_music = want; ui.music(want) end
    end
  end
  local mode, o = G.mode, G.o
  local p1 = G.ps[1]
  -- the stacks get faster as the game goes on
  if G.speedup and G.secs % G.speedup == 0 then
    for _, ps in ipairs(G.ps) do ps.b.speed = min(40, ps.b.speed + 1) end
    sfx("speedup", 1); G.speed_t = 90
  end
  if G.speed_t and G.speed_t > 0 then G.speed_t = G.speed_t - 1 end
  local b = p1.b
  if mode == "endless" then
    if b.lost then
      local rec = save.best("endless", o.diff or 2, b.score)
      finish(false, { score = b.score, time = G.secs, record = rec, panels = b.cleared, chain = b.best_chain, combo = b.best_combo })
    end
  elseif mode == "time" then
    if b.lost or G.secs >= G.limit then
      local rec = save.best("time", o.diff or 2, b.score)
      finish(true, { score = b.score, time = G.secs, record = rec, panels = b.cleared, chain = b.best_chain, combo = b.best_combo, timeup = not b.lost })
    end
  elseif mode == "vs" then
    local a, c = b, G.ps[2].b
    if a.lost or c.lost then
      local win = c.lost and not a.lost
      face(G.ps[1], win and "happy" or "dizzy", 9999); face(G.ps[2], win and "dizzy" or "happy", 9999)
      local rec = false
      if win and o.opp > save.get("vsbeat", o.diff or 2) then save.set("vsbeat", o.diff or 2, o.opp); rec = true end
      finish(win, { score = a.score, time = G.secs, record = rec, opp = o.opp })
    end
  elseif mode == "stage" then
    G.rain_t = G.rain_t + 1
    if G.def.rain > 0 and G.rain_t >= G.def.rain * 60 and #b.pending == 0 and PL.garbage_left(b) > 0 then
      G.rain_t = 0; PL.add_garbage(b, 3 + random(0, 2), 1, false)
    end
    if b.lost then finish(false, { score = b.score, time = G.secs, stage = o.stage })
    elseif PL.garbage_left(b) == 0 and PL.settled(b) then
      local rec = false
      if o.stage >= save.data.stage and o.stage < STAGE_COUNT then save.data.stage = o.stage + 1; save.write(); rec = true end
      finish(true, { score = b.score, time = G.secs, stage = o.stage, record = rec })
    end
  elseif mode == "puzzle" then
    if PL.settled(b) then
      if PL.count_panels(b) == 0 then
        sfx("solved", 1)
        finish(true, { puzzle = o.puzzle, moves = b.moves, record = save.solve(o.puzzle) })
      elseif b.moves >= G.puz.moves then
        finish(false, { puzzle = o.puzzle, moves = b.moves })
      end
    end
  end
end

PG.PAUSE_ITEMS = { "RESUME", "RESTART", "QUIT" }
function PG.step()
  if not G then return nil end
  G.tick = G.tick + 1
  if G.shake > 0 then G.shake = G.shake - 1 end
  if G.paused then
    G.pcur = ui.move(G.pcur, #PG.PAUSE_ITEMS)
    if pressed("start") or pressed("b") then G.paused = false; sfx("back", 1) end
    if pressed("a") then
      sfx("ok", 1)
      if G.pcur == 1 then G.paused = false
      elseif G.pcur == 2 then PG.start(G.mode, G.o)
      else ui.stop_music(200); PG.last = { mode = G.mode, o = G.o }; G = nil; return "quit" end
    end
    return nil
  end
  if G.phase == "countdown" then
    G.t = G.t - 1
    if G.t % 60 == 59 and G.t > 0 then sfx("tick", 1) end
    if G.t <= 0 then G.phase = "run"; sfx("go", 1) end
    for _, ps in ipairs(G.ps) do BOARD.fx_step(ps.b) end
  elseif G.phase == "run" then
    if pressed("start") and not BOT then G.paused = true; G.pcur = 1; sfx("ok", 1); return nil end
    if (G.mode == "puzzle" or G.mode == "stage") and pressed("select") then PG.start(G.mode, G.o); return nil end
    run()
  elseif G.phase == "over" then
    G.over_t = G.over_t + 1
    for _, ps in ipairs(G.ps) do
      BOARD.fx_step(ps.b)
      if ps.face_t > 0 then ps.face_t = ps.face_t - 1 end
    end
    if BOT and G.over_t > 30 and not G.printed then
      G.printed = true
      local r = G.result
      print(string.format("BOT RESULT mode=%s win=%s score=%s time=%.0fs opp=%s", G.mode, tostring(r.win), tostring(r.score), (r.time or G.secs) / 60, tostring(G.o.opp)))
      gs.quit()
    end
    if G.over_t > 100 and ui.ok() then
      PG.result = G.result
      ui.stop_music(300)
      PG.last = { mode = G.mode, o = G.o }
      G = nil
      return "results"
    end
  end
  return nil
end

-- ---------------------------------------------------------------- drawing: the boards (the rest is
-- the play scene's layout)
local CHAR_FRAME = { idle = 0, happy = 2, dizzy = 3 }
-- the frame of a player's face: it blinks now and then and looks worried when the stack is high
function PG.face_frame(ps)
  local f = CHAR_FRAME[ps.face] or 0
  if f == 0 and (G.tick // 90) % 2 == 1 and G.tick % 90 < 6 then f = 1 end
  if ps.b.danger and ps.face == "idle" then f = 3 end
  return f
end

function PG.draw()
  if not G then return end
  local sx = G.shake > 0 and (G.shake % 2 == 0 and 1 or -1) or 0
  for _, ps in ipairs(G.ps) do
    BOARD.draw(ps.b, ps.x + (ps.human and sx or 0), ps.y, { tick = G.tick, hide_incoming = ps.b.puzzle })
  end
end

-- the big 3, 2, 1, GO! (nil once the game runs)
function PG.countdown()
  if G.phase ~= "countdown" then return nil end
  if G.t <= 10 then return "GO!" end
  return G.t > 60 and tostring(G.t // 60) or "1"
end

-- the words shown when it ends: the banner and the font it is written in
function PG.banner()
  local r, m = G.result, G.mode
  if m == "time" then return "TIME UP!", ui.GOLD end
  if m == "vs" then return r.win and "YOU WIN!" or "YOU LOSE", r.win and ui.GOLD or ui.WHITE end
  if m == "stage" then return r.win and "STAGE CLEAR!" or "GAME OVER", r.win and ui.GOLD or ui.WHITE end
  if m == "puzzle" then return r.win and "SOLVED!" or "OUT OF SWAPS", r.win and ui.GOLD or ui.WHITE end
  return "GAME OVER", ui.WHITE
end

-- used by the play scene, the tests and screenshots
function PG.game() return G end
return PG
