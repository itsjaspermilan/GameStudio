local Main = gs.scene{}
local plain = os.getenv("GS_MOSAIC_PLAIN")
local N = 4

function Main:enter()
  gs.world.bg = "#000000"
  if not plain then gs.raw.mosaic(N) end
end

local n = 0
function Main:update()
  n = n + 1
  if n == 3 then
    print("MOSAIC TEST RAN")
    gs.quit()
  end
end

-- every block gets its own colour, so a block that took a pixel from the wrong place shows
local function color(bx, by) return { 40 + bx * 3, 40 + by * 4, 200 } end

function Main:draw_ui()
  local w, h = gs.screen()
  for by = 0, h // N - 1 do
    for bx = 0, w // N - 1 do
      if plain then gs.draw.rect(bx * N, by * N, N, N, color(bx, by))
      else gs.draw.rect(bx * N + N // 2, by * N + N // 2, 1, 1, color(bx, by)) end
    end
  end
end

return Main
