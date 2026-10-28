-- A survivors-style screen for measuring the Lua side on a device (not a pass/fail test): a hero circling a 1024x1024 grass field with
-- the camera on it, GS_SV_BATS bats (default 300) chasing it and pushing each other apart, a bolt at the nearest bat every 0.1 s, a gem
-- and a burst of sparks for every bat that falls (a new bat comes in at the edge of the screen). Written the way a beginner's game would
-- be, with the framework's own calls, so its numbers are what such a game costs.
return gs.game{ title = "Survivors bench", console = "glow43", start = "scenes.main" }
