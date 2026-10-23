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
local spr, txt, txtr, box, item = ui.spr, ui.txt, ui.txtr, ui.box, ui.item

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
    if rank >= 5 then audio.sfx("sfx_error", 1); menu.say(self, "Already maxed")
    else
      local c = cost(self.sub, rank)
      if s.credits >= c then s.credits = s.credits - c; t[self.cur] = rank + 1; audio.sfx("sfx_buy", 1); save.write()
      else audio.sfx("sfx_error", 1); menu.say(self, "Not enough credits") end
    end
  end
end

function Weapons:draw_ui()
  local s = save.data
  menu.credits(self)
  for i, id in ipairs(data.WEAPON_ORDER) do
    local y = 28 + (i - 1) * 19
    local on = (i == self.cur)
    item(8, y, 38, 17, on, 215)
    spr("spr_ico_" .. data.WEAPONS[id].icon, 0, 18, y + 9, 0.67)
    txt(tostring(s.wa[i] + s.wb[i]), 30, y + 5, on and 14 or 2)
  end
  local id = data.WEAPON_ORDER[self.cur]
  local def = data.WEAPONS[id]
  spr("spr_ico_" .. def.icon, 0, 72, 50, 1.33)
  txt(def.name, 94, 38, 14, 1, 304, "round_tall")
  for i, l in ipairs(ui.wrap_px(def.blurb, 206)) do if i <= 2 then txt(l, 94, 52 + (i - 1) * 10, 2, 1, 304) end end
  txt("Dmg " .. def.dmg .. "  Shots " .. def.count .. "  Every " .. def.cd .. "s", 62, 76, 1, 1, 304)
  local rows = {
    { name = data.WEAPON_PATH_A.name, rank = s.wa[self.cur], ci = 6, desc = function() return "+10% damage" end },
    { name = def.pathBname, rank = s.wb[self.cur], ci = 22, desc = function(r) local u = def.pathB[r]; return run.describe(u[1], u[2]) end },
  }
  for k, row in ipairs(rows) do
    local y = 92 + (k - 1) * 60
    local on = (self.sub == k)
    item(58, y, 248, 52, on, 215)
    txt("Path " .. (k == 1 and "A" or "B") .. ": " .. row.name, 66, y + 6, on and 14 or 3, 1, 268)
    menu.pips(66, y + 20, row.rank, 5, row.ci)
    if row.rank < 5 then
      txt("Next: " .. row.desc(row.rank + 1), 66, y + 34, 3, 1, 300)
      local c = cost(k, row.rank)
      txtr(tostring(c), 298, y + 6, s.credits >= c and 14 or 5)
    else txt("Maxed out", 66, y + 34, 22) end
  end
  menu.footer(self, "Up/Down: Weapon   L/R: Path   A: Buy")
end

return Weapons
