-- THE VOID HEART. The attacks are cycled through in order, one every 1.6 seconds (see entities/boss.lua for what each does).
local Boss = require "entities.boss"

return gs.entity(Boss, {
  kind = "voidheart", name = "THE VOID HEART", sprite = "spr_b_voidheart", hitbox = { r = 18 },
  hp = 9500, spd = 24, dmg = 26, gap = 1.6,
  atk = { { "ring", 18 }, { "spiral" }, { "aim", 7 }, { "summon", "knight", 3 }, { "strike", 8 }, { "charge" }, { "pull" } },
})
