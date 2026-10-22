-- Panel Pop & Doc Capsule: two puzzlers in one cart. The rules, CPU players and drawing are plain Lua modules in lib/ (boards are tables of
-- cells, not entities: hundreds of cells a board would cost far more as entities); every screen is a scene (scenes/, built in lib/screens.lua).
return gs.game{
  title = "Panel Pop",
  console = "dot",
  start = "scenes.start",
}
