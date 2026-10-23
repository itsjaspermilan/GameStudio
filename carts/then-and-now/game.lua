-- Then & Now: a metroidvania on a dead space station whose crew live on as echoes. Wren's goggles
-- flip every room between Now (the wreck) and Then (the station as it was). Every upgrade is a
-- person: keep them, or let them go. Design: docs/then-and-now-design.md.
return gs.game{
  title = "Then & Now",
  console = "dot",            -- 320x240, the Dot handheld: the taller screen suits shafts
  start = "scenes.title",
}
