-- Grub: walks straight at the player.
local Enemy = require "entities.enemy"

return gs.entity(Enemy, {
  kind = "grub", sprite = "spr_e_grub", hitbox = { r = 9 },
  hp = 10, spd = 38, dmg = 5, xp = 1,
})
