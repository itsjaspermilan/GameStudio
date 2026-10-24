-- The mosaic (gs.raw.mosaic): each 4x4 block of the frame must take the colour of the pixel at its middle. The scene puts a dot of a
-- different colour in the middle of every block over a black screen; with GS_MOSAIC_PLAIN=1 it draws the whole blocks in those colours
-- instead, with no mosaic. run.sh compares the two frames.
return gs.game{ title = "Mosaic", console = "glow43", start = "scenes.main" }
