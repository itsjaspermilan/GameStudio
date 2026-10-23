-- Assets: sprites and tilesets (and the tile layers of a level). Everything is looked up by file name, without the extension:
--   sprites/<name>.json + .png   {image, frames, origin = {x, y}, mask = {x, y, w, h}, fps, animations = {name = {from, to, fps, loop}}}
--   tilesets/<name>.json + .png  {image, tile_w, tile_h}
--   palette.json                 {sprites = {{name, colors = {"#rrggbb" x 15}}, ...}, tiles = {...}}: the game's colour banks (GBA style). Place 0 of a
--                                bank is see-through, so `colors` holds places 1 to 15. A sprite names its bank ({bank = "hero"}), a tileset its banks.
-- The folder IS the list: there is no index file. Sprites and tilesets load the first time they are asked for (or all at once with preload()).
local json = require("gs.json")

local M = { sprites = {}, tilesets = {}, fresh = false, banks = nil } -- fresh: re-read picture files (set while live-reloading)

local function read_json(path)
  local text = gs.load(path)
  if not text then return nil end
  local ok, res = pcall(json.decode, text)
  if not ok then error(path .. ": " .. tostring(res), 0) end
  return res
end

-- A sprite is a strip of frames side by side. Its origin is the point that sits on the entity's position (default: the middle).
function M.sprite(name, level)
  local s = M.sprites[name]
  if s then return s end
  local d = read_json("sprites/" .. name .. ".json")
  if not d then error("unknown sprite '" .. tostring(name) .. "' (looked for sprites/" .. tostring(name) .. ".json)", (level or 1) + 1) end
  local img = gs.image(d.image or ("sprites/" .. name .. ".png"), M.fresh)
  local frames = d.frames or 1
  local fw, fh = img.w // frames, img.h
  local o = d.origin
  s = { name = name, img = img, frames = frames, fw = fw, fh = fh, ox = o and o[1] or fw // 2, oy = o and o[2] or fh // 2,
    mask = d.mask or { 0, 0, fw, fh }, fps = d.fps or 0, anims = d.animations or {}, bank = d.bank, swaps = {} }
  M.sprites[name] = s
  return s
end

function M.tileset(name, level)
  local t = M.tilesets[name]
  if t then return t end
  local d = read_json("tilesets/" .. name .. ".json")
  if not d then error("unknown tileset '" .. tostring(name) .. "' (looked for tilesets/" .. tostring(name) .. ".json)", (level or 1) + 1) end
  local img = gs.image(d.image or ("tilesets/" .. name .. ".png"), M.fresh)
  local tw, th = d.tile_w or 16, d.tile_h or 16
  local cols, rows = img.w // tw, img.h // th
  t = { name = name, img = img, tw = tw, th = th, cols = cols, rows = rows, count = cols * rows, banks = d.banks }
  M.tilesets[name] = t
  return t
end

-- Load every sprite and tileset now, so nothing hitches the first time it is drawn. Returns how many there were.
function M.preload()
  local n = 0
  for _, path in ipairs(gs.list("sprites")) do
    local name = path:match("^sprites/(.+)%.json$") -- in folders too: "ui/logo"
    if name then M.sprite(name); n = n + 1 end
  end
  for _, path in ipairs(gs.list("tilesets")) do
    local name = path:match("^tilesets/(.+)%.json$")
    if name then M.tileset(name); n = n + 1 end
  end
  return n
end

-- Forget a sprite or tileset so the next use reads the files again (live reload); "palette" forgets the banks and every palette swap.
local swap_pictures = {} -- by sprite and bank, so a swap made again (live reload) reuses its picture slot
function M.forget(kind, name)
  if kind == "sprites" then M.sprites[name] = nil elseif kind == "tilesets" then M.tilesets[name] = nil
  elseif kind == "palette" then
    M.banks = nil
    for _, s in pairs(M.sprites) do s.swaps = {} end
  end
end

