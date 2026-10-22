-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#fff6a8",
  layers = {
    { name = "sky", tileset = "ts_sky", depth = 100, wrap_x = true, wrap_y = true, data = {
      { 12, 13, 14, 15 },
      { 28, 29, 30, 31 },
      { 44, 45, 46, 47 },
      { 60, 61, 62, 63 },
    } },
  },
  entities = {
  },
  panels = {
    { 0, 0, 320, 24, tileset = "ts_ui", tile = 6, name = "header" },
    { 12, 30, 296, 188, tileset = "ts_ui", tile = 0, name = "box" },
    { 20, 114, 280, 2, tileset = "ts_ui", tile = 9, name = "rule" },
    { 0, 222, 320, 18, tileset = "ts_ui", tile = 6, name = "footer" },
  },
  texts = {
    { "RECORDS", 12, 8, name = "heading", font = "spr_font_w" },
    { "EASY", 190, 40, name = "col1", align = "right", font = "spr_font_r" },
    { "NORMAL", 248, 40, name = "col2", align = "right", font = "spr_font_r" },
    { "HARD", 300, 40, name = "col3", align = "right", font = "spr_font_r" },
    { "ENDLESS", 22, 60, name = "endless_label", font = "spr_font" },
    { "0", 190, 60, name = "endless1", align = "right", font = "spr_font" },
    { "0", 248, 60, name = "endless2", align = "right", font = "spr_font" },
    { "0", 300, 60, name = "endless3", align = "right", font = "spr_font" },
    { "TIME ATTACK", 22, 78, name = "time_label", font = "spr_font" },
    { "0", 190, 78, name = "time1", align = "right", font = "spr_font" },
    { "0", 248, 78, name = "time2", align = "right", font = "spr_font" },
    { "0", 300, 78, name = "time3", align = "right", font = "spr_font" },
    { "RIVALS BEATEN", 22, 96, name = "vs_label", font = "spr_font" },
    { "0", 190, 96, name = "vs1", align = "right", font = "spr_font" },
    { "0", 248, 96, name = "vs2", align = "right", font = "spr_font" },
    { "0", 300, 96, name = "vs3", align = "right", font = "spr_font" },
    { "STAGE REACHED", 22, 126, name = "stage_label", font = "spr_font" },
    { "", 300, 126, name = "stage", align = "right", font = "spr_font" },
    { "PUZZLES SOLVED", 22, 144, name = "puzzles_label", font = "spr_font" },
    { "", 300, 144, name = "puzzles", align = "right", font = "spr_font" },
    { "KEEP POPPING!", 164, 182, name = "cheer", align = "center", font = "spr_font_r" },
    { "B BACK", 8, 227, name = "hint", font = "spr_font_w" },
  },
  pictures = {
    { "spr_char_pip", 52, 182, name = "pip", scale = 2 },
    { "spr_ico_star", 252, 180, name = "star1" },
    { "spr_ico_star", 276, 192, name = "star2" },
  },
}
