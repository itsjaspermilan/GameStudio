-- collides with walls: counts the calls (the order must follow the order of making)
local Walker = gs.entity{ tags = { "walker" }, hitbox = { -3, -3, 6, 6 } }
function Walker:on_collide_wall(wall) _G.WALL_HITS = _G.WALL_HITS + 1; _G.LAST_WALKER = self.id end
return Walker
