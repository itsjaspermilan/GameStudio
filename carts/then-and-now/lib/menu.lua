-- The pause menu (Start): four pages, Left and Right (or L and R) to change page, Start or B to carry on.
--   MAP    the rooms seen so far       NOTES  the earlier Wrens' notes (Up and Down to choose)
--   CREW   who Wren has met and what became of them       HELP   the buttons
local state = require "lib.state"
local hud = require "lib.hud"
local world = require "lib.world"

local M = {}
local PAGES = { "MAP", "NOTES", "CREW", "HELP" }

local CREW = {
  { id = "ossie", name = "OSSIE OKAFOR", job = "SHUTTLE PILOT", met = "ossie_met", gift = "DASH (A)", trait = "AFTERBURNER: DASHING HURTS ENEMIES" },
}

local HELP = {
  { "D-PAD", "RUN. UP AIMS UP" },
  { "DOWN", "CROUCH / AIM DOWN IN AIR" },
  { "B", "JUMP, HOLD FOR HIGHER" },
  { "DOWN+B", "DROP THROUGH A THIN FLOOR" },
  { "Y", "SHOOT" },
  { "A", "DASH (ONCE YOU CAN)" },
  { "L", "LENS: NOW / THEN" },
  { "UP / R", "USE, TALK, READ" },
  { "SELECT", "QUICK MAP" },
}

function M.open(scene)
  local m = setmetatable({ scene = scene, page = 1, pick = 1, t = 0 }, { __index = M })
  gs.sfx("sfx_select", 0.4)
  return m
end

-- returns false when the menu closes
function M:update(dt)
  self.t = self.t + dt
  local I = gs.input
  if I.pressed("start") or I.pressed("b") then gs.sfx("sfx_select", 0.4) return false end
  if I.pressed("right") or I.pressed("r") then self.page = self.page % #PAGES + 1; self.pick = 1; gs.sfx("sfx_select", 0.3) end
  if I.pressed("left") or I.pressed("l") then self.page = (self.page - 2) % #PAGES + 1; self.pick = 1; gs.sfx("sfx_select", 0.3) end
  if PAGES[self.page] == "NOTES" then
    local n = self:note_list()
    if #n > 0 then
      if I.pressed("down") then self.pick = self.pick % #n + 1 end
      if I.pressed("up") then self.pick = (self.pick - 2) % #n + 1 end
    end
  end
  return true
end

function M:note_list()
  local out = {}
  for n in pairs(state.data.notes) do out[#out + 1] = n end
  table.sort(out)
  return out
end

local function wrap_text(text, x, y, width, color)
  for i, line in ipairs(gs.draw.wrap(text, width)) do gs.draw.text(line, x, y + (i - 1) * 10, color) end
end

function M:draw()
  local d = state.data
  gs.draw.rect(8, 8, 304, 224, "#0b1020f0")
  gs.draw.frame(8, 8, 304, 224, "#45d1c5")
  -- tabs
  local x = 16
  for i, p in ipairs(PAGES) do
    local w = gs.draw.text_width(p) + 10
    if i == self.page then gs.draw.rect(x, 14, w, 13, "#1f8a96") end
    gs.draw.text(p, x + 5, 17, i == self.page and "#ffffff" or "#8a90a8")
    x = x + w + 4
  end
  gs.draw.text_right("PAUSED", 304, 17, "#45d1c5")
  local page = PAGES[self.page]
  if page == "MAP" then
    local info = world.rooms[self.scene.room_id]
    gs.draw.text(world.biomes[info.biome].name, 20, 38, "#4f9bf0")
    gs.draw.text(info.name, 20, 50, "#ffffff")
    hud.map(30, 80, self.scene.room_id, self.t, 20, 15)
    gs.draw.rect(20, 206, 3, 3, "#f5d94a"); gs.draw.text("LAST SAVE", 28, 204, "#8a90a8")
    gs.draw.text_right(string.format("TIME %d:%02d", d.time // 60, math.floor(d.time % 60)), 304, 204, "#8a90a8")
  elseif page == "NOTES" then
    local list = self:note_list()
    if #list == 0 then gs.draw.text("NO NOTES YET.", 20, 40, "#8a90a8") end
    for i, n in ipairs(list) do
      gs.draw.text((i == self.pick and "> " or "  ") .. "NOTE " .. n, 20, 30 + i * 12, i == self.pick and "#ffffff" or "#8a90a8")
    end
    local n = list[self.pick]
    if n then
      gs.draw.frame(110, 38, 192, 160, "#1f8a96")
      wrap_text(require("lib.story").notes[n] or "", 118, 46, 176, "#ffd08a")
    end
  elseif page == "CREW" then
    for i, c in ipairs(CREW) do
      local y = 36 + (i - 1) * 64
      local fate = d.crew[c.id]
      local met = fate or d.flags[c.met]
      gs.draw.frame(20, y, 52, 52, "#1f8a96")
      if met then gs.draw.sprite("spr_por_" .. c.id, 22, y + 2, { frame = fate == "kept" and 0 or fate == "released" and 0 or 1 }) end
      gs.draw.text(met and c.name or "???", 80, y + 2, "#a6f4e6")
      gs.draw.text(met and c.job or "", 80, y + 14, "#8a90a8")
      if fate == "kept" then
        gs.draw.text("KEPT. HE IS PART OF YOU.", 80, y + 28, "#ffd08a")
        gs.draw.text(c.trait, 80, y + 40, "#ffffff")
      elseif fate == "released" then
        gs.draw.text("LET GO. HE WAITS BY YOUR SHIP.", 80, y + 28, "#a6f4e6")
        gs.draw.text("GAVE YOU: " .. c.gift, 80, y + 40, "#ffffff")
      elseif met then
        gs.draw.text("STILL WAITING FOR CLEARANCE.", 80, y + 28, "#8a90a8")
      end
    end
  else
    for i, h in ipairs(HELP) do
      gs.draw.text(h[1], 24, 30 + i * 16, "#f5d94a")
      gs.draw.text(h[2], 100, 30 + i * 16, "#ffffff")
    end
  end
  gs.draw.text_centered("LEFT/RIGHT: PAGE    START: BACK", 220, "#3b3f55")
end

return M
