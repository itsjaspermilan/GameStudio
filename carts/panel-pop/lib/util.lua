-- util.lua: drawing helpers, sound helpers and the save file. Everything is plain Lua tables drawn
-- straight with gs.tile / gs.rect: boards hold hundreds of cells and engine instances would cost
-- far more.
local art = require "lib.art"
local ART, BG_COUNT, PAL = art.ART, art.BG_COUNT, art.PAL
local floor, max, min = math.floor, math.max, math.min
local SW, SH = 320, 240

local PP = { SW = SW, SH = SH }

local imgs = {}
local function image(path) local i = imgs[path]; if not i then i = gs.image(path); imgs[path] = i end; return i end
-- draws frame `f` of a sprite sheet (a strip) with its top left corner at x, y
local function frame(name, f, x, y, sc, flip, alpha, cw, ch)
  local a = ART[name]
  if not a then error("no sprite " .. tostring(name), 2) end
  local im = imgs[name]
  if not im then im = gs.image("sprites/" .. name .. ".png"); imgs[name] = im end
  local fw, fh = a.w, a.h
  gs.tile(im, (floor(f) % a.f) * fw, 0, cw or fw, ch or fh, floor(x), floor(y), sc or 1, flip or false, 0, sc or 1, alpha or 255)
end
-- centred on x, y
local function spr(name, f, x, y, sc, flip, alpha)
  local a = ART[name]
  frame(name, f, x - a.w * 0.5 * (sc or 1), y - a.h * 0.5 * (sc or 1), sc, flip, alpha)
end
local function rgb(i) local c = PAL[i + 1]; return c[1], c[2], c[3] end
local function txt(s, x, y, ci, sc)
  local r, g, b = rgb(ci or 3)
  gs.print(s, floor(x), floor(y), r, g, b, 255, sc or 1)
