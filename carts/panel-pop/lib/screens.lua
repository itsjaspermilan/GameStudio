-- screens.lua: title, menus, setup screens, puzzle select, records, results and the ending. Each
-- screen is a scene (scenes/<name>.lua is
-- `return require("lib.screens").scene("<name>")`); they share the menu cursor and helpers kept
-- here. scenes/start.lua picks the first one.
-- With GS_BOT=1 the game plays itself (see the end of this file for the environment variables that
-- start a game directly).
local floor, sin, max, min = math.floor, math.sin, math.max, math.min
local PP = require "lib.util"
local PG = require "lib.game"
local DRAW = require "lib.draw"
local PUZZLES = require "lib.puzzles"
local tests = require "lib.tests"
local art = require "lib.art"
local CHAR_IDS, PANEL_STATES = art.CHAR_IDS, art.PANEL_STATES
local data = require "lib.data"
local DIFFS, DM_SPEEDS, OPPONENTS, STAGE_COUNT, STAGE_DEF = data.DIFFS, data.DM_SPEEDS, data.OPPONENTS, data.STAGE_COUNT, data.STAGE_DEF
local SW = PP.SW
local M = {}
local spr, txt, txtc, txtr, txts, txtcx, box, window, bar, frame = PP.spr, PP.txt, PP.txtc, PP.txtr, PP.txts, PP.txtcx, PP.box, PP.window, PP.bar, PP.frame
local sfx, fmt_time, commas = PP.sfx, PP.fmt_time, PP.commas

local BOT = os.getenv("GS_BOT") ~= nil
local FF = tonumber(os.getenv("GS_FF") or "1") or 1
local STATS = os.getenv("GS_STATS") ~= nil

local state, cur, tick = "title", 1, 0
local S = {}           -- the screens: S.name = { enter, step, draw }
local setup            -- the setup screen being shown: { title, rows, start, back }
local menu_bg = 1

local MENU_SCREENS = { main = true, pp = true, dm = true, setup = true, puzzles = true, records = true, howto = true }
-- leave for another screen; it starts at the next step (state changes now, so a fast-forward loop
-- over the game stops at once)
local function go(name, arg)
  state = name
  gs.goto_scene("scenes." .. name, nil, arg)
end
local function move(i, n)
  if PP.pressed("up") then sfx("select", 1); return (i - 2) % n + 1 end
  if PP.pressed("down") then sfx("select", 1); return i % n + 1 end
  return i
