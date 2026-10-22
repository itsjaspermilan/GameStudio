-- ui.lua: what every screen shares: drawing sprite frames and text in the game's fonts, the
-- drifting sky, menu rows, sound and the buttons.
-- Boards hold hundreds of cells, so they are drawn straight from tables with gs.tile, not as
-- entities; everything else on a screen is in its layout (scenes/<name>.layout.lua).
local art = require "lib.art"
local ART, UI = art.ART, art.UI
local floor = math.floor

local M = { SW = 320, SH = 240, UI = UI }
-- the fonts (sprites, a frame a letter): dark and coral on the white windows, white and gold on
-- colour and on the dark board wells
M.INK, M.CORAL, M.WHITE, M.GOLD = "spr_font", "spr_font_r", "spr_font_w", "spr_font_y"

-- ---------------------------------------------------------------- drawing
local imgs = {}
-- frame `f` of a sprite sheet (a strip) with its top-left corner at x, y
function M.frame(name, f, x, y, sc, flip, alpha)
  local a = ART[name]
  if not a then error("no sprite " .. tostring(name), 2) end
  local im = imgs[name]
  if not im then im = gs.image("sprites/" .. name .. ".png"); imgs[name] = im end
  gs.tile(im, (floor(f) % a.f) * a.w, 0, a.w, a.h, floor(x), floor(y), sc or 1, flip or false, 0, sc or 1, alpha or 255)
end
-- the same, centred on x, y
function M.spr(name, f, x, y, sc, flip, alpha)
  local a = ART[name]
  M.frame(name, f, x - a.w * 0.5 * (sc or 1), y - a.h * 0.5 * (sc or 1), sc, flip, alpha)
end
-- text in one of the fonts; align is "left" (default), "center" or "right"
function M.text(s, x, y, font, align, sc)
  s = tostring(s)
  local w = #s * 8 * (sc or 1)
  if align == "center" then x = x - w / 2 elseif align == "right" then x = x - w end
  gs.draw.font_text(font or M.INK, s, floor(x), floor(y), sc)
end

-- ---------------------------------------------------------------- the sky: every layout has a
-- tile layer named "sky" made of one 4x4-tile pattern of ts_sky that repeats
-- picks pattern i (1 to #art.SKIES) for the layer
function M.sky(i)
  local layer = gs.layer("sky")
  if not layer then return end
  i = (i - 1) % #art.SKIES
  local first = (i // 4) * 64 + (i % 4) * 4
  for r = 0, 3 do for c = 0, 3 do gs.set_tile(layer, layer.x + c * 16, layer.y + r * 16, first + r * 16 + c) end end
end
-- slides it diagonally, a pixel every four steps
function M.drift(tick)
  local layer = gs.layer("sky")
  if layer then layer.x, layer.y = -floor(tick / 4) % 64 - 64, -floor(tick / 4) % 64 - 64 end
end

-- ---------------------------------------------------------------- menus
-- a menu row is a layout panel: the chosen one is drawn with the "selected" block of ts_ui
function M.mark(panel, on, normal)
  if panel then panel.tile = on and UI.selected or (normal or UI.window) end
end
-- up and down move a cursor over n rows (wrapping round)
function M.move(i, n)
  if M.pressed("up") then M.sfx("select", 1); return (i - 2) % n + 1 end
  if M.pressed("down") then M.sfx("select", 1); return i % n + 1 end
  return i
end
-- words broken into lines of at most n letters
function M.wrap(s, n)
  local lines, line = {}, ""
  for word in s:gmatch("%S+") do
    if #line + #word + (line == "" and 0 or 1) > n then lines[#lines + 1] = line; line = word else line = (line == "" and "" or line .. " ") .. word end
  end
  if line ~= "" then lines[#lines + 1] = line end
  return lines
end
-- fills texts self[prefix .. 1], self[prefix .. 2], ... with lines, blanking the rest
function M.lines(scene, prefix, lines)
  local i = 1
  while scene[prefix .. i] do scene[prefix .. i].text = lines[i] or ""; i = i + 1 end
end

function M.fmt_time(s) s = floor(s); return string.format("%d:%02d", s // 60, s % 60) end
function M.commas(n)
  local s = tostring(floor(n)); local out = ""
  while #s > 3 do out = "," .. s:sub(-3) .. out; s = s:sub(1, -4) end
  return s .. out
end

-- ---------------------------------------------------------------- sound
local music_now
-- a song keeps playing when the next screen asks for the same one
function M.music(name) if music_now ~= name then music_now = name; gs.music(name) end end
function M.stop_music(ms) music_now = nil; gs.music_stop((ms or 300) / 1000) end
local sfx_last = {}
local frame_no = 0
-- a sound plays at most once every `gap` steps (eight panels popping at once are one pop)
function M.sfx(name, gap)
  local last = sfx_last[name]
  if not last or frame_no - last >= (gap or 2) then sfx_last[name] = frame_no; gs.sfx(name) end
end

-- ---------------------------------------------------------------- buttons
-- (tests press them with GS_BOT_LUA=tests/keys-bot.lua GS_KEYS="a,wait*30,down,a")
-- once a step, from every scene's update
function M.tick() frame_no = frame_no + 1 end
M.pressed, M.held = gs.input.pressed, gs.input.held
-- A or Start: the "go on" buttons
function M.ok() return gs.input.pressed("a") or gs.input.pressed("start") end
return M
