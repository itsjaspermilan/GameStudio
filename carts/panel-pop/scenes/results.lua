-- After a game: how it went (lab1..lab5 and val1..val5 in the card) and what to do next
-- (opt1..opt3: the next rival, stage or puzzle when there is one, retry, back to the menu).
local ui = require "lib.ui"
local PG = require "lib.game"
local PUZZLES = require "lib.puzzles"
local data = require "lib.data"
local OPPONENTS, STAGE_COUNT = data.OPPONENTS, data.STAGE_COUNT

local TITLES = { endless = "ENDLESS", time = "TIME ATTACK", vs = "VS CPU", stage = "STAGE CLEAR", puzzle = "PUZZLE" }

local Results = gs.scene{}

local function copy(t, k, v) local n = {}; for a, b in pairs(t) do n[a] = b end; n[k] = v; return n end
local function play(mode, o) return function() ui.stop_music(100); gs.goto_scene(mode == "vs" and "scenes.versus" or "scenes.play", { fade = 0.2 }, mode, o) end end

function Results:enter()
  local res, last = PG.result, PG.last
  local m, o = last.mode, last.o
  self.res, self.cur, self.tick = res, 1, 0
  self.heading.text = TITLES[res.mode]
  -- what comes next
  local items = {}
  local function add(label, fn) items[#items + 1] = { label = label, fn = fn } end
  if res.win and m == "vs" and o.opp < #OPPONENTS then add("NEXT: " .. OPPONENTS[o.opp + 1].name, play(m, copy(o, "opp", o.opp + 1)))
  elseif res.win and m == "vs" then add("FINISH", function() gs.goto_scene("scenes.ending", { fade = 0.4 }) end)
  elseif res.win and m == "stage" and o.stage < STAGE_COUNT then add("NEXT STAGE", play(m, copy(o, "stage", o.stage + 1)))
  elseif res.win and m == "puzzle" and o.puzzle < #PUZZLES then add("NEXT PUZZLE", play(m, copy(o, "puzzle", o.puzzle + 1))) end
  add("RETRY", play(m, o))
  add("MENU", function() gs.goto_scene(m == "puzzle" and "scenes.puzzles" or "scenes.menu") end)
  self.items = items
  for i = 1, 3 do
    self["opt" .. i].visible, self["opt" .. i .. "_text"].visible = items[i] ~= nil, items[i] ~= nil
    self["opt" .. i .. "_text"].text = items[i] and items[i].label or ""
  end
  -- how it went
  local head = res.win and (res.mode == "time" and "TIME UP!" or "YOU WIN!") or "GAME OVER"
  if not res.win and res.mode == "vs" then head = "YOU LOSE" end
  if res.mode == "puzzle" then head = res.win and "SOLVED!" or "TRY AGAIN" end
  self.head.text = head
  self.card.tile = res.win and ui.UI.window or ui.UI.pink
  local rows = {}
  local function row(a, b) rows[#rows + 1] = { a, b } end
  if res.score then row("SCORE", ui.commas(res.score)) end
  if res.time then row("TIME", ui.fmt_time(res.time / 60)) end
  if res.panels then row("PANELS CLEARED", res.panels) end
  if res.chain and res.chain > 1 then row("BEST CHAIN", "X" .. res.chain) end
  if res.combo and res.combo >= 4 then row("BEST COMBO", res.combo) end
  if res.moves then row("SWAPS", res.moves) end
  for i = 1, 5 do self["lab" .. i].text, self["val" .. i].text = rows[i] and rows[i][1] or "", rows[i] and tostring(rows[i][2]) or "" end
  self.pip.frame = res.win and 2 or 3
  self:show()
  ui.music(res.win and "msc_win" or "msc_lose")
end

function Results:show()
  for i = 1, #self.items do ui.mark(self["opt" .. i], i == self.cur) end
end

function Results:update(dt)
  ui.tick()
  self.tick = self.tick + 1
  ui.drift(self.tick)
  self.record.visible = self.res.record and (self.tick // 15) % 2 == 0
  self.pip.y = 190 - (self.res.win and math.abs(math.floor(math.sin(self.tick / 8) * 4)) or 0)
  local was = self.cur
  self.cur = ui.move(self.cur, #self.items)
  if self.cur ~= was then self:show() end
  if ui.pressed("a") then ui.sfx("ok", 1); self.items[self.cur].fn() end
end

return Results
