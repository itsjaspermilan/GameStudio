-- EVENT HORIZON. The attacks are cycled through in order, one every 1.9 seconds (see
-- entities/boss.lua for what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "horizon", name = "Event Horizon", sprite = "spr_b_horizon", hitbox = { r = 27 },
  hp = 5800, spd = 22, dmg = 22, gap = 1.9,
  atk = { { "pull" }, { "spiral" }, { "ring", 16 }, { "strike", 7 } },
})
