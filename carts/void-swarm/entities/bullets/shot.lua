local EBullet = require "entities.bullets.ebullet"

return gs.entity(EBullet, { kind = "shot", sprite = "spr_p_enemy_shot", hitbox = { r = 2 }, anim_speed = 8 / 6 })
