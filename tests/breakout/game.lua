-- Breakout: smash every brick with the ball. A small complete game: three entities, three scenes
-- and a little shared state.
return gs.game{
  title = "Breakout",
  console = "glow43",            -- 320x240, the Glow43 handheld
  start = "scenes.title",
}
