-- Sound helpers: music that does not restart when asked for again, and sound effects that cannot
-- pile up (a crowd of kills is one sound, not fifty).
local M = {}
local now, last = nil, {}

function M.music(name)
  if now ~= name then now = name; gs.music(name) end
end

function M.stop_music()
  now = nil
  gs.music_stop(0.3)
end

-- play a sound effect unless the same one played in the last `gap` steps (default 3)
function M.sfx(name, gap)
  local step = gs.world.step_id
  local at = last[name]
  if not at or step - at >= (gap or 3) then
    last[name] = step
    gs.sfx(name)
  end
end

return M
