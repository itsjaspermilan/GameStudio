local Main = gs.scene{}
function Main:enter()
  gs.sfx("blip", 0.8); gs.music("tune"); gs.sfx_stop(); gs.music_stop(0.1)
  local ok1 = pcall(gs.sfx, "nope")
  local ok2 = pcall(gs.music, "nope")
  print("UNKNOWN SFX " .. (ok1 and "ACCEPTED" or "REJECTED") .. " / UNKNOWN MUSIC " .. (ok2 and "ACCEPTED" or "REJECTED"))
  print("AUDIO TEST PASS")
  gs.raw.quit()
end
return Main
