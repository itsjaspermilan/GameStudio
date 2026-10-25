-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 256, height = 192, background = "#0b0d1a",
  layers = {
    { name = "stars", tileset = "space", depth = 100, data = {
      { 0, 2, 0, 0, 0, 0, 0, 0 },
      { 2, 2, 0, 1, 3, 1, 1, 0 },
      { 0, 1, 0, 0, 2, 0, 1, 0 },
      { 0, 0, 0, 0, 0, 0, 1, 3 },
      { 3, 2, 0, 3, 0, 0, 2, 0 },
      { 2, 0, 0, 3, 0, 0, 3, 0 },
    } },
  },
  entities = {
  },
  texts = {
    { "BREAKOUT", 128, 44, name = "title", color = "text:2", size = 3, align = "center", font = "bold_tall", shadow = true },
    { "PRESS A", 128, 136, name = "prompt", color = "text:1", align = "center", font = "round_tall", shadow = true },
    { "BEST 0", 128, 162, name = "best", color = "text:3", align = "center" },
  },
  pictures = {
    { "brick", 64, 96, name = "brick_left", frame = 0 },
    { "brick", 112, 96, name = "brick_mid", frame = 2 },
    { "brick", 160, 96, name = "brick_right", frame = 4 },
  },
}
