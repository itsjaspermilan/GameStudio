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
    { 92, 198, 136, 22, tileset = "ts_ui", tile = 6, name = "prompt_bar" },
  },
  texts = {
    { "Press Start", 160, 204, name = "prompt", color = "#ffffff", align = "center", font = "round_tall", shadow = "#14234f" },
    { "Swap, match and pop!", 160, 227, name = "tagline", color = "#14234f", align = "center", font = "round_tall", shadow = "#a8d4ff" },
  },
  pictures = {
    { "spr_logo", 92, 50, name = "l1", frame = 0 },
    { "spr_logo", 126, 50, name = "l2", frame = 1 },
    { "spr_logo", 160, 50, name = "l3", frame = 2 },
    { "spr_logo", 194, 50, name = "l4", frame = 3 },
    { "spr_logo", 228, 50, name = "l5", frame = 4 },
    { "spr_logo", 126, 88, name = "l6", frame = 0 },
    { "spr_logo", 160, 88, name = "l7", frame = 5 },
    { "spr_logo", 194, 88, name = "l8", frame = 0 },
    { "spr_char_bloop", 40, 168, name = "rival1" },
    { "spr_char_ember", 86, 176, name = "rival2" },
    { "spr_char_frost", 234, 176, name = "rival3" },
    { "spr_char_kit", 280, 168, name = "rival4" },
    { "spr_char_pip", 160, 150, name = "pip", scale = 2 },
  },
}
