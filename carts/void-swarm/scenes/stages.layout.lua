-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#000000",
  entities = {
  },
  panels = {
    { 0, 0, 320, 23, tileset = "ts_panel", tile = 9, name = "header", screen = true },
    { 6, 172, 308, 52, tileset = "ts_panel", tile = 6, name = "sector_panel", screen = true },
    { 0, 226, 320, 14, tileset = "ts_panel", tile = 12, name = "footer", screen = true },
  },
  texts = {
    { "Choose a Sector", 8, 6, name = "heading", color = 14, size = 1, font = "bold_tall", shadow = true, screen = true },
  },
}
