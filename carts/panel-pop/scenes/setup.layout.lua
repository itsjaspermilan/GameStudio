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
    { "ENDLESS", 12, 8, name = "heading", font = "spr_font_w" },
    { "", 48, 49, name = "row1_name", font = "spr_font" },
    { "<", 172, 49, name = "row1_left", font = "spr_font_r" },
    { "", 224, 49, name = "row1_value", align = "center", font = "spr_font" },
    { ">", 268, 49, name = "row1_right", font = "spr_font_r" },
    { "", 48, 77, name = "row2_name", font = "spr_font" },
    { "<", 172, 77, name = "row2_left", font = "spr_font_r" },
    { "", 224, 77, name = "row2_value", align = "center", font = "spr_font" },
    { ">", 268, 77, name = "row2_right", font = "spr_font_r" },
    { "START", 160, 116, name = "start_text", align = "center", font = "spr_font_w" },
    { "", 192, 160, name = "info1", align = "center", font = "spr_font" },
    { "", 192, 174, name = "info2", align = "center", font = "spr_font_r" },
    { "", 192, 188, name = "info3", align = "center", font = "spr_font" },
    { "", 192, 202, name = "info4", align = "center", font = "spr_font" },
    { "UP/DOWN PICK   </> CHANGE   A START", 8, 227, name = "hint", font = "spr_font_w" },
  },
  pictures = {
    { "spr_char_bloop", 62, 184, name = "rival" },
  },
}
