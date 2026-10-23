-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#a8d4ff",
  layers = {
    { name = "sky", tileset = "ts_sky", depth = 100, wrap_x = true, wrap_y = true, data = {
      { 0, 1, 2, 3 },
      { 16, 17, 18, 19 },
      { 32, 33, 34, 35 },
      { 48, 49, 50, 51 },
    } },
  },
  entities = {
  },
  panels = {
    { 0, 0, 320, 24, tileset = "ts_ui", tile = 6, name = "header" },
    { 12, 30, 164, 22, tileset = "ts_ui", tile = 0, name = "row1" },
    { 12, 56, 164, 22, tileset = "ts_ui", tile = 0, name = "row2" },
    { 12, 82, 164, 22, tileset = "ts_ui", tile = 0, name = "row3" },
    { 12, 108, 164, 22, tileset = "ts_ui", tile = 0, name = "row4" },
    { 12, 134, 164, 22, tileset = "ts_ui", tile = 0, name = "row5" },
    { 12, 160, 164, 22, tileset = "ts_ui", tile = 0, name = "row6" },
    { 12, 186, 164, 22, tileset = "ts_ui", tile = 0, name = "row7" },
    { 186, 30, 122, 96, tileset = "ts_ui", tile = 0, name = "preview_box" },
    { 186, 132, 122, 84, tileset = "ts_ui", tile = 0, name = "info_box" },
    { 0, 222, 320, 18, tileset = "ts_ui", tile = 6, name = "footer" },
  },
  texts = {
    { "Panel Pop", 12, 7, name = "heading", color = "#ffffff", font = "bold_tall", shadow = "#14234f" },
    { "Endless", 34, 36, name = "item1", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "Time Attack", 34, 62, name = "item2", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "Vs CPU", 34, 88, name = "item3", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "Stage Clear", 34, 114, name = "item4", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "Puzzle", 34, 140, name = "item5", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "How to Play", 34, 166, name = "item6", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "Records", 34, 192, name = "item7", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 194, 140, name = "desc1", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 194, 153, name = "desc2", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 194, 166, name = "desc3", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 194, 179, name = "desc4", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 194, 192, name = "desc5", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 194, 205, name = "desc6", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "A  Choose     B  Back", 8, 228, name = "hint", color = "#ffffff", font = "round_small", shadow = "#14234f" },
  },
  pictures = {
    { "spr_ico_arrow", 24, 41, name = "arrow" },
  },
}
