local Menu = gs.scene{}
function Menu:enter()
  local input = require("gs.input")
  assert(not gs.input.held("a", 2) and not gs.input.pressed("any", 4) and not gs.input.released("a", 3))
  assert(not pcall(gs.input.held, "a", 0) and not pcall(gs.input.dir, 1.5))
  assert(not pcall(gs.input.dir, false))
  input.network({ 0, (1 << 4) | (1 << 3), 0, 0 })
  assert(gs.input.held("a", 2) and gs.input.pressed("a", 2) and gs.input.pressed("any", 2))
  assert(not pcall(gs.input.held, "not_a_button", 2))
  assert(not gs.input.held("a") and not gs.input.pressed("a", 1))
  local dx, dy = gs.input.dir(2)
  assert(dx == 1 and dy == 0)
  input.end_step()
  assert(not gs.input.pressed("a", 2))
  input.network({ 0, 0, 0, 0 })
  assert(gs.input.released("a", 2) and not gs.input.released("a"))
  input.reset()
end
return Menu
