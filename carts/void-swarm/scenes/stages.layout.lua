-- The scene's layout, built when it starts. Named things are fields of its code: self.<name>.
return {
  width = 320, height = 240, background = "#000000",
  entities = {
  },
  boxes = {
    { 0, 0, 320, 22, name = "header", color = 0, alpha = 200, screen = true },
    { 0, 22, 320, 1, name = "header_line", color = 22, screen = true },
    { 6, 172, 308, 52, name = "sector_panel", color = 0, alpha = 215, edge = 22, screen = true },
    { 0, 226, 320, 14, name = "footer", color = 0, alpha = 210, screen = true },
  },
  texts = {
    { "CHOOSE A SECTOR", 8, 7, name = "heading", color = 14, size = 1, screen = true },
  },
}
