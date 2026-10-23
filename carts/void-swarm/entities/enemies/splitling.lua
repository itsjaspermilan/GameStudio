-- Splitling: walks straight at the player.
local Enemy = require "entities.enemy"

return gs.entity(Enemy, {
  kind = "splitling", sprite = "spr_e_splitling", hitbox = { r = 5 },
  hp = 8, spd = 56, dmg = 3, xp = 1,
})
