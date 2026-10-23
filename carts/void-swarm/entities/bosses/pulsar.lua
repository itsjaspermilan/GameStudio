-- PULSAR. The attacks are cycled through in order, one every 2.0 seconds (see entities/boss.lua for
-- what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "pulsar", name = "Pulsar", sprite = "spr_b_pulsar", hitbox = { r = 26 },
  hp = 4000, spd = 26, dmg = 20, gap = 2.0,
  atk = { { "spiral" }, { "ring", 14 }, { "strike", 6 }, { "aim", 5 } },
})
