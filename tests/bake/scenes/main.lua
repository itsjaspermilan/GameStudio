local Main = gs.scene{}
local plain = os.getenv("GS_BAKE_PLAIN")
local SHADOW = { font = "round_tall", shadow = true }

-- the backdrop, at an offset: the bake draws it at (0, 0) of its picture and the picture goes where the plain drawing would
local function backdrop(ox, oy)
  gs.draw.rect(ox, oy, 200, 120, "#203058")
  for i = 0, 19 do gs.draw.rect(ox + i * 10, oy + 60 + (i % 3) * 4, 8, 40, i % 2 == 0 and "#3a5a8a" or "#5878a8") end
  gs.draw.line(ox, oy + 2, ox + 199, oy + 50, "#ffd08a")
  gs.draw.circle(ox + 150, oy + 30, 12, "#f8f8f0")
  gs.draw.panel(ox + 8, oy + 8, 80, 30)
  gs.draw.text("BAKED", ox + 16, oy + 16, "#f8f8f0", 1, SHADOW)
  gs.draw.sprite("green", ox + 120, oy + 80)
end

function Main:enter()
  gs.background("#101010")
  if not plain then self.pic = gs.draw.bake("backdrop", 200, 120, function() backdrop(0, 0) end) end
end

local n = 0
function Main:update()
  n = n + 1
  gs.camera:set(-3, -5) -- the world's camera must not move what the bake drew
end

function Main:draw()
  if plain then backdrop(30, 40) else gs.draw.picture(self.pic, 30, 40) end
end

return Main
