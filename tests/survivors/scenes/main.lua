local Main = gs.scene{}
local BATS = tonumber(os.getenv("GS_SV_BATS") or "300")
Main.hero = nil

function Main:enter()
  math.randomseed(1)
  local data = {}
  for r = 1, 64 do
    local row = {}
    for c = 1, 64 do row[c] = (r * 7 + c * 3) % 4 end
    data[r] = row
  end
  gs.add_layer{ name = "ground", tileset = "grass", data = data, depth = 1000 }
  self.hero = gs.spawn("hero", 512, 512)
  gs.camera:follow(self.hero, { bounds = { 0, 0, 1024, 1024 } })
  for i = 1, BATS do Main.spawn_bat(self.hero, i) end
end

function Main.spawn_bat(hero, i)
  local a = (i or math.random(1000)) * 2.39996
  local r = os.getenv("GS_SV_STILL") and 4 + (i % 60) * 1.5 or 140 + (i or math.random(100)) % 60
  return gs.spawn("bat", hero.x + math.cos(a) * r, hero.y + math.sin(a) * r)
end

function Main:draw_ui()
  gs.draw.text("BATS " .. gs.count("bat") .. "  GEMS " .. gs.count("gem"), 4, 4, "#ffffff", 1, { shadow = true })
end
return Main
