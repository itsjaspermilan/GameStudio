local Main = gs.scene{}
function Main:enter()
  gs.sfx("zap"); gs.music("tune")
  print("SONG TEST LOADED")
  gs.raw.quit()
end
return Main