-- ---------------------------------------------------------------- colour banks
-- The game's banks by name: {colors = {{r, g, b}, ...}, hex = {0xRRGGBB, ...}} with places 1 to 15. Sprite and tile banks share one set of names.
-- A game without palette.json has none (it uses the console's classic colours).
local function rgb_of(hex)
  local h = type(hex) == "string" and hex:match("^#(%x%x%x%x%x%x)$")
  if not h then return nil end
  return { tonumber(h:sub(1, 2), 16), tonumber(h:sub(3, 4), 16), tonumber(h:sub(5, 6), 16) }
end
function M.all_banks()
  if M.banks then return M.banks end
  local banks, d = {}, read_json("palette.json")
  for _, list in ipairs({ d and d.sprites or {}, d and d.tiles or {} }) do
    for _, b in ipairs(list) do
      if type(b.name) == "string" and not banks[b.name] then
        local colors, hex = {}, {}
        for i, c in ipairs(b.colors or {}) do
          local v = rgb_of(c) or { 0, 0, 0 }
          colors[i], hex[i] = v, (v[1] << 16) | (v[2] << 8) | v[3]
        end
        banks[b.name] = { name = b.name, colors = colors, hex = hex }
      end
    end
  end
  M.banks = banks
  return banks
end
function M.bank(name, level)
  local b = M.all_banks()[name]
  if not b then error("unknown colour bank '" .. tostring(name) .. "' (palette.json has no bank of that name)", (level or 1) + 1) end
  return b
end

-- The sprite drawn with another bank's colours, place for place (a palette swap: red and blue soldiers from one drawing). The sprite must name
-- its own bank, so its places are known. The copy is made the first time and kept.
function M.swapped(s, bank, level)
  if bank == nil or bank == s.bank then return s end
  local v = s.swaps[bank]
  if v then return v end
  if not s.bank then error("sprite '" .. s.name .. "' has no colour bank of its own, so it cannot be drawn with bank '" .. tostring(bank) .. "'", (level or 1) + 1) end
  local from, to = M.bank(s.bank, (level or 1) + 1), M.bank(bank, (level or 1) + 1)
  local key = s.name .. "@" .. bank
  local img = gs.recolor(s.img, from.hex, to.hex, swap_pictures[key])
  swap_pictures[key] = img
  v = setmetatable({ img = img }, { __index = s })
  s.swaps[bank] = v
  return v
end

-- Draw one frame of a sprite with its origin at (x, y). angle is degrees clockwise; sx, sy scale (negative mirrors); alpha is 0 to 1.
local tile, floor = gs.tile, math.floor -- (gs.tile, like gs.image / gs.load / gs.list, is never replaced by the framework)
function M.draw(s, frame, x, y, angle, sx, sy, alpha, flip)
  local fw = s.fw
  tile(s.img, (floor(frame) % s.frames) * fw, 0, fw, s.fh, floor(x - s.ox + 0.5), floor(y - s.oy + 0.5), sx, flip or false, angle, sy, alpha * 255, s.ox, s.oy)
end

-- ---------------------------------------------------------------- tile layers
-- A layer is {tileset, cell = {w, h}, data = {{tile, ...}, ...} (rows of tile numbers from 0, -1 for empty), depth, scroll_x, scroll_y,
-- wrap_x, wrap_y, visible}. It is drawn from one composed picture (gs.compose) rather than tile by tile; set_tile marks it for composing again.
local use_pictures = not os.getenv("GS_NO_LAYER_PICTURES") -- (the tests compare drawing tile by tile with drawing the picture)
local pictures = {} -- by layer key, so a layer that is made again reuses its picture slot

function M.make_layer(spec)
  local ts = M.tileset(spec.tileset, 2)
  local data = {}
  for r, row in ipairs(spec.data or {}) do
    local nr = {}
    for c, v in ipairs(row) do nr[c] = v end
    data[r] = nr
  end
  return {
    name = spec.name, key = tostring(spec.name or "") .. ":" .. tostring(spec.tileset), tileset = spec.tileset, ts = ts,
    cell = spec.cell or { ts.tw, ts.th }, data = data, depth = spec.depth or 100, visible = spec.visible ~= false,
    scroll_x = spec.scroll_x or 1, scroll_y = spec.scroll_y or 1, wrap_x = spec.wrap_x == true, wrap_y = spec.wrap_y == true,
    solid = spec.solid, dirty = true,
    x = spec.x or 0, y = spec.y or 0, -- where the layer's top-left corner is in the world: change them to slide a layer (a drifting sky)
  }
end

local function picture(l, cols, rows)
  if l.picture and not l.dirty then return l.picture end
  local ts, cw, ch = l.ts, l.cell[1], l.cell[2]
  if ts.tw ~= cw or ts.th ~= ch then return nil end
  local pic = gs.compose(ts.img, ts.tw, ts.th, ts.cols, ts.count, cw, ch, cols, rows, l.data, pictures[l.key])
  pictures[l.key] = pic
  l.picture, l.dirty = pic, false
  return pic
end

-- Draw a layer for a camera at (cam_x, cam_y) and a screen of view_w x view_h. Leaves the raw camera at the layer's own offset.
function M.draw_layer(l, cam_x, cam_y, view_w, view_h)
  local ts = l.ts
  local rows = #l.data
  if rows == 0 then return end
  local cols = 0
  for _, row in ipairs(l.data) do if #row > cols then cols = #row end end
  if cols == 0 then return end
  local ex, ey = floor(cam_x * l.scroll_x - l.x + 0.5), floor(cam_y * l.scroll_y - l.y + 0.5)
  gs.raw.camera(ex, ey)
  local cw, ch = l.cell[1], l.cell[2]
  local pic = use_pictures and picture(l, cols, rows)
  if pic then
    local W, H = cols * cw, rows * ch
    local kx0, kx1, ky0, ky1 = 0, 0, 0, 0
    if l.wrap_x then kx0, kx1 = floor(ex / W), floor((ex + view_w - 1) / W) end
    if l.wrap_y then ky0, ky1 = floor(ey / H), floor((ey + view_h - 1) / H) end
    for ky = ky0, ky1 do
      for kx = kx0, kx1 do
        local ox, oy = kx * W, ky * H
        local x0, y0 = math.max(ex, ox), math.max(ey, oy)
        local x1, y1 = math.min(ex + view_w, ox + W), math.min(ey + view_h, oy + H)
        if x1 > x0 and y1 > y0 then gs.tile(pic, x0 - ox, y0 - oy, x1 - x0, y1 - y0, x0, y0) end
      end
    end
    return
  end
  local c0, c1 = floor(ex / cw), floor((ex + view_w - 1) / cw)
  local r0, r1 = floor(ey / ch), floor((ey + view_h - 1) / ch)
  if not l.wrap_x then c0, c1 = math.max(c0, 0), math.min(c1, cols - 1) end
  if not l.wrap_y then r0, r1 = math.max(r0, 0), math.min(r1, rows - 1) end
  for r = r0, r1 do
    local row = l.data[(r % rows) + 1]
    if row then
      for c = c0, c1 do
        local f = row[(c % cols) + 1]
        if f and f >= 0 and f < ts.count then
          gs.tile(ts.img, (f % ts.cols) * ts.tw, (f // ts.cols) * ts.th, ts.tw, ts.th, c * cw, r * ch)
        end
      end
    end
  end
end

-- The tile at a world position (nil outside the layer), and changing it.
function M.tile_at(l, x, y)
  local row = l.data[floor((y - l.y) / l.cell[2]) + 1]
  return row and row[floor((x - l.x) / l.cell[1]) + 1]
end
function M.set_tile(l, x, y, v)
  local r, c = floor((y - l.y) / l.cell[2]) + 1, floor((x - l.x) / l.cell[1]) + 1
  if l.data[r] and l.data[r][c] ~= nil then l.data[r][c] = v; l.dirty = true end
end

return M