end
local function wrap(s, n)
  local lines, line = {}, ""
  for word in s:gmatch("%S+") do
    if #line + #word + (line == "" and 0 or 1) > n then lines[#lines + 1] = line; line = word else line = (line == "" and "" or line .. " ") .. word end
  end
  if line ~= "" then lines[#lines + 1] = line end
  return lines
end

-- a list of boxes down the left; items = { { label, desc } }
local function draw_list(items, x, y, w, rowh)
  for i, it in ipairs(items) do
    local on = i == cur
    local yy = y + (i - 1) * rowh
    box(x, yy, w, rowh - 4, on and 25 or 0, on and 26 or 1, 225)
    txt(it.label, x + 22, yy + (rowh - 4 - 8) / 2, on and 3 or 2)
    if on then spr("spr_ico_arrow", 0, x + 12, yy + (rowh - 4) / 2) end
    if it.right then txtr(it.right, x + w - 8, yy + (rowh - 4 - 8) / 2, 14) end
  end
end
local function footer(text)
  box(0, 226, SW, 14, 0, nil, 210)
  txt(text, 6, 230, 2)
end
local function header(title)
  box(0, 0, SW, 22, 0, nil, 210)
  box(0, 22, SW, 1, 22)
  txt(title, 8, 7, 14, 1)
end

-- ---------------------------------------------------------------- title
local logo_cols = { 6, 14, 18, 22, 26, 30, 6, 14, 18 }
S.title = {
  enter = function() PP.music("msc_title") end,
  step = function() if PP.pressed("a") or PP.pressed("start") then sfx("ok", 1); go("main") end end,
  draw = function()
    PP.background(1, tick)
    for i = 1, 9 do
      local fx = (i * 83 + tick * (0.4 + i % 3 * 0.15)) % 360 - 20
      local fy = (i * 47 + tick * (0.6 + i % 4 * 0.2)) % 280 - 20
      frame("spr_panels", ((i - 1) % 6) * PANEL_STATES, floor(fx), floor(fy), 1, false, 150)
    end
    local s, sc = "PANEL POP", 4
    local x0 = (SW - #s * 8 * sc) / 2
    for i = 1, #s do
      local ch = s:sub(i, i)
      local y = 36 + floor(sin(tick / 20 + i * 0.7) * 4)
      txt(ch, x0 + (i - 1) * 8 * sc + 3, y + 3, 0, sc)
      txt(ch, x0 + (i - 1) * 8 * sc, y, logo_cols[i], sc)
    end
    txtc("& DOC CAPSULE", 84, 3, 2)
    spr("spr_doc", 0, 70, 160, 2)
    spr("spr_bigvirus", 0, 250, 160, 2)
    spr("spr_char_pip", (tick // 40) % 2, 160, 150, 2)
    if (tick // 30) % 2 == 0 then txtc("PRESS START", 206, 3, 1) end
    txtc("SWAP . MATCH . POP", 226, 2, 1)
  end,
}

-- ---------------------------------------------------------------- main menus
local MAIN = {
  { label = "PANEL POP", desc = "Swap panels, make lines of 3, chain combos." },
  { label = "DOC CAPSULE", desc = "Drop capsules to wipe out the viruses." },
  { label = "HOW TO PLAY", desc = "New here? Start with this." },
  { label = "RECORDS", desc = "Your best scores." },
}
S.main = {
  step = function()
    cur = move(cur, #MAIN)
    if PP.pressed("b") then sfx("back", 1); go("title") end
    if PP.pressed("a") then
      sfx("ok", 1)
      if cur == 1 then go("pp") elseif cur == 2 then go("dm") elseif cur == 3 then go("howto") else go("records") end
    end
  end,
  draw = function()
    PP.background(1, tick)
    header("MAIN MENU")
    draw_list(MAIN, 14, 36, 170, 32)
    window(196, 40, 112, 100, 2, 0)
    if cur == 1 then
      for c = 0, 5 do frame("spr_panels", c * PANEL_STATES + ((tick // 16 + c) % 2) * 0, 207 + (c % 3) * 32, 56 + (c // 3) * 32, 2) end
    elseif cur == 2 then
      spr("spr_doc", (tick // 30) % 2, 232, 94, 2)
      frame("spr_pills", 1, 262, 88, 1, false, 255, 12, 12); frame("spr_pills", 8, 274, 88, 1, false, 255, 12, 12)
      spr("spr_bigvirus", (tick // 20) % 2, 272, 120, 1)
    elseif cur == 3 then
      spr("spr_char_pip", 2, 252, 92, 2)
      txtcx("?", 252, 54, 14, 2)
    else
      txtc("BEST OF", 54, 2, 1); txtcx("PIP & DOC", 252, 70, 14)
      spr("spr_ico_star", (tick // 20) % 2, 252, 112, 3)
    end
    local lines = wrap(MAIN[cur].desc, 36)
    for i, l in ipairs(lines) do txtc(l, 176 + (i - 1) * 10, 3, 1) end
    footer("A: SELECT   B: BACK")
  end,
}

local PPMENU = {
  { label = "ENDLESS", desc = "Keep the stack down as long as you can. It speeds up." },
  { label = "TIME ATTACK", desc = "Two minutes. Score as much as you can." },
  { label = "VS CPU", desc = "Beat eight rivals. Combos and chains send them garbage." },
  { label = "STAGE CLEAR", desc = "Break every garbage block to clear the stage." },
  { label = "PUZZLE", desc = "Clear the whole board in a set number of swaps." },
}
S.pp = {
  step = function()
    cur = move(cur, #PPMENU)
    if PP.pressed("b") then sfx("back", 1); go("main") end
    if PP.pressed("a") then
      sfx("ok", 1)
      if cur == 1 or cur == 2 then PP.open_setup("pl" .. cur)
      elseif cur == 3 then PP.open_setup("vs")
      elseif cur == 4 then PP.open_setup("stage")
      else go("puzzles") end
    end
  end,
  draw = function()
    PP.background(2, tick)
    header("PANEL POP")
    draw_list(PPMENU, 14, 34, 180, 30)
    window(204, 40, 104, 110, 2, 0)
    local k = cur
    if k == 1 or k == 2 then
      for c = 1, 6 do frame("spr_panels", (c - 1) * PANEL_STATES, 212 + ((c - 1) % 3) * 30, 52 + ((c - 1) // 3) * 30, 1) end
    elseif k == 3 then spr("spr_char_bloop", (tick // 40) % 2, 232, 80, 1); spr("spr_char_shade", (tick // 40) % 2, 282, 120, 1)
    elseif k == 4 then for c = 0, 2 do frame("spr_garbage", 9 + c, 220 + c * 16, 72) end for c = 0, 2 do frame("spr_garbage", 9 + c, 252 + c * 16, 72) end frame("spr_panels", 0, 232, 100)
    else frame("spr_panels", 0, 244, 92); frame("spr_panels", PANEL_STATES, 228, 108); frame("spr_panels", PANEL_STATES * 2, 260, 108) end
    for i, l in ipairs(wrap(PPMENU[cur].desc, 36)) do txtc(l, 194 + (i - 1) * 10, 3, 1) end
    footer("A: SELECT   B: BACK")
  end,
}

local DMMENU = {
  { label = "VIRUS BUSTER", desc = "Clear every virus. Line up 4 of one colour." },
  { label = "VS CPU", desc = "Race a rival. Clear several lines at once to drop pills on them." },
}
S.dm = {
  step = function()
    cur = move(cur, #DMMENU)
    if PP.pressed("b") then sfx("back", 1); go("main") end
    if PP.pressed("a") then sfx("ok", 1); PP.open_setup(cur == 1 and "dm" or "dmvs") end
  end,
  draw = function()
    PP.background(4, tick)
    header("DOC CAPSULE")
    draw_list(DMMENU, 14, 36, 180, 34)
    window(204, 40, 104, 120, 2, 0)
    spr("spr_doc", (tick // 30) % 2, 256, 92, 2)
    for c = 1, 3 do frame("spr_viruses", (c - 1) * 3 + (tick // 20 + c) % 2, 222 + (c - 1) * 22, 130, 1, false, 255, 12, 12) end
    for i, l in ipairs(wrap(DMMENU[cur].desc, 36)) do txtc(l, 176 + (i - 1) * 10, 3, 1) end
    footer("A: SELECT   B: BACK")
  end,
}

-- ---------------------------------------------------------------- setup screens: a few rows to
-- change with left / right, then START
local function range_labels(a, b) local t = {}; for i = a, b do t[#t + 1] = tostring(i) end; return t end
local function diff_labels() local t = {}; for i, d in ipairs(DIFFS) do t[i] = d.name end; return t end

-- kinds: pl1 (endless), pl2 (time attack), vs, stage, dm, dmvs
function PP.open_setup(kind)
  local s = { kind = kind, rows = {} }
  local sv = PP.save
  if kind == "pl1" or kind == "pl2" then
    s.title = kind == "pl1" and "ENDLESS" or "TIME ATTACK"
    s.rows = { { name = "DIFFICULTY", labels = diff_labels(), i = 2 }, { name = "START LEVEL", labels = range_labels(1, 10), i = 4 } }
    s.bg = kind == "pl1" and 2 or 7
  elseif kind == "vs" then
    s.title = "VS CPU"
    s.rows = { { name = "DIFFICULTY", labels = diff_labels(), i = 2 }, { name = "OPPONENT", labels = {}, i = 1 } }
    s.bg = 3
  elseif kind == "stage" then
    s.title = "STAGE CLEAR"
    s.rows = { { name = "DIFFICULTY", labels = diff_labels(), i = 2 }, { name = "STAGE", labels = {}, i = sv.stage } }
    s.bg = 5
  elseif kind == "dm" then
    s.title = "VIRUS BUSTER"
    s.rows = { { name = "VIRUS LEVEL", labels = range_labels(0, 20), i = 4 }, { name = "SPEED", labels = DM_SPEEDS, i = 2 }, { name = "MUSIC", labels = { "FEVER", "CHILL" }, i = 1 } }
    s.bg = 4
  elseif kind == "dmvs" then
    s.title = "CAPSULE VS CPU"
    s.rows = { { name = "VIRUS LEVEL", labels = range_labels(0, 20), i = 4 }, { name = "SPEED", labels = DM_SPEEDS, i = 2 }, { name = "OPPONENT", labels = {}, i = 1 } }
    s.bg = 6
  end
  setup = s
  go("setup")
end

local function setup_refresh()
  local s = setup
  local sv = PP.save
  if s.kind == "vs" then
    local diff = s.rows[1].i
    local n = min(#OPPONENTS, PP.rec_get("vsbeat", diff) + 1)
    local l = {}
    for i = 1, n do l[i] = i .. " " .. OPPONENTS[i].name end
    s.rows[2].labels = l
    s.rows[2].i = min(s.rows[2].i, n)
  elseif s.kind == "stage" then
    local l = {}
    for i = 1, sv.stage do l[i] = tostring(i) end
    s.rows[2].labels = l
    s.rows[2].i = min(s.rows[2].i, sv.stage)
  elseif s.kind == "dmvs" then
    local speed = s.rows[2].i
    local n = min(8, PP.rec_get("vsdm", speed) + 1)
    local l = {}
    for i = 1, n do l[i] = i .. " " .. OPPONENTS[i].name end
    s.rows[3].labels = l
    s.rows[3].i = min(s.rows[3].i, n)
  end
end

local function setup_start()
  local s, r = setup, setup.rows
  local k = s.kind
  PP.stop_music(100)
  if k == "pl1" then PG.start("endless", { diff = r[1].i, speed = r[2].i })
  elseif k == "pl2" then PG.start("time", { diff = r[1].i, speed = r[2].i })
  elseif k == "vs" then PG.start("vs", { diff = r[1].i, opp = r[2].i })
  elseif k == "stage" then PG.start("stage", { diff = r[1].i, stage = r[2].i })
  elseif k == "dm" then PG.start("dm", { level = r[1].i - 1, speed = r[2].i, song = r[3].i })
  elseif k == "dmvs" then PG.start("dmvs", { level = r[1].i - 1, speed = r[2].i, opp = r[3].i }) end
  go("play")
end

S.setup = {
  enter = function() setup_refresh() end,
  step = function()
    local s = setup
    local n = #s.rows + 1
    cur = move(cur, n)
    if cur <= #s.rows then
      local row = s.rows[cur]
      if PP.pressed("left") then row.i = (row.i - 2) % #row.labels + 1; sfx("select", 1); setup_refresh() end
      if PP.pressed("right") then row.i = row.i % #row.labels + 1; sfx("select", 1); setup_refresh() end
      if PP.pressed("a") then cur = n; sfx("select", 1) end
    elseif PP.pressed("a") then sfx("ok", 1); setup_start() end
    if PP.pressed("b") then
      sfx("back", 1)
      local k = setup.kind
      go((k == "dm" or k == "dmvs") and "dm" or "pp")
    end
  end,
  draw = function()
    local s = setup
    PP.background(s.bg or 1, tick)
    header(s.title)
    window(40, 40, 240, 40 + #s.rows * 26, 2, 0)
    for i, row in ipairs(s.rows) do
      local y = 54 + (i - 1) * 26
      local on = i == cur
      txt(row.name, 54, y + 4, on and 3 or 2)
      local v = row.labels[row.i] or "?"
      if on then txt("<", 168, y + 4, 14); txt(">", 266, y + 4, 14) end
      txtcx(v, 218, y + 4, on and 14 or 3)
    end
    local sy = 54 + #s.rows * 26
    local on = cur == #s.rows + 1
    box(80, sy + 4, 160, 20, on and 25 or 1, on and 26 or 2)
    txtcx("START", 160, sy + 10, on and 3 or 2)
    -- extra information for the row chosen
    local k = s.kind
    if k == "vs" or k == "dmvs" then
      local oi = tonumber(s.rows[#s.rows].labels[s.rows[#s.rows].i]:match("^%d+")) or 1
      local o = OPPONENTS[oi]
      spr("spr_char_" .. CHAR_IDS[o.char], (tick // 40) % 2, 160, 176, 2)
      txtc(o.name, 204, 14, 1)
      txtc('"' .. o.hi .. '"', 214, 2, 1)
    elseif k == "pl1" or k == "pl2" then
      local d = DIFFS[s.rows[1].i]
      txtc(d.colors .. " KINDS OF PANEL", 176, 3, 1)
      txtc("BEST " .. commas(PP.rec_get(k == "pl1" and "endless" or "time", s.rows[1].i)), 192, 14, 1)
    elseif k == "stage" then
      local def = STAGE_DEF(s.rows[2].i)
      txtc("BREAK ALL " .. #def.rows .. "+ ROWS OF GARBAGE", 176, 3, 1)
    elseif k == "dm" then
      txtc("VIRUSES " .. min(84, 4 * (s.rows[1].i)), 176, 3, 1)
      txtc("BEST " .. commas(PP.rec_get("dmscore", s.rows[2].i)), 192, 14, 1)
    end
    footer("UP/DOWN PICK   </> CHANGE   A START")
  end,
}

-- ---------------------------------------------------------------- puzzle select
local solved = {}
local function load_solved()
  solved = {}
  for v in (PP.save.puzzles .. ","):gmatch("([^,]*),") do if v ~= "" then solved[tonumber(v)] = true end end
end
S.puzzles = {
  enter = function() load_solved() end,
  step = function()
    local n = #PUZZLES
    if PP.pressed("left") then cur = (cur - 2) % n + 1; sfx("select", 1) end
    if PP.pressed("right") then cur = cur % n + 1; sfx("select", 1) end
    if PP.pressed("up") then cur = cur - 5 >= 1 and cur - 5 or cur; sfx("select", 1) end
    if PP.pressed("down") then cur = cur + 5 <= n and cur + 5 or cur; sfx("select", 1) end
    if PP.pressed("b") then sfx("back", 1); go("pp") end
    if PP.pressed("a") then sfx("ok", 1); PP.stop_music(100); PG.start("puzzle", { puzzle = cur }); go("play") end
  end,
  draw = function()
    PP.background(6, tick)
    header("PUZZLE")
    local n = #PUZZLES
    local done = 0; for i = 1, n do if solved[i] then done = done + 1 end end
    txtr(done .. "/" .. n .. " SOLVED", SW - 8, 7, 18)
    local first = max(0, ((cur - 1) // 5) - 4)
    for i = first * 5 + 1, min(n, first * 5 + 25) do
      local x, y = 10 + ((i - 1) % 5) * 46, 32 + ((i - 1) // 5 - first) * 38
      local on = i == cur
      box(x, y, 42, 34, on and 25 or 0, on and 26 or 1, 230)
      txtcx(tostring(i), x + 21, y + 5, on and 3 or 2)
      if solved[i] then spr("spr_ico_star", (tick // 20) % 2, x + 21, y + 24)
      else
        local n = PUZZLES[i].moves
        for k = 1, n do box(x + 21 - n * 5 + (k - 1) * 10 + 1, y + 21, 8, 6, 22) end -- one pip per swap
      end
    end
    local P = PUZZLES[cur]
    if P then
      window(246, 32, 64, 120, 2, 0)
      txtcx("LAYOUT", 278, 36, 2)
      local top = 56
      for r = 1, #P.rows do for c = 1, 6 do
        local k = tonumber(P.rows[r]:sub(c, c)) or 0
        if k > 0 then box(250 + (c - 1) * 9, top + (r - 1) * 9, 8, 8, DRAW.PCOL[k], 0) end
      end end
      txtcx(P.moves .. " SWAP" .. (P.moves > 1 and "S" or ""), 278, 138, 14)
    end
    footer("A: PLAY   B: BACK   PIPS = SWAPS")
  end,
}

-- ---------------------------------------------------------------- how to play: three short pages
local HOWTO = {
  { title = "PANEL POP", lines = { "Move the cursor with the D-pad.", "A swaps the two panels under it.", "Line up 3 or more of a kind, across or down, and they pop.", "The stack keeps rising. Do not let it reach the top!", "Hold B to make it rise faster." } },
  { title = "CHAINS AND GARBAGE", lines = { "When panels fall and match again that is a CHAIN.", "Pop 4 or more at once for a COMBO.", "In Vs, combos and chains send gray garbage blocks to your rival.", "Pop panels next to a garbage block to break it open." } },
  { title = "DOC CAPSULE", lines = { "Capsules fall into the bottle. Left and right move, A and B turn, down drops.", "Line up 4 of one colour, across or down, to pop them. Viruses too!", "Pop every virus to win.", "In Vs, clearing several lines at once drops pills on your rival." } },
}
local howto_page = 1
S.howto = {
  enter = function() howto_page = 1 end,
  step = function()
    if PP.pressed("left") then howto_page = (howto_page - 2) % #HOWTO + 1; sfx("select", 1) end
    if PP.pressed("right") or PP.pressed("a") then howto_page = howto_page % #HOWTO + 1; sfx("select", 1) end
    if PP.pressed("b") then sfx("back", 1); go("main") end
  end,
  draw = function()
    PP.background(3, tick)
    local h = HOWTO[howto_page]
    header("HOW TO PLAY  " .. howto_page .. "/" .. #HOWTO)
    window(14, 34, 292, 170, 2, 0)
    txtc(h.title, 42, 14, 2)
    local y = 66
    for _, line in ipairs(h.lines) do
      for _, l in ipairs(wrap(line, 34)) do txt(l, 28, y, 3); y = y + 10 end
      y = y + 6
    end
    -- a small picture for each page
    if howto_page == 1 then
      -- swap the star and the last heart: three hearts in a row
      frame("spr_panels", 0, 50, 172); frame("spr_panels", 0, 68, 172); frame("spr_panels", PANEL_STATES, 86, 172); frame("spr_panels", 0, 104, 172)
      local cc = (tick // 12) % 2 == 0 and 3 or 14
      box(83, 169, 40, 2, cc); box(83, 190, 40, 2, cc); box(83, 169, 2, 23, cc); box(121, 169, 2, 23, cc)
      txt("A", 134, 177, 14); txt(">", 144, 177, 3)
      local f = (tick // 6) % 2 == 0 and 2 or 0
      for c = 0, 2 do frame("spr_panels", f, 164 + c * 18, 172) end
      frame("spr_panels", PANEL_STATES, 218, 172)
    elseif howto_page == 2 then
      for c = 0, 2 do frame("spr_garbage", 9 + c, 108 + c * 16, 178) end
      for c = 0, 2 do frame("spr_garbage", 14 + 9 + c, 170 + c * 16, 178) end
      txtc("x2  x3  x4", 192, 22, 1)
    else
      frame("spr_pills", 1, 130, 180, 1, false, 255, 12, 12); frame("spr_pills", 2, 142, 180, 1, false, 255, 12, 12)
      frame("spr_viruses", (tick // 24) % 2, 170, 180, 1, false, 255, 12, 12)
    end
    footer("</> PAGE   B BACK")
  end,
}

-- ---------------------------------------------------------------- records
S.records = {
  step = function() if PP.pressed("b") or PP.pressed("a") then sfx("back", 1); go("main") end end,
  draw = function()
    PP.background(1, tick)
    header("RECORDS")
    local y = 30
    local function line(label, a, b, c) txt(label, 16, y, 2); txtr(a, 190, y, 3); txtr(b, 250, y, 3); txtr(c, 310, y, 3); y = y + 12 end
    txt("PANEL POP", 16, y, 14); txtr("EASY", 190, y, 18); txtr("NORMAL", 250, y, 14); txtr("HARD", 310, y, 6); y = y + 14
    local function trip(key) return commas(PP.rec_get(key, 1)), commas(PP.rec_get(key, 2)), commas(PP.rec_get(key, 3)) end
    line("ENDLESS", trip("endless")); line("TIME ATTACK", trip("time"))
    line("VS RIVALS BEATEN", PP.rec_get("vsbeat", 1) .. "/8", PP.rec_get("vsbeat", 2) .. "/8", PP.rec_get("vsbeat", 3) .. "/8")
    line("STAGE REACHED", "", tostring(PP.save.stage) .. "/" .. STAGE_COUNT, "")
    load_solved(); local n = 0; for _ in pairs(solved) do n = n + 1 end
    line("PUZZLES SOLVED", "", n .. "/" .. #PUZZLES, "")
    y = y + 10
    txt("DOC CAPSULE", 16, y, 14); txtr("LOW", 190, y, 18); txtr("MED", 250, y, 14); txtr("HI", 310, y, 6); y = y + 14
    line("BEST SCORE", trip("dmscore")); line("LEVELS CLEARED", PP.rec_get("dmlevel", 1) .. "/21", PP.rec_get("dmlevel", 2) .. "/21", PP.rec_get("dmlevel", 3) .. "/21")
    line("VS RIVALS BEATEN", PP.rec_get("vsdm", 1) .. "/8", PP.rec_get("vsdm", 2) .. "/8", PP.rec_get("vsdm", 3) .. "/8")
    footer("B: BACK")
  end,
}

-- ---------------------------------------------------------------- play (game.lua does the work)
S.play = {
  step = function()
    local r = PG.step()
    if r == "results" then go("results") elseif r == "quit" then go(PG.last.mode:sub(1, 2) == "dm" and "dm" or "pp") end
  end,
  draw = function() PG.draw() end,
}

-- ---------------------------------------------------------------- results
local res, res_items = nil, {}
S.results = {
  enter = function()
    res = PG.result
    local last = PG.last
    local m, o = last.mode, last.o
    res_items = {}
    local function add(label, fn) res_items[#res_items + 1] = { label = label, fn = fn } end
    local function again(mm, oo) return function() PP.stop_music(100); PG.start(mm, oo); go("play") end end
    local function copy(t, k, v) local n = {}; for a, b in pairs(t) do n[a] = b end; n[k] = v; return n end
    local back = (m:sub(1, 2) == "dm") and "dm" or "pp"
    if res.win and m == "vs" and o.opp < #OPPONENTS then add("NEXT: " .. OPPONENTS[o.opp + 1].name, again(m, copy(o, "opp", o.opp + 1)))
    elseif res.win and m == "vs" then add("FINISH", function() go("ending") end)
    elseif res.win and m == "stage" and o.stage < STAGE_COUNT then add("NEXT STAGE", again(m, copy(o, "stage", o.stage + 1)))
    elseif res.win and m == "puzzle" and o.puzzle < #PUZZLES then add("NEXT PUZZLE", again(m, copy(o, "puzzle", o.puzzle + 1)))
    elseif res.win and m == "dm" and o.level < 20 then add("NEXT LEVEL", again(m, copy(o, "level", o.level + 1)))
    elseif res.win and m == "dmvs" and o.opp < 8 then add("NEXT: " .. OPPONENTS[o.opp + 1].name, again(m, copy(o, "opp", o.opp + 1))) end
    add("RETRY", again(m, o))
    add("MENU", function() go(back) end)
    PP.music(res.win and "msc_win" or "msc_lose")
  end,
  step = function()
    cur = move(cur, #res_items)
    if PP.pressed("a") then sfx("ok", 1); res_items[cur].fn() end
  end,
  draw = function()
    PP.background(res.win and 4 or 1, tick)
    local title = ({ endless = "ENDLESS", time = "TIME ATTACK", vs = "VS CPU", stage = "STAGE CLEAR", puzzle = "PUZZLE", dm = "VIRUS BUSTER", dmvs = "CAPSULE VS CPU" })[res.mode]
    header(title)
    window(30, 32, 260, 124, res.win and 14 or 5, 0)
    local head = res.win and (res.mode == "time" and "TIME UP!" or "YOU WIN!") or "GAME OVER"
    if not res.win and (res.mode == "vs" or res.mode == "dmvs") then head = "YOU LOSE" end
    txtc(head, 40, res.win and 14 or 6, 2)
    local rows = {}
    local function add(a, b) rows[#rows + 1] = { a, b } end
    if res.score then add("SCORE", commas(res.score)) end
    if res.time then add("TIME", fmt_time(res.time / 60)) end
    if res.panels then add("PANELS CLEARED", tostring(res.panels)) end
    if res.chain and res.chain > 1 then add("BEST CHAIN", "x" .. res.chain) end
    if res.combo and res.combo >= 4 then add("BEST COMBO", tostring(res.combo)) end
    if res.moves then add("SWAPS", tostring(res.moves)) end
    if res.viruses then add("VIRUSES CLEARED", tostring(res.viruses)) end
    for i, r in ipairs(rows) do txt(r[1], 50, 66 + (i - 1) * 12, 2); txtr(r[2], 270, 66 + (i - 1) * 12, 3) end
    if res.record then if (tick // 15) % 2 == 0 then txtc("NEW RECORD!", 138, 14, 1) end end
    for i, it in ipairs(res_items) do
      local on = i == cur
      local y = 166 + (i - 1) * 18
      box(90, y, 140, 16, on and 25 or 0, on and 26 or 1, 230)
      txtcx(it.label, 160, y + 4, on and 3 or 2)
    end
    spr("spr_char_pip", res.win and 2 or 3, 50, 190, 1)
  end,
}

S.ending = {
  enter = function() PP.music("msc_ending") end,
  step = function() if tick > 120 and (PP.pressed("a") or PP.pressed("start")) then sfx("ok", 1); go("main") end end,
  draw = function()
    PP.background(8, tick)
    txtc("CONGRATULATIONS!", 30, 14, 2)
    txtc("YOU BEAT ALL EIGHT RIVALS", 60, 3, 1)
    for i = 1, #CHAR_IDS do
      local x = 24 + ((i - 1) % 5) * 68 + (i > 5 and 34 or 0)
      local y = 118 + ((i - 1) // 5) * 56
      spr("spr_char_" .. CHAR_IDS[i], 2 + ((tick // 20 + i) % 2) * 0, x + 12, y + floor(sin(tick / 12 + i) * 3), 1)
    end
    if tick > 120 and (tick // 30) % 2 == 0 then txtc("PRESS A", 218, 3, 1) end
  end,
}

-- ---------------------------------------------------------------- the scenes
function M.scene(name)
  local Scene = gs.scene{}
  function Scene:enter(arg)
    state, cur, tick = name, 1, 0
    if MENU_SCREENS[name] then PP.music("msc_menu") end -- coming back from a game or a results jingle
    if S[name].enter then S[name].enter(arg) end
  end
  function Scene:update()
    PP.tick()
    PP.keys_tick()
    tick = tick + 1
    if BOT and state == "play" then
      for _ = 1, FF do if state == "play" then S.play.step() end end
      return
    end
    S[name].step()
  end
  function Scene:draw()
    S[name].draw()
    if STATS and tick % 120 == 0 then
      local px, calls, screen = gs.stats()
      print(string.format("stats %s/%s: %.2f screens drawn, %d draw calls", state, PG.mode() or "-", px / screen, calls))
    end
  end
  return Scene
end

-- The first scene: loads the save, then shows the title, or (for tests) runs the self-test, starts
-- a game directly or opens one screen.
function M.start()
  PP.load_game()
  if os.getenv("GS_SELFTEST") then tests.selftest(); return end
  if os.getenv("GS_DMDEBUG") then tests.dmdebug(); return end
  local mode = os.getenv("GS_MODE")
  if mode then
    local n = function(k, d) return tonumber(os.getenv(k) or d) end
    math.randomseed(n("GS_SEED", 1))
    local o = { diff = n("GS_DIFF", 2), opp = n("GS_OPP", 1), stage = n("GS_STAGE", 1), puzzle = n("GS_PUZ", 1), level = n("GS_LEVEL", 0), speed = n("GS_SPEED", mode:sub(1, 2) == "dm" and 2 or 4) }
    PG.start(mode, o)
    go("play")
    return
  end
  local shot = os.getenv("GS_SCREEN")
  if shot then
    PP.save.stage = 6
    if shot == "results" then
      PG.result = { win = true, mode = "endless", score = 12345, time = 3600, panels = 100, chain = 4, combo = 6, record = true }
      PG.last = { mode = "endless", o = { diff = 2, speed = 4 } }
    end
    if shot == "setup" then PP.open_setup(os.getenv("GS_KIND") or "vs") elseif S[shot] then go(shot) end
    return
  end
  go("title")
end

return M
