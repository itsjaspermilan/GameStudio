-- Shortcuts for testing and screenshots (never set on the handheld):
--   GS_ROOM=<id>      start in that room, skipping the title (with GS_DOOR=<A-F> at a door)
--   GS_HAS=lens,dash  abilities to start with;   GS_FLAGS=intro,ossie_met   story flags to start with
--   GS_ERA=then       start with the Lens in Then;   GS_STATIC=n   start with that much Static
--   GS_SCREEN=end     show the end-of-part screen
--   GS_SELFTEST=1     visit every room and check it (Wren never arrives inside a wall, in either era); prints THEN AND NOW TEST PASS
local state = require "lib.state"

local M = {}

local function list(name)
  local out = {}
  for v in (os.getenv(name) or ""):gmatch("[^,]+") do out[#out + 1] = v end
  return out
end

-- Called by the title: true when a shortcut took over.
function M.start()
  if os.getenv("GS_SCREEN") == "end" then gs.goto_scene("scenes.slice_end") return true end
  if os.getenv("GS_SELFTEST") then
    local world = require "lib.world"
    state.new_game()
    state.data.flags.intro = true
    M.test = { rooms = {}, i = 0, fails = {} }
    for id in pairs(world.rooms) do M.test.rooms[#M.test.rooms + 1] = id end
    table.sort(M.test.rooms)
    M.next_room()
    return true
  end
  local room = os.getenv("GS_ROOM")
  if not room then return false end
  state.new_game()
  local d = state.data
  for _, a in ipairs(list("GS_HAS")) do d.has[a] = true end
  for _, f in ipairs(list("GS_FLAGS")) do d.flags[f] = true end
  if not d.flags.intro and room ~= "dock" then d.flags.intro = true end
  d.static = tonumber(os.getenv("GS_STATIC") or "0")
  d.room, d.door, d.save_room = room, os.getenv("GS_DOOR"), room
  if os.getenv("GS_ERA") == "then" then require("lib.lens").era = "then" end
  gs.goto_scene("scenes.rooms." .. room)
  return true
end

-- ---------- the self-test: called by the room scene after it is set up

function M.next_room()
  local t = M.test
  t.i = t.i + 1
  local id = t.rooms[t.i]
  if not id then
    if #t.fails == 0 then print("THEN AND NOW TEST PASS (" .. #t.rooms .. " rooms)") else
      for _, f in ipairs(t.fails) do print("FAIL: " .. f) end
    end
    return
  end
  state.data.room, state.data.door = id, nil
  gs.goto_scene("scenes.rooms." .. id)
end

function M.room_entered(scene)
  local t = M.test
  if not t then return end
  local tiles = require "lib.tiles"
  local function blocked(x, y, era) return tiles.box_wall(x - 6, y - 28, x + 6, y, era) end
  local id = scene.room_id
  scene:open_seals() -- a sealed door is only walked through once it is open
  if not scene.hero then t.fails[#t.fails + 1] = id .. ": no hero" end
  for name, door in pairs(scene.info.doors) do
    local x = door.side == "left" and door.x + 34 or door.x - 18
    for _, era in ipairs({ "now", "then" }) do
      if blocked(x, door.y, era) then t.fails[#t.fails + 1] = string.format("%s door %s: Wren arrives inside a wall in %s", id, name, era) end
    end
  end
  gs.after(0.05, M.next_room)
end

return M
