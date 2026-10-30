local role = os.getenv("GS_NET_ROLE") or "host"
local expected = tonumber(os.getenv("GS_NET_EXPECT") or "2")
local started, joined, waited, done_at = false, false, false, nil
local input = gs.input
NET_RANDOM = math.random
local transport = require("gs.transport")
transport.open(0)
assert(not pcall(transport.send, "not-an-address", "x"))
assert(not pcall(transport.send, "127.0.0.1:1", string.rep("x", 1201)))
transport.close()
assert(transport.receive() == nil)
if os.getenv("GS_NET_LOSS") then
  local original, count, pending = transport.send, 0, nil
  function transport.send(to, data)
    count = count + 1
    if count % 5 == 0 then return true end
    if count % 7 == 0 and not pending then pending = { to, data }; return true end
    local result = original(to, data)
    if pending then original(pending[1], pending[2]); pending = nil end
    return result
  end
end
local local_score = role == "host" and 17 or 91
gs.save.set("score", local_score)
gs.save.slot(3).set("level", role == "host" and 5 or 91)
gs.save.set("large", string.rep("x", 10000))
if role ~= "host" then gs.save.set("guest_only", true) end
gs.save.flush()
if os.getenv("GS_NET_STATE_GUARD") then gs.net.host("Host"); started = true end
local clock = gs.raw.time
local born = clock()
function bot_step()
  if role == "scanner" then
    assert(#gs.net.find() == 0, "discovery returned a different game")
    if clock() - born > 1 then print("NETPLAY FILTER PASS"); gs.raw.quit() end
    return
  end
  if not started then
    started = true
    if role == "host" then gs.net.host("Host") end
  end
  if role ~= "host" and not joined then
    local sessions = gs.net.find()
    if #sessions > 0 then
      assert(sessions[1].players >= 1 and sessions[1].max == 4)
      gs.net.join(sessions[1].id, role); joined = true
    end
  end
  if role == "host" and gs.net.state == "lobby" and gs.net.count == expected and not _G.NET_STARTED then
    _G.NET_STARTED = true
    gs.net.start("scenes.arena")
  end
  if gs.net.state == "waiting" and not waited then waited = true; print("NETPLAY WAITING") end
  if gs.net.state == "playing" or gs.net.state == "waiting" then
    input.sim_hold("right", role == "host")
    input.sim_hold("left", role ~= "host")
    input.sim_hold("a", gs.world.step_id % 40 < 10)
    if role == "host" and os.getenv("GS_NET_LEAVE") and gs.world.step_id >= 120 then gs.net.leave(); return end
    if gs.world.step_id >= 180 then done_at = done_at or clock() end
    if done_at and clock() - done_at >= 0.5 then print("NETPLAY TEST PASS"); gs.raw.quit() end
  end
  if clock() - born > 12 then error("netplay fixture timed out: " .. gs.net.state) end
end
