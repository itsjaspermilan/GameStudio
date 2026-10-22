-- Written by scripts/make-panel-pop.mjs: sprite sizes and where things are in the tilesets.
local M = {}
M.ART = {
  spr_char_pip = { f = 4, w = 32, h = 32 },
  spr_char_bloop = { f = 4, w = 32, h = 32 },
  spr_char_fuzz = { f = 4, w = 32, h = 32 },
  spr_char_kit = { f = 4, w = 32, h = 32 },
  spr_char_spike = { f = 4, w = 32, h = 32 },
  spr_char_puff = { f = 4, w = 32, h = 32 },
  spr_char_ember = { f = 4, w = 32, h = 32 },
  spr_char_frost = { f = 4, w = 32, h = 32 },
  spr_char_shade = { f = 4, w = 32, h = 32 },
  spr_panels = { f = 36, w = 16, h = 16 },
  spr_garbage = { f = 28, w = 16, h = 16 },
  spr_logo = { f = 6, w = 32, h = 32 },
  spr_cursor = { f = 2, w = 40, h = 24 },
  spr_spark = { f = 4, w = 8, h = 8 },
  spr_ico_arrow = { f = 2, w = 8, h = 8 },
  spr_ico_star = { f = 2, w = 8, h = 8 },
  spr_font = { f = 59, w = 8, h = 8 },
  spr_font_w = { f = 59, w = 8, h = 8 },
  spr_font_r = { f = 59, w = 8, h = 8 },
  spr_font_y = { f = 59, w = 8, h = 8 },
}
M.PANEL_STATES = 6
M.GARBAGE_PIECES = 14
M.CHAR_IDS = {"pip", "bloop", "fuzz", "kit", "spike", "puff", "ember", "frost", "shade"}
M.CHAR_SPRITES = {"spr_char_pip", "spr_char_bloop", "spr_char_fuzz", "spr_char_kit", "spr_char_spike", "spr_char_puff", "spr_char_ember", "spr_char_frost", "spr_char_shade"}
M.LOGO_LETTERS = "PANELO"
-- ts_sky: backgrounds of 4x4 tiles, four across
M.SKIES = {"blue", "mint", "lilac", "lemon", "peach", "lime"}
-- ts_ui: 3x3 blocks of 8x8 tiles for panels, four across
M.UI = {window = 0, selected = 3, bar = 6, inset = 9, go = 36, pink = 39, lilac = 42, mint = 45}
M.SFX_NAMES = {"move", "swap", "land", "raise", "clear", "chain2", "chain3", "chain4", "chain5", "combo", "garb_land", "garb_break", "send", "panic", "tick", "go", "win", "lose", "solved", "speedup", "ok", "back", "select", "error", "pop1", "pop2", "pop3", "pop4", "pop5", "pop6", "pop7", "pop8"}
M.MUSIC_NAMES = {"msc_title", "msc_menu", "msc_endless", "msc_panic", "msc_vs", "msc_stage", "msc_puzzle", "msc_time", "msc_win", "msc_lose", "msc_ending"}
return M
