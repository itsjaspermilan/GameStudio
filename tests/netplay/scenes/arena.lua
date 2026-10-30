local Arena = gs.scene{}
local cached_random = NET_RANDOM
function Arena:enter()
  assert(gs.net.count == tonumber(os.getenv("GS_NET_EXPECT") or "2"))
  assert(gs.net.peers()[gs.net.me].name == (os.getenv("GS_NET_ROLE") == "host" and "Host" or os.getenv("GS_NET_ROLE")))
  assert(gs.save.get("score") == 17 and gs.save.slot(3).get("level") == 5, "the host's saves were not shared")
  assert(gs.save.get("guest_only") == nil, "the guest's own save leaked into the session")
  assert(#gs.save.get("large") == 10000, "a multi-packet save was not shared")
  self.roll = cached_random(1, 1000000)
  gs.save.delete("not_present")
  for p = 1, gs.net.count do gs.spawn("player", 0, 0, { player = p }) end
  print("NETPLAY START " .. gs.net.me .. " " .. gs.net.count)
end
function Arena:update()
  local step = gs.world.step_id
  self.roll = cached_random(1, 1000000)
  if os.getenv("GS_NET_DRIFT") and os.getenv("GS_NET_ROLE") ~= "host" and step >= 61 then self.roll = self.roll + 1 end
  if step % 60 == 0 then
    gs.save.set("score", 17 + step)
    if step >= 120 then
      local players = gs.world.all
      assert(players[1].x > 0 and players[2].x < 0, "player buttons were not kept separate")
      for _, player in ipairs(players) do assert(player.presses > 1 and player.releases > 1, "press/release edges were lost") end
    end
    print("NETPLAY STEP " .. step)
  end
end
function Arena:on_net_end(reason)
  assert(gs.net.state == "off" and gs.net.me == 1 and gs.net.count == 1)
  if os.getenv("GS_NET_LEAVE") then
    local role = os.getenv("GS_NET_ROLE")
    assert(gs.save.get("score") == (role == "host" and 137 or 91), "local saves were not restored after leaving")
    if role == "host" then
      local transport = require("gs.transport")
      transport.open(tonumber(os.getenv("GS_NET_PORT"))); transport.close()
    end
    print("NETPLAY LEAVE PASS")
    gs.raw.quit()
  end
  if os.getenv("GS_NET_DRIFT") then
    assert(reason:find("out of step", 1, true))
    print("NETPLAY DRIFT PASS")
    gs.raw.quit()
  end
  print("NETPLAY END " .. reason)
end
return Arena
