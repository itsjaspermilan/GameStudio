-- The state of one run (R) and everything several kinds of entity share: the player's stats,
-- damage, explosions, drops, level-up choices and the end of a run. R holds the run; R.P (also
-- run.P) is the player entity; progress between runs is in lib/save.lua.
local data = require "lib.data"
local save = require "lib.save"
local audio = require "lib.audio"

local floor, sin, cos, sqrt, abs, max, min, random = math.floor, math.sin, math.cos, math.sqrt, math.abs, math.max, math.min, math.random
local TAU = math.pi * 2

-- How many of each thing may exist at once. They add up to well under the console's 512 entities.
local ENEMY_CAP, BULLET_CAP, PICKUP_CAP, SHOT_CAP, FX_CAP = 100, 100, 120, 60, 50

local M = { R = nil, P = nil, nbullets = 0, ENEMY_CAP = ENEMY_CAP }

-- ---------------------------------------------------------------- stat plumbing
function M.describe(stat, amt)
  if stat == "count" then return "+" .. amt .. (amt == 1 and " shot" or " shots") end
  if stat == "pierce" then return "+" .. amt .. " pierce" end
  local pct = floor(abs(amt) * 100 + 0.5)
  local names = { dmg = "damage", cd = "cooldown", area = "area", speed = "speed", dur = "duration" }
  return (amt < 0 and "-" or "+") .. pct .. "% " .. (names[stat] or stat)
end

function M.weapon_index(id)
  for i, w in ipairs(data.WEAPON_ORDER) do if w == id then return i end end
end

-- the player's modifiers: the pilot, the permanent ship ranks and the passives picked in this run
function M.build_mods()
  local R = M.R
  local pilot = data.PILOTS[R.pilot_index]
  local m = { dmg = 0, cd = 0, area = 0, xp = 0, credits = 0, magnet = 0, regen = 0, armor = 0, spd = 1, hp = 100, dashcd = 0, dashinv = 0, revive = 0, reroll = 0, startlevel = 0, startbonus = 0 }
  for k, v in pairs(pilot.mods) do if k == "hp" or k == "spd" then m[k] = m[k] * v else m[k] = m[k] + v end end
  for pi, path in ipairs(data.SHIP_PATHS) do
    for rank = 1, save.data.ship[pi] do
      for k, v in pairs(path.ranks[rank][3]) do
        if k == "hp_add" then m.hp = m.hp + v elseif k == "spd_add" then m.spd = m.spd + v else m[k] = (m[k] or 0) + v end
      end
    end
  end
  for id, lv in pairs(R.passives) do
    local p = data.PASSIVES[id]
    if p.key == "hp" then m.hp = m.hp + p.per * lv elseif p.key == "spd" then m.spd = m.spd + p.per * lv else m[p.key] = m[p.key] + p.per * lv end
  end
  return m
end

-- what a weapon does right now: its base numbers plus the in-run levels, the permanent paths and
-- the player's modifiers
function M.weapon_stats(w)
  local def, wi = data.WEAPONS[w.id], M.weapon_index(w.id)
  local acc = { dmg = 0, cd = 0, area = 0, speed = 0, dur = 0, count = 0, pierce = 0 }
  for i = 1, w.lv - 1 do local u = def.up[i]; acc[u[1]] = acc[u[1]] + u[2] end
  acc.dmg = acc.dmg + save.data.wa[wi] * data.WEAPON_PATH_A.per
  for i = 1, save.data.wb[wi] do local u = def.pathB[i]; acc[u[1]] = acc[u[1]] + u[2] end
  local m = M.P.mods
  return { dmg = def.dmg * (1 + acc.dmg + m.dmg), cd = def.cd * max(0.3, 1 + acc.cd + m.cd), count = def.count + acc.count + (w.first and m.startbonus or 0),
    speed = def.speed * (1 + acc.speed), pierce = def.pierce + acc.pierce, area = def.area * (1 + acc.area + m.area), dur = 1 + acc.dur }
end

function M.recalc()
  local P = M.P
  P.mods = M.build_mods()
  local oldmax = P.maxhp
  P.maxhp = floor(P.mods.hp)
  if oldmax and P.maxhp > oldmax then P.hp = P.hp + (P.maxhp - oldmax) end
  P.hp = min(P.hp, P.maxhp)
  for _, w in ipairs(M.R.weapons) do w.s = M.weapon_stats(w) end
end

function M.xp_need(level) return floor(4 + 4.5 * level + 0.35 * level * level) end
function M.add_xp(v) M.P.xp = M.P.xp + v * (1 + M.P.mods.xp) end

