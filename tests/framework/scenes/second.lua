local Second = gs.scene{}
function Second:enter(a, b) _G.SECOND_ARGS = { a, b }; _G.FINISH() end
return Second
