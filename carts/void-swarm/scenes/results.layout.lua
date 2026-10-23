-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#000000",
  entities = {
  },
  panels = {
    { 30, 20, 260, 196, tileset = "ts_panel", tile = 15, name = "panel", screen = true },
    { 60, 168, 200, 8, tileset = "ts_panel", tile = 21, name = "divider", screen = true },
  },
  texts = {
    { "Sector Cleared!", 160, 26, name = "headline", color = 14, size = 2, align = "center", font = "bold_tall", shadow = true, screen = true },
    { "Sector Name", 160, 53, name = "sector", color = 2, size = 1, align = "center", font = "round_tall", shadow = true, screen = true },
    { "Time", 70, 120, name = "time_label", color = 2, size = 1, shadow = true, screen = true },
    { "Level", 70, 131, name = "level_label", color = 2, size = 1, shadow = true, screen = true },
    { "Enemies", 70, 142, name = "enemies_label", color = 2, size = 1, shadow = true, screen = true },
    { "Coins", 70, 153, name = "coins_label", color = 2, size = 1, shadow = true, screen = true },
    { "Credits earned", 70, 176, name = "credits_label", color = 3, size = 1, shadow = true, screen = true },
    { "Press A", 160, 202, name = "prompt", color = 3, size = 1, align = "center", font = "bold_tall", shadow = true, screen = true },
  },
  pictures = {
    { "spr_pilot_nova", 160, 90, name = "pilot", frame = 2, scale = 2, screen = true },
  },
}
