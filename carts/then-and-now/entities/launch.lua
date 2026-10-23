-- The tower's launch console. It only exists in Then: forty years ago someone sat here and cleared Ossie's shuttle to launch.
local Usable = require "entities.usable"
return gs.entity(Usable, { sprite = "spr_launch", what = "launch", era = "then", hidden_away = true, fps = 4 })
