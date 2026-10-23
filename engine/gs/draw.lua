-- Drawing helpers. Positions are in pixels. A color is "#rrggbb", "#rrggbbaa" (the last two digits are how solid it is: 00 invisible,
-- ff solid), "bank:place" (place 1 to 15 of one of the game's colour banks, like "sky:3"), { r, g, b [, a] } (0 to 255) or a number (a place in
-- the console's classic palette). The strings are read once and remembered,
-- so a see-through color written as a string costs nothing per frame, unlike a new table.
--   gs.draw.rect(10, 10, 40, 8, "#ff0000")         gs.draw.frame(...)  gs.draw.line(...)  gs.draw.circle(x, y, r, color)
--   gs.draw.text("SCORE 10", 4, 4, "#ffffff", 1)   gs.draw.text_centered("GAME OVER", 100, "#ffd08a", 2)
--   gs.draw.text("Hello!", 8, 8, "#404040", 1, { font = "round_tall", shadow = true })  another built-in font, with a drop shadow
--   gs.draw.font_text("spr_font", "SCORE 10", 4, 4)  text in a font drawn as a sprite (a frame a letter)
--   gs.draw.sprite("star", x, y, { frame = 1, angle = 45, scale = 2, alpha = 0.5, bank = "gold" })  bank: drawn with another bank's colours
--   gs.draw.panel(x, y, w, h)   gs.draw.bar(x, y, w, h, value, max, { color = "#4ade80" })
--   gs.draw.blend("add") ... gs.draw.blend()   how what is drawn next mixes in: "normal", "add" (light, glow) or "darken" (shadow, tint)
-- An entity, a tile layer, a picture or text in a layout, gs.draw.sprite and gs.burst take `blend = "add"` (or "darken") as well, and
-- their alpha is the strength, like the GBA's blending of layers and sprites.
-- The built-in fonts come in three styles, round, square and bold, each small (8 pixels high, for scores and labels) and tall
-- (12 high, for talking and menus): "round_small" (the one used when no font is named), "round_tall", "square_small", "square_tall",
-- "bold_small", "bold_tall". Letters are as wide as they need to be, so measure text with gs.draw.text_width. They know " " to "~";
-- any other character is drawn as a box. A shadow (true for one made from the text's colour, or a colour) sits right of and under
-- every pixel, the way GBA games drew their words.
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
      local bank, place = c:match("^([%w_%-/]+):(%d+)$")
      if bank then
        local b = assets.all_banks()[bank]
        if not b then error("bad color '" .. c .. "': the game has no colour bank called " .. bank, 3) end
        local p = b.colors[tonumber(place)]
        if not p then error("bad color '" .. c .. "': bank " .. bank .. " has places 1 to " .. #b.colors, 3) end
        v = { p[1], p[2], p[3], 255 }
      elseif not h then error("bad color '" .. c .. "' (write it like \"#ff8800\", \"#ff880080\" for half see-through, or \"sky:3\" for a bank colour)", 3)
      else v = { tonumber(h:sub(1, 2), 16), tonumber(h:sub(3, 4), 16), tonumber(h:sub(5, 6), 16), #h == 8 and tonumber(h:sub(7, 8), 16) or 255 } end
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
-- Bank colours are remembered like any other string: forget them when palette.json changes (live reload).
function M.forget_colors() for k in pairs(cache) do if not k:find("^#") then cache[k] = nil end end end

local raw = gs.raw
-- The blend mode now in use. The runtime starts every frame at "normal"; the world puts "normal" back after each thing it draws.
M.mode = "normal"
function M.blend(mode)
  mode = mode or "normal"
  if mode ~= M.mode then raw.blend(mode); M.mode = mode end -- (raw.blend checks the name)
end
function M.rect(x, y, w, h, color) local r, g, b, a = parse(color); raw.rect(x, y, w, h, r, g, b, a) end
function M.frame(x, y, w, h, color)
  local r, g, b, a = parse(color)
  raw.rect(x, y, w, 1, r, g, b, a); raw.rect(x, y + h - 1, w, 1, r, g, b, a)
  raw.rect(x, y, 1, h, r, g, b, a); raw.rect(x + w - 1, y, 1, h, r, g, b, a)
end
function M.line(x1, y1, x2, y2, color) local r, g, b, a = parse(color); raw.line(x1, y1, x2, y2, r, g, b, a) end
function M.circle(x, y, radius, color) local r, g, b, a = parse(color); raw.circle(x, y, radius, r, g, b, a) end
local builtin = {}
-- A built-in font's number and height, or nil when the name is not one (then it is a sprite font).
local function font_of(name)
  if name == nil then return 0, 8, 10 end
  local f = builtin[name]
  if f == nil then local n, h, line = raw.font(name); f = n and { n, h, line } or false; builtin[name] = f end
  if f then return f[1], f[2], f[3] end
end
M.font_of = font_of
-- The shadow made from a colour: light letters get a dark shadow of their own hue, dark letters a pale one.
local function shadow_of(r, g, b)
  if r * 0.3 + g * 0.59 + b * 0.11 > 110 then return r * 0.3 // 1, g * 0.3 // 1, b * 0.36 // 1 end
  return (r + (255 - r) * 0.7) // 1, (g + (255 - g) * 0.7) // 1, (b + (255 - b) * 0.66) // 1
end
local function shadow_color(shadow, r, g, b, a)
  if shadow == true then local sr, sg, sb = shadow_of(r, g, b); return sr, sg, sb, a end
  local sr, sg, sb, sa = parse(shadow)
  return sr, sg, sb, sa * a // 255
end
-- opts: font (a built-in font's name), shadow (true or a colour), alpha (0 to 1, on top of the colour's own)
function M.text(str, x, y, color, scale, opts)
  local r, g, b, a = parse(color)
  local font, shadow = 0, nil
  if opts then
    if opts.font then
      font = font_of(opts.font)
      if not font then error("there is no built-in font called '" .. tostring(opts.font) .. "' (round_small, round_tall, square_small, square_tall, bold_small, bold_tall); for a sprite font use gs.draw.font_text", 2) end
    end
    if opts.alpha then a = a * opts.alpha // 1 end
    shadow = opts.shadow
  end
  if shadow then
    local sr, sg, sb, sa = shadow_color(shadow, r, g, b, a)
    raw.print(tostring(str), math.floor(x), math.floor(y), r, g, b, a, scale or 1, font, sr, sg, sb, sa)
  else raw.print(tostring(str), math.floor(x), math.floor(y), r, g, b, a, scale or 1, font) end
end
function M.text_width(str, scale, font) return raw.text_width(tostring(str), font and font_of(font) or 0) * (scale or 1) end
function M.text_centered(str, y, color, scale, opts)
  local w = gs.screen()
  M.text(str, (w - M.text_width(str, scale, opts and opts.font)) // 2, y, color, scale, opts)
end
function M.text_right(str, x, y, color, scale, opts) M.text(str, x - M.text_width(str, scale, opts and opts.font), y, color, scale, opts) end

-- Text in any font, built-in or a sprite: what layouts, menus and talk boxes draw with. `font` nil is round_small.
function M.any_text(font, str, x, y, color, scale, alpha, shadow)
  if font and not font_of(font) then M.font_text(font, str, x, y, scale, alpha)
  else M.text(str, x, y, color, scale, { font = font, alpha = alpha, shadow = shadow }) end
end
function M.any_width(font, str, scale)
  if font and not font_of(font) then return M.font_width(font, str, scale) end
  return M.text_width(str, scale, font)
end
-- how tall the letters are and how far apart lines sit, at scale 1
function M.any_height(font)
  local _, h, line = font_of(font)
  if h then return h, line end
  local fh = assets.sprite(font, 3).fh
  return fh, fh + 2
end

-- Text in a font of your own: a sprite whose frames are the letters, from " " (frame 0) on in ASCII order (! " # ... 0-9 ... A-Z ...).
-- Letters it has no frame for are left as a gap. Every letter is as wide as a frame; the sprite's own colours are used.
function M.font_width(font, str, scale) return #tostring(str) * assets.sprite(font, 2).fw * (scale or 1) end
function M.font_text(font, str, x, y, scale, alpha)
  local s, sc, a = assets.sprite(font, 2), scale or 1, (alpha or 1) * 255
  str = tostring(str)
  local fw, fh, img, tile = s.fw, s.fh, s.img, gs.tile
  x, y = math.floor(x), math.floor(y)
  for i = 1, #str do
    local f = str:byte(i) - 32
    if f >= 0 and f < s.frames then tile(img, f * fw, 0, fw, fh, x + (i - 1) * fw * sc, y, sc, false, 0, sc, a) end
  end
end

function M.sprite(name, x, y, opts)
  opts = opts or {}
  local s = assets.sprite(name, 2)
  if opts.bank then s = assets.swapped(s, opts.bank, 2) end
  local sc = opts.scale or 1
  local was = M.mode
  if opts.blend then M.blend(opts.blend) end
  assets.draw(s, opts.frame or 0, x, y, opts.angle or 0, opts.sx or sc, opts.sy or sc, opts.alpha or 1, opts.flip)
  if opts.blend then M.blend(was) end
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

-- Split text into lines of at most `width` pixels (at the given scale, in a font: nil is round_small), breaking at spaces. A word
-- longer than a line is cut.
function M.wrap(text, width, scale, font)
  local lines, line = {}, ""
  local fits = function(s) return M.any_width(font, s, scale) <= width end
  for word in tostring(text):gmatch("%S+") do
    while not fits(word) and #word > 1 do
      local n = #word - 1
      while n > 1 and not fits(word:sub(1, n)) do n = n - 1 end
      if line ~= "" then lines[#lines + 1] = line; line = "" end
      lines[#lines + 1] = word:sub(1, n); word = word:sub(n + 1)
    end
    local joined = line == "" and word or line .. " " .. word
    if line ~= "" and not fits(joined) then lines[#lines + 1] = line; line = word else line = joined end
  end
  if line ~= "" then lines[#lines + 1] = line end
  return lines
end

return M
