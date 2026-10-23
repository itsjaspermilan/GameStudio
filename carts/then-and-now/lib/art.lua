-- Written by scripts/make-then-and-now.mjs: Wren's frames in spr_hero (with each frame's body bob) and tile numbers.
local M = {}
M.HERO_DY = { 0, 1, 0, 1, -1, 0, 1, -1, -1, 0, 5, 2, 0, 3, 0, 1, 0, 1, -1, 0, 1, -1, -1, 0, -1, 0, 1 }   -- how far each frame's body sits lower than standing (index frame + 1)
M.HERO = { idle = 0, run = 2, jump = 8, fall = 9, crouch = 10, dash = 11, slide = 12, land = 13, idle_up = 14, run_up = 16, jump_up = 22, fall_up = 23, jump_down = 24, fall_down = 25, hurt = 26 }
M.TILE = { THIN = 16, HAZARD = 17, PANEL = 24, LIGHT = 25, VENT = 26, WINDOW = 27, PIPE_V = 28, PIPE_H = 29, STRIPE = 30, DARK = 31 }
return M
