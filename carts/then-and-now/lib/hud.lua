-- The HUD: hearts, the Static bar, which era the Lens shows, the boss's health, a message line, and
-- what high Static does to the screen (Then's scan lines, noise, whispers, hearts that lie). Also
-- the map, used by the quick map (Select) and the pause menu.
local state = require "lib.state"
local lens = require "lib.lens"
local world = require "lib.world"
local talk = require "lib.talk"

local M = {}

local WHISPERS = { "COUNT THE JACKETS", "STAY", "WREN?", "ANY MINUTE NOW", "YOU'VE BEEN HERE", "SEVEN", "DON'T LOOK BACK", "IT KNOWS" }

-- a heart, 9x8, from rectangles; full or an empty outline
function M.heart(x, y, full)
  local c = full and "#ea5a4b" or "#3b3f55"
  gs.draw.rect(x + 1, y, 3, 1, c); gs.draw.rect(x + 5, y, 3, 1, c)
  gs.draw.rect(x, y + 1, 9, 3, c); gs.draw.rect(x + 1, y + 4, 7, 1, c)
  gs.draw.rect(x + 2, y + 5, 5, 1, c); gs.draw.rect(x + 3, y + 6, 3, 1, c); gs.draw.rect(x + 4, y + 7, 1, 1, c)
  if full then gs.draw.rect(x + 1, y + 1, 2, 1, "#ffa38c") end
end

function M.draw(scene)
  local d, t = state.data, scene.t or 0
  local u = lens.unease()

  -- Then: faint scan lines, the look of a memory
  if lens.era == "then" then
    for y = (math.floor(t * 30) % 4), 239, 4 do gs.draw.rect(0, y, 320, 1, "#a6f4e60c") end
  end
  -- high Static: noise, the screen's edges going dark, whispers
  if u > 0 then
    for _ = 1, math.floor(u * 30) do
      gs.draw.rect(gs.random(0, 319), gs.random(0, 239), gs.random(1, 6), 1, gs.choose("#ffffff40", "#a56be060", "#00000080"))
    end
    local edge = math.floor(u * 22)
    gs.draw.rect(0, 0, 320, edge, "#000000a0"); gs.draw.rect(0, 240 - edge, 320, edge, "#000000a0")
    if math.floor(t * 1.5) % 3 == 0 and not talk.busy then
      local w = WHISPERS[math.floor(t * 1.5 / 3) % #WHISPERS + 1]
      local seed = math.floor(t * 1.5 / 3)
      gs.draw.text(w, 20 + (seed * 53) % 200, 40 + (seed * 37) % 140, { 165, 107, 224, math.floor(80 + u * 120) })
    end
  end

  -- hearts (at high Static they sometimes lie)
  local shown = d.hp
  if u > 0.5 and math.floor(t * 2) % 5 == 0 then shown = (d.hp + math.floor(t * 7)) % (d.hp_max + 1) end
  for i = 1, d.hp_max do M.heart(6 + (i - 1) * 11, 6, i <= shown) end

  -- Static and the era
  if d.has.lens then
    local w = math.floor(d.static_max * 0.6)
    local f = d.static / d.static_max
    local col = f < 0.5 and "#45d1c5" or f < 0.8 and "#a56be0" or "#ea5a4b"
    gs.draw.rect(6, 18, w + 2, 5, "#0b1020")
    gs.draw.rect(7, 19, math.floor(w * f), 3, col)
    if lens.overload_t > 0 and math.floor(t * 10) % 2 == 0 then gs.draw.rect(6, 18, w + 2, 5, "#ffffff80") end
    local era = lens.era == "then" and "THEN" or "NOW"
    gs.draw.text_right(era, 314, 6, lens.era == "then" and "#a6f4e6" or "#8a90a8")
    if scene.info.lens_lock and lens.blocked then gs.draw.text_right("NO FOCUS", 314, 16, "#ea5a4b") end
  end
  if d.has.missile then gs.draw.text(string.format("M%02d", d.missiles), 6, 26, "#ffa38c") end

  -- the boss's health
  local b = scene.boss
  if b and b:is_alive() and not b.dying then
    gs.draw.rect(59, 225, 202, 7, "#0b1020")
    gs.draw.rect(60, 226, math.floor(200 * b.hp / b.hp_max), 5, lens.era == "then" and "#a6f4e6" or "#8a90a8")
    gs.draw.text_centered("LAST LAUNCH", 214, "#ffffff")
  end

  -- the message line
  if state.note and not talk.busy then
    local w = gs.draw.text_width(state.note) + 12
    local y = b and 36 or 220
    gs.draw.rect(160 - w / 2, y - 4, w, 16, "#000000c0")
    gs.draw.text_centered(state.note, y, "#ffffff")
  end

  -- a flip washes the screen
  if lens.flash > 0 then
    local c = lens.era == "then" and { 166, 244, 230 } or { 255, 255, 255 }
    gs.draw.rect(0, 0, 320, 240, { c[1], c[2], c[3], math.floor(lens.flash * 110) })
  end
end

-- The map of the biome: every room seen as a box (8x6 pixels a screen), the current one blinking,
-- terminals marked.
function M.map(x0, y0, here, t, cell_w, cell_h)
  cell_w, cell_h = cell_w or 8, cell_h or 6
  local d = state.data
  local minx, miny = 99, 99
  for _, r in pairs(world.rooms) do minx, miny = math.min(minx, r.mx), math.min(miny, r.my) end
  for id, r in pairs(world.rooms) do
    if d.seen[id] then
      local x, y = x0 + (r.mx - minx) * cell_w, y0 + (r.my - miny) * cell_h
      local w, h = r.w * cell_w - 1, r.h * cell_h - 1
      local col = id == here and (math.floor(t * 3) % 2 == 0 and "#ffffff" or "#45d1c5") or r.hub and "#e8913a" or "#1f8a96"
      gs.draw.rect(x, y, w, h, col)
      gs.draw.frame(x, y, w, h, "#0b1020")
      if id == d.save_room then gs.draw.rect(x + 2, y + 2, 2, 2, "#f5d94a") end
    end
  end
end

function M.minimap(scene)
  local w, h = 13 * 8 + 8, 4 * 6 + 8
  local x0 = 320 - w - 6
  gs.draw.rect(x0, 26, w, h, "#0b1020d0")
  gs.draw.frame(x0, 26, w, h, "#45d1c5")
  M.map(x0 + 4, 30, scene.room_id, scene.t or 0)
end

return M
