-- Breakout: smash every brick with the ball. A small complete game: three entities, three scenes
-- (each a layout you can open and change, plus a little code) and a little shared state.
return gs.game{
  title = "Breakout",
  console = "glow43",            -- 256x192, the Glow43 handheld
  start = "scenes.title",
}
