-- draw.lua: drawing a Panel Pop board and a Doc Capsule bottle, plus the little effects (sparks, floating text) that belong to a board.
local PP = require "lib.util"
local PL = require "lib.pl"
local DM = require "lib.dm"
local art = require "lib.art"
local GARBAGE_PIECES, PANEL_STATES = art.GARBAGE_PIECES, art.PANEL_STATES
local floor, max, min, sin = math.floor, math.max, math.min, math.sin
local box, txt, txts, txtcx, frame, window = PP.box, PP.txt, PP.txts, PP.txtcx, PP.frame, PP.window
local COLS, VIS, TOP, NR = PL.COLS, PL.VIS, PL.TOP, PL.NR
local DRAW = {}

-- bright shade of each panel colour (for sparks and text)
local PCOL = { 6, 14, 18, 22, 26, 30 }
DRAW.PCOL = PCOL

-- ---------------------------------------------------------------- effects stored on a board / bottle: b.fx
function DRAW.fx_text(b, x, y, s, col, life, sc)
  b.fx = b.fx or {}
  b.fx[#b.fx + 1] = { kind = "text", x = x, y = y, s = s, col = col or 3, life = life or 60, max = life or 60, sc = sc or 1 }
end
function DRAW.fx_sparks(b, x, y, col, n)
  b.fx = b.fx or {}
  for i = 1, n or 5 do
    local a = (i / (n or 5)) * 6.283 + math.random() * 0.6
    b.fx[#b.fx + 1] = { kind = "spark", x = x, y = y, vx = math.cos(a) * (0.8 + math.random()), vy = math.sin(a) * (0.8 + math.random()) - 0.6, life = 22, max = 22, col = col }
  end
end
local function fx_step(b)
  local fx = b.fx
  if not fx then return end
  for i = #fx, 1, -1 do
    local f = fx[i]
    f.life = f.life - 1
    if f.kind == "spark" then f.x = f.x + f.vx; f.y = f.y + f.vy; f.vy = f.vy + 0.08 else f.y = f.y - 0.5 end
    if f.life <= 0 then table.remove(fx, i) end
  end
end
local function fx_draw(b, ox, oy)
  for _, f in ipairs(b.fx or {}) do
    if f.kind == "spark" then
      local r, g, bl = PP.rgb(f.col)
      gs.rect(floor(ox + f.x), floor(oy + f.y), 2, 2, r, g, bl, floor(255 * f.life / f.max))
    else
      local w = #f.s * 8 * f.sc
      local x = max(ox, min(ox + 96 - w, ox + f.x - w / 2))
      if f.life > 12 or f.life % 4 < 2 then txts(f.s, floor(x), floor(oy + f.y), f.col, f.sc) end
    end
  end
end
DRAW.fx_step = fx_step

-- ---------------------------------------------------------------- Panel Pop board (96 x 192 at x, y)
local function garbage_piece(g, rr, cc)
  local base = g.metal and GARBAGE_PIECES or 0
  if g.h == 1 then return base + 9 + (cc == 0 and 0 or cc == g.w - 1 and 2 or 1) end
  local ri = rr == 0 and 0 or rr == g.h - 1 and 2 or 1
  local ci = cc == 0 and 0 or cc == g.w - 1 and 2 or 1
  return base + ri * 3 + ci
end

-- o: lost (grey panels), hide_incoming, cursor (bool), tick (frame counter for blinking)
function DRAW.pl_board(b, x, y, o)
  o = o or {}
  local tick = o.tick or b.t
  local sy = floor(b.scroll)
  if b.puzzle or not b.rise_on then sy = 0 end
  -- the well
  box(x - 2, y - 2, 100, 196, 0, 2)
  for c = 1, COLS do box(x + (c - 1) * 16, y, 16, 192, (c % 2 == 0) and 1 or 0, nil, (c % 2 == 0) and 90 or 255) end
  for r = TOP, NR do
    local py = y + (r - TOP) * 16 - sy
    local row = b.g[r]
    if not (o.hide_incoming and r == NR) then
      for c = 1, COLS do
        local p = row[c]
        if p and not p.gb then
          local st = 0
          local ox, oy = 0, 0
          if b.lost then st = 5
          elseif p.st == "dim" then st = 4
          elseif p.st == "flash" then st = (tick // 2) % 2 == 0 and 2 or 0
          elseif p.st == "face" then st = 3
          elseif p.land >= 3 then st = 1 end
          if p.st == "swap" then ox = -p.dir * 16 * p.tm / PL.SWAP
          elseif p.st == "fall" and p.tm > 0 then oy = -16 * p.tm / PL.FALL end
          if b.danger and p.st == "idle" and r <= TOP + 1 then oy = oy - ((tick // 3) % 2) end
          frame("spr_panels", (p.k - 1) * PANEL_STATES + st, x + (c - 1) * 16 + ox, py + oy)
        end
      end
    end
  end
  for _, g in ipairs(b.garbs) do
    local oy = (g.fall and g.tm > 0) and (-16 * g.tm / PL.FALL) or 0
    for rr = 0, g.h - 1 do
      local r = g.y + rr
      if r >= TOP then
        for cc = 0, g.w - 1 do
          local px, py = x + (g.x - 1 + cc) * 16, y + (r - TOP) * 16 - sy + oy
          frame("spr_garbage", garbage_piece(g, rr, cc), px, py)
        end
      end
    end
    -- a sleepy face in the middle (a surprised one while it dissolves)
    local mr, mc = g.y + (g.h - 1) // 2, g.x + (g.w - 1) // 2
    if mr >= TOP then
      local px, py = x + (mc - 1) * 16, y + (mr - TOP) * 16 - sy + oy
      frame("spr_garbage", (g.metal and GARBAGE_PIECES or 0) + (g.st == "flash" and 13 or 12), px, py)
    end
    if g.st == "flash" and (tick // 3) % 2 == 0 then
      local top = max(g.y, TOP)
      box(x + (g.x - 1) * 16, y + (top - TOP) * 16 - sy, g.w * 16, (g.y + g.h - top) * 16, 3, nil, 140)
    end
  end
  fx_draw(b, x, y)
  -- the cursor
  if o.cursor ~= false and not b.lost then
    local cx, cy = x + (b.cur_c - 1) * 16 - 2, y + (b.cur_r - TOP) * 16 - sy - 2
    local col = (tick // 12) % 2 == 0 and 3 or 14
    local w, h = 36, 20
    box(cx, cy, 9, 2, col); box(cx, cy, 2, 7, col)
    box(cx + w - 9, cy, 9, 2, col); box(cx + w - 2, cy, 2, 7, col)
    box(cx, cy + h - 2, 9, 2, col); box(cx, cy + h - 7, 2, 7, col)
    box(cx + w - 9, cy + h - 2, 9, 2, col); box(cx + w - 2, cy + h - 7, 2, 7, col)
  end
  -- plates over the rows that scroll in and out
  box(x - 2, y - 20, 100, 18, 1, 2)
  box(x - 2, y + 192, 100, 20, 1, 2)
  -- pending garbage, shown on the top plate as little blocks
  local px = x + 2
  for i, d in ipairs(b.pending) do
    if i > 5 then txt("+", px, y - 16, 3); break end
    local w = d.w * 2
    local cw = max(w, 8)
    box(px, y - 17, cw, 7 + (d.h > 1 and 3 or 0), d.metal and 2 or 29, d.metal and 3 or 31)
    txt(tostring(d.h > 1 and d.h or d.w), px + cw / 2 - 3, y - 15, 3)
    px = px + cw + 3
  end
  if b.danger and (tick // 10) % 2 == 0 then txt("!", x + 90, y - 16, 6) end
end

-- ---------------------------------------------------------------- Doc Capsule bottle (96 x 192 at x, y; cells are 12 pixels)
local function cell_frame(x, f) end
local function pill_frame(c, ori)
  local idx = ({ s = 0, l = 1, r = 2, u = 3, d = 4 })[ori] or 0
  return (c - 1) * 6 + idx
end
local function draw_cell(px, py, cell, tick, flash_phase)
  if cell.t == "v" then
    local f = (cell.c - 1) * 3 + ((tick // 24) % 2)
    if cell.flash then f = (cell.c - 1) * 3 + 2 end
    frame("spr_viruses", f, px, py, 1, false, 255, 12, 12)
  else
    if cell.flash then
      frame("spr_pills", (cell.c - 1) * 6 + 5, px, py, 1, false, 255, 12, 12)
    else
      frame("spr_pills", pill_frame(cell.c, cell.ori), px, py, 1, false, 255, 12, 12)
    end
  end
end

-- o: tick, hide_pill
function DRAW.dm_bottle(d, x, y, o)
  o = o or {}
  local tick = o.tick or d.t
  -- the bottle: a dark well with a neck
  box(x - 3, y - 3, 102, 198, 2, nil)
  box(x - 2, y - 2, 100, 196, 0, 1)
  box(x, y, 96, 192, 0)
  for r = 1, DM.H do for c = 1, DM.W do if (r + c) % 2 == 0 then box(x + (c - 1) * 12, y + (r - 1) * 12, 12, 12, 1, nil, 70) end end end
  for r = 1, DM.H do
    for c = 1, DM.W do
      local cell = d.g[r][c]
      if cell then
        local blink = cell.flash and (tick // 3) % 2 == 0
        if not blink then draw_cell(x + (c - 1) * 12, y + (r - 1) * 12, cell, tick) end
      end
    end
  end
  local p = d.pill
  if p and not o.hide_pill then
    local r1, c1, a, r2, c2, b = DM.pill_cells(p)
    local drop = 0
    local r1n, r2n = r1 + 1, r2 + 1
    if d.g[min(DM.H, r1n)] and r1n <= DM.H and r2n <= DM.H and not d.g[r1n][c1] and not d.g[r2n][c2] then drop = floor(12 * d.gt / d.gf) end
    local ori = ({ { "l", "r" }, { "u", "d" }, { "r", "l" }, { "d", "u" } })[p.dir]
    frame("spr_pills", pill_frame(a, ori[1]), x + (c1 - 1) * 12, y + (r1 - 1) * 12 + drop, 1, false, 255, 12, 12)
    frame("spr_pills", pill_frame(b, ori[2]), x + (c2 - 1) * 12, y + (r2 - 1) * 12 + drop, 1, false, 255, 12, 12)
  end
  fx_draw(d, x, y)
  -- the bottle's shoulders
  box(x - 3, y - 12, 102, 9, 1, 2)
  box(x + 34, y - 16, 28, 14, 0, 2)
  box(x + 35, y - 14, 26, 12, 0)
end
return DRAW
