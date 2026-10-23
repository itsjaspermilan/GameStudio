local EBullet = require "entities.bullets.ebullet"

return gs.entity(EBullet, { kind = "bossshot", sprite = "spr_p_boss_shot", blend = "add", hitbox = { r = 8 }, anim_speed = 8 / 6 })
