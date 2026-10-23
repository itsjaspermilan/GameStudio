-- Blend modes: an entity, a tile layer and gs.draw.sprite drawn with "add", "darken" and
-- see-through, over a grey background. With
-- GS_BLEND_PLAIN=1 the colours they should make are drawn as plain rectangles instead; run.sh
-- compares the two frames.
return gs.game{ title = "Blend", console = "glow43", start = "scenes.main" }
