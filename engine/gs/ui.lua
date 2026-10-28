-- Menus and other small pieces of interface.
--   local menu = gs.ui.menu({ "PLAY", "OPTIONS", "QUIT" })
--   function Title:update(dt) local pick = menu:update(); if pick == 1 then ... end end
--   function Title:draw_ui() menu:draw(100, 120) end
-- menu:update() moves the cursor with up/down (held, it repeats) and returns the number of the item when A is pressed, "back" when B
-- is (opts.back = false: B does nothing), otherwise nil. Start does not pick (it is the pause button) unless opts.start = true.
-- An item is a string, or a table for more:
--   { "MUSIC", values = { "OFF", "LOW", "HIGH" }, value = 3, on_change = function(item, value) ... end }   left/right change it
--   { "CONTINUE", enabled = false, hint = "No saved game yet" }   drawn dim and skipped; menu:hint() is the chosen item's hint
-- (opts.skip = false: the cursor stops on dim items too, to read their hint, and A on one is refused, as in a shop). With
-- opts.cycle, A on an item with values steps it on as right does, instead of picking it (a settings list).
-- menu:value(i) is item i's value as shown ("LOW"); item.value is its number. opts.width right-aligns the values that far from x.
-- opts.font and opts.shadow set the letters (a built-in font or a sprite font), opts.indent how far right of x the labels start (room
-- for the cursor), and opts.cursor can be a function(x, y, menu) that
-- draws the cursor itself, for a game with a cursor of its own (an arrow that bobs, a hand).
-- Its look can come from the scene's layout: gs.ui.menu(items, { at = self.menu_text, cursor = self.menu_cursor }) puts the list where
-- that text is, in its font, colour and size (the text itself is only the pattern and is hidden), with that picture as the cursor.
-- A menu rolls open line by line, top to bottom, when it is first drawn, and menu:close() rolls it back up (menu.closed is true once it has; menu:open()
-- unfolds it again). It takes no buttons while it moves. opts.roll = false: it is open at once and takes buttons from the start, also
-- when the game draws it itself (menu.items, menu.cur) and never calls menu:draw. gs.ui.style.open_time (seconds, 0 for none) is how long that takes, for
-- gs.say's box as well. gs.ui.style also holds the menu colours (color, selected, disabled, value: the colour of a value that is not
-- chosen, the item's own when nil), the cursor, the line height, sounds (on_move, on_pick, on_back, on_refuse: A on a dim item;
-- functions) and how gs.say types (text_speed in letters a second, on_letter).
local draw = require("gs.draw")
local input = require("gs.input")

local M = { style = { color = "#8a90a8", selected = "#ffd08a", disabled = "#4a4e62", cursor = ">", line = 12, on_move = nil, on_pick = nil,
  on_back = nil, open_time = 0.12, repeat_delay = 0.3, repeat_every = 0.08 } }
local function now() return require("gs.world").time end

local Menu = {}
Menu.__index = Menu

local function label(item) if type(item) == "table" then return tostring(item[1] or item.label or "") end return tostring(item) end
local function enabled(item) return type(item) ~= "table" or item.enabled ~= false end
M.label, M.enabled = label, enabled

function M.menu(items, opts)
  local m = setmetatable({ items = items, cur = 1, closed = false }, Menu)
  m.opts = opts or {}
  if m.opts.skip ~= false and not enabled(items[1]) then m:move(1) end
  return m
end

-- how far unfolded it is, 0 to 1 (eased, so it slows as it settles); it starts unfolding when first drawn
function Menu:unfolded()
  if self.opts.roll == false then -- open at once, and shut at once
    if self.closing then self.closed = true; return 0 end
    return 1
  end
  local ot = M.style.open_time or 0
  if not self.t0 then return self.closing and 0 or (ot > 0 and 0 or 1) end
  local f = ot > 0 and math.min(1, (now() - self.t0) / ot) or 1
  if self.closing then f = 1 - f end
  if self.closing and f <= 0 then self.closed = true end
  return 1 - (1 - f) * (1 - f)
end
function Menu:open() self.t0, self.closing, self.closed = now(), false, false end
function Menu:close() if not self.closing then self.t0, self.closing = now(), true end end

