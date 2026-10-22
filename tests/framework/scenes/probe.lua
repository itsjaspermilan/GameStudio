local Probe = gs.scene{}
function Probe:enter(n)
  local check = _G.LAYOUT_CHECK
  check("a layout can use another scene's code", self.door and self.door.x == 100, self.door)
  check("arguments reach that code", n == 3, n)
  gs.goto_scene("plain")
end
return Probe
