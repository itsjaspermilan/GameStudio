-- Colour banks (palette.json): a sprite drawn with another bank's colours, place for place (a
-- palette swap), and "bank:place" colours in code.
-- With GS_BANKS_PLAIN=1 the same picture is drawn with rectangles in the swapped colours; run.sh
-- compares the two frames.
return gs.game{ title = "Banks", console = "glow43", start = "scenes.main" }
