-- A door hatch in a room's left or right wall (x, y: the bottom-left of its opening). It slides
-- open as Wren comes near. Walking out through it takes Wren to the room and door it names
-- (scenes/room.lua watches the room's edges).
local Door = gs.entity{
  sprite = "spr_door",
  depth = 50,
  id = "A", side = "left", to = "", at = "A",
  open = 0,
}

function Door:update(dt)
  local h = gs.first("hero")
  local near = h and math.abs(h.x - (self.x + 8)) < 56 and math.abs(h.y - self.y) < 48
  local was = self.open
  self.open = gs.clamp(self.open + (near and dt or -dt) * 8, 0, 3)
  if was == 0 and self.open > 0 then gs.sfx("sfx_door", 0.3) end
  self.frame = math.floor(self.open)
end

return Door
