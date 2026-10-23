-- Choose a pilot, or spend credits to unlock one. The bars, the title, the pilot's panel and the
-- background are in its layout (pilots.layout.lua).
local data = require "lib.data"
local save = require "lib.save"
local audio = require "lib.audio"
local ui = require "lib.ui"
local menu = require "lib.menu"

local floor = math.floor
local spr, txt, txtr, box, item = ui.spr, ui.txt, ui.txtr, ui.box, ui.item

local Pilots = gs.scene{}

function Pilots:enter(cur)
  self.cur, self.tick, self.drift = cur or 1, 0, 0.2
  ui.drift(0, self.drift)
end

-- the lines that describe a pilot's modifiers
local function mod_lines(m)
  local o = {}
  local function pct(v) return (v >= 0 and "+" or "") .. floor(v * 100 + 0.5) .. "%" end
  if m.hp then o[#o + 1] = "HEALTH " .. pct(m.hp - 1) end
  if m.spd then o[#o + 1] = "SPEED " .. pct(m.spd - 1) end
  if m.armor then o[#o + 1] = "ARMOR +" .. m.armor end
  if m.dmg then o[#o + 1] = "DAMAGE " .. pct(m.dmg) end
  if m.cd then o[#o + 1] = "FIRE RATE " .. pct(-m.cd) end
  if m.area then o[#o + 1] = "AREA " .. pct(m.area) end
  if m.magnet then o[#o + 1] = "PICKUP RANGE " .. pct(m.magnet) end
  if m.xp then o[#o + 1] = "XP " .. pct(m.xp) end
  if m.credits then o[#o + 1] = "CREDITS " .. pct(m.credits) end
  if m.regen then o[#o + 1] = "REGEN +" .. m.regen .. "/S" end
  if m.dashcd then o[#o + 1] = "DASH COOLDOWN " .. pct(m.dashcd) end
  if m.revive then o[#o + 1] = "ONE REVIVE" end
  if #o == 0 then o[1] = "NO BONUSES" end
  return o
end

function Pilots:update(dt)
  menu.tick(self)
  self.cur = menu.move(self.cur, #data.PILOTS)
  if gs.input.pressed("b") then audio.sfx("sfx_back", 1); gs.goto_scene("scenes.hub", { fade = 0.2 }, 2) end
  if gs.input.pressed("a") then
    local p, s = data.PILOTS[self.cur], save.data
    if s.unl[self.cur] == 1 then s.sel = self.cur; audio.sfx("sfx_ok", 1); save.write()
    elseif s.credits >= p.cost then
      s.credits = s.credits - p.cost; s.unl[self.cur] = 1; s.sel = self.cur
      audio.sfx("sfx_unlock", 1); save.write(); menu.say(self, p.name .. " JOINED YOU!")
    else audio.sfx("sfx_error", 1); menu.say(self, "NOT ENOUGH CREDITS") end
  end
end

function Pilots:draw_ui()
  local s = save.data
  menu.credits(self)
  for i, p in ipairs(data.PILOTS) do
    local y = 28 + (i - 1) * 19
    local on, owned = (i == self.cur), s.unl[i] == 1
    item(6, y, 150, 17, on, 215)
    spr("spr_pilot_" .. p.id, 0, 20, y + 9, 0.5, false, 0, owned and 255 or 90)
    txt(p.name, 34, y + 5, owned and 3 or 1, 1, 100)
    if s.sel == i then txtr("ACTIVE", 152, y + 5, 22)
    elseif not owned then txtr(tostring(p.cost), 152, y + 5, s.credits >= p.cost and 14 or 5) end
  end
  local p = data.PILOTS[self.cur]
  local owned = s.unl[self.cur] == 1
  spr("spr_pilot_" .. p.id, 2 + floor(self.tick / 5) % 6, 238, 66, 2, false, 0, owned and 255 or 120)
  txt(p.name, 238 - #p.name * 8, 102, 14, 2, 312)
  for i, l in ipairs(ui.wrap(p.blurb, 17)) do txt(l, 168, 122 + (i - 1) * 9, 2, 1, 312) end
  spr("spr_ico_" .. data.WEAPONS[p.weapon].icon, 0, 176, 156)
  -- drawn here, not in the layout: a long blurb's third line reaches it, and it must stay on top
  txt("STARTS WITH", 192, 144, 1, 1, 312)
  for i, l in ipairs(ui.wrap(data.WEAPONS[p.weapon].name, 15)) do txt(l, 192, 154 + (i - 1) * 9, 3, 1, 312) end
  for i, l in ipairs(mod_lines(p.mods)) do txt(l, 168, 176 + (i - 1) * 9, 18, 1, 312) end
  menu.footer(self, owned and "A: CHOOSE   B: BACK" or ("A: BUY FOR " .. p.cost .. "   B: BACK"))
end

return Pilots