end
local function txtc(s, y, ci, sc) txt(s, (SW - #s * 8 * (sc or 1)) * 0.5, y, ci, sc) end
local function txtcx(s, cx, y, ci, sc) txt(s, cx - #s * 4 * (sc or 1), y, ci, sc) end
local function txtr(s, x, y, ci, sc) txt(s, x - #s * 8 * (sc or 1), y, ci, sc) end
-- text with a dark shadow
local function txts(s, x, y, ci, sc) txt(s, x + 1, y + 1, 0, sc); txt(s, x, y, ci, sc) end
local function box(x, y, w, h, fill, edge, alpha)
  local r, g, b = rgb(fill or 0)
  gs.rect(floor(x), floor(y), floor(w), floor(h), r, g, b, alpha or 255)
  if edge then
    local er, eg, eb = rgb(edge)
    gs.rect(x, y, w, 1, er, eg, eb); gs.rect(x, y + h - 1, w, 1, er, eg, eb); gs.rect(x, y, 1, h, er, eg, eb); gs.rect(x + w - 1, y, 1, h, er, eg, eb)
  end
end
-- a window: dark body, light edge, a soft shadow
local function window(x, y, w, h, edge, fill)
  box(x + 2, y + 2, w, h, 0, nil, 120)
  box(x, y, w, h, fill or 1, edge or 2)
  box(x + 1, y + 1, w - 2, 1, 3, nil, 60)
end
local function bar(x, y, w, h, v, vmax, fg, bg, edge)
  box(x, y, w, h, bg or 1, edge)
  local fw = floor((w - 2) * max(0, min(1, v / max(1, vmax))))
  if fw > 0 then box(x + 1, y + 1, fw, h - 2, fg) end
end
local function fmt_time(s) s = floor(s); return string.format("%d:%02d", s // 60, s % 60) end
local function commas(n)
  local s = tostring(floor(n)); local out = ""
  while #s > 3 do out = "," .. s:sub(-3) .. out; s = s:sub(1, -4) end
  return s .. out
end
PP.image, PP.frame, PP.spr, PP.rgb, PP.txt, PP.txtc, PP.txtcx, PP.txtr, PP.txts, PP.box, PP.window, PP.bar, PP.fmt_time, PP.commas =
  image, frame, spr, rgb, txt, txtc, txtcx, txtr, txts, box, window, bar, fmt_time, commas

-- a tiling background (one of the 8 tile pictures), drifting diagonally
function PP.background(i, t)
  local im = image("tilesets/ts_bg" .. ((i - 1) % BG_COUNT) .. ".png")
  local ox, oy = -((t * 0.25) % 64), -((t * 0.25) % 64)
  for ty = 0, 4 do for tx = 0, 5 do gs.tile(im, 0, 0, 64, 64, floor(ox + tx * 64), floor(oy + ty * 64)) end end
end

-- ---------------------------------------------------------------- sound
local music_now
function PP.music(name) if music_now ~= name then music_now = name; gs.music(name) end end
function PP.stop_music(ms) music_now = nil; gs.music_stop((ms or 300) / 1000) end
local sfx_last = {}
local frame_no = 0
function PP.tick() frame_no = frame_no + 1 end
function PP.sfx(name, gap)
  local last = sfx_last[name]
  if not last or frame_no - last >= (gap or 2) then sfx_last[name] = frame_no; gs.sfx(name) end
end

-- ---------------------------------------------------------------- save file: lines of key=value
local function default_save()
  return { endless = "0,0,0", time = "0,0,0", dmscore = "0,0,0", stage = 1, vsbeat = "0,0,0", puzzles = "", dmlevel = "0,0,0", vsdm = "0,0,0", sound = 1 }
end
function PP.load_game()
  local s = default_save()
  local text = gs.loadsave("panelpop_save")
  if text then for k, v in text:gmatch("([%w_]+)=([^\n]*)") do if s[k] ~= nil then s[k] = (type(s[k]) == "number") and (tonumber(v) or s[k]) or v end end end
  PP.save = s
end
function PP.save_game()
  local lines = {}
  for k, v in pairs(PP.save) do lines[#lines + 1] = k .. "=" .. tostring(v) end
  gs.save("panelpop_save", table.concat(lines, "\n"))
end
-- records are "a,b,c" strings, one number per difficulty
function PP.rec_get(key, i) local n = 0; for v in (PP.save[key] .. ","):gmatch("([^,]*),") do n = n + 1; if n == i then return tonumber(v) or 0 end end; return 0 end
function PP.rec_set(key, i, val)
  local t = {}; for k = 1, 3 do t[k] = PP.rec_get(key, k) end
  t[i] = val; PP.save[key] = table.concat(t, ","); PP.save_game()
end
-- true if val beat the old record (and stores it)
function PP.rec_best(key, i, val)
  if val > PP.rec_get(key, i) then PP.rec_set(key, i, val); return true end
  return false
end

-- ---------------------------------------------------------------- input
-- GS_KEYS="a,down,a,wait60,left" feeds scripted presses (one every GS_KEYGAP frames, default 8) in
-- place of the pad, for testing menus without a controller
local keys, key_i, key_t, key_now = {}, 0, 0, nil
for k in (os.getenv("GS_KEYS") or ""):gmatch("[^,]+") do keys[#keys + 1] = k end
local key_gap = tonumber(os.getenv("GS_KEYGAP") or "8") or 8
function PP.keys_tick()
  key_now = nil
  if #keys == 0 then return end
  key_t = key_t + 1
  if key_t >= key_gap then
    key_t = 0
    key_i = key_i + 1
    local k = keys[key_i]
    if k and k:sub(1, 4) == "wait" then key_t = -(tonumber(k:sub(5)) or 30) elseif k then key_now = k end
  end
end
function PP.pressed(n) if #keys > 0 then return key_now == n end return gs.input.pressed(n) end
function PP.held(n) if #keys > 0 then return key_now == n end return gs.input.held(n) end
return PP
