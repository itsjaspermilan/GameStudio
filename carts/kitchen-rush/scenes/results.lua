-- The end of a day: coins, customers served and lost, stars one by one, then Next day / Try again /
-- Days.
local ui = require "lib.ui"
local data = require "lib.data"
local save = require "lib.save"

local d = gs.draw
local Results = gs.scene{}

function Results:enter(r)
  ui.backdrop()
  self.r = r
  self.record = not r.bot and save.record(r.day, r.stars, r.coins)
  self.shown = 0                -- stars shown so far, one every 0.4 s
  self.t = 0
  self.items, self.go = {}, {}
  local open = save.open_days()
  if r.day < #data.DAYS and r.day + 1 <= open then self.items[#self.items + 1] = "Next day"; self.go[#self.go + 1] = r.day + 1 end
  self.items[#self.items + 1] = "Try again"; self.go[#self.go + 1] = r.day
  self.items[#self.items + 1] = "Pick a day"; self.go[#self.go + 1] = "days"
  self.cur = 1
  gs.music(r.stars > 0 and "msc_closed" or "msc_fail")
end

function Results:update(dt)
  self.t = self.t + dt
  if self.shown < self.r.stars and self.t > 0.8 + self.shown * 0.4 then self.shown = self.shown + 1; gs.sfx("star") end
  local inp = gs.input
  if inp.pressed("up") then self.cur = (self.cur - 2) % #self.items + 1; gs.sfx("move") end
  if inp.pressed("down") then self.cur = self.cur % #self.items + 1; gs.sfx("move") end
  if inp.pressed("a") or inp.pressed("start") then
    gs.sfx("ok")
    local g = self.go[self.cur]
    if g == "days" then gs.goto_scene("scenes.days", { fade = 0.3 }, self.r.day)
    else gs.goto_scene("scenes.play", { fade = 0.3 }, g) end
  end
end

function Results:draw_ui()
  local r = self.r
  local day = data.DAYS[r.day]
  ui.box(30, 14, 260, 212, "#14234f", "#4f9bf0")
  ui.shadow_centered(day.name .. " is done", 22, "#f5d94a", 2)
  if r.ended == "misses" then d.text_centered("Three customers walked out!", 44, "#ea5a4b") end
  for s = 1, 3 do d.sprite("spr_star", 160 - 30 + (s - 1) * 22, 56, { frame = s <= self.shown and 0 or 1 }) end
  local y = 82
  local function row(label, value, color)
    d.text(label, 60, y, "#a8d4ff"); d.text_right(value, 260, y, color or "#ffffff"); y = y + 12
  end
  row("Coins", tostring(r.coins), "#f5d94a")
  row("Served", tostring(r.served))
  row("Walked out", tostring(r.misses), r.misses > 0 and "#ea5a4b" or "#ffffff")
  row("Best tip", tostring(r.best_tip))
  local need = day.stars
  d.text_centered(string.format("Stars: %d / %d / %d coins", need[1], need[2], need[3]), y + 2, "#8a90a8")
  if self.record then d.text_centered("New best!", y + 14, "#6ccf4f") end
  ui.rows(self.items, self.cur, 90, 166, 140)
end

return Results
