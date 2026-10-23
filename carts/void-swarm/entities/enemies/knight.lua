-- Aegis Knight: walks straight at the player.
local Enemy = require "entities.enemy"

return gs.entity(Enemy, {
  kind = "knight", sprite = "spr_e_knight", hitbox = { r = 11 },
  cap = 6, hp = 55, spd = 30, dmg = 9, xp = 5, armor = 2,
})
