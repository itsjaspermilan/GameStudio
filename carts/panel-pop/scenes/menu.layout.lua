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
    { "PANEL POP", 12, 8, name = "heading", font = "spr_font_w" },
    { "ENDLESS", 34, 37, name = "item1", font = "spr_font" },
    { "TIME ATTACK", 34, 63, name = "item2", font = "spr_font" },
    { "VS CPU", 34, 89, name = "item3", font = "spr_font" },
    { "STAGE CLEAR", 34, 115, name = "item4", font = "spr_font" },
    { "PUZZLE", 34, 141, name = "item5", font = "spr_font" },
    { "HOW TO PLAY", 34, 167, name = "item6", font = "spr_font" },
    { "RECORDS", 34, 193, name = "item7", font = "spr_font" },
    { "", 194, 141, name = "desc1", font = "spr_font" },
    { "", 194, 154, name = "desc2", font = "spr_font" },
    { "", 194, 167, name = "desc3", font = "spr_font" },
    { "", 194, 180, name = "desc4", font = "spr_font" },
    { "", 194, 193, name = "desc5", font = "spr_font" },
    { "", 194, 206, name = "desc6", font = "spr_font" },
    { "A SELECT   B BACK", 8, 227, name = "hint", font = "spr_font_w" },
  },
  pictures = {
    { "spr_ico_arrow", 24, 41, name = "arrow" },
  },
}
