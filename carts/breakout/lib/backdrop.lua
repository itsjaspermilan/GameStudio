-- A starry background made of tiles: tile 1 of the tileset is a star, tile 0 is empty space.
return function()
  local rng = gs.rng(7)
  local data = {}
  for row = 1, 15 do
    data[row] = {}
    for col = 1, 20 do data[row][col] = rng:float() < 0.08 and 1 or 0 end
  end
  gs.add_layer{ tileset = "ts_bg", data = data, depth = 100 }
end
