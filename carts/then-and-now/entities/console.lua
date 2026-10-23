-- Tender's console: the station's caretaker speaks through it (lib/story.lua "console").
local Usable = require "entities.usable"
return gs.entity(Usable, { sprite = "spr_console", what = "console", era = "both" })
