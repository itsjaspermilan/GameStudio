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
    { 30, 30, 260, 128, tileset = "ts_ui", tile = 0, name = "card" },
    { 90, 164, 140, 20, tileset = "ts_ui", tile = 0, name = "opt1" },
    { 90, 186, 140, 20, tileset = "ts_ui", tile = 0, name = "opt2" },
    { 90, 208, 140, 20, tileset = "ts_ui", tile = 0, name = "opt3" },
  },
  texts = {
    { "Results", 12, 7, name = "heading", color = "#ffffff", font = "bold_tall", shadow = "#14234f" },
    { "", 160, 38, name = "head", color = "#ea5a4b", size = 2, align = "center", font = "bold_tall", shadow = "#ffd6cc" },
    { "", 46, 63, name = "lab1", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 274, 63, name = "val1", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "", 46, 76, name = "lab2", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 274, 76, name = "val2", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "", 46, 89, name = "lab3", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 274, 89, name = "val3", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "", 46, 102, name = "lab4", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 274, 102, name = "val4", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "", 46, 115, name = "lab5", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 274, 115, name = "val5", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "New record!", 160, 139, name = "record", color = "#ea5a4b", align = "center", font = "round_tall", shadow = "#ffd6cc" },
    { "", 160, 169, name = "opt1_text", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "", 160, 191, name = "opt2_text", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "", 160, 213, name = "opt3_text", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
  },
  pictures = {
    { "spr_char_pip", 52, 190, name = "pip", scale = 2 },
  },
}
