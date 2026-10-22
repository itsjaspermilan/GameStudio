-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#a6f4e6",
  code = "play",
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
    { 116, 24, 88, 192, tileset = "ts_ui", tile = 0, name = "middle" },
    { 0, 90, 320, 52, tileset = "ts_ui", tile = 6, name = "banner_bar", screen = true },
    { 100, 70, 120, 96, tileset = "ts_ui", tile = 0, name = "pause_box", screen = true },
    { 112, 96, 96, 20, tileset = "ts_ui", tile = 0, name = "prow1", screen = true },
    { 112, 118, 96, 20, tileset = "ts_ui", tile = 0, name = "prow2", screen = true },
    { 112, 140, 96, 20, tileset = "ts_ui", tile = 0, name = "prow3", screen = true },
  },
  texts = {
    { "PIP", 160, 76, name = "p1_name", align = "center", font = "spr_font" },
    { "0", 160, 88, name = "p1_score", align = "center", font = "spr_font" },
    { "", 160, 100, name = "p1_shout", align = "center", font = "spr_font_r" },
    { "", 160, 178, name = "p2_name", align = "center", font = "spr_font" },
    { "0", 160, 190, name = "p2_score", align = "center", font = "spr_font" },
    { "", 160, 202, name = "p2_shout", align = "center", font = "spr_font_r" },
    { "VS", 160, 114, name = "vs", size = 2, align = "center", font = "spr_font_r" },
    { "", 160, 98, name = "banner", size = 2, align = "center", font = "spr_font_y", screen = true },
    { "PRESS A", 160, 124, name = "banner_hint", align = "center", font = "spr_font_w", screen = true },
    { "PAUSED", 160, 80, name = "pause_title", align = "center", font = "spr_font_r", screen = true },
    { "RESUME", 160, 102, name = "ptext1", align = "center", font = "spr_font", screen = true },
    { "RESTART", 160, 124, name = "ptext2", align = "center", font = "spr_font", screen = true },
    { "QUIT", 160, 146, name = "ptext3", align = "center", font = "spr_font", screen = true },
  },
  pictures = {
    { "spr_char_pip", 160, 50, name = "p1_face", scale = 1.5 },
    { "spr_char_bloop", 160, 152, name = "p2_face", scale = 1.5 },
  },
}
