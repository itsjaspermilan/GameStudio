-- Menus and other small pieces of interface.
--   local menu = gs.ui.menu({ "PLAY", "OPTIONS", "QUIT" })
--   function Title:update(dt) local pick = menu:update(); if pick == 1 then ... end end
--   function Title:draw_ui() menu:draw(100, 120) end
-- menu:update() moves the cursor with up/down and returns the number of the item when A is pressed (otherwise nil).
local draw = require("gs.draw")
local input = require("gs.input")

local M = { style = { color = "#8a90a8", selected = "#ffd08a", cursor = ">", line = 12, on_move = nil, on_pick = nil } }

local Menu = {}
Menu.__index = Menu

function M.menu(items, opts)
  local m = setmetatable({ items = items, cur = 1 }, Menu)
  m.opts = opts or {}
  return m
end

function Menu:update()
  local n = #self.items
  if n == 0 then return nil end
  local style = M.style
  if input.pressed("up") then self.cur = (self.cur - 2) % n + 1; if style.on_move then style.on_move() end end
  if input.pressed("down") then self.cur = self.cur % n + 1; if style.on_move then style.on_move() end end
  if input.pressed("a") or input.pressed("start") then if style.on_pick then style.on_pick() end return self.cur end
  return nil
end

function Menu:draw(x, y)
  local style, scale = M.style, self.opts.scale or 1
  local step = self.opts.line or style.line * scale
  for i, text in ipairs(self.items) do
    local on = i == self.cur
    draw.text((on and style.cursor or " ") .. " " .. tostring(text), x, y + (i - 1) * step, on and style.selected or style.color, scale)
  end
end

return M
