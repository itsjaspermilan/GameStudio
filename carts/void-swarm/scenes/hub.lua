-- The hangar: where a run starts and where credits are spent. The bars, the title, the pilot's
-- panel and the background are in its layout (hub.layout.lua).
local data = require "lib.data"
local save = require "lib.save"
local audio = require "lib.audio"
local ui = require "lib.ui"
local menu = require "lib.menu"

local floor = math.floor
local spr, txt, box, item = ui.spr, ui.txt, ui.box, ui.item

local Hub = gs.scene{}

local ITEMS = { "Launch", "Pilots", "Ship Upgrades", "Weapon Upgrades" }

function Hub:enter(cur)
  self.cur, self.tick, self.drift = cur or 1, 0, 0.3
  ui.drift(0, self.drift)
  audio.music("msc_hub")
end

function Hub:update(dt)
  menu.tick(self)
  self.cur = menu.move(self.cur, #ITEMS)
  if gs.input.pressed("b") then audio.sfx("sfx_back", 1); gs.goto_scene("scenes.title") end
  if gs.input.pressed("a") then
    audio.sfx("sfx_ok", 1)
    if self.cur == 1 then gs.goto_scene("scenes.stages", { fade = 0.2 }, math.min(save.data.cleared + 1, #data.STAGES))
    elseif self.cur == 2 then gs.goto_scene("scenes.pilots", { fade = 0.2 }, save.data.sel)
    elseif self.cur == 3 then gs.goto_scene("scenes.ship", { fade = 0.2 })
    else gs.goto_scene("scenes.weapons", { fade = 0.2 }) end
  end
end

function Hub:draw_ui()
  menu.credits(self)
  local p = data.PILOTS[save.data.sel]
  spr("spr_pilot_" .. p.id, 2 + floor(self.tick / 5) % 6, 244, 76, 2)
  ui.txtm(p.name, 244, 110, 14, 2, 310, "bold_small")
  spr("spr_ico_" .. data.WEAPONS[p.weapon].icon, 0, 190, 146)
  local wy = 134
  for _, l in ipairs(ui.wrap_px(data.WEAPONS[p.weapon].name, 104)) do txt(l, 205, wy, 3, 1, 310); wy = wy + 10 end
  for _, l in ipairs(ui.wrap_px(p.blurb, 104)) do txt(l, 205, wy + 2, 2, 1, 310); wy = wy + 10 end
  for i, name in ipairs(ITEMS) do
    local y = 42 + (i - 1) * 30
    local on = (i == self.cur)
    item(10, y, 156, 24, on, 220)
    txt(name, 22, y + 6, on and 3 or 2, 1, nil, "round_tall")
    if on then spr("spr_ico_cursor", self.tick / 8, 12, y + 12) end
  end
  txt("Sectors cleared " .. save.data.cleared .. "/" .. #data.STAGES, 10, 170, 22)
  txt("Runs " .. save.data.runs .. "   KO " .. save.data.kills, 10, 182, 2)
  menu.footer(self, "A: Select")
end

return Hub
