-- The first scene: it only decides which screen comes next (see lib/screens.lua, M.start).
local Start = gs.scene{}
function Start:enter() require("lib.screens").start() end
return Start
