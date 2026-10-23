-- Menus and other small pieces of interface.
--   local menu = gs.ui.menu({ "PLAY", "OPTIONS", "QUIT" })
--   function Title:update(dt) local pick = menu:update(); if pick == 1 then ... end end
--   function Title:draw_ui() menu:draw(100, 120) end
-- menu:update() moves the cursor with up/down and returns the number of the item when A is pressed (otherwise nil).
-- Its look can come from the scene's layout: gs.ui.menu(items, { at = self.menu_text, cursor = self.menu_cursor }) puts the list where
-- that text is, in its font, colour and size (the text itself is only the pattern and is hidden), with that picture as the cursor.
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
  local style, o = M.style, self.opts
  local at = o.at
  if at then at.visible = false; x, y = x or at.x, y or at.y end
  local scale = o.scale or (at and at.size) or 1
  local font, shadow = at and at.font, at and at.shadow
  local sprite_font = font and not draw.font_of(font)
  local fh = draw.any_height(font)
  local step = o.line or (at and (fh + 4) * scale) or style.line * scale
  local cw = sprite_font and require("gs.assets").sprite(font, 2).fw * scale or 8 * scale
  for i, text in ipairs(self.items) do
    local on = i == self.cur
    local ly = y + (i - 1) * step
    if sprite_font then draw.font_text(font, tostring(text), x + cw * 2, ly, scale)
    else draw.text(tostring(text), x + 16 * scale, ly, on and style.selected or (at and at.color) or style.color, scale, { font = font, shadow = shadow }) end
    if on then
      local c = o.cursor
      if c then c.visible = false; require("gs.assets").draw(require("gs.assets").sprite(c.sprite, 2), c.frame, x + cw / 2, ly + fh * scale / 2, 0, c.sx, c.sy, 1, false)
      elseif sprite_font then draw.font_text(font, style.cursor, x, ly, scale)
      else draw.text(style.cursor, x, ly, style.selected, scale, { font = font, shadow = shadow }) end
    end
  end
end

return M
