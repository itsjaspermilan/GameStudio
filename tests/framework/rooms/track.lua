-- A room as the room editor writes it: a walker on a square path that loops, and a straight path that ends.
return {
  width = 320, height = 240, background = "#101220",
  entities = {
    { "walker", 10, 10 },
  },
  paths = {
    square = { { 10, 10 }, { 110, 10 }, { 110, 110 }, { 10, 110 }, loop = true },
    line = { { 0, 0 }, { 30, 0 } },
  },
}
