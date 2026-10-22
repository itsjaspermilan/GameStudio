-- Drawing helpers. Positions are in pixels. A color is "#rrggbb", "#rrggbbaa" (the last two digits are how solid it is: 00 invisible,
-- ff solid), { r, g, b [, a] } (0 to 255) or a number (a place in the console's palette). The strings are read once and remembered,
-- so a see-through color written as a string costs nothing per frame, unlike a new table.
--   gs.draw.rect(10, 10, 40, 8, "#ff0000")         gs.draw.frame(...)  gs.draw.line(...)  gs.draw.circle(x, y, r, color)
--   gs.draw.text("SCORE 10", 4, 4, "#ffffff", 1)   gs.draw.text_centered("GAME OVER", 100, "#ffd08a", 2)
--   gs.draw.font_text("spr_font", "SCORE 10", 4, 4)  text in a font drawn as a sprite (a frame a letter)
--   gs.draw.sprite("star", x, y, { frame = 1, angle = 45, scale = 2, alpha = 0.5 })
--   gs.draw.panel(x, y, w, h)   gs.draw.bar(x, y, w, h, value, max, { color = "#4ade80" })
-- The built-in font is 8x8 plain ASCII; text at scale 1 is the right size for most UI.
local assets = require("gs.assets")

local M = { palette = {} }
local cache = {}

local function parse(c)
  if c == nil then return 255, 255, 255, 255 end
  local t = type(c)
  if t == "string" then
    local v = cache[c]
    if not v then
      local h = c:match("^#(%x%x%x%x%x%x)$") or c:match("^#(%x%x%x%x%x%x%x%x)$")
      if not h then error("bad color '" .. c .. "' (write it like \"#ff8800\", or \"#ff880080\" for half see-through)", 3) end
      v = { tonumber(h:sub(1, 2), 16), tonumber(h:sub(3, 4), 16), tonumber(h:sub(5, 6), 16), #h == 8 and tonumber(h:sub(7, 8), 16) or 255 }
      cache[c] = v
    end
    return v[1], v[2], v[3], v[4]
  elseif t == "table" then return c[1], c[2], c[3], c[4] or 255
  elseif t == "number" then
    local p = M.palette[c + 1]
    if not p then error("palette color " .. c .. " does not exist (the console has " .. #M.palette .. ")", 3) end
    return p[1], p[2], p[3], 255
  end
  error("a color must be \"#rrggbb\", \"#rrggbbaa\", {r, g, b} or a palette number, not " .. t, 3)
end
M.color = parse

local raw = gs.raw
function M.rect(x, y, w, h, color) local r, g, b, a = parse(color); raw.rect(x, y, w, h, r, g, b, a) end
function M.frame(x, y, w, h, color)
  local r, g, b, a = parse(color)
  raw.rect(x, y, w, 1, r, g, b, a); raw.rect(x, y + h - 1, w, 1, r, g, b, a)
  raw.rect(x, y, 1, h, r, g, b, a); raw.rect(x + w - 1, y, 1, h, r, g, b, a)
end
function M.line(x1, y1, x2, y2, color) local r, g, b, a = parse(color); raw.line(x1, y1, x2, y2, r, g, b, a) end
function M.circle(x, y, radius, color) local r, g, b, a = parse(color); raw.circle(x, y, radius, r, g, b, a) end
function M.text(str, x, y, color, scale)
  local r, g, b, a = parse(color)
  raw.print(tostring(str), math.floor(x), math.floor(y), r, g, b, a, scale or 1)
end
function M.text_width(str, scale) return #tostring(str) * 8 * (scale or 1) end
function M.text_centered(str, y, color, scale)
  local w = gs.screen()
  M.text(str, (w - M.text_width(str, scale)) / 2, y, color, scale)
end
function M.text_right(str, x, y, color, scale) M.text(str, x - M.text_width(str, scale), y, color, scale) end

-- Text in a font of your own: a sprite whose frames are the letters, from " " (frame 0) on in ASCII order (! " # ... 0-9 ... A-Z ...).
-- Letters it has no frame for are left as a gap. Every letter is as wide as a frame; the sprite's own colours are used.
function M.font_width(font, str, scale) return #tostring(str) * assets.sprite(font, 2).fw * (scale or 1) end
function M.font_text(font, str, x, y, scale)
  local s, sc = assets.sprite(font, 2), scale or 1
  str = tostring(str)
  local fw, fh, img, tile = s.fw, s.fh, s.img, gs.tile
  x, y = math.floor(x), math.floor(y)
  for i = 1, #str do
    local f = str:byte(i) - 32
    if f >= 0 and f < s.frames then tile(img, f * fw, 0, fw, fh, x + (i - 1) * fw * sc, y, sc) end
  end
end

function M.sprite(name, x, y, opts)
  opts = opts or {}
  local s = assets.sprite(name, 2)
  local sc = opts.scale or 1
  assets.draw(s, opts.frame or 0, x, y, opts.angle or 0, opts.sx or sc, opts.sy or sc, opts.alpha or 1, opts.flip)
end

function M.panel(x, y, w, h, opts)
  opts = opts or {}
  M.rect(x, y, w, h, opts.fill or "#101424")
  M.frame(x, y, w, h, opts.border or "#ffffff")
end
function M.bar(x, y, w, h, value, max, opts)
  opts = opts or {}
  M.rect(x, y, w, h, opts.back or "#333344")
  local fill = math.floor((w - 2) * math.max(0, math.min(1, value / math.max(max, 1e-9))))
  if fill > 0 then M.rect(x + 1, y + 1, fill, h - 2, opts.color or "#4ade80") end
  if opts.border then M.frame(x, y, w, h, opts.border) end
end

-- Split text into lines of at most `width` pixels (at the given scale), breaking at spaces.
function M.wrap(text, width, scale)
  local per = math.max(1, math.floor(width / (8 * (scale or 1))))
  local lines, line = {}, ""
  for word in tostring(text):gmatch("%S+") do
    if #line + #word + (line == "" and 0 or 1) > per then lines[#lines + 1] = line; line = word
    else line = (line == "" and "" or line .. " ") .. word end
  end
  if line ~= "" then lines[#lines + 1] = line end
  return lines
end

return M
