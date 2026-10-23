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
    { "Pip", 160, 65, name = "p1_name", color = "#ea5a4b", align = "center", font = "round_tall", shadow = "#ffd6cc" },
    { "0", 160, 77, name = "p1_score", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "", 160, 91, name = "p1_shout", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "", 160, 163, name = "p2_name", color = "#ea5a4b", align = "center", font = "round_tall", shadow = "#ffd6cc" },
    { "0", 160, 175, name = "p2_score", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "", 160, 189, name = "p2_shout", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "VS", 160, 106, name = "vs", color = "#ea5a4b", size = 2, align = "center", font = "bold_tall", shadow = "#ffd6cc" },
    { "", 160, 203, name = "level", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
    { "", 160, 96, name = "banner", color = "#f5d94a", size = 2, align = "center", font = "bold_tall", shadow = "#14234f", screen = true },
    { "Press A", 160, 123, name = "banner_hint", color = "#ffffff", align = "center", font = "round_tall", shadow = "#14234f", screen = true },
    { "Paused", 160, 79, name = "pause_title", color = "#ea5a4b", align = "center", font = "round_tall", shadow = "#ffd6cc", screen = true },
    { "Resume", 160, 101, name = "ptext1", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff", screen = true },
    { "Restart", 160, 123, name = "ptext2", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff", screen = true },
    { "Quit", 160, 145, name = "ptext3", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff", screen = true },
  },
  pictures = {
    { "spr_char_pip", 160, 46, name = "p1_face" },
    { "spr_char_bloop", 160, 144, name = "p2_face" },
  },
}
