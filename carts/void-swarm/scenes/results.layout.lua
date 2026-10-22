-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#000000",
  entities = {
  },
  boxes = {
    { 30, 20, 260, 196, name = "panel", color = 0, alpha = 225, edge = 14, screen = true },
    { 60, 168, 200, 1, name = "divider", color = 22, screen = true },
  },
  texts = {
    { "SECTOR CLEARED!", 160, 30, name = "headline", color = 14, size = 2, align = "center", screen = true },
    { "SECTOR NAME", 160, 54, name = "sector", color = 2, size = 1, align = "center", screen = true },
    { "TIME", 70, 120, name = "time_label", color = 2, size = 1, screen = true },
    { "LEVEL", 70, 131, name = "level_label", color = 2, size = 1, screen = true },
    { "ENEMIES", 70, 142, name = "enemies_label", color = 2, size = 1, screen = true },
    { "COINS", 70, 153, name = "coins_label", color = 2, size = 1, screen = true },
    { "CREDITS EARNED", 70, 176, name = "credits_label", color = 3, size = 1, screen = true },
    { "PRESS A", 160, 204, name = "prompt", color = 3, size = 1, align = "center", screen = true },
  },
  pictures = {
    { "spr_pilot_nova", 160, 90, name = "pilot", frame = 2, scale = 2, screen = true },
  },
}
