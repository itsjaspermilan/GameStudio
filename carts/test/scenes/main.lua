local Main = gs.scene{}

function Main:enter()
  gs.spawn("player", 160, 120)
end

return Main
