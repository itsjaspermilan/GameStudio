-- CRYSTAL MATRIARCH. The attacks are cycled through in order, one every 2.1 seconds (see
-- entities/boss.lua for what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "crystalmother", name = "CRYSTAL MATRIARCH", sprite = "spr_b_crystalmother", hitbox = { r = 17 },
  hp = 2400, spd = 22, dmg = 16, gap = 2.1,
  atk = { { "ring", 16 }, { "aim", 7 }, { "summon", "ringdrone", 4 }, { "strike", 5 } },
})
