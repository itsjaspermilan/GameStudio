-- The How to play page: the two button diamonds as they are in the kitchen, and what L, R and Start
-- do. The How to play screen draws it, and so does the kitchen from the pause menu (so looking it
-- up never loses the day).
local ui = require "lib.ui"
local data = require "lib.data"

local d = gs.draw
local M = {}

-- a diamond of foods around a centre, each with its button
local function diamond(cx, cy, buttons)
  for _, b in ipairs(buttons) do
    local dx = (b[2] == "left" or b[2] == "y") and -28 or (b[2] == "right" or b[2] == "a") and 28 or 0
    local dy = (b[2] == "up" or b[2] == "x") and -20 or (b[2] == "down" or b[2] == "b") and 20 or 0
    local food = data.BY_BUTTON[b[2]]
    ui.food(food.id, cx + dx - 8, cy + dy - 8)
    if ui.BUTTON[b[1]] then ui.button(b[1], cx + dx + 6, cy + dy + 2) else ui.dpad(b[2], cx + dx + 6, cy + dy + 2) end
  end
end

function M.draw(footer)
  ui.box(6, 4, 308, 232, "#14234f", "#4f9bf0")
  ui.shadow_centered("How to cook", 10, "#f5d94a", 2)
  d.text_centered("The food sits where its button is.", 30, "#ffffff")
  d.text_centered("Press it to put it on the plate.", 40, "#ffffff")
  diamond(80, 88, { { "", "up" }, { "", "left" }, { "", "right" }, { "", "down" } })
  diamond(240, 88, { { "X", "x" }, { "Y", "y" }, { "A", "a" }, { "B", "b" } })
  d.text("D-pad", 60, 122, "#a8d4ff")
  d.text("buttons", 212, 122, "#a8d4ff")
  -- a worked example
  d.text("Cheesy =", 40, 144, "#ffd08a")
  local x = 112
  for i, id in ipairs(data.DISHES.cheesy.items) do
    ui.food(id, x, 140)
    ui.button(data.FOOD[id].button:upper(), x + 18, 142)
    x = x + 36
    if i < 3 then d.text("+", x - 6, 144, "#ffffff") end
  end
  local rows = { { "R", "serve the plate" }, { "L", "throw the plate away" }, { "Start", "pause" } }
  for i, r in ipairs(rows) do
    local y = 166 + (i - 1) * 16
    ui.button(r[1], 60, y)
    d.text(r[2], 110, y + 2, "#ffffff")
  end
  d.text_centered("New foods join the D-pad day by day.", 214, "#8a90a8")
  d.text_centered(footer, 226, "#a8d4ff")
end

return M
