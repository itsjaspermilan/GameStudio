local Main = gs.scene{}
function Main:enter()
  gs.sfx("chord"); gs.sfx("old"); gs.music("groove")
  print("BAND TEST LOADED")
  gs.raw.quit()
end
return Main
