-- How to play: three short pages (title and line1..line8 in the layout) with a small moving picture
-- at the bottom of each.
local ui = require "lib.ui"
local frame = ui.frame

local PAGES = {
  { title = "The Basics", lines = { "Move the cursor with the D-pad.", "A swaps the two panels in it.", "Line up 3 or more alike, across or down, and they pop.", "The stack keeps rising: keep it off the top! Hold B to raise it yourself." } },
  { title = "Chains and Combos", lines = { "Pop 4 or more at once for a combo.", "When panels fall and match again, that is a chain.", "Big combos and chains score far more." } },
  { title = "Garbage", lines = { "In Vs, combos and chains drop garbage blocks on your rival.", "Pop panels touching a block to break it into panels.", "Stage Clear: break every block to win." } },
}

local Howto = gs.scene{}

function Howto:enter()
  self.page, self.tick = 1, 0
  self:show()
end

function Howto:show()
  local p = PAGES[self.page]
  self.title.text = p.title
  self.page_no.text = self.page .. "/" .. #PAGES
  local lines = {}
  for _, s in ipairs(p.lines) do
    for _, l in ipairs(gs.draw.wrap(s, 272, 1, "round_tall")) do lines[#lines + 1] = l end
  end
  ui.lines(self, "line", lines)
end

function Howto:update(dt)
  ui.tick()
  self.tick = self.tick + 1
  ui.drift(self.tick)
  local n = #PAGES
  if ui.pressed("left") then self.page = (self.page - 2) % n + 1; ui.sfx("select", 1); self:show() end
  if ui.pressed("right") or ui.pressed("a") then self.page = self.page % n + 1; ui.sfx("select", 1); self:show() end
  if ui.pressed("b") then ui.sfx("back", 1); gs.goto_scene("scenes.menu") end
end

-- the picture at the bottom of the window (y 168 to 208)
function Howto:draw()
  local t, y = self.tick, 180
  if self.page == 1 then
    -- swap the star and the last heart: three hearts in a row
    local phase = (t // 40) % 3
    frame("spr_panels", 0, 60, y); frame("spr_panels", 0, 76, y)
    if phase == 0 then frame("spr_panels", 6, 92, y); frame("spr_panels", 0, 108, y)
    else frame("spr_panels", phase == 1 and 0 or 2, 92, y); frame("spr_panels", 6, 108, y) end
    if phase == 2 then frame("spr_panels", 2, 60, y); frame("spr_panels", 2, 76, y) end
    frame("spr_cursor", (t // 16) % 2, 88, y - 4)
    ui.text("A", 150, y + 4, ui.CORAL)
    ui.text(">", 166, y + 4, ui.INK)
    for c = 0, 2 do frame("spr_panels", 3, 190 + c * 16, y) end
  elseif self.page == 2 then
    for c = 0, 3 do frame("spr_panels", 18 + ((t // 6 + c) % 2) * 2, 64 + c * 16, y) end
    ui.text("Combo 4", 96, y - 12, ui.CORAL, "center")
    frame("spr_panels", 12, 190, y - 16); frame("spr_panels", 12, 190, y); frame("spr_panels", 6, 206, y)
    ui.text("Chain x2", 214, y - 28, ui.CORAL, "center")
  else
    for c = 0, 3 do frame("spr_garbage", 9 + (c == 0 and 0 or c == 3 and 2 or 1), 72 + c * 16, y) end
    frame("spr_garbage", 12, 88, y)
    for c = 0, 3 do frame("spr_garbage", 14 + 9 + (c == 0 and 0 or c == 3 and 2 or 1), 168 + c * 16, y) end
    frame("spr_garbage", 14 + 12, 184, y)
  end
end

return Howto
