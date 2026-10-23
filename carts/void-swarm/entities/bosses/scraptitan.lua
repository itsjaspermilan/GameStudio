-- SCRAP TITAN. The attacks are cycled through in order, one every 2.0 seconds (see
-- entities/boss.lua for what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "scraptitan", name = "SCRAP TITAN", sprite = "spr_b_scraptitan", hitbox = { r = 27 },
  hp = 3200, spd = 20, dmg = 20, gap = 2.0,
  atk = { { "aim", 3 }, { "summon", "minelayer", 2 }, { "charge" }, { "strike", 6 }, { "ring", 10 } },
})
