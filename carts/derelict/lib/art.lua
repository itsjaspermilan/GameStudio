-- Written by scripts/make-derelict.mjs: the hero's frames in spr_hero, the upgrade capsules' frames, ts_station tiles.
local M = {}
M.HERO_DY = { 0, 1, 0, 1, -1, 0, 1, -1, -1, 0, 5, 2, 0, 3, 0, 1, 0, 1, -1, 0, 1, -1, -1, 0, -1, 0 }   -- how far each frame's body sits lower than standing (index frame + 1)
M.HERO = { idle = 0, run = 2, jump = 8, fall = 9, crouch = 10, dash = 11, slide = 12, land = 13, idle_up = 14, run_up = 16, jump_up = 22, fall_up = 23, jump_down = 24, fall_down = 25 }
M.UPGRADES = { "dash", "double", "wall", "charge", "missile" }
M.TILE = { WALL = 0, THIN = 16, PANEL = 24, PANEL_LIGHT = 25, VENT = 26, WINDOW = 27, PIPE_V = 28, PIPE_H = 29 }
return M
