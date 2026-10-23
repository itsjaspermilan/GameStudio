-- The jacket an earlier Wren left behind, with a note pinned to it (n: which Wren). Reading it adds
-- the note to the pause menu.
local Usable = require "entities.usable"
return gs.entity(Usable, { sprite = "spr_jacket", what = "jacket", era = "both", prompt = "READ", frames = 1, hitbox = { -16, -16, 32, 16 }, n = 1 })
