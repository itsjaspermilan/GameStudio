-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#a6f4e6",
  layers = {
    { name = "sky", tileset = "ts_sky", depth = 100, wrap_x = true, wrap_y = true, data = {
      { 4, 5, 6, 7 },
      { 20, 21, 22, 23 },
      { 36, 37, 38, 39 },
      { 52, 53, 54, 55 },
    } },
  },
  entities = {
  },
  panels = {
    { 0, 0, 320, 24, tileset = "ts_ui", tile = 6, name = "header" },
    { 12, 30, 296, 188, tileset = "ts_ui", tile = 0, name = "box" },
    { 20, 38, 280, 20, tileset = "ts_ui", tile = 6, name = "title_bar" },
    { 0, 222, 320, 18, tileset = "ts_ui", tile = 6, name = "footer" },
  },
  texts = {
    { "How to Play", 12, 7, name = "heading", color = "#ffffff", font = "bold_tall", shadow = "#14234f" },
    { "", 312, 7, name = "page_no", color = "#f5d94a", align = "right", font = "round_tall", shadow = "#14234f" },
    { "", 160, 43, name = "title", color = "#ffffff", align = "center", font = "round_tall", shadow = "#14234f" },
    { "", 24, 63, name = "line1", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 24, 76, name = "line2", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 24, 89, name = "line3", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 24, 102, name = "line4", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 24, 115, name = "line5", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 24, 128, name = "line6", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 24, 141, name = "line7", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 24, 154, name = "line8", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "Left/Right  Page     B  Back", 8, 228, name = "hint", color = "#ffffff", font = "round_small", shadow = "#14234f" },
  },
}
