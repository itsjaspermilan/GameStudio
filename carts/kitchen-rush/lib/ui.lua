-- Drawing shared by every screen: the button badges (each button has one colour everywhere, so the
-- shelf, the stations and the How to play page all speak the same language), food icons, the
-- kitchen backdrop and small menus.
local art = require "lib.art"
local data = require "lib.data"

local M = {}
local d = gs.draw

M.INK = "#2d1a4f"          -- dark text on the paper tickets
M.PAPER = "#fff6a8"
M.PAPER_EDGE = "#c9a227"

-- face buttons are round and coloured (like a Super Famicom pad); the rest are grey pills
M.BUTTON = {
  A = { fill = "#b0293a", lit = "#ea5a4b" },
  B = { fill = "#c9a227", lit = "#f5d94a" },
  X = { fill = "#2a56c4", lit = "#4f9bf0" },
  Y = { fill = "#2f8a3f", lit = "#6ccf4f" },
}

-- A badge for a button, its top-left at x, y. Returns its width. `lit` draws it pressed in
-- (brighter).
function M.button(name, x, y, lit)
  local b = M.BUTTON[name]
  if b then
    d.circle(x + 5, y + 5, 6, "#000000")
    d.circle(x + 5, y + 5, 5, lit and b.lit or b.fill)
    d.text(name, x + 2, y + 2, lit and "#000000" or "#ffffff")
    return 12
  end
  local w = d.text_width(name) + 6
  d.rect(x, y - 1, w, 12, "#000000")
  d.rect(x + 1, y, w - 2, 10, lit and "#d9b3ff" or "#8a90a8")
  d.text(name, x + 3, y + 2, lit and "#000000" or "#14234f")
  return w
end

-- A small D-pad with one arm lit, for the foods on the D-pad. Its top-left at x, y; 11 pixels
-- across.
local ARM = { up = { 4, 0 }, down = { 4, 8 }, left = { 0, 4 }, right = { 8, 4 } }
function M.dpad(dir, x, y, lit)
  d.rect(x + 3, y - 1, 5, 13, "#000000"); d.rect(x - 1, y + 3, 13, 5, "#000000")
  d.rect(x + 4, y, 3, 11, "#3b3f55"); d.rect(x, y + 4, 11, 3, "#3b3f55")
  local a = ARM[dir]
  d.rect(x + a[1], y + a[2], 3, 3, lit and "#ffffff" or "#f5d94a")
end

-- The icon of an ingredient as it is on a plate (cooked, chopped), or raw as it is on the shelf.
function M.food(id, x, y, raw, opts)
  local f = (not raw and art.FOOD[id .. "_ready"]) or art.FOOD[id]
  if opts then opts.frame = f; d.sprite("spr_food", x, y, opts) else d.sprite("spr_food", x, y, { frame = f }) end
end

-- The kitchen: tiled wall, a dark band behind the ticket rail, the steel counter and its wooden
-- front.
function M.backdrop()
  local T, rows = art.TILE, {}
  for r = 1, 15 do
    rows[r] = {}
    for c = 1, 20 do
      local t
      if r <= 5 then t = T.dark
      elseif r == 12 then t = T.counter
      elseif r > 12 then t = T.front
      else t = (r + c) % 2 == 0 and T.wall_a or T.wall_b end
      rows[r][c] = t
    end
  end
  gs.add_layer{ tileset = "ts_kitchen", data = rows, depth = 100 }
end

-- A box with a dark border and a lighter top edge.
function M.box(x, y, w, h, fill, edge)
  d.rect(x, y, w, h, "#000000")
  d.rect(x + 1, y + 1, w - 2, h - 2, fill or "#3b3f55")
  d.rect(x + 1, y + 1, w - 2, 1, edge or "#8a90a8")
end

-- Text with a one-pixel shadow, for anything over the busy kitchen.
function M.shadow(str, x, y, color, scale)
  d.text(str, x + 1, y + 1, "#000000", scale)
  d.text(str, x, y, color or "#ffffff", scale)
end
function M.shadow_centered(str, y, color, scale)
  local w = d.text_width(str, scale)
  M.shadow(str, math.floor(160 - w / 2), y, color, scale)
end

-- A vertical list of choices drawn as rows; `cur` is the picked one. Returns nothing; the scene
-- handles the buttons.
function M.rows(items, cur, x, y, w, enabled)
  for i, label in ipairs(items) do
    local yy = y + (i - 1) * 16
    local on = i == cur
    local ok = not enabled or enabled[i]
    if on then M.box(x, yy, w, 14, "#2a56c4", "#a8d4ff") end
    d.text(label, x + 10, yy + 3, not ok and "#3b3f55" or on and "#ffffff" or "#a8d4ff")
    if on then d.text(">", x + 2, yy + 3, "#f5d94a") end
  end
end

-- m:ss
function M.clock(secs)
  secs = math.max(0, math.ceil(secs))
  return string.format("%d:%02d", secs // 60, secs % 60)
end

-- The foods of a dish as a row of icons.
function M.recipe(dish, x, y)
  for i, id in ipairs(dish.items) do M.food(id, x + (i - 1) * 18, y) end
end

return M
