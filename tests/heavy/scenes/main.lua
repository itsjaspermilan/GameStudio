local Main = gs.scene{}
local STARS = tonumber(os.getenv("GS_HEAVY_STARS") or "200")
local THINGS = tonumber(os.getenv("GS_HEAVY_THINGS") or "0") -- moving, colliding entities: the Lua side of a frame
local t = 0

function Main:enter()
  for i = 1, THINGS do gs.spawn("mover", (i * 53) % 256, (i * 31) % 192) end
end

function Main:update(dt) t = t + dt end

function Main:draw_ui()
  local draw = gs.draw
  draw.sprite("back", 128, 96)
  draw.sprite("glow", 128, 96, { blend = "add", alpha = 0.8 })
  draw.sprite("glow", 100, 80, { blend = "darken", alpha = 0.5 })
  draw.sprite("glow", 160, 110, { alpha = 0.5 })
  for i = 1, STARS do
    local a = i * 2.39996 + t * 0.7
    local r = 10 + (i * 37) % 90
    draw.sprite("star", 128 + math.cos(a) * r * 1.3, 96 + math.sin(a) * r, { angle = (t * 90 + i * 13) % 360, scale = 0.75 + (i % 5) * 0.25, alpha = 0.9 })
  end
  for i = 1, 4 do draw.rect(0, 0, 256, 192, "#10204020") end
  draw.text("HEAVY " .. STARS .. (THINGS > 0 and " / " .. THINGS or ""), 4, 4, "#ffffff")
end
return Main
