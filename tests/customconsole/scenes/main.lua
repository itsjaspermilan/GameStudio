local Main = gs.scene{}
function Main:enter()
  local w, h = gs.screen()
  print(string.format("CUSTOM CONSOLE %s %dx%d", gs.limits.console, w, h))
  gs.quit()
end
return Main
