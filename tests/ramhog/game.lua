-- Fills the console's RAM until it runs out (tests/run.sh): the program with GS_RAM=1 (the studio's Play panel) and the libretro core must
-- run out at the same point. Every step keeps a new 32 KB string and prints how many it holds and gs.raw.ram().
return gs.game{ title = "RAM hog", console = "glow43", start = "scenes.main" }
