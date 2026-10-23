-- The end of the Hangar Ring: what Wren did, and a promise of the rest. A, B or Start goes back to
-- the title.
local state = require "lib.state"

local End = gs.scene{}

function End:enter()
  self.t = 0
  gs.music("msc_end")
end

function End:update(dt)
  self.t = self.t + dt
  local I = gs.input
  if self.t > 2 and (I.pressed("a") or I.pressed("b") or I.pressed("start")) then gs.goto_scene("scenes.title", { fade = 0.8 }) end
end

function End:draw_ui()
  local d = state.data
  gs.draw.rect(0, 0, 320, 240, "#05070f")
  gs.draw.text_centered("THE HANGAR RING", 40, "#4f9bf0", 2)
  gs.draw.text_centered("END OF THE FIRST PART", 62, "#8a90a8")
  local fate = d.crew.ossie == "kept" and "YOU KEPT OSSIE. HE FLIES WITH YOU." or d.crew.ossie == "released" and "YOU LET OSSIE GO. HE WAITS BY YOUR SHIP." or "OSSIE IS STILL WAITING."
  gs.draw.text_centered(fate, 96, "#a6f4e6")
  local notes = 0
  for _ in pairs(d.notes) do notes = notes + 1 end
  local items = 0
  for _ in pairs(d.items) do items = items + 1 end
  gs.draw.text_centered(string.format("NOTES FOUND %d/2    PICKUPS %d/2", notes, items), 118, "#ffffff")
  gs.draw.text_centered(string.format("TIME %d:%02d    FALLS %d", d.time // 60, math.floor(d.time % 60), d.deaths), 132, "#ffffff")
  gs.draw.text_centered("THE GARDENS AND THE WARD ARE WAITING.", 166, "#ffd08a")
  gs.draw.text_centered("SO IS TENDER.", 178, "#f5d94a")
  if self.t > 2 and math.floor(self.t * 2) % 2 == 0 then gs.draw.text_centered("PRESS A", 212, "#8a90a8") end
end

return End
