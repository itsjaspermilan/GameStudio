-- Permanent weapon upgrades: every weapon has two paths of five ranks (A: more damage, B: its own
-- special improvements). The bars, the title, the weapon's panel and the background are in its
-- layout (weapons.layout.lua).
local data = require "lib.data"
local run = require "lib.run"
local save = require "lib.save"
local audio = require "lib.audio"
local ui = require "lib.ui"
local menu = require "lib.menu"

local floor = math.floor
local spr, txt, txtr, box = ui.spr, ui.txt, ui.txtr, ui.box

local Weapons = gs.scene{}

function Weapons:enter()
  self.cur, self.sub, self.tick, self.drift = 1, 1, 0, 0.2 -- sub: which of the two paths is selected
  ui.drift(0, self.drift)
end

local function cost(kind, rank) return floor((kind == 1 and 50 or 70) * 1.7 ^ rank + 0.5) end

function Weapons:update(dt)
  menu.tick(self)
  self.cur = menu.move(self.cur, #data.WEAPON_ORDER)
  if gs.input.pressed("left") or gs.input.pressed("right") then self.sub = 3 - self.sub; audio.sfx("sfx_move", 1) end
  if gs.input.pressed("b") then audio.sfx("sfx_back", 1); gs.goto_scene("scenes.hub", { fade = 0.2 }, 4) end
  if gs.input.pressed("a") then
    local s = save.data
    local t = (self.sub == 1) and s.wa or s.wb
    local rank = t[self.cur]
    if rank >= 5 then audio.sfx("sfx_error", 1); menu.say(self, "ALREADY MAXED")
    else
      local c = cost(self.sub, rank)
      if s.credits >= c then s.credits = s.credits - c; t[self.cur] = rank + 1; audio.sfx("sfx_buy", 1); save.write()
      else audio.sfx("sfx_error", 1); menu.say(self, "NOT ENOUGH CREDITS") end
    end
  end
end

function Weapons:draw_ui()
  local s = save.data
  menu.credits(self)
  for i, id in ipairs(data.WEAPON_ORDER) do
    local y = 26 + (i - 1) * 19
    local on = (i == self.cur)
    box(4, y, 40, 17, on and 25 or 0, on and 26 or 1, 215)
    spr("spr_ico_" .. data.WEAPONS[id].icon, 0, 14, y + 9)
    txt(tostring(s.wa[i] + s.wb[i]), 26, y + 5, on and 14 or 2)
  end
  local id = data.WEAPON_ORDER[self.cur]
  local def = data.WEAPONS[id]
  spr("spr_ico_" .. def.icon, 0, 68, 46, 2)
  txt(def.name, 90, 34, 14, 1, 312)
  for i, l in ipairs(ui.wrap(def.blurb, 27)) do txt(l, 90, 46 + (i - 1) * 9, 2, 1, 312) end
  txt("DMG " .. def.dmg .. "  SHOTS " .. def.count .. "  EVERY " .. def.cd .. "S", 56, 74, 1, 1, 312)
  local rows = {
    { name = data.WEAPON_PATH_A.name, rank = s.wa[self.cur], ci = 6, desc = function() return "+10% damage" end },
    { name = def.pathBname, rank = s.wb[self.cur], ci = 22, desc = function(r) local u = def.pathB[r]; return run.describe(u[1], u[2]) end },
  }
  for k, row in ipairs(rows) do
    local y = 92 + (k - 1) * 58
    local on = (self.sub == k)
    box(54, y, 256, 52, on and 25 or 0, on and 26 or 1, 215)
    txt("PATH " .. (k == 1 and "A" or "B") .. ": " .. row.name, 62, y + 6, on and 14 or 3, 1, 268)
    menu.pips(62, y + 20, row.rank, 5, row.ci)
    if row.rank < 5 then
      txt("NEXT: " .. row.desc(row.rank + 1), 62, y + 33, 3, 1, 306)
      local c = cost(k, row.rank)
      txtr(tostring(c), 304, y + 6, s.credits >= c and 14 or 5)
    else txt("MAXED OUT", 62, y + 33, 22) end
  end
  menu.footer(self, "UP/DOWN WEAPON  L/R PATH  A: BUY")
end

return Weapons
