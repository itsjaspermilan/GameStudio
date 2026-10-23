-- ROCK KING. The attacks are cycled through in order, one every 2.4 seconds (see entities/boss.lua
-- for what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "rockking", name = "Rock King", sprite = "spr_b_rockking", hitbox = { r = 27 },
  hp = 900, spd = 24, dmg = 16, gap = 2.4,
  atk = { { "aim", 3 }, { "ring", 8 }, { "charge" }, { "summon", "rockling", 2 }, { "aim", 5 } },
})
