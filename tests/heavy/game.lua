-- A heavy screen for measuring drawing on a device (not a pass/fail test): a full-screen background, three full-screen glows ("add",
-- "darken" and see-through), 200 stars scaled and turning, and four full-screen fades, every frame. GS_HEAVY_STARS=N changes the stars.
return gs.game{ title = "Heavy", console = "glow43", start = "scenes.main" }
