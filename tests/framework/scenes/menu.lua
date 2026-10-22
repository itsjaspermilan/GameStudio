-- A scene with a layout (scenes/menu.layout.lua): everything named in it is a field before enter() runs.
local Menu = gs.scene{}
function Menu:enter()
  local check = _G.LAYOUT_CHECK
  check("a named text is a field", self.title and self.title.text == "HELLO" and self.title.x == 160 and self.title.align == "center")
  check("a named picture is a field", self.logo and self.logo.sprite == "ball" and self.logo.sx == 2)
  check("a named entity is a field", self.thing and self.thing.x == 5 and self.thing.y == 6 and self.thing.hp == 7)
  check("unnamed things are made too", gs.world.count_alive() == 4, gs.world.count_alive())
  check("the layout's size limits the camera", gs.world.room_w == 640 and gs.world.room_h == 480)
  self.title.text = "CHANGED"
  check("a text can be changed", self.title.text == "CHANGED")
  gs.goto_scene("lvl1", 3)
end
return Menu
