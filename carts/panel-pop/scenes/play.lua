-- A game. enter(mode, opts) starts it (lib/game.lua has the rules of each mode). Two layouts run
-- this code: play.layout.lua (one board in the middle, the score on the left, Pip on the right) and
-- versus.layout.lua (two boards, the faces and scores between them). This code fills in the words
-- and faces; the boards are drawn in draw(), and the end banner and pause menu are screen items of
-- the layout, shown and hidden here.
local ui = require "lib.ui"
local save = require "lib.save"
local PG = require "lib.game"
local PL = require "lib.pl"
local art = require "lib.art"
local data = require "lib.data"
local STAGE_COUNT = data.STAGE_COUNT
local max = math.max
local commas, fmt_time = ui.commas, ui.fmt_time

local BOT = os.getenv("GS_BOT") ~= nil
local FF = tonumber(os.getenv("GS_FF") or "1") or 1
local STATS = os.getenv("GS_STATS") ~= nil
local FADE = { fade = 0.2, look = "mosaic" }
local NAMES = { endless = "Endless", time = "Time Attack", stage = "Stage Clear", puzzle = "Puzzle" }

local Play = gs.scene{}

function Play:enter(mode, o)
  self.versus = self.p1_face ~= nil
  PG.start(mode, o)
  ui.sky(PG.game().sky)
  if self.versus then
    local p2 = PG.game().ps[2]
    self.p2_face.sprite = art.CHAR_SPRITES[p2.char]
    self.p2_name.text = p2.name
  else
    self.mode_name.text = NAMES[mode]
    local rises = mode ~= "puzzle"
    self.speed_label.visible = rises
    self.help2.visible = rises
    self.help4.visible = mode == "puzzle" or mode == "stage"
  end
  self:show()
end

-- the words and faces round the boards
function Play:show()
  local G = PG.game()
  if not G then return end
  if self.versus then
    for i, ps in ipairs(G.ps) do
      local p = "p" .. i
      self[p .. "_face"].frame = PG.face_frame(ps)
      self[p .. "_score"].text = commas(ps.b.score)
      self[p .. "_shout"].text = ps.shout_t > 0 and ps.shout or ""
    end
    self.level.text = "Speed " .. G.ps[1].b.speed
  else
    local ps = G.ps[1]
    local b, m, o = ps.b, G.mode, G.o
    local rows
    if m == "endless" then rows = { "Score", commas(b.score), "Level", b.speed, "Time", fmt_time(G.secs / 60), "Best", commas(save.get("endless", o.diff or 2)) }
    elseif m == "time" then rows = { "Time left", fmt_time(max(0, (G.limit - G.secs) / 60)), "Score", commas(b.score), "Level", b.speed, "Best", commas(save.get("time", o.diff or 2)) }
    elseif m == "stage" then rows = { "Stage", o.stage .. "/" .. STAGE_COUNT, "Blocks", #b.garbs + #b.pending, "Score", commas(b.score), "Time", fmt_time(G.secs / 60) }
    else rows = { "Puzzle", o.puzzle, "Swaps left", max(0, G.puz.moves - b.moves), "Time", fmt_time(G.secs / 60), "", "" } end
    for i = 1, 4 do self["lab" .. i].text, self["val" .. i].text = rows[i * 2 - 1], tostring(rows[i * 2]) end
    self.face.frame = PG.face_frame(ps)
    -- beside Pip: the last big thing ("Chain" over "x3"), else its name
    local word, n = "Pip", ""
    if ps.shout_t > 0 then word, n = ps.shout:match("^(%S+) (.*)$") elseif G.speed_t and G.speed_t > 0 then word, n = "Speed", "up!" end
    self.shout.text, self.shout_n.text = word, n
    local next_up = PG.next_speedup()
    rows = { "Chain", b.best_chain > 1 and "x" .. b.best_chain or "-", "Combo", b.best_combo >= 4 and b.best_combo or "-", "Popped", b.cleared,
      next_up and "Faster" or "", next_up and fmt_time(next_up) or "" }
    for i = 1, 4 do self["best" .. i].text, self["best" .. i .. "_v"].text = rows[i * 2 - 1], tostring(rows[i * 2]) end
    self.danger.visible = b.danger and (G.tick // 10) % 2 == 0
  end
  -- the end banner and the pause menu
  local over = G.phase == "over"
  self.banner_bar.visible, self.banner.visible = over, over
  self.banner_hint.visible = over and G.over_t > 100 and (G.over_t // 20) % 2 == 0
  if over then local words, ink = PG.banner(); self.banner.text = words; ui.ink(self.banner, ink) end
  local paused = G.paused
  self.pause_box.visible, self.pause_title.visible = paused, paused
  for i = 1, 3 do
    ui.mark(self["prow" .. i], i == G.pcur)
    self["prow" .. i].visible, self["ptext" .. i].visible = paused, paused
  end
end

function Play:update(dt)
  ui.tick()
  local G = PG.game()
  if G then ui.drift(G.tick) end
  local r
  for _ = 1, BOT and FF or 1 do
    r = PG.step()
    if r then break end
  end
  if r == "results" then gs.goto_scene("scenes.results", FADE)
  elseif r == "quit" then gs.goto_scene(PG.last.mode == "puzzle" and "scenes.puzzles" or "scenes.menu")
  else self:show() end
end

function Play:draw()
  PG.draw()
  local G = PG.game()
  if not G then return end
  -- the speed meter under the score (one board only)
  if not self.versus and G.ps[1].b.rise_on then
    local b = G.ps[1].b
    gs.draw.rect(14, 160, 84, 8, 25)
    gs.draw.rect(15, 161, 82, 6, 27)
    gs.draw.rect(15, 161, math.floor(82 * math.min(1, b.speed / 40)), 6, 18)
    if b.panic < PL.PANIC_MAX then gs.draw.rect(15, 165, math.floor(82 * b.panic / PL.PANIC_MAX), 2, 6) end
  end
  -- the pause menu sits on a dimmed screen (the menu itself is drawn after this)
  if G.paused then gs.draw.rect(0, 0, ui.SW, ui.SH, "#14234fa0") end
  if STATS and G.tick % 120 == 0 then
    local px, calls, screen = gs.stats()
    print(string.format("stats play/%s: %.2f screens drawn, %d draw calls", G.mode, px / screen, calls))
  end
end

function Play:draw_ui()
  local G = PG.game()
  local s = G and PG.countdown()
  if s and not G.paused then ui.text(s, ui.SW / 2, 96, ui.GOLD, "center", 3, "bold_tall") end
end

return Play
