-- Choosing a puzzle: a page of 25 (cell1..cell25 with num1..num25 in the layout), a star on the
-- solved ones and a dot per swap on the rest, and the chosen puzzle's board in the window on the
-- right.
local ui = require "lib.ui"
local save = require "lib.save"
local PUZZLES = require "lib.puzzles"
local BOARD = require "lib.board"
local max = math.max

local FADE = { fade = 0.2 }

local Puzzles = gs.scene{}
local cur = 1 -- kept between visits

function Puzzles:enter()
  self.tick = 0
  self.done = save.solved()
  self.solved.text = save.solved_count() .. "/" .. #PUZZLES .. " SOLVED"
  ui.music("msc_menu")
  self:show()
end

-- the first puzzle on the page: pages move a row at a time to keep the chosen one in view
function Puzzles:first()
  return max(0, ((cur - 1) // 5) - 4) * 5
end

function Puzzles:show()
  local first = self:first()
  for k = 1, 25 do
    local i = first + k
    local cell, num = self["cell" .. k], self["num" .. k]
    cell.visible, num.visible = PUZZLES[i] ~= nil, PUZZLES[i] ~= nil
    num.text = tostring(i)
    ui.mark(cell, i == cur, self.done[i] and ui.UI.mint or ui.UI.window)
  end
  local P = PUZZLES[cur]
  self.swaps.text = P.moves .. " SWAP" .. (P.moves > 1 and "S" or "")
end

function Puzzles:update(dt)
  ui.tick()
  self.tick = self.tick + 1
  ui.drift(self.tick)
  local n, was = #PUZZLES, cur
  if ui.pressed("left") then cur = (cur - 2) % n + 1 end
  if ui.pressed("right") then cur = cur % n + 1 end
  if ui.pressed("up") and cur - 5 >= 1 then cur = cur - 5 end
  if ui.pressed("down") and cur + 5 <= n then cur = cur + 5 end
  if cur ~= was then ui.sfx("select", 1); self:show() end
  if ui.pressed("b") then ui.sfx("back", 1); gs.goto_scene("scenes.menu") end
  if ui.pressed("a") then ui.sfx("ok", 1); ui.stop_music(100); gs.goto_scene("scenes.play", FADE, "puzzle", { puzzle = cur }) end
end

function Puzzles:draw()
  local first = self:first()
  for k = 1, 25 do
    local i = first + k
    local P = PUZZLES[i]
    if P then
      local cell = self["cell" .. k]
      local cx, y = cell.x + 20, cell.y + 22
      if self.done[i] then ui.frame("spr_ico_star", (self.tick // 20 + i) % 2, cx - 4, y - 1)
      else for d = 1, P.moves do gs.draw.rect(cx - P.moves * 4 + (d - 1) * 8 + 1, y, 6, 4, i == cur and 9 or 25) end end
    end
  end
  -- the chosen puzzle, small, bottom-aligned in the window like on the board
  local P = PUZZLES[cur]
  local x0, bottom = 242, 190
  gs.draw.rect(x0 - 2, 52, 64, bottom - 50, "#14234fc0")
  for r = 1, #P.rows do
    for c = 1, 6 do
      local k = tonumber(P.rows[r]:sub(c, c)) or 0
      if k > 0 then
        local y = bottom - (#P.rows - r + 1) * 10
        gs.draw.rect(x0 + (c - 1) * 10, y, 9, 9, BOARD.PCOL[k] - 1)
        gs.draw.rect(x0 + (c - 1) * 10, y, 9, 1, BOARD.PCOL[k])
      end
    end
  end
end

return Puzzles
