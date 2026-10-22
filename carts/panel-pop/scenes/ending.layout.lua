-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#d9b3ff",
  layers = {
    { name = "sky", tileset = "ts_sky", depth = 100, wrap_x = true, wrap_y = true, data = {
      { 8, 9, 10, 11 },
      { 24, 25, 26, 27 },
      { 40, 41, 42, 43 },
      { 56, 57, 58, 59 },
    } },
  },
  entities = {
  },
  panels = {
    { 28, 18, 264, 48, tileset = "ts_ui", tile = 0, name = "card" },
  },
  texts = {
    { "CONGRATULATIONS!", 160, 26, name = "title", size = 2, align = "center", font = "spr_font_r" },
    { "YOU BEAT ALL EIGHT RIVALS", 160, 50, name = "subtitle", align = "center", font = "spr_font" },
    { "PRESS A", 160, 214, name = "prompt", align = "center", font = "spr_font_w" },
  },
  pictures = {
    { "spr_char_pip", 160, 112, name = "pip", scale = 2 },
    { "spr_char_bloop", 28, 172, name = "c1" },
    { "spr_char_fuzz", 66, 172, name = "c2" },
    { "spr_char_kit", 104, 172, name = "c3" },
    { "spr_char_spike", 142, 172, name = "c4" },
    { "spr_char_puff", 180, 172, name = "c5" },
    { "spr_char_ember", 218, 172, name = "c6" },
    { "spr_char_frost", 256, 172, name = "c7" },
    { "spr_char_shade", 294, 172, name = "c8" },
  },
}
