-- Amoeba: walks straight at the player. Breaks into two splitlings when killed.
local Enemy = require "entities.enemy"

return gs.entity(Enemy, {
  kind = "amoeba", sprite = "spr_e_amoeba", hitbox = { r = 11 },
  hp = 30, spd = 32, dmg = 6, xp = 3, split = "splitling",
})
