-- A mine left by a Minelayer: it sits still until its time runs out.
local EBullet = require "entities.bullets.ebullet"

local Mine = gs.entity(EBullet, { kind = "mine", sprite = "spr_p_mine", hitbox = { r = 3 }, anim_speed = 0.5, life = 9 })

function Mine:create()
  EBullet.create(self)
  self.sx, self.sy = 1.2, 1.2
end

return Mine
