-- Over #404040: green #208020 added makes #60c060; grey #808080 darkening makes #202020; green at
-- half strength (normal) makes
-- #306030; the tile layer adds green at half strength: #508050.
local Main = gs.scene{}
local plain = os.getenv("GS_BLEND_PLAIN")
local failed = 0
local function check(what, ok)
  if not ok then failed = failed + 1; print("FAIL " .. what) end
end

function Main:enter()
  gs.world.bg = "#404040"
  if plain then return end
  gs.spawn("glow", 0, 0)
  gs.world.add_layer({ tileset = "solid", data = { { -1, -1, -1, 0 } }, blend = "add", alpha = 0.5, depth = 10 })
  gs.burst(-100, -100, { count = 3, speed = 0, blend = "add" }) -- off the screen: the blend path runs, the random sparks stay out of the frame
  check("a bad mode is an error", not pcall(gs.draw.blend, "glowy"))
end

local n = 0
function Main:update()
  n = n + 1
  if n == 3 then
    if failed == 0 then print("BLEND TEST PASS") end
    gs.quit()
  end
end

function Main:draw_ui()
  if plain then
    gs.draw.rect(0, 0, 8, 8, "#60c060"); gs.draw.rect(8, 0, 8, 8, "#202020"); gs.draw.rect(16, 0, 8, 8, "#306030")
    gs.draw.rect(24, 0, 8, 8, "#508050")
  else
    gs.draw.sprite("grey", 8, 0, { blend = "darken" })
    gs.draw.sprite("green", 16, 0, { alpha = 0.5 })
    gs.draw.rect(40, 0, 8, 8, "#ffffff") -- after a sprite with a blend mode, plain drawing is back to normal
  end
  if plain then gs.draw.rect(40, 0, 8, 8, "#ffffff") end
end
return Main
