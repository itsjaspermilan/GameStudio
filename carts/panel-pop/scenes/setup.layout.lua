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
    { 24, 32, 272, 112, tileset = "ts_ui", tile = 0, name = "box" },
    { 36, 42, 248, 22, tileset = "ts_ui", tile = 0, name = "row1" },
    { 36, 70, 248, 22, tileset = "ts_ui", tile = 0, name = "row2" },
    { 100, 106, 120, 28, tileset = "ts_ui", tile = 36, name = "start" },
    { 24, 150, 272, 68, tileset = "ts_ui", tile = 0, name = "info_box" },
    { 0, 222, 320, 18, tileset = "ts_ui", tile = 6, name = "footer" },
  },
  texts = {
    { "Endless", 12, 7, name = "heading", color = "#ffffff", font = "bold_tall", shadow = "#14234f" },
    { "", 48, 48, name = "row1_name", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "<", 172, 48, name = "row1_left", color = "#ea5a4b", font = "round_tall", shadow = "#ffd6cc" },
    { "", 224, 48, name = "row1_value", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { ">", 268, 48, name = "row1_right", color = "#ea5a4b", font = "round_tall", shadow = "#ffd6cc" },
    { "", 48, 76, name = "row2_name", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "<", 172, 76, name = "row2_left", color = "#ea5a4b", font = "round_tall", shadow = "#ffd6cc" },
    { "", 224, 76, name = "row2_value", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { ">", 268, 76, name = "row2_right", color = "#ea5a4b", font = "round_tall", shadow = "#ffd6cc" },
    { "Start", 160, 115, name = "start_text", color = "#ffffff", align = "center", font = "round_tall", shadow = "#14234f" },
    { "", 192, 159, name = "info1", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "", 192, 173, name = "info2", color = "#ea5a4b", align = "center", font = "round_tall", shadow = "#ffd6cc" },
    { "", 192, 187, name = "info3", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "", 192, 201, name = "info4", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "Up/Down  Pick     Left/Right  Change     A  Start", 8, 228, name = "hint", color = "#ffffff", font = "round_small", shadow = "#14234f" },
  },
  pictures = {
    { "spr_char_bloop", 62, 184, name = "rival" },
  },
}
