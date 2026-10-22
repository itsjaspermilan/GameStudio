-- STORM EYE. The attacks are cycled through in order, one every 2.2 seconds (see entities/boss.lua for what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "stormeye", name = "STORM EYE", sprite = "spr_b_stormeye", hitbox = { r = 16 },
  hp = 1300, spd = 26, dmg = 14, gap = 2.2,
  atk = { { "ring", 10 }, { "strike", 4 }, { "aim", 5 }, { "strike", 6 } },
})
