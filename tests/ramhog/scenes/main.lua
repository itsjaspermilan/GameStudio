local Main = gs.scene{}
local kept = {}

function Main:update(dt)
  kept[#kept + 1] = string.rep(string.char(65 + #kept % 26) .. #kept, 8192) -- a new string each step, never let go
  local used, _, size = gs.raw.ram()
  io.stderr:write(string.format("ramhog %d %d/%d KB, Lua %d KB\n", #kept, used // 1024, size // 1024, math.floor(collectgarbage("count"))))
end

return Main
