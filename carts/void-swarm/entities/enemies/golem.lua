-- Crystal Golem: walks straight at the player.
local Enemy = require "entities.enemy"

return gs.entity(Enemy, {
  kind = "golem", sprite = "spr_e_golem", hitbox = { r = 20 },
  cap = 5, hp = 140, spd = 20, dmg = 14, xp = 10, armor = 1,
})
