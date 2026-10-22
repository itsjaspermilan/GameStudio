-- Permanent ship upgrades: four paths of five ranks each, paid for with credits. The bars, the
-- title, the bottom panel and the background are in its layout (ship.layout.lua).
local data = require "lib.data"
local save = require "lib.save"
local audio = require "lib.audio"
local ui = require "lib.ui"
local menu = require "lib.menu"

local floor = math.floor
local spr, txt, txtr, box = ui.spr, ui.txt, ui.txtr, ui.box

local Ship = gs.scene{}

function Ship:enter()
  self.cur, self.tick, self.drift = 1, 0, 0.2
  ui.drift(0, self.drift)
end

local function cost(path, rank) return floor(path.cost * 1.8 ^ rank + 0.5) end

function Ship:update(dt)
  menu.tick(self)
  self.cur = menu.move(self.cur, #data.SHIP_PATHS)
  if gs.input.pressed("b") then audio.sfx("sfx_back", 1); gs.goto_scene("scenes.hub", { fade = 0.2 }, 3) end
  if gs.input.pressed("a") then
    local path, s = data.SHIP_PATHS[self.cur], save.data
    local rank = s.ship[self.cur]
    if rank >= 5 then audio.sfx("sfx_error", 1); menu.say(self, "ALREADY MAXED")
    else
      local c = cost(path, rank)
      if s.credits >= c then s.credits = s.credits - c; s.ship[self.cur] = rank + 1; audio.sfx("sfx_buy", 1); save.write()
      else audio.sfx("sfx_error", 1); menu.say(self, "NOT ENOUGH CREDITS") end
    end
  end
end

function Ship:draw_ui()
  local s = save.data
  menu.credits(self)
  for i, path in ipairs(data.SHIP_PATHS) do
    local y = 30 + (i - 1) * 36
    local rank, on = s.ship[i], (i == self.cur)
    box(6, y, 308, 32, on and 25 or 0, on and 26 or 1, 215)
    spr("spr_ico_" .. path.icon, 0, 24, y + 16, 1.5)
    txt(path.name, 44, y + 5, on and 14 or 3, 1, 102)
    menu.pips(44, y + 18, rank, 5, 22)
    if rank < 5 then
      local r = path.ranks[rank + 1]
      txt(r[1], 106, y + 5, 3, 1, 270)
      txt(r[2], 106, y + 16, 2, 1, 310)
      local c = cost(path, rank)
      txtr(tostring(c), 308, y + 5, s.credits >= c and 14 or 5)
    else txt("MAXED OUT", 106, y + 11, 22) end
  end
  local path = data.SHIP_PATHS[self.cur]
  local owned = {}
  for r = 1, s.ship[self.cur] do owned[#owned + 1] = path.ranks[r][1] end
  local line = #owned > 0 and table.concat(owned, ", ") or "NOTHING YET"
  for k, l in ipairs(ui.wrap(line, 36)) do if k <= 3 then txt(l, 12, 194 + (k - 1) * 9, 18, 1, 310) end end
  menu.footer(self, "A: BUY NEXT RANK   B: BACK")
end

return Ship
