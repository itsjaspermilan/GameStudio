-- Wren's ship in the Docking Bay. Frame 0 is how Now shows it; Then shows frame 1, which the Lens
-- will not focus on until late in the game.
local lens = require "lib.lens"
local Ship = gs.entity{ sprite = "spr_ship", depth = 60 }
function Ship:update() self.frame = lens.era == "then" and 1 or 0 end
return Ship