-- ---------------------------------------------------------------- starting a run
-- Sets up the run's state. The scene then makes the player, whose create() calls init_player.
function M.start(pilot_index, stage)
  local pilot = data.PILOTS[pilot_index]
  M.R = { stage = stage, sdef = data.STAGES[stage], pilot_index = pilot_index, pilot = pilot, t = 0, kills = 0, coin_count = 0, bonus_credits = 0, weapons = {}, passives = {},
    spawn_t = 1, haz_t = 4, dmgmul = 1 + (stage - 1) * 0.07, hpmul = 1 + (stage - 1) * 0.09, over = nil, rerolls = 0, boss = nil, boss_alert = 0, end_t = 0, win = false }
  M.R.weapons[1] = { id = pilot.weapon, lv = 1, t = 0.4, first = true }
  M.nbullets = 0
  M.P = nil
  return M.R
end

function M.init_player(p)
  local R = M.R
  M.P = p
  p.mods = M.build_mods()
  p.hp = floor(p.mods.hp); p.maxhp = p.hp
  R.rerolls = p.mods.reroll
  M.recalc()
  p.hp = p.maxhp
  R.pending_levels = p.mods.startlevel
  p.lvl = 1 + p.mods.startlevel
end

-- ---------------------------------------------------------------- making things
function M.fx(name, x, y, life, scale, vx, vy)
  if gs.count("fx") > FX_CAP then return end
  gs.spawn("fx", x, y, { sprite = "spr_fx_" .. name, life = life or 0.4, sx = scale or 1, sy = scale or 1, vx = vx or 0, vy = vy or 0,
    blend = name ~= "puff" and "add" or nil })          -- blasts, sparks and pops are light: they glow over what is behind
end

-- a point on a ring around the player
function M.ring_pos(dist)
  local a = random() * TAU
  return M.P.x + cos(a) * dist, M.P.y + sin(a) * dist, a
end

-- kind is a file in entities/enemies/ ("grub"). free: the cap on enemies does not stop splits and
-- summons from a little over it.
function M.spawn_enemy(kind, x, y, free)
  local n = gs.count("enemy")
  if n >= ENEMY_CAP + 20 or (n >= ENEMY_CAP and not free) then return nil end
  return gs.spawn("enemies." .. kind, x, y)
end

-- kind is a file in entities/bullets/: shot, shot2, bossshot, mine, meteor
function M.enemy_bullet(x, y, ang, speed, dmg, kind, life, props)
  if M.nbullets >= BULLET_CAP then return nil end
  local p = props or {}
  p.vx, p.vy, p.dmg, p.life = cos(ang) * speed, sin(ang) * speed, dmg, life or 3.2
  return gs.spawn("bullets." .. (kind or "shot"), x, y, p)
end

function M.shot(kind, x, y, props)
  if gs.count("shot") >= SHOT_CAP then return nil end
  return gs.spawn("weapons." .. kind, x, y, props)
end

-- ---------------------------------------------------------------- hurting and healing
function M.hurt_player(dmg, src)
  local P, R = M.P, M.R
  if P.inv > 0 or P.dash > 0 or R.over then return end
  dmg = max(1, floor(dmg * R.dmgmul * min(2.2, 1 + R.t / 240) - P.mods.armor + 0.5))
  P.hp = P.hp - dmg
  if src then R.hits = R.hits or {}; R.hits[src] = (R.hits[src] or 0) + dmg end
  P.inv = 0.7
  P.flash = 0.25
  gs.camera:shake(2.4, 0.33)
  audio.sfx("sfx_hurt", 6)
end

-- everything within r of (x, y) takes damage and is thrown outward
function M.explode(x, y, r, dmg, scale)
  M.fx("boom", x, y, 0.45, scale or r / 24)
  audio.sfx("sfx_explode", 4)
  local list = gs.all("enemy")
  for i = 1, #list do
    local e = list[i]
    if not e._dead then
      local dx, dy = e.x - x, e.y - y
      local d = sqrt(dx * dx + dy * dy)
      if d <= r + e:radius() then e:hurt(dmg, dx / (d + 0.01) * 80, dy / (d + 0.01) * 80) end
    end
  end
end

-- ---------------------------------------------------------------- drops
function M.drop(e)
  local x, y = e.x, e.y
  if gs.count("pickup") > PICKUP_CAP then -- too many on the floor: the oldest is cashed in at once
    local far = gs.first("pickup")
    if far then
      if far.kind == "gem" then M.add_xp(far.v) end
      far:destroy()
    end
  end
  gs.spawn("pickup", x + random(-3, 3), y + random(-3, 3), { kind = "gem", v = e.xp })
  local roll = random()
  local big = e.xp >= 8
  if roll < 0.05 + (big and 0.15 or 0) then gs.spawn("pickup", x + 4, y, { kind = "coin", v = 1 })
  elseif roll < 0.057 + (big and 0.05 or 0) then gs.spawn("pickup", x, y, { kind = "heart", v = 25 })
  elseif roll < 0.060 then gs.spawn("pickup", x, y, { kind = "magnet", v = 0 })
  elseif roll < 0.063 then gs.spawn("pickup", x, y, { kind = "bomb", v = 0 }) end
