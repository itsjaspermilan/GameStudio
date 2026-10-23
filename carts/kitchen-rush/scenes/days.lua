-- Pick a day of the week. One star on a day opens the next; each card shows the best stars and
-- coins, and the dishes on the menu.
local ui = require "lib.ui"
local data = require "lib.data"
local save = require "lib.save"

local d = gs.draw
local Days = gs.scene{}

function Days:enter(cur)
  ui.backdrop()
  self.open = save.open_days()
  self.cur = math.min(cur or self.open, self.open)
  gs.music("msc_menu")
end

function Days:update(dt)
  local inp, n = gs.input, #data.DAYS
  if inp.pressed("up") then self.cur = (self.cur - 2) % n + 1; gs.sfx("move") end
  if inp.pressed("down") then self.cur = self.cur % n + 1; gs.sfx("move") end
  if inp.pressed("b") then gs.sfx("back"); gs.goto_scene("scenes.title", { fade = 0.3 }) end
  if inp.pressed("a") or inp.pressed("start") then
    if self.cur > self.open then gs.sfx("wrong"); return end
    gs.sfx("ok")
    gs.music_stop(0.3)
    gs.goto_scene("scenes.play", { fade = 0.3 }, self.cur)
  end
end

function Days:draw_ui()
  ui.shadow_centered("Pick a day", 6, "#f5d94a", 2)
  for i, day in ipairs(data.DAYS) do
    local y = 26 + (i - 1) * 40
    local on, open = i == self.cur, i <= self.open
    ui.box(12, y, 296, 36, on and "#2a56c4" or "#14234f", on and "#a8d4ff" or "#4f9bf0")
    if on then d.text(">", 4, y + 14, "#f5d94a") end
    d.text(day.name, 20, y + 5, open and "#ffffff" or "#3b3f55")
    if open then
      local stars = save.stars(i)
      for s = 1, 3 do d.sprite("spr_star", 104 + (s - 1) * 15, y + 1, { frame = s <= stars and 0 or 1 }) end
      local best = save.coins(i)
      if best > 0 then d.sprite("spr_coin", 20, y + 21); d.text(tostring(best), 30, y + 21, "#f5d94a") end
      -- the dishes new on this day
      local x = 160
      for _, id in ipairs(day.new) do
        local dish = data.DISHES[id]
        d.text(dish.name, x, y + 5, "#ffd08a")
        ui.recipe(dish, x, y + 16)
        x = x + 74
      end
    else
      d.text("Earn a star on " .. data.DAYS[i - 1].name .. " first", 20, y + 21, "#8a90a8")
    end
  end
  d.text_centered("A: cook   B: back", 230, "#a8d4ff")
end

return Days
