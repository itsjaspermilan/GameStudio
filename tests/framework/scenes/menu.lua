-- A scene with a layout (scenes/menu.layout.lua): everything named in it is a field before enter() runs.
local Menu = gs.scene{}
function Menu:enter()
  local check = _G.LAYOUT_CHECK
  check("a named text is a field", self.title and self.title.text == "HELLO" and self.title.x == 160 and self.title.align == "center")
  check("a named picture is a field", self.logo and self.logo.sprite == "ball" and self.logo.sx == 2)
  check("a named entity is a field", self.thing and self.thing.x == 5 and self.thing.y == 6 and self.thing.hp == 7)
  check("unnamed things are made too", gs.world.count_alive() == 7, gs.world.count_alive())
  check("a named panel is a field", self.frame and self.frame.w == 50 and self.frame.tileset == "ts_bg")
  check("a text can have a sprite font", self.fancy.font == "ball" and gs.draw.font_width("ball", "AB") == 2 * gs.assets.sprite("ball").fw)
  -- drawing them works: a panel bigger than its block, one a bar, letters the font has and has not
  gs.world.draw()
  check("the layout's size limits the camera", gs.world.room_w == 640 and gs.world.room_h == 480)
  check("a sprite in a folder is found by its folder and name", gs.assets.sprites["ui/dot"] ~= nil and gs.assets.sprite("ui/dot").fw == gs.assets.sprite("ball").fw)
  self.title.text = "CHANGED"
  check("a text can be changed", self.title.text == "CHANGED")
  gs.goto_scene("lvl1", 3)
end
return Menu
