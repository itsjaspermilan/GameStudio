local EBullet = require "entities.bullets.ebullet"

return gs.entity(EBullet, { kind = "shot2", sprite = "spr_p_enemy_shot2", blend = "add", hitbox = { r = 3 }, anim_speed = 8 / 6 })
