-- data.lua: the names and numbers of Panel Pop (opponents, difficulties, stages). To rebalance the
-- game this is the file to edit.
local art = require "lib.art"
local SKIES = #art.SKIES
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
-- order. Chars index art.CHAR_IDS (1 = Pip, the player). sky: the background (lib/ui.lua). gap:
-- frames per cursor step. cool: frames between moves. think: frames between decisions. err: chance
-- of a worse move.
M.OPPONENTS = {
  { char = 2, name = "BLOOP", speed = 1, sky = 6, gap = 15, cool = 30, think = 40, err = 0.55, chains = false, raise = false, hi = "BLIP BLOP!", lo = "BLOOP... SLEEPY." },
  { char = 3, name = "FUZZ",  speed = 2, sky = 5, gap = 12, cool = 22, think = 32, err = 0.40, chains = false, raise = true,  hi = "FLUFF YOU UP!", lo = "AWW, FUZZY LOSS." },
  { char = 4, name = "KIT",   speed = 3, sky = 1, gap = 10, cool = 18, think = 26, err = 0.32, chains = false, raise = true,  hi = "PURR-FECT!", lo = "HISS. REMATCH?" },
  { char = 5, name = "SPIKE", speed = 5, sky = 3, gap = 8,  cool = 14, think = 22, err = 0.25, chains = true,  raise = true,  hi = "OUCH? GOOD.", lo = "THAT STUNG." },
  { char = 6, name = "PUFF",  speed = 7, sky = 1, gap = 7,  cool = 11, think = 18, err = 0.18, chains = true,  raise = true,  hi = "PUFF PUFF!", lo = "I'M DEFLATING..." },
  { char = 7, name = "EMBER", speed = 9, sky = 5, gap = 6,  cool = 9,  think = 14, err = 0.12, chains = true,  raise = true,  hi = "FEEL THE HEAT!", lo = "I BURNED OUT." },
  { char = 8, name = "FROST", speed = 11, sky = 2, gap = 5, cool = 7,  think = 11, err = 0.07, chains = true,  raise = true,  hi = "STAY COOL.", lo = "BRRR. NICELY DONE." },
  { char = 9, name = "SHADE", speed = 14, sky = 3, gap = 4, cool = 5,  think = 8,  err = 0.03, chains = true,  raise = true,  hi = "BOW TO THE KING.", lo = "THE CROWN IS YOURS." },
}

-- ---------------------------------------------------------------- Stage Clear: break every garbage
-- block to clear the stage
-- Each stage lays garbage blocks over a small stack. speed is the rise level, rain is seconds
-- between extra blocks that drop in (0 = none).
M.STAGE_COUNT = 15
function M.STAGE_DEF(i)
  local d = { n = i, speed = 1 + math.floor(i * 1.3), colors = i >= 9 and 6 or 5, sky = (i - 1) % SKIES + 1, rain = i >= 4 and (46 - i * 2) or 0, rows = {} }
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

return M
