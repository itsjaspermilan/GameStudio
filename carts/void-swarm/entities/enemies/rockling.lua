-- Rockling: walks straight at the player.
local Enemy = require "entities.enemy"

return gs.entity(Enemy, {
  kind = "rockling", sprite = "spr_e_rockling", hitbox = { r = 13 },
  cap = 14, hp = 60, spd = 22, dmg = 10, xp = 5, armor = 1,
})
