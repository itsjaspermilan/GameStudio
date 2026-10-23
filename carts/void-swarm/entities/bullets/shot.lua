local EBullet = require "entities.bullets.ebullet"

return gs.entity(EBullet, { kind = "shot", sprite = "spr_p_enemy_shot", blend = "add", hitbox = { r = 3 }, anim_speed = 8 / 6 })
