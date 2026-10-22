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
    { "RESULTS", 12, 8, name = "heading", font = "spr_font_w" },
    { "", 160, 40, name = "head", size = 2, align = "center", font = "spr_font_r" },
    { "", 46, 64, name = "lab1", font = "spr_font" },
    { "", 274, 64, name = "val1", align = "right", font = "spr_font" },
    { "", 46, 77, name = "lab2", font = "spr_font" },
    { "", 274, 77, name = "val2", align = "right", font = "spr_font" },
    { "", 46, 90, name = "lab3", font = "spr_font" },
    { "", 274, 90, name = "val3", align = "right", font = "spr_font" },
    { "", 46, 103, name = "lab4", font = "spr_font" },
    { "", 274, 103, name = "val4", align = "right", font = "spr_font" },
    { "", 46, 116, name = "lab5", font = "spr_font" },
    { "", 274, 116, name = "val5", align = "right", font = "spr_font" },
    { "NEW RECORD!", 160, 140, name = "record", align = "center", font = "spr_font_r" },
    { "", 160, 170, name = "opt1_text", align = "center", font = "spr_font" },
    { "", 160, 192, name = "opt2_text", align = "center", font = "spr_font" },
    { "", 160, 214, name = "opt3_text", align = "center", font = "spr_font" },
  },
  pictures = {
    { "spr_char_pip", 52, 190, name = "pip", scale = 2 },
  },
}
