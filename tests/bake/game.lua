-- Baked pictures (gs.draw.bake): a backdrop of rectangles, lines, circles, text and a sprite is baked once and drawn as one picture.
-- With GS_BAKE_PLAIN=1 the same backdrop is drawn directly every frame; run.sh compares the two frames, on the program and in the core.
return gs.game{ title = "Bake", console = "glow43", start = "scenes.main" }
