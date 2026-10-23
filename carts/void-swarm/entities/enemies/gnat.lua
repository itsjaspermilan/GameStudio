-- Gnat: walks straight at the player. They arrive in a group of five.
local Enemy = require "entities.enemy"

return gs.entity(Enemy, {
  kind = "gnat", sprite = "spr_e_gnat", hitbox = { r = 6 },
  hp = 4, spd = 72, dmg = 3, xp = 1, group = 5,
})
