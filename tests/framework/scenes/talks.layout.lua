-- the look of gs.say's box: a panel and a text named dialogue_*, only patterns (the game does not show them itself)
return {
  panels = { { 4, 180, 312, 40, tileset = "ts_bg", tile = 0, name = "dialogue_box" } },
  texts = {
    { "", 12, 188, name = "dialogue_text", color = 3 },
    { "", 12, 172, name = "dialogue_name", color = 14 },
  },
}
