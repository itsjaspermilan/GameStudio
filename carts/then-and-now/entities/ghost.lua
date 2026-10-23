-- Draws the other era's walls, faint, between the background and the solid tiles (lib/lens.lua draw_ghost).
local lens = require "lib.lens"
local Ghost = gs.entity{ depth = 150 }
function Ghost:draw() lens.draw_ghost() end
return Ghost
