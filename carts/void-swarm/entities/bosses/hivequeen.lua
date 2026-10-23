-- HIVE QUEEN. The attacks are cycled through in order, one every 1.9 seconds (see entities/boss.lua
-- for what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "hivequeen", name = "Hive Queen", sprite = "spr_b_hivequeen", hitbox = { r = 26 },
  hp = 4800, spd = 30, dmg = 18, gap = 1.9,
  atk = { { "summon", "gnat", 8 }, { "aim", 5 }, { "charge" }, { "summon", "leech", 3 } },
})
