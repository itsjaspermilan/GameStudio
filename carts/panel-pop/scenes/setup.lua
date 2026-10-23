-- Before a game: two rows to change with left and right (row1, row2 in the layout), then START.
-- enter(kind): "endless", "time", "vs" or "stage". The window at the bottom says more about the
-- choice (the rival for Vs, the record, the stage).
local ui = require "lib.ui"
local save = require "lib.save"
local data = require "lib.data"
local art = require "lib.art"
local DIFFS, OPPONENTS, STAGE_DEF = data.DIFFS, data.OPPONENTS, data.STAGE_DEF
local min = math.min

local TITLES = { endless = "Endless", time = "Time Attack", vs = "Vs CPU", stage = "Stage Clear" }
local FADE = { fade = 0.2, look = "mosaic" }
local SKIES = { endless = 1, time = 4, vs = 5, stage = 2 }

local function numbers(a, b) local t = {}; for i = a, b do t[#t + 1] = tostring(i) end; return t end
local function diff_names() local t = {}; for i, d in ipairs(DIFFS) do t[i] = d.name end; return t end

local Setup = gs.scene{}

function Setup:enter(kind)
  self.kind, self.cur, self.tick = kind, 1, 0
  self.heading.text = TITLES[kind]
  ui.sky(SKIES[kind])
  ui.music("msc_menu")
  local second
  if kind == "endless" or kind == "time" then second = { name = "Start level", labels = numbers(1, 10), i = 4 }
  elseif kind == "vs" then second = { name = "Rival", labels = {}, i = 1 }
  else second = { name = "Stage", labels = {}, i = save.data.stage } end
  self.rows = { { name = "Difficulty", labels = diff_names(), i = 2 }, second }
  self:refresh()
end

-- the choices the second row offers depend on the first (rivals beaten, stages reached)
function Setup:refresh()
  local kind, row = self.kind, self.rows[2]
  if kind == "vs" then
    local n = min(#OPPONENTS, save.get("vsbeat", self.rows[1].i) + 1)
    row.labels = {}
    for i = 1, n do row.labels[i] = OPPONENTS[i].name end
  elseif kind == "stage" then
    row.labels = numbers(1, save.data.stage)
  end
  row.i = min(row.i, #row.labels)
  self:show()
end

function Setup:show()
  local kind = self.kind
  for i, row in ipairs(self.rows) do
    local on = i == self.cur
    ui.mark(self["row" .. i], on)
    self["row" .. i .. "_name"].text = row.name
    self["row" .. i .. "_value"].text = row.labels[row.i] or "?"
    self["row" .. i .. "_left"].visible, self["row" .. i .. "_right"].visible = on, on
  end
  self.start.tile = self.cur == 3 and ui.UI.selected or ui.UI.go
  ui.ink(self.start_text, self.cur == 3 and ui.INK or ui.WHITE)
  local diff = DIFFS[self.rows[1].i]
  local lines
  self.rival.visible = kind == "vs"
  if kind == "vs" then
    local o = OPPONENTS[self.rows[2].i]
    self.rival.sprite = art.CHAR_SPRITES[o.char]
    lines = { "Rival " .. self.rows[2].i .. " of " .. #OPPONENTS, o.name, '"' .. o.hi .. '"', "" }
  elseif kind == "stage" then
    local def = STAGE_DEF(self.rows[2].i)
    lines = { "Break every block:", #def.rows .. "+ rows of garbage", def.rain > 0 and "and more keeps falling" or "", "" }
  else
    lines = { diff.colors .. " kinds of panel", "Best " .. ui.commas(save.get(kind, self.rows[1].i)), kind == "time" and "Two minutes" or "As long as you can", "" }
  end
  local cx = kind == "vs" and 192 or 160
  for i = 1, 4 do self["info" .. i].text, self["info" .. i].x = lines[i], cx end
end

function Setup:update(dt)
  ui.tick()
  self.tick = self.tick + 1
  ui.drift(self.tick)
  local was = self.cur
  self.cur = ui.move(self.cur, 3)
  local row = self.rows[self.cur]
  if row then
    local d = (ui.pressed("left") and -1) or (ui.pressed("right") and 1) or 0
    if d ~= 0 then row.i = (row.i - 1 + d) % #row.labels + 1; ui.sfx("select", 1); self:refresh() end
    if ui.pressed("a") then self.cur = 3; ui.sfx("select", 1) end
  elseif ui.ok() then
    ui.sfx("ok", 1)
    self:begin()
    return
  end
  if self.cur ~= was then self:show() end
  if self.rival.visible then self.rival.frame = (self.tick // 40) % 2 == 0 and 0 or 2 end
  if ui.pressed("b") then ui.sfx("back", 1); gs.goto_scene("scenes.menu") end
end

function Setup:begin()
  local kind, r = self.kind, self.rows
  local o = { diff = r[1].i }
  if kind == "vs" then o.opp = r[2].i elseif kind == "stage" then o.stage = r[2].i else o.speed = r[2].i end
  ui.stop_music(100)
  gs.goto_scene(kind == "vs" and "scenes.versus" or "scenes.play", FADE, kind, o)
end

return Setup
