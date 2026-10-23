-- Drawing helpers for the menus and the heads-up display. Colors are numbers from the console's
-- palette (0 black, 3 white, 22 teal, ...).
-- Text never leaves its container: `limit` is the x the text may not pass; what does not fit is cut
-- off. GS_TEXTAUDIT=1 reports every cut (see lib/debug.lua).
local floor, max, min = math.floor, math.max, math.min
local SW, SH = 320, 240

local M = { SW = SW, SH = SH, audit = nil }

local opts = {} -- reused, so drawing a sprite does not make a table
function M.spr(name, frame, x, y, scale, flip, angle, alpha)
  opts.frame, opts.scale, opts.flip, opts.angle, opts.alpha = frame, scale or 1, flip or false, angle or 0, (alpha or 255) / 255
  gs.draw.sprite(name, x, y, opts)
end

-- a color with transparency: a palette number and an alpha from 0 to 255, made once
local tinted = {}
local function tint(ci, a)
  if not a or a >= 255 then return ci end
  local key = ci * 256 + a
  local c = tinted[key]
  if not c then local r, g, b = gs.color(ci); c = { r, g, b, a }; tinted[key] = c end
  return c
end

function M.txt(s, x, y, ci, scale, limit)
  scale = scale or 1
  limit = limit or SW
  local width = gs.draw.text_width
  if x + width(s, scale) > limit then
    if M.audit then M.audit(s, x, limit) end
    local n = #s
    while n > 0 and x + width(s:sub(1, n), scale) > limit do n = n - 1 end
    s = s:sub(1, n)
  end
  gs.draw.text(s, floor(x), floor(y), ci or 3, scale)
end
function M.txtc(s, y, ci, scale, limit) M.txt(s, floor((SW - gs.draw.text_width(s, scale)) * 0.5), y, ci, scale, limit) end
function M.txtr(s, x, y, ci, scale) M.txt(s, max(0, x - gs.draw.text_width(s, scale)), y, ci, scale) end

function M.box(x, y, w, h, fill, edge, alpha)
  gs.draw.rect(x, y, w, h, tint(fill or 0, alpha))
  if edge then
    gs.draw.rect(x, y, w, 1, edge); gs.draw.rect(x, y + h - 1, w, 1, edge)
    gs.draw.rect(x, y, 1, h, edge); gs.draw.rect(x + w - 1, y, 1, h, edge)
  end
end

-- A button of a menu list, GBA style: corners cut round, a light line along the top and a dark one
-- along the bottom, and a bright stripe on the left when it is the one chosen (accent: its colour,
-- teal unless given).
function M.item(x, y, w, h, on, alpha, accent)
  local a = alpha or 215
  local fill, top, bottom = on and 25 or 0, on and 27 or 1, on and 24 or 0
  gs.draw.rect(x + 1, y, w - 2, h, tint(fill, a)); gs.draw.rect(x, y + 1, 1, h - 2, tint(fill, a)); gs.draw.rect(x + w - 1, y + 1, 1, h - 2, tint(fill, a))
  gs.draw.rect(x + 1, y, w - 2, 1, tint(top, on and 255 or a))
  if on then gs.draw.rect(x + 1, y + 1, w - 2, 1, 26) end
  gs.draw.rect(x + 1, y + h - 1, w - 2, 1, tint(bottom, 255))
  gs.draw.rect(x, y + 1, on and 2 or 1, h - 2, on and (accent or 22) or tint(1, a))
end

function M.bar(x, y, w, h, v, vmax, fg, bg, edge)
  M.box(x, y, w, h, bg or 1, edge)
  local fw = floor((w - 2) * max(0, min(1, v / max(1, vmax))))
  if fw > 0 then M.box(x + 1, y + 1, fw, h - 2, fg) end
end

function M.fmt_time(s)
  s = floor(s)
  return string.format("%d:%02d", s // 60, s % 60)
end

-- word wrap into lines of at most n characters
function M.wrap(s, n)
  local lines, line = {}, ""
  for word in s:gmatch("%S+") do
    if #line + #word + (line == "" and 0 or 1) > n then lines[#lines + 1] = line; line = word else line = (line == "" and "" or line .. " ") .. word end
  end
  if line ~= "" then lines[#lines + 1] = line end
  return lines
end

-- one-pixel rectangles and lines with a palette color and alpha (the radar and the weapon beams)
function M.dot(x, y, w, h, ci, alpha) gs.draw.rect(x, y, w, h, tint(ci, alpha)) end
function M.line(x1, y1, x2, y2, ci, alpha) gs.draw.line(x1, y1, x2, y2, tint(ci, alpha)) end
function M.rgba(r, g, b, a) return { r, g, b, a } end

-- The menus' scrolling starfield. In a scene with a layout it is two repeating tile layers there,
-- "far" and "dust", and drift slides them to where they are at this tick; menu_background draws the
-- same picture itself, for the screens whose background changes (the sector list, the results).
function M.drift(tick, speed)
  local t = tick * (speed or 0.3)
  local far, dust = gs.layer("far"), gs.layer("dust")
  far.x, far.y = floor(-t * 0.5), floor(-t * 0.2)
  dust.x, dust.y = floor(-t * 1.2), floor(-t * 0.5)
end

-- a scrolling starfield for the menus: a far layer and a nearer dust layer, both 256 pixels square
-- and repeating
function M.menu_background(bg, tick, speed)
  local far, dust = gs.image("tilesets/ts_bg_" .. bg .. ".png"), gs.image("tilesets/ts_dust.png")
  local t = tick * (speed or 0.3)
  local ox, oy = (-(t * 0.5)) % 256 - 256, (-(t * 0.2)) % 256 - 256
  for ty = 0, 2 do for tx = 0, 2 do gs.tile(far, 0, 0, 256, 256, floor(ox + tx * 256), floor(oy + ty * 256)) end end
  ox, oy = (-(t * 1.2)) % 256 - 256, (-(t * 0.5)) % 256 - 256
  for ty = 0, 2 do for tx = 0, 2 do gs.tile(dust, 0, 0, 256, 256, floor(ox + tx * 256), floor(oy + ty * 256)) end end
end

return M
