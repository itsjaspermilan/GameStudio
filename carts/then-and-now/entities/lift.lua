-- The lift to the rest of the station. In this first part of the game it is dead (lib/story.lua "lift").
local Usable = require "entities.usable"
return gs.entity(Usable, { sprite = "spr_lift", what = "lift", era = "both", frames = 2, fps = 1, hitbox = { -16, -48, 32, 48 }, depth = 60 })
