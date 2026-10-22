-- Breakout: smash every brick with the ball. A small complete game: three entities, three scenes and a little shared state.
return gs.game{
  title = "Breakout",
  console = "dot",            -- 320x240, the Dot handheld
  start = "scenes.title",
}
