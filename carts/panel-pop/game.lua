-- Panel Pop: swap neighbouring panels to line up three, chain combos and bury your rival in
-- garbage. Every screen is a scene with a layout (scenes/<name>.lua and <name>.layout.lua); the
-- rules, the CPU players and the boards are plain Lua modules in lib/ (a board is a table of cells,
-- not entities: hundreds of cells a board would cost far more as entities).
return gs.game{
  title = "Panel Pop",
  console = "glow43",
  start = "scenes.title",
}
