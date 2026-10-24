-- Button icons in text. Write {a}, {b}, {x}, {y}, {l}, {r}, {start}, {select}, {up}, {down}, {left}, {right} or {dpad} in anything
-- drawn as words (gs.draw.text, a layout's texts, gs.say, gs.ask, menus) and the button's picture shows in its place:
--   gs.draw.text("Press {a} to jump", 8, 8, "#ffffff")
-- An icon is as tall as the letters beside it: small fonts get small icons, tall fonts tall ones. The look is the game's button style,
-- chosen in game.lua (gs.game{ ..., buttons = "snes" }) or while it runs with gs.draw.buttons("mono"):
--   "gba" (grey, the default), "snes" (red A, yellow B, blue X, green Y), "nes" (red on black), "mono" (drawn in the text's own colour).
-- Braces around anything else stay as they are. The pictures are drawn here once (scripts/make-buttons.mjs holds the art) and made into
-- one picture per style and size the first time they are needed.
local art = require("gs.buttons_art")

local M = { style = "gba" }
local raw = gs.raw
local sheets, tinted = {}, {}

function M.set_style(name)
  if not art.styles[name] then
    local names = {}
    for k in pairs(art.styles) do names[#names + 1] = '"' .. k .. '"' end
    table.sort(names)
    error("there is no button style called '" .. tostring(name) .. "' (" .. table.concat(names, ", ") .. ")", 3)
  end
  M.style = name
end

local function rgba(hex)
  if not hex then return 0, 0, 0, 0 end
  local a = #hex == 9 and tonumber(hex:sub(8, 9), 16) or 255
  return tonumber(hex:sub(2, 3), 16), tonumber(hex:sub(4, 5), 16), tonumber(hex:sub(6, 7), 16), a
end

-- every icon of one style and size side by side in one picture, with where each starts
local function sheet(style, size)
  local key = style .. ":" .. size
  local s = sheets[key]
  if s then return s end
  local icons, colours = art.sizes[size].icons, art.styles[style].colours
  local w, h, at = 0, 0, {}
  for _, name in ipairs(art.order) do
    local ic = icons[name]
    at[name] = { x = w, w = ic.w, h = #ic.rows }
    w, h = w + ic.w, math.max(h, #ic.rows)
  end
  local bytes = {}
  for y = 1, h do
    local row = {}
    for _, name in ipairs(art.order) do
      local line, cs = icons[name].rows[y], colours[name]
      for x = 1, icons[name].w do
        local c = line and line:sub(x, x) or "."
        row[#row + 1] = string.char(rgba(c ~= "." and cs[c] or nil))
      end
    end
    bytes[y] = table.concat(row)
  end
  s = { img = raw.pixels(w, h, table.concat(bytes)), at = at, dy = art.sizes[size].dy }
  sheets[key] = s
  return s
end

-- the "mono" style in one colour: a copy of its sheet with every pixel that shows in that colour, made once per colour
local function in_colour(s, r, g, b)
  local key = s.img.id .. ":" .. r .. ":" .. g .. ":" .. b
  local img = tinted[key]
  if not img then img = raw.recolor(s.img, false, r * 65536 + g * 256 + b); tinted[key] = img end
  return img
end

M.names = {}
for _, n in ipairs(art.order) do M.names[n] = true end

-- the text cut into pieces: plain strings and { icon = name }; nil when it has no icons at all (the usual case, kept cheap)
function M.split(str)
  if not str:find("{", 1, true) then return nil end
  local parts, i, found = {}, 1, false
  while true do
    local s, e, name = str:find("{(%a+)}", i)
    if not s then break end
    if M.names[name] then
      if s > i then parts[#parts + 1] = str:sub(i, s - 1) end
      parts[#parts + 1] = { icon = name }
      found = true
      i = e + 1
    else
      if e + 1 > #str then break end
      parts[#parts + 1] = str:sub(i, e)
      i = e + 1
    end
  end
  if not found then return nil end
  if i <= #str then parts[#parts + 1] = str:sub(i) end
  return parts
end

-- small icons beside letters up to 10 rows tall, tall ones beside taller
function M.size_for(letter_h) return letter_h >= 11 and "tall" or "small" end
function M.width(name, size) return art.sizes[size].icons[name].w end
function M.tinted() return art.styles[M.style].tint end

-- one icon with its top-left corner at the text's top-left (it starts a row higher, to sit on the capitals); color is for "mono"
function M.draw(name, size, x, y, scale, r, g, b, a)
  local s = sheet(M.style, size)
  local at = s.at[name]
  local img = art.styles[M.style].tint and in_colour(s, r or 255, g or 255, b or 255) or s.img
  scale = scale or 1
  raw.tile(img, at.x, 0, at.w, at.h, math.floor(x), math.floor(y + s.dy * scale), scale, false, 0, scale, a or 255)
end

return M
