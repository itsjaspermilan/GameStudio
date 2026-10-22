-- LUNAR MAW. The attacks are cycled through in order, one every 2.2 seconds (see entities/boss.lua for what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "lunarmaw", name = "LUNAR MAW", sprite = "spr_b_lunarmaw", hitbox = { r = 19 },
  hp = 1800, spd = 28, dmg = 18, gap = 2.2,
  atk = { { "charge" }, { "spiral" }, { "ring", 12 }, { "aim", 3 } },
})
