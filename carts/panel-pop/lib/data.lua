-- data.lua: the names and numbers of Panel Pop & Doc Capsule (opponents, difficulties, stages). To
-- rebalance the game this is the file to edit.
local art = require "lib.art"
local BG_COUNT, CHAR_IDS = art.BG_COUNT, art.CHAR_IDS
local M = {}

-- ---------------------------------------------------------------- difficulty (what the player
-- picks) colors: how many kinds of panel. speed: where Endless starts. cpu: how much better the CPU
-- opponents play (added to their level).
M.DIFFS = {
  { name = "EASY",   colors = 5, speed = 1, cpu = -0.25 },
  { name = "NORMAL", colors = 5, speed = 4, cpu = 0 },
  { name = "HARD",   colors = 6, speed = 8, cpu = 0.2 },
}

-- ---------------------------------------------------------------- Panel Pop opponents, in ladder
-- order. Chars index CHAR_IDS (1 = Pip, the player). gap: frames per cursor step. cool: frames
-- between moves. think: frames between decisions. err: chance of a worse move.
M.OPPONENTS = {
  { char = 2, name = "BLOOP", speed = 1, bg = 4, gap = 15, cool = 30, think = 40, err = 0.55, chains = false, raise = false, hi = "Blip blop!", lo = "Bloop... sleepy." },
  { char = 3, name = "FUZZ",  speed = 2, bg = 6, gap = 12, cool = 22, think = 32, err = 0.40, chains = false, raise = true,  hi = "Fluff you up!", lo = "Aww, fuzzy loss." },
  { char = 4, name = "KIT",   speed = 3, bg = 1, gap = 10, cool = 18, think = 26, err = 0.32, chains = false, raise = true,  hi = "Purr-fect!", lo = "Hiss. Rematch?" },
  { char = 5, name = "SPIKE", speed = 5, bg = 2, gap = 8,  cool = 14, think = 22, err = 0.25, chains = true,  raise = true,  hi = "Ouch? Good.", lo = "That stung." },
  { char = 6, name = "PUFF",  speed = 7, bg = 7, gap = 7,  cool = 11, think = 18, err = 0.18, chains = true,  raise = true,  hi = "Puff puff!", lo = "I'm deflating..." },
  { char = 7, name = "EMBER", speed = 9, bg = 5, gap = 6,  cool = 9,  think = 14, err = 0.12, chains = true,  raise = true,  hi = "Feel the heat!", lo = "I burned out." },
  { char = 8, name = "FROST", speed = 11, bg = 3, gap = 5, cool = 7,  think = 11, err = 0.07, chains = true,  raise = true,  hi = "Stay cool.", lo = "Brrr. Nicely done." },
  { char = 9, name = "SHADE", speed = 14, bg = 8, gap = 4, cool = 5,  think = 8,  err = 0.03, chains = true,  raise = true,  hi = "Bow to the king.", lo = "The crown is yours." },
}

-- ---------------------------------------------------------------- Doc Capsule opponents (the same
-- characters, a different game)
M.DM_SPEEDS = { "LOW", "MED", "HI" }
M.DM_OPPONENTS = {
  { gap = 14, err = 0.55, think = 40 }, { gap = 11, err = 0.42, think = 32 }, { gap = 9, err = 0.32, think = 26 }, { gap = 7, err = 0.24, think = 20, look = true },
  { gap = 6, err = 0.16, think = 16, look = true }, { gap = 5, err = 0.10, think = 12, look = true }, { gap = 4, err = 0.05, think = 9, look = true }, { gap = 3, err = 0.02, think = 6, look = true },
}

-- ---------------------------------------------------------------- Stage Clear: break every garbage
-- block to clear the stage
-- Each stage lays garbage blocks over a small stack. speed is the rise level, rain is seconds
-- between extra blocks that drop in (0 = none).
M.STAGE_COUNT = 15
function M.STAGE_DEF(i)
  local d = { n = i, speed = 1 + math.floor(i * 1.3), colors = i >= 9 and 6 or 5, bg = (i - 1) % BG_COUNT + 1, rain = i >= 4 and (46 - i * 2) or 0, rows = {} }
  -- deterministic layout from the stage number
  local seed = 7919 * i
  local function rnd(n) seed = (seed * 1103515245 + 12345) % 2147483648; return seed // 65536 % n + 1 end
  local nrows = math.min(2 + i // 2, 6)
  local pats = { { 6 }, { 3, 3 }, { 4 }, { 5 }, { 3 }, { 3, 3 }, { 6 } }
  for r = 1, nrows do
    local pat = pats[rnd(#pats)]
    local row, total = {}, 0
    for _, w in ipairs(pat) do total = total + w end
    local x = total < 6 and rnd(7 - total) or 1
    for _, w in ipairs(pat) do row[#row + 1] = { x = x, w = w, h = (i >= 6 and rnd(3) == 1) and 2 or 1, metal = i >= 8 and rnd(4) == 1 }; x = x + w end
    d.rows[r] = row
  end
  return d
end

-- ---------------------------------------------------------------- the little tips shown while
-- loading and on the results screen
M.TIPS = {
  "Match 3 or more panels in a row or column.",
  "Hold B to raise the stack faster.",
  "Panels that fall into place can match again: that is a chain!",
  "Match next to a garbage block to break it open.",
  "Clear 4 or more at once to send garbage to your rival.",
  "You can swap a panel with an empty space.",
  "Doc Capsule: line up 4 of a colour to pop viruses.",
  "A and B turn the capsule. Hold down to drop it.",
}
return M