end

-- ---------------------------------------------------------------- level-ups
local function weapon_owned(id)
  for _, w in ipairs(M.R.weapons) do if w.id == id then return w end end
end

function M.make_choices()
  local R = M.R
  local pool = {}
  for _, w in ipairs(R.weapons) do
    if w.lv < 8 then
      local u = data.WEAPONS[w.id].up[w.lv]
      pool[#pool + 1] = { kind = "wup", id = w.id, title = data.WEAPONS[w.id].name .. " LV" .. (w.lv + 1), text = M.describe(u[1], u[2]), icon = data.WEAPONS[w.id].icon, weight = 3 }
    end
  end
  if #R.weapons < 4 then
    for _, id in ipairs(data.WEAPON_ORDER) do
      if not weapon_owned(id) then pool[#pool + 1] = { kind = "wnew", id = id, title = data.WEAPONS[id].name, text = data.WEAPONS[id].blurb, icon = data.WEAPONS[id].icon, weight = 2, new = true } end
    end
  end
  local owned = 0
  for _ in pairs(R.passives) do owned = owned + 1 end
  for _, id in ipairs(data.PASSIVE_ORDER) do
    local lv = R.passives[id]
    local p = data.PASSIVES[id]
    if lv and lv < 5 then pool[#pool + 1] = { kind = "pup", id = id, title = p.name .. " LV" .. (lv + 1), text = p.text, icon = p.icon, weight = 3 }
    elseif not lv and owned < 4 then pool[#pool + 1] = { kind = "pnew", id = id, title = p.name, text = p.text, icon = p.icon, weight = 2, new = true } end
  end
  local picks = {}
  for _ = 1, 3 do
    if #pool == 0 then break end
    local total = 0
    for _, c in ipairs(pool) do total = total + c.weight end
    local roll, idx = random() * total, 1
    for i, c in ipairs(pool) do roll = roll - c.weight; if roll <= 0 then idx = i; break end end
    picks[#picks + 1] = table.remove(pool, idx)
  end
  if #picks == 0 then
    picks[1] = { kind = "heal", title = "REPAIR", text = "Heal 40% health", icon = "p_repair" }
    picks[2] = { kind = "gold", title = "SALVAGE", text = "+30 credits", icon = "s_salvage" }
  end
  return picks
end

function M.apply_choice(c)
  local R, P = M.R, M.P
  if c.kind == "wnew" then R.weapons[#R.weapons + 1] = { id = c.id, lv = 1, t = 0.3 }
  elseif c.kind == "wup" then weapon_owned(c.id).lv = weapon_owned(c.id).lv + 1
  elseif c.kind == "pnew" then R.passives[c.id] = 1
  elseif c.kind == "pup" then R.passives[c.id] = R.passives[c.id] + 1
  elseif c.kind == "heal" then P.hp = min(P.maxhp, P.hp + P.maxhp * 0.4)
  elseif c.kind == "gold" then R.bonus_credits = R.bonus_credits + 30 end
  M.recalc()
  audio.sfx("sfx_ok", 1)
end

function M.reroll()
  local R = M.R
  if R.rerolls > 0 then R.rerolls = R.rerolls - 1; R.choices = M.make_choices(); audio.sfx("sfx_ok", 1); return true end
  audio.sfx("sfx_error", 1)
end

-- after a choice: another level-up may be waiting (a big gem, a head start), otherwise back to the
-- run
function M.next_after_choice()
  local R, P = M.R, M.P
  if P.xp >= M.xp_need(P.lvl) then
    P.xp = P.xp - M.xp_need(P.lvl); P.lvl = P.lvl + 1; R.choices = M.make_choices(); audio.sfx("sfx_levelup", 1)
    return false
  elseif R.pending_levels and R.pending_levels > 0 then
    R.pending_levels = R.pending_levels - 1; R.choices = M.make_choices()
    return false
  end
  return true
end

-- ---------------------------------------------------------------- the end of a run
function M.finish(win)
  local R, P = M.R, M.P
  R.over = true
  R.win = win
  R.end_t = 0
  local base = R.coin_count * (1 + floor((R.stage - 1) / 2)) + floor(R.kills / 10) + R.bonus_credits + (win and (30 + R.stage * 25) or 0)
  R.credits = floor(base * (1 + P.mods.credits) + 0.5)
  local s = save.data
  s.credits = s.credits + R.credits
  s.runs = s.runs + 1
  s.kills = s.kills + R.kills
  R.newstage = nil
  if win then
    if R.stage > s.cleared then s.cleared = R.stage; R.newstage = R.stage + 1 <= #data.STAGES and R.stage + 1 or nil end
    if s.best[R.stage] == 0 or R.t < s.best[R.stage] then s.best[R.stage] = floor(R.t) end
  end
  save.write()
  audio.stop_music()
  audio.sfx("sfx_ok", 1)
end

return M
