-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#0b0d1a",
  layers = {
    { name = "stars", tileset = "ts_space", depth = 100, data = {
      { 0, 2, 0, 0, 0, 0, 0, 0, 1, 0 },
      { 2, 2, 0, 1, 3, 1, 1, 0, 0, 0 },
      { 0, 1, 0, 0, 2, 0, 1, 0, 2, 1 },
      { 0, 0, 0, 0, 0, 0, 1, 3, 2, 0 },
      { 3, 2, 0, 3, 0, 0, 2, 0, 0, 3 },
      { 2, 0, 0, 3, 0, 0, 3, 0, 2, 1 },
      { 0, 0, 0, 2, 0, 1, 0, 2, 2, 0 },
      { 0, 0, 0, 2, 0, 3, 0, 0, 2, 2 },
    } },
  },
  entities = {
  },
  texts = {
    { "GAME OVER", 160, 80, name = "result", color = "text:2", size = 2, align = "center", font = "bold_tall", shadow = true },
    { "SCORE 0   BEST 0", 160, 124, name = "score", color = "text:3", align = "center" },
    { "PRESS A TO PLAY AGAIN", 160, 170, name = "prompt", color = "text:1", align = "center", font = "round_tall", shadow = true },
  },
}
