-- board.lua: drawing a board (96 x 192 at x, y) and the little effects that belong to one
-- (twinkles, floating words). The board itself is a table of cells (lib/pl.lua), drawn straight
-- with gs.tile.
local ui = require "lib.ui"
local PL = require "lib.pl"
local art = require "lib.art"
local GARBAGE_PIECES, PANEL_STATES = art.GARBAGE_PIECES, art.PANEL_STATES
local floor, max, min = math.floor, math.max, math.min
local frame, text, rect = ui.frame, ui.text, gs.draw.rect
local COLS, TOP, NR = PL.COLS, PL.TOP, PL.NR
local M = {}

-- a light shade of each panel colour (for the little preview boards)
M.PCOL = { 7, 15, 19, 23, 27, 31 }

-- ---------------------------------------------------------------- effects stored on a board: b.fx
function M.fx_text(b, x, y, s, font, life)
  b.fx = b.fx or {}
  b.fx[#b.fx + 1] = { kind = "text", x = x, y = y, s = s, font = font or ui.WHITE, life = life or 60 }
end
function M.fx_sparks(b, x, y, n)
  b.fx = b.fx or {}
  for i = 1, n or 4 do
    local a = (i / (n or 4)) * 6.283 + math.random() * 0.6
    b.fx[#b.fx + 1] = { kind = "spark", x = x, y = y, vx = math.cos(a) * (0.7 + math.random() * 0.8), vy = math.sin(a) * (0.7 + math.random() * 0.8) - 0.5, life = 24 }
  end
end
function M.fx_step(b)
  local fx = b.fx
  if not fx then return end
  for i = #fx, 1, -1 do
    local f = fx[i]
    f.life = f.life - 1
    if f.kind == "spark" then f.x = f.x + f.vx; f.y = f.y + f.vy; f.vy = f.vy + 0.06 else f.y = f.y - 0.5 end
    if f.life <= 0 then table.remove(fx, i) end
  end
end
local function fx_draw(b, ox, oy)
  for _, f in ipairs(b.fx or {}) do
    if f.kind == "spark" then
      frame("spr_spark", 3 - min(3, f.life // 6), ox + f.x - 4, oy + f.y - 4)
    elseif f.life > 12 or f.life % 4 < 2 then
      local w = #f.s * 8
      text(f.s, max(ox, min(ox + 96 - w, ox + f.x - w / 2)), oy + f.y, f.font)
    end
  end
end

-- ---------------------------------------------------------------- the board
local function garbage_piece(g, rr, cc)
  local base = g.metal and GARBAGE_PIECES or 0
  if g.h == 1 then return base + 9 + (cc == 0 and 0 or cc == g.w - 1 and 2 or 1) end
  local ri = rr == 0 and 0 or rr == g.h - 1 and 2 or 1
  local ci = cc == 0 and 0 or cc == g.w - 1 and 2 or 1
  return base + ri * 3 + ci
end

-- a plate over the rows that scroll in and out: the same blue as the screens' title bars
local function plate(x, y, w, h)
  rect(x, y, w, h, 24)
  rect(x + 1, y + 1, w - 2, h - 2, 25)
  rect(x + 1, y + 1, w - 2, 1, 26)
end

-- o: hide_incoming, cursor (false hides it), tick (frame counter for blinking)
function M.draw(b, x, y, o)
  o = o or {}
  local tick = o.tick or b.t
  local sy = floor(b.scroll)
  if b.puzzle or not b.rise_on then sy = 0 end
  -- the well: a white frame round a see-through navy pit, so the bright panels stand out on the
  -- light screens
  rect(x - 4, y - 4, 104, 200, 25)
  rect(x - 3, y - 3, 102, 198, 3)
  rect(x - 2, y - 2, 100, 196, 27)
  for c = 1, COLS do rect(x + (c - 1) * 16, y, 16, 192, c % 2 == 0 and "#14234fd8" or "#14234fc0") end
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
          frame("spr_garbage", garbage_piece(g, rr, cc), x + (g.x - 1 + cc) * 16, y + (r - TOP) * 16 - sy + oy)
        end
      end
    end
    -- a sleepy face in the middle (a surprised one while it dissolves)
    local mr, mc = g.y + (g.h - 1) // 2, g.x + (g.w - 1) // 2
    if mr >= TOP then
      frame("spr_garbage", (g.metal and GARBAGE_PIECES or 0) + (g.st == "flash" and 13 or 12), x + (mc - 1) * 16, y + (mr - TOP) * 16 - sy + oy)
    end
    if g.st == "flash" and (tick // 3) % 2 == 0 then
      local top = max(g.y, TOP)
      rect(x + (g.x - 1) * 16, y + (top - TOP) * 16 - sy, g.w * 16, (g.y + g.h - top) * 16, "#ffffff8c")
    end
  end
  fx_draw(b, x, y)
  if o.cursor ~= false and not b.lost then
    frame("spr_cursor", (tick // 16) % 2, x + (b.cur_c - 1) * 16 - 4, y + (b.cur_r - TOP) * 16 - sy - 4)
  end
  plate(x - 4, y - 22, 104, 19)
  plate(x - 4, y + 192, 104, 18)
  -- garbage on its way, shown on the top plate as little blocks
  local px = x
  for i, d in ipairs(b.pending) do
    if i > 5 then text("+", px, y - 17, ui.WHITE); break end
    local cw = max(d.w * 2, 10)
    rect(px, y - 18, cw, 11, d.metal and 1 or 28)
    rect(px + 1, y - 17, cw - 2, 9, d.metal and 27 or 30)
    text(tostring(d.h > 1 and d.h or d.w), px + cw / 2 - 4, y - 17, ui.INK)
    px = px + cw + 3
  end
  if b.danger and not b.lost and (tick // 10) % 2 == 0 then text("!", x + 88, y - 17, ui.GOLD) end
end
return M
