-- The test room: the hero, targets and upgrades in one big room. Start pauses (with the controls), Select shows the map.
local tiles = require "lib.tiles"
local state = require "lib.state"

local Station = gs.scene{}

local CONTROLS = {
  { "D-PAD", "RUN, UP AIMS UP" },
  { "DOWN", "CROUCH / AIM DOWN IN AIR" },
  { "B", "JUMP, HOLD FOR HIGHER" },
  { "DOWN+B", "DROP THROUGH THIN FLOOR" },
  { "Y", "SHOOT (HOLD: AUTO-FIRE)" },
  { "A", "DASH" },
  { "X", "FIRE A MISSILE" },
  { "UP", "USE A TERMINAL" },
  { "SELECT", "MAP" },
}

function Station:enter()
  tiles.use(gs.layer("solid"))
  gs.camera:follow(self.hero, { smooth = 0.08, offset_y = -16 })
  self.map_on, self.paused, self.t = false, false, 0
  self:build_map()
end

-- the map is the solid layer at 2 pixels a tile; runs of wall in a row are joined so drawing it is a few dozen rectangles
function Station:build_map()
  self.map = {}
  local layer = gs.layer("solid")
  for r, row in ipairs(layer.data) do
    local c = 1
    while c <= #row do
      if tiles.wall(row[c]) or tiles.thin(row[c]) then
        local start, thin = c, tiles.thin(row[c])
        while c <= #row and (tiles.wall(row[c]) or tiles.thin(row[c])) and tiles.thin(row[c]) == thin do c = c + 1 end
        self.map[#self.map + 1] = { start - 1, r - 1, c - start, thin }
      else
        c = c + 1
      end
    end
  end
  self.map_w, self.map_h = #layer.data[1], #layer.data
end

function Station:update(dt)
  state.tick(dt)
  self.t = self.t + dt
  if gs.input.pressed("start") then
    self.paused = not self.paused
    gs.pause(self.paused)
  end
  if gs.input.pressed("select") and not self.paused then self.map_on = not self.map_on end
end

function Station:draw_map()
  local s = 2
  local w, h = self.map_w * s, self.map_h * s
  local x0, y0 = 320 - w - 8, 8
  gs.draw.rect(x0 - 3, y0 - 3, w + 6, h + 6, "#000000c0")
  gs.draw.frame(x0 - 3, y0 - 3, w + 6, h + 6, "#45d1c5")
  for _, m in ipairs(self.map) do
    gs.draw.rect(x0 + m[1] * s, y0 + m[2] * s, m[3] * s, m[4] and 1 or s, m[4] and "#8a90a8" or "#1f8a96")
  end
  local hero = self.hero
  if hero and math.floor(self.t * 4) % 2 == 0 then
    gs.draw.rect(x0 + math.floor(hero.x / 16) * s - 1, y0 + math.floor((hero.y - 1) / 16) * s - 2, 3, 3, "#ffffff")
  end
end

function Station:draw_ui()
  -- missiles left (the blaster never runs out, so it needs nothing)
  if state.has.missile then gs.draw.text(string.format("MISSILES %02d/%02d", state.missiles, state.missiles_max), 6, 6, "#ffa38c") end
  if self.map_on then self:draw_map() end
  if state.note then
    local w = gs.draw.text_width(state.note) + 12
    gs.draw.rect(160 - w / 2, 214, w, 16, "#000000c0")
    gs.draw.text_centered(state.note, 218, "#ffffff")
  end
  if self.paused then
    gs.draw.rect(16, 30, 288, 180, "#000000e0")
    gs.draw.frame(16, 30, 288, 180, "#45d1c5")
    gs.draw.text_centered("PAUSED", 40, "#45d1c5")
    for i, c in ipairs(CONTROLS) do
      gs.draw.text(c[1], 28, 56 + i * 15, "#f5d94a")
      gs.draw.text(c[2], 96, 56 + i * 15, "#ffffff")
    end
  end
end

return Station
