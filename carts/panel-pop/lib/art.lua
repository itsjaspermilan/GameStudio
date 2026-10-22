-- Written by scripts/make-panel-pop.mjs: frame counts and sizes of every sprite, and the palette.
local M = {}
M.ART = {
  spr_char_pip = { f = 4, w = 32, h = 32 },
  spr_doc = { f = 5, w = 32, h = 32 },
  spr_char_bloop = { f = 4, w = 32, h = 32 },
  spr_char_fuzz = { f = 4, w = 32, h = 32 },
  spr_char_kit = { f = 4, w = 32, h = 32 },
  spr_char_spike = { f = 4, w = 32, h = 32 },
  spr_char_puff = { f = 4, w = 32, h = 32 },
  spr_char_ember = { f = 4, w = 32, h = 32 },
  spr_char_frost = { f = 4, w = 32, h = 32 },
  spr_char_shade = { f = 4, w = 32, h = 32 },
  spr_bigvirus = { f = 12, w = 32, h = 32 },
  spr_panels = { f = 36, w = 16, h = 16 },
  spr_garbage = { f = 28, w = 16, h = 16 },
  spr_pills = { f = 18, w = 16, h = 16 },
  spr_viruses = { f = 9, w = 16, h = 16 },
  spr_ico_arrow = { f = 1, w = 8, h = 8 },
  spr_ico_star = { f = 2, w = 8, h = 8 },
  spr_ico_spark = { f = 3, w = 8, h = 8 },
}
M.PAL = {{0, 0, 0}, {59, 63, 85}, {138, 144, 168}, {255, 255, 255}, {74, 20, 36}, {176, 41, 58}, {234, 90, 75}, {255, 163, 140}, {75, 42, 29}, {154, 83, 36}, {232, 145, 58}, {255, 208, 138}, {107, 90, 20}, {201, 162, 39}, {245, 217, 74}, {255, 246, 168}, {18, 59, 42}, {47, 138, 63}, {108, 207, 79}, {196, 242, 138}, {15, 59, 74}, {31, 138, 150}, {69, 209, 197}, {166, 244, 230}, {20, 35, 79}, {42, 86, 196}, {79, 155, 240}, {168, 212, 255}, {45, 26, 79}, {106, 63, 181}, {165, 107, 224}, {217, 179, 255}}
M.PANEL_STATES = 6
M.GARBAGE_PIECES = 14
M.CHAR_IDS = {"pip", "bloop", "fuzz", "kit", "spike", "puff", "ember", "frost", "shade"}
M.BG_COUNT = 8
M.SFX_NAMES = {"move", "swap", "land", "raise", "clear", "chain2", "chain3", "chain4", "chain5", "combo", "garb_land", "garb_break", "send", "panic", "tick", "go", "win", "lose", "solved", "speedup", "ok", "back", "select", "error", "pill_move", "pill_rot", "pill_land", "virus_pop", "pill_clear", "virus_laugh", "pop1", "pop2", "pop3", "pop4", "pop5", "pop6", "pop7", "pop8"}
M.MUSIC_NAMES = {"msc_title", "msc_menu", "msc_endless", "msc_panic", "msc_vs", "msc_stage", "msc_puzzle", "msc_time", "msc_dm_a", "msc_dm_b", "msc_dm_vs", "msc_win", "msc_lose", "msc_ending"}
return M
