-- The title screen: the name, the chef juggling food, and Play / How to play.
local ui = require "lib.ui"
local data = require "lib.data"
local debug = require "lib.debug"

local d = gs.draw
local Title = gs.scene{}
local ITEMS = { "Play", "How to play" }
local JUGGLE = { "bun", "tomato", "patty", "cheese", "fish", "lettuce" }

function Title:enter()
  if debug.start() then return end
  ui.backdrop()
  self.cur = 1
  gs.music("msc_title")
end

function Title:update(dt)
  local inp = gs.input
  if inp.pressed("up") or inp.pressed("down") then self.cur = 3 - self.cur; gs.sfx("move") end
  if inp.pressed("a") or inp.pressed("start") then
    gs.sfx("ok")
    if self.cur == 1 then gs.goto_scene("scenes.days", { fade = 0.3 })
    else gs.goto_scene("scenes.howto", { fade = 0.3 }) end
  end
end

function Title:draw_ui()
  local t = gs.world.time
  ui.box(20, 18, 280, 58, "#4a1424", "#ea5a4b")
  ui.shadow_centered("KITCHEN", 26, "#fff6a8", 3)
  ui.shadow_centered("RUSH!", 52, "#f5d94a", 3)
  -- the chef juggles: food flies round in a circle above his hands
  local cx, cy = 160, 128
  for i, id in ipairs(JUGGLE) do
    local a = t * 2.2 + i * (math.pi * 2 / #JUGGLE)
    ui.food(id, math.floor(cx - 8 + math.cos(a) * 42), math.floor(cy - 8 + math.sin(a) * 22), false)
  end
  d.sprite("spr_chef", cx - 16, 132, { frame = math.floor(t * 4) % 2 == 0 and 5 or 0 })
  ui.box(100, 178, 120, 38, "#14234f", "#4f9bf0")
  ui.rows(ITEMS, self.cur, 104, 182, 112)
  d.text_centered("A: choose", 226, "#a8d4ff")
end

return Title
