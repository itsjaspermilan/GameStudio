return {
  width = 640, height = 480,
  entities = {
    { "dummy", 5, 6, { hp = 7 }, name = "thing" },
    { "dummy", 50, 60 },
  },
  texts = {
    { "HELLO", 160, 100, name = "title", color = 3, size = 2, align = "center" },
    { "AB", 10, 200, name = "fancy", font = "ball" },
  },
  panels = {
    { 0, 0, 50, 30, tileset = "ts_bg", tile = 0, name = "frame" },
    { 0, 40, 50, 4, tileset = "ts_bg", tile = 0 },
  },
  pictures = {
    { "ball", 10, 20, name = "logo", scale = 2 },
  },
}
