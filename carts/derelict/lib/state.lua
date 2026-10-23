-- What the player has found, shared by every room: upgrades, missiles, and a short message on screen.
local M = {
  has = {},            -- dash, double, wall, charge, missile = true once picked up
  missiles = 0, missiles_max = 10,
  note = nil, note_t = 0,
}

function M.say(text, seconds) M.note, M.note_t = text, seconds or 2 end

function M.tick(dt)
  if M.note_t > 0 then M.note_t = M.note_t - dt; if M.note_t <= 0 then M.note = nil end end
end

return M
