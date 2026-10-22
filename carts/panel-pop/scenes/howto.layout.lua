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
    { "HOW TO PLAY", 12, 8, name = "heading", font = "spr_font_w" },
    { "", 312, 8, name = "page_no", align = "right", font = "spr_font_y" },
    { "", 160, 44, name = "title", align = "center", font = "spr_font_w" },
    { "", 24, 66, name = "line1", font = "spr_font" },
    { "", 24, 78, name = "line2", font = "spr_font" },
    { "", 24, 90, name = "line3", font = "spr_font" },
    { "", 24, 102, name = "line4", font = "spr_font" },
    { "", 24, 114, name = "line5", font = "spr_font" },
    { "", 24, 126, name = "line6", font = "spr_font" },
    { "", 24, 138, name = "line7", font = "spr_font" },
    { "", 24, 150, name = "line8", font = "spr_font" },
    { "</> PAGE   B BACK", 8, 227, name = "hint", font = "spr_font_w" },
  },
}
