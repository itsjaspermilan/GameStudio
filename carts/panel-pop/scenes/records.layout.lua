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
    { "Records", 12, 7, name = "heading", color = "#ffffff", font = "bold_tall", shadow = "#14234f" },
    { "Easy", 190, 39, name = "col1", color = "#ea5a4b", align = "right", font = "round_tall", shadow = "#ffd6cc" },
    { "Normal", 248, 39, name = "col2", color = "#ea5a4b", align = "right", font = "round_tall", shadow = "#ffd6cc" },
    { "Hard", 300, 39, name = "col3", color = "#ea5a4b", align = "right", font = "round_tall", shadow = "#ffd6cc" },
    { "Endless", 22, 59, name = "endless_label", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "0", 190, 59, name = "endless1", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "0", 248, 59, name = "endless2", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "0", 300, 59, name = "endless3", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "Time Attack", 22, 77, name = "time_label", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "0", 190, 77, name = "time1", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "0", 248, 77, name = "time2", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "0", 300, 77, name = "time3", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "Rivals beaten", 22, 95, name = "vs_label", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "0", 190, 95, name = "vs1", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "0", 248, 95, name = "vs2", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "0", 300, 95, name = "vs3", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "Stage reached", 22, 125, name = "stage_label", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 300, 125, name = "stage", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "Puzzles solved", 22, 143, name = "puzzles_label", color = "#14234f", font = "round_tall", shadow = "#a8d4ff" },
    { "", 300, 143, name = "puzzles", color = "#14234f", align = "right", font = "round_tall", shadow = "#a8d4ff" },
    { "Keep popping!", 164, 181, name = "cheer", color = "#ea5a4b", align = "center", font = "round_tall", shadow = "#ffd6cc" },
    { "B  Back", 8, 228, name = "hint", color = "#ffffff", font = "round_small", shadow = "#14234f" },
  },
  pictures = {
    { "spr_char_pip", 52, 182, name = "pip", scale = 2 },
    { "spr_ico_star", 252, 180, name = "star1" },
    { "spr_ico_star", 276, 192, name = "star2" },
  },
}
