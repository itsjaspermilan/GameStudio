-- DREADNOUGHT. The attacks are cycled through in order, one every 1.8 seconds (see
-- entities/boss.lua for what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "dread", name = "DREADNOUGHT", sprite = "spr_b_dread", hitbox = { r = 20 },
  hp = 7000, spd = 24, dmg = 24, gap = 1.8,
  atk = { { "aim", 5 }, { "ring", 12 }, { "summon", "saucer", 3 }, { "charge" }, { "strike", 6 } },
})
