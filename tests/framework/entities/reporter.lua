-- Placed by scenes/plain.layout.lua, a scene with no code: reports on it after the first step and ends the test.
local Reporter = gs.entity{}
function Reporter:update()
  _G.LAYOUT_CHECK("a scene with only a layout gets its names too", gs.world.scene.x and gs.world.scene.x.text == "X")
  _G.DONE()
end
return Reporter
