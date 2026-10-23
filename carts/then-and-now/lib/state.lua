-- Everything the player has found and decided, shared by every room and saved at terminals as one table (gs.save key "game").
--   has:      abilities (lens, dash, wall, charge, missile, slip, drift)
--   traits:   a kept crew member's passive (ossie = afterburner, ...)
--   crew:     each crew member's fate: nil (not met), "kept" or "released"
--   flags:    story progress (any name = true)
--   items:    pickups taken, by id, so they never come back
--   seen:     rooms visited, for the map
--   notes:    Wren notes found, by number
-- `room` and `door` say where to start: the room of the last terminal, or a door when walking between rooms.
local M = {}

local function fresh()
  return {
    has = {}, traits = {}, crew = {}, flags = {}, items = {}, seen = {}, notes = {},
    hp = 4, hp_max = 4, missiles = 0, missiles_max = 0, static = 0, static_max = 100,
    room = "dock", door = nil, save_room = "dock",
    time = 0, deaths = 0,
  }
end

M.data = fresh()
M.note, M.note_t = nil, 0 -- a short message along the bottom of the screen (not saved)

function M.new_game() M.data = fresh() end

local function copy(v)
  if type(v) ~= "table" then return v end
  local c = {}
  for k, x in pairs(v) do c[k] = copy(x) end
  return c
end

function M.has_save() return gs.save.get("game") ~= nil end

-- Save where the player stands now (a terminal's room), with full health.
function M.save(room)
  local d = M.data
  d.save_room, d.room, d.door = room, room, nil
  gs.save.set("game", copy(d))
end

-- Load the last save (on Continue, or after dying). Fields added to the game later get their fresh values.
function M.load()
  local saved = gs.save.get("game")
  M.data = fresh()
  if saved then for k, v in pairs(saved) do M.data[k] = copy(v) end end
  local d = M.data
  d.room, d.door, d.hp, d.static = d.save_room, nil, d.hp_max, 0
  d.missiles = d.missiles_max
end

function M.say(text, seconds) M.note, M.note_t = text, seconds or 2.5 end

function M.tick(dt)
  M.data.time = M.data.time + dt
  if M.note_t > 0 then M.note_t = M.note_t - dt; if M.note_t <= 0 then M.note = nil end end
end

return M
