-- Menus and other small pieces of interface.
--   local menu = gs.ui.menu({ "PLAY", "OPTIONS", "QUIT" })
--   function Title:update(dt) local pick = menu:update(); if pick == 1 then ... end end
--   function Title:draw_ui() menu:draw(100, 120) end
-- menu:update() moves the cursor with up/down and returns the number of the item when A is pressed (otherwise nil).
-- Its look can come from the scene's layout: gs.ui.menu(items, { at = self.menu_text, cursor = self.menu_cursor }) puts the list where
-- that text is, in its font, colour and size (the text itself is only the pattern and is hidden), with that picture as the cursor.
-- A menu rolls open line by line, top to bottom, when it is first drawn, and menu:close() rolls it back up (menu.closed is true once it has; menu:open()
-- unfolds it again). It takes no buttons while it moves. gs.ui.style.open_time (seconds, 0 for none) is how long that takes, for
-- gs.say's box as well.
local draw = require("gs.draw")
local input = require("gs.input")

local M = { style = { color = "#8a90a8", selected = "#ffd08a", cursor = ">", line = 12, on_move = nil, on_pick = nil, open_time = 0.12 } }
local function now() return require("gs.world").time end

local Menu = {}
Menu.__index = Menu

function M.menu(items, opts)
  local m = setmetatable({ items = items, cur = 1, closed = false }, Menu)
  m.opts = opts or {}
  return m
end

-- how far unfolded it is, 0 to 1 (eased, so it slows as it settles); it starts unfolding when first drawn
function Menu:unfolded()
  local ot = M.style.open_time or 0
  if not self.t0 then return self.closing and 0 or (ot > 0 and 0 or 1) end
  local f = ot > 0 and math.min(1, (now() - self.t0) / ot) or 1
  if self.closing then f = 1 - f end
  if self.closing and f <= 0 then self.closed = true end
  return 1 - (1 - f) * (1 - f)
end
function Menu:open() self.t0, self.closing, self.closed = now(), false, false end
function Menu:close() if not self.closing then self.t0, self.closing = now(), true end end

function Menu:update()
  local n = #self.items
  if n == 0 or self.closing or self:unfolded() < 1 then return nil end
  local style = M.style
  if input.pressed("up") then self.cur = (self.cur - 2) % n + 1; if style.on_move then style.on_move() end end
  if input.pressed("down") then self.cur = self.cur % n + 1; if style.on_move then style.on_move() end end
  if input.pressed("a") or input.pressed("start") then if style.on_pick then style.on_pick() end return self.cur end
  return nil
end

function Menu:draw(x, y)
  local style, o = M.style, self.opts
  if not self.t0 and not self.closing then self.t0 = now() end
  local open = self:unfolded()
  if self.closed then return end
  local at = o.at
  if at then at.visible = false; x, y = x or at.x, y or at.y end
  local scale = o.scale or (at and at.size) or 1
  local font, shadow = at and at.font, at and at.shadow
  local sprite_font = font and not draw.font_of(font)
  local fh = draw.any_height(font)
  local step = o.line or (at and (fh + 4) * scale) or style.line * scale
  local cw = sprite_font and require("gs.assets").sprite(font, 2).fw * scale or 8 * scale
  for i, text in ipairs(self.items) do
    if open < 1 and (i - 1) / #self.items > open then break end -- not rolled out this far yet
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
