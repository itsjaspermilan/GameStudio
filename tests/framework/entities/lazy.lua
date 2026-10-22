-- checks its wall only every third step
local Lazy = gs.entity{ hitbox = { -3, -3, 6, 6 }, collide_every = { wall = 3 } }
function Lazy:on_collide_wall(wall) _G.LAZY_HITS = _G.LAZY_HITS + 1 end
return Lazy