-- the cursor to the next item that can be chosen, going by -1 or 1 (it stays where it is when none can)
function Menu:move(by)
  local n = #self.items
  local i = self.cur
  local all = self.opts.skip == false
  for _ = 1, n do
    i = (i - 1 + by) % n + 1
    if all or enabled(self.items[i]) then self.cur = i; return true end
  end
  return false
end
function Menu:item() return self.items[self.cur] end
function Menu:hint() local it = self.items[self.cur]; return type(it) == "table" and it.hint or nil end
function Menu:value(i)
  local it = self.items[i or self.cur]
  if type(it) ~= "table" or not it.values then return nil end
  return it.values[it.value or 1]
end

-- a direction pressed now, or held long enough to repeat
function Menu:repeating(name)
  if input.pressed(name) then self.rep, self.rep_t = name, now() + (M.style.repeat_delay or 0.3); return true end
  if self.rep == name and input.held(name) and now() >= self.rep_t then self.rep_t = self.rep_t + (M.style.repeat_every or 0.08); return true end
  return false
end

-- an item's value by -1 or 1: round, or stopping at the ends (wrap = false)
local function step(it, by)
  local k, count = (it.value or 1) + by, #it.values
  if it.wrap == false then k = math.max(1, math.min(count, k)) else k = (k - 1) % count + 1 end
  if k == (it.value or 1) then return false end
  it.value = k
  if M.style.on_move then M.style.on_move() end
  if it.on_change then it.on_change(it, it.values[k]) end
  return true
end

function Menu:update()
  local n = #self.items
  if n == 0 or self.closing or self:unfolded() < 1 then return nil end
  local style, o = M.style, self.opts
  if self.rep and not input.held(self.rep) then self.rep = nil end
  if self:repeating("up") and self:move(-1) and style.on_move then style.on_move() end
  if self:repeating("down") and self:move(1) and style.on_move then style.on_move() end
  local it = self.items[self.cur]
  if type(it) == "table" and it.values and enabled(it) then
    local by = (self:repeating("left") and -1 or 0) + (self:repeating("right") and 1 or 0)
    if by ~= 0 then step(it, by) end
  end
  if input.pressed("a") or (o.start and input.pressed("start")) then
    if o.cycle and enabled(it) and type(it) == "table" and it.values and #it.values > 1 then
      step(it, 1) -- a setting: A steps it on, as right does
      return nil
    elseif enabled(it) then
      if style.on_pick then style.on_pick() end
      return self.cur
    end
    if style.on_refuse then style.on_refuse() end
  end
  if input.pressed("b") and o.back ~= false then
    if style.on_back then style.on_back() end
    return "back"
  end
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
  local font, shadow = o.font or (at and at.font), o.shadow or (at and at.shadow)
  local sprite_font = font and not draw.font_of(font)
  local fh = draw.any_height(font)
  local step = o.line or (at and (fh + 4) * scale) or style.line * scale
  local cw = sprite_font and require("gs.assets").sprite(font, 2).fw * scale or 8 * scale
  local lx = x + (o.indent or (sprite_font and cw * 2 or 16 * scale))
  local plain = (at and at.color) or style.color
  for i, item in ipairs(self.items) do
    if open < 1 and (i - 1) / #self.items > open then break end -- not rolled out this far yet
    local on = i == self.cur
    local ly = y + (i - 1) * step
    local color = not enabled(item) and (style.disabled or plain) or on and style.selected or plain
    local text = label(item)
    draw.any_text(font, text, lx, ly, color, scale, nil, shadow)
    local v = type(item) == "table" and item.values and item.values[item.value or 1]
    if v ~= nil and v ~= false then
      v = (on and #item.values > 1 and enabled(item)) and "< " .. tostring(v) .. " >" or tostring(v) -- arrows only on what can change
      local vw = draw.any_width(font, v, scale)
      local vx = o.width and x + o.width - vw or lx + draw.any_width(font, text, scale) + 8 * scale
      draw.any_text(font, v, vx, ly, (on or not enabled(item)) and color or style.value or color, scale, nil, shadow)
    end
    if on then
      local c = o.cursor
      if type(c) == "function" then c(x, ly, self)
      elseif c then c.visible = false; require("gs.assets").draw(require("gs.assets").sprite(c.sprite, 2), c.frame, x + cw / 2, ly + fh * scale / 2, 0, c.sx, c.sy, 1, false)
      else draw.any_text(font, style.cursor, x, ly, style.selected, scale, nil, shadow) end
    end
  end
end

return M
