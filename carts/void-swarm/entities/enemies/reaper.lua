-- Reaper: walks straight at the player.
local Enemy = require "entities.enemy"

return gs.entity(Enemy, {
  kind = "reaper", sprite = "spr_e_reaper", hitbox = { r = 13 },
  cap = 5, hp = 150, spd = 66, dmg = 16, xp = 14,
})
