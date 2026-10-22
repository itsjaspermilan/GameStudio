-- Leech: walks straight at the player. Touching it slows the player.
local Enemy = require "entities.enemy"

return gs.entity(Enemy, {
  kind = "leech", sprite = "spr_e_leech", hitbox = { r = 6 },
  cap = 14, hp = 20, spd = 62, dmg = 3, xp = 3, slows = true,
})
