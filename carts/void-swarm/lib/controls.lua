-- What the player asks the ship to do: a direction and a dash. The buttons by default; with GS_BOT=1 a bot steers instead (see lib/bot.lua).
local M = { bot = nil }

function M.move()
  if M.bot then return M.bot.move() end
  local dx, dy = gs.input.dir()
  return dx, dy
end

function M.dash()
  if M.bot then return M.bot.dash() end
  return gs.input.pressed("b") or gs.input.pressed("a")
end

return M
