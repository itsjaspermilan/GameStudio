-- One run through a sector. The scene is the director: it spawns the enemies, the hazards and the boss, watches for a level-up, a death or a
-- fallen boss, and draws the heads-up display. The ship, the enemies, the shots and the pickups are entities that look after themselves.
-- While a level-up choice or the pause menu is open the world is frozen (gs.pause) and only this scene's update runs.
local data = require "lib.data"
local run = require "lib.run"
local save = require "lib.save"
local audio = require "lib.audio"
local ui = require "lib.ui"
local controls = require "lib.controls"

local floor, sin, cos, sqrt, abs, max, min, random, atan = math.floor, math.sin, math.cos, math.sqrt, math.abs, math.max, math.min, math.random, math.atan
local TAU = math.pi * 2
local SW, SH = ui.SW, ui.SH
local spr, txt, txtc, txtr, box = ui.spr, ui.txt, ui.txtc, ui.txtr, ui.box

local Play = gs.scene{}

-- the background tile: the 256x256 picture of a sector is a tileset of 16x16 tiles, laid out as one map that repeats in every direction
local BG_GRID = {}
for r = 0, 15 do
  local row = {}
  for c = 0, 15 do row[c + 1] = r * 16 + c end
  BG_GRID[r + 1] = row
end
local function layer(tileset, scroll, depth)
  return { tileset = tileset, data = BG_GRID, scroll_x = scroll, scroll_y = scroll, wrap_x = true, wrap_y = true, depth = depth }
end

function Play:enter(pilot_index, stage)
  local R = run.start(pilot_index, stage)
  local sd = R.sdef
  gs.add_layer(layer("ts_bg_" .. sd.bg, 0.5, 100))
  gs.add_layer(layer("ts_dust", 0.85, 99))
  if sd.hazard == "pull" then gs.spawn("hole", 0, 0) end
  local player = gs.spawn("player", 0, 0, { sprite = "spr_pilot_" .. R.pilot.id })
  gs.camera:follow(player, { smooth = 0.18 })
  audio.music(sd.music)
  self.mode = "play"          -- "play", "levelup" or "pause"
  self.cur = 1
  self.tick = 0
  if require("lib.debug").bot_on() then
    controls.bot = require "lib.bot"
  else
    controls.bot = nil
  end
  if R.pending_levels > 0 then R.pending_levels = R.pending_levels - 1; self:open_levelup() end
  require("lib.debug").run_started(self)
end

function Play:open_levelup()
  run.R.choices = run.make_choices()
  self.mode, self.cur = "levelup", 1
  gs.pause(true)
end

-- ---------------------------------------------------------------- the director: who arrives, and when
local function pick_enemy(R)
  local pool = R.sdef.pool
  local counts = R.counts or {}
  R.counts = counts
  for k in pairs(counts) do counts[k] = 0 end
  local list = gs.all("enemy")
  for i = 1, #list do local k = list[i].kind; counts[k] = (counts[k] or 0) + 1 end
  for _ = 1, 6 do -- a kind that is at its cap is passed over (shooters especially: ten of them fill the screen with bullets)
    local choice
    local sum = 0
    for _, p in ipairs(pool) do if R.t >= p[2] then sum = sum + p[3] * (R.t < p[2] + 25 and 0.5 or 1) end end
    local roll = random() * sum
    for _, p in ipairs(pool) do
      if R.t >= p[2] then
        roll = roll - p[3] * (R.t < p[2] + 25 and 0.5 or 1)
        if roll <= 0 then choice = p[1]; break end
      end
    end
    choice = choice or pool[1][1]
    local cap = gs.defaults("enemies." .. choice).cap
    if not cap or (counts[choice] or 0) < cap then return choice end
  end
  return pool[1][1]
end

local function update_spawner(R, dt)
  R.spawn_t = R.spawn_t - dt
  if R.spawn_t > 0 then return end
  R.spawn_t = 0.35
  local st = R.stage
  local target = min(run.ENEMY_CAP - 10, 7 + st * 1.1 + R.t * (0.25 + st * 0.012))
  target = target * min(1, 0.35 + R.t / 30)
  if R.boss then target = target * 0.35 end
  local live = gs.count("enemy")
  if live >= target then return end
  for _ = 1, min(3, floor(target - live) + 1) do
    local kind = pick_enemy(R)
    local x, y = run.ring_pos(195 + random() * 20)
    for _ = 1, gs.defaults("enemies." .. kind).group or 1 do
      run.spawn_enemy(kind, x + random(-14, 14), y + random(-14, 14))
    end
  end
end

local function update_hazards(R, dt)
  local hz = R.sdef.hazard
  local P = run.P
  R.haz_t = R.haz_t - dt
  if hz == "meteors" and R.haz_t <= 0 then
    R.haz_t = max(1.3, 3.2 - R.t / 120)
    local a = random() * TAU
    local sx, sy = P.x + cos(a) * 210, P.y + sin(a) * 210
    local tx, ty = P.x + random(-60, 60), P.y + random(-60, 60)
    run.enemy_bullet(sx, sy, atan(ty - sy, tx - sx), 150, 12, "meteor", 3)
  elseif hz == "strikes" and R.haz_t <= 0 then
    R.haz_t = max(1.6, 4 - R.t / 90)
    local an, r = random() * TAU, random() * 80
    gs.spawn("strike", P.x + cos(an) * r, P.y + sin(an) * r, { t = 1.1, total = 1.1, r = 22, dmg = 14 })
    audio.sfx("sfx_warn", 5)
  elseif hz == "pull" then
    local d = sqrt(P.x * P.x + P.y * P.y) + 0.01
    if d > 12 then P.px, P.py = P.px - P.x / d * 14 * dt * 60 * 0.4, P.py - P.y / d * 14 * dt * 60 * 0.4 end
  end
end

local function spawn_boss(R)
  local x, y = run.ring_pos(170)
  gs.spawn("bosses." .. R.sdef.boss, x, y)
  R.boss_spawned = true
  audio.sfx("sfx_bossalert", 1)
  audio.music(R.stage == #data.STAGES and "msc_final" or "msc_boss")
end

-- the boss fell: everything else dies, the floor fills with gems, and after a few seconds of explosions the result screen comes
local function boss_down(R)
  local b = R.boss_down
  R.boss_down, R.boss, R.boss_death_fx, R.boss_x, R.boss_y = nil, nil, true, b.x, b.y
  gs.each("enemy", function(e) e:destroy() end)
  gs.each("ebullet", function(e) e:destroy() end)
  for _ = 1, 14 do gs.spawn("pickup", b.x + random(-30, 30), b.y + random(-30, 30), { kind = "gem", v = 8 }) end
  for _ = 1, 8 do gs.spawn("pickup", b.x + random(-30, 30), b.y + random(-30, 30), { kind = "coin", v = 1 }) end
  R.magnet_all = 4
  R.over, R.win, R.end_t, R.finish_pending = true, true, 0, true
  audio.stop_music()
  gs.pause(true)
end

function Play:finish_to_results()
  require("lib.debug").run_ended()
  gs.pause(false)
  audio.music(run.R.win and "msc_victory" or "msc_gameover")
  gs.goto_scene("scenes.results")
end

-- ---------------------------------------------------------------- one step
function Play:update(dt)
  self.tick = self.tick + 1
  local R, P = run.R, run.P
  if self.mode == "levelup" then return self:update_levelup() end
  if self.mode == "pause" then return self:update_pause() end
  if R.over then return self:update_over(dt) end

  if gs.input.pressed("start") then
    self.mode, self.cur = "pause", 1
    gs.pause(true)
    audio.sfx("sfx_ok", 1)
    return
  end
  R.t = R.t + dt
  require("lib.debug").run_step()
  if R.flash and R.flash > 0 then R.flash = R.flash - dt end
  if R.boss_alert > 0 then R.boss_alert = R.boss_alert - dt end
  if R.magnet_all then R.magnet_all = R.magnet_all - dt; if R.magnet_all <= 0 then R.magnet_all = nil end end
  if R.t >= R.sdef.time and not R.boss_spawned then spawn_boss(R) end
  update_spawner(R, dt)
  update_hazards(R, dt)
  if R.boss_down then boss_down(R) return end

  if P.hp <= 0 then
    if P.mods.revive > 0 and not P.revived then
      P.revived = true
      P.hp = P.maxhp * 0.5
      P.inv = 2.5
      run.explode(P.x, P.y, 90, 200, 4)
      gs.each("ebullet", function(b) b:destroy() end)
      run.fx("boom", P.x, P.y, 0.5, 4)
    else
      run.finish(false)
      self:finish_to_results()
    end
    return
  end
  if P.xp >= run.xp_need(P.lvl) then
    P.xp = P.xp - run.xp_need(P.lvl)
    P.lvl = P.lvl + 1
    audio.sfx("sfx_levelup", 1)
    self:open_levelup()
  end
end

-- after the boss: explosions for a moment, then the results
function Play:update_over(dt)
  local R = run.R
  R.end_t = R.end_t + dt
  gs.each("fx", function(f) f:update(dt) end)          -- the world is not running, so the explosions are moved along by hand
  if R.boss_death_fx and random() < 0.3 then
    run.fx("boom", R.boss_x + random(-26, 26), R.boss_y + random(-26, 26), 0.45, 1.2 + random())
    audio.sfx("sfx_explode", 6)
  end
  if R.finish_pending and R.end_t > 2.6 then
    R.finish_pending = nil
    run.finish(true)
    self:finish_to_results()
  end
end

local function move(i, n, up, down)
  if gs.input.pressed(up or "up") then audio.sfx("sfx_move", 1); return (i - 2) % n + 1 end
  if gs.input.pressed(down or "down") then audio.sfx("sfx_move", 1); return i % n + 1 end
  return i
end

function Play:update_levelup()
  local R = run.R
  local pick
  if controls.bot then
    pick = require("lib.bot").choose(R.choices)
  else
    self.cur = move(self.cur, #R.choices, "left", "right")
    if gs.input.pressed("y") then run.reroll(); self.cur = 1 end
    if gs.input.pressed("a") then pick = self.cur end
  end
  if pick then
    run.apply_choice(R.choices[pick])
    self.cur = 1
    if run.next_after_choice() then self.mode = "play"; gs.pause(false) end
  end
end

function Play:update_pause()
  self.cur = move(self.cur, 2)
  if gs.input.pressed("start") or gs.input.pressed("b") then self.mode = "play"; gs.pause(false); audio.sfx("sfx_back", 1) end
  if gs.input.pressed("a") then
    if self.cur == 1 then
      self.mode = "play"; gs.pause(false)
    else
      local R = run.R
      R.over, R.win, R.abandoned = true, false, true
      run.finish(false)
      self:finish_to_results()
    end
  end
end

-- ---------------------------------------------------------------- the heads-up display
function Play:draw_hud()
  local R, P = run.R, run.P
  local frame = gs.world.step_id
  local need = run.xp_need(P.lvl)
  box(0, 0, SW, 5, 0, nil, 180)
  box(0, 0, floor(SW * min(1, P.xp / need)), 4, 22)
  box(0, 4, SW, 1, 21)
  txt("LV" .. P.lvl, 3, 7, 3)
  -- health
  box(2, 228, 82, 10, 0, 3, 200)
  spr("spr_pk_heart", 0, 8, 233)
  box(14, 230, 68, 6, 4)
  box(14, 230, floor(68 * max(0, P.hp / P.maxhp)), 6, 6)
  box(14, 230, floor(68 * max(0, P.hp / P.maxhp)), 2, 7)
  txtc(ui.fmt_time(R.t), 7, 3)
  txtr(R.kills .. " KO", SW - 4, 7, 2)
  spr("spr_pk_coin", frame / 8, SW - 8, 22)
  txtr(tostring(R.coin_count), SW - 14, 18, 14)
  -- weapons and passives
  local x = 90
  for _, w in ipairs(R.weapons) do
    spr("spr_ico_" .. data.WEAPONS[w.id].icon, 0, x + 8, 228, 0.75)
    txt(tostring(w.lv), x + 11, 230, 14)
    x = x + 14
  end
  x = x + 4
  for _, id in ipairs(data.PASSIVE_ORDER) do
    local lv = R.passives[id]
    if lv then spr("spr_ico_" .. data.PASSIVES[id].icon, 0, x + 8, 228, 0.75); txt(tostring(lv), x + 11, 230, 11); x = x + 14 end
  end
  -- dash ready
  local dw = 22
  box(SW - dw - 3, 228, dw, 8, 0, 3, 200)
  box(SW - dw - 2, 229, floor((dw - 2) * (1 - P.dash_cd / max(0.1, 1.8 * (1 + P.mods.dashcd)))), 6, P.dash_cd <= 0 and 22 or 1)
  -- boss bar
  local b = R.boss
  if b then
    txtc(b.name, 12, 6)
    box(60, 22, 200, 7, 0, 3)
    box(61, 23, floor(198 * max(0, b.hp / b.maxhp)), 5, 5)
    box(61, 23, floor(198 * max(0, b.hp / b.maxhp)), 2, 6)
  end
  -- the radar: where the gems, coins and boss are, near and far (the little rectangle is what the screen shows)
  do
    local rx, ry, rr, range = SW - 30, SH - 54, 26, 320
    local k = rr / range
    box(rx - rr, ry - rr, rr * 2, rr * 2, 0, 1, 175)
    ui.dot(rx - 160 * k, ry - 120 * k, 1, 1, 2, 150); ui.dot(rx + 160 * k - 1, ry - 120 * k, 1, 1, 2, 150)
    ui.dot(rx - 160 * k, ry + 120 * k - 1, 1, 1, 2, 150); ui.dot(rx + 160 * k - 1, ry + 120 * k - 1, 1, 1, 2, 150)
    local pickups = gs.all("pickup")
    local step = (#pickups > 90) and 2 or 1
    for i = 1, #pickups, step do
      local g = pickups[i]
      if not g._dead then
        local dx, dy = (g.x - P.x) * k, (g.y - P.y) * k
        if abs(dx) < rr - 1 and abs(dy) < rr - 1 then
          local kind = g.kind
          if kind == "gem" then gs.draw.rect(rx + dx, ry + dy, 1, 1, g.v >= 8 and 30 or g.v >= 3 and 18 or 22)
          elseif kind == "coin" then gs.draw.rect(rx + dx, ry + dy, 2, 2, 14)
          elseif floor(frame / 15) % 2 == 0 then gs.draw.rect(rx + dx - 1, ry + dy - 1, 3, 3, kind == "heart" and 6 or kind == "magnet" and 3 or 10) end
        end
      end
    end
    if b and b:is_alive() then
      local dx, dy = (b.x - P.x) * k, (b.y - P.y) * k
      local l = sqrt(dx * dx + dy * dy)
      if l > rr - 3 then dx, dy = dx / l * (rr - 3), dy / l * (rr - 3) end
      if floor(frame / 10) % 2 == 0 then gs.draw.rect(rx + dx - 1, ry + dy - 1, 3, 3, 6) end
    end
    gs.draw.rect(rx - 1, ry - 1, 2, 2, 3)
  end
  -- the boss pointer: an arrow at the edge of the screen when the boss is out of view
  if b and b:is_alive() then
    local cam = gs.camera
    local sx, sy = b.x - cam.x, b.y - cam.y
    if sx < -8 or sx > SW + 8 or sy < -8 or sy > SH + 8 then
      local dx, dy = sx - SW / 2, sy - SH / 2
      local k = min((SW / 2 - 14) / max(1, abs(dx)), (SH / 2 - 34) / max(1, abs(dy)))
      spr("spr_ico_arrow", frame / 8, SW / 2 + dx * k, SH / 2 + 4 + dy * k, 2, false, math.deg(atan(dy, dx)))
    end
  end
  if R.boss_alert > 0 and floor(R.boss_alert * 6) % 2 == 0 then txtc("! WARNING !", 100, 6, 3); txtc("A SECTOR BOSS APPROACHES", 128, 3, 1) end
  if R.flash and R.flash > 0 then box(0, 0, SW, SH, 3, nil, floor(160 * R.flash / 0.3)) end
  if P.flash > 0 then box(0, 0, SW, SH, 5, nil, floor(90 * P.flash / 0.25)) end
end

function Play:draw_levelup()
  local R = run.R
  box(0, 0, SW, SH, 0, nil, 170)
  txtc("LEVEL UP!", 10, 14, 3)
  txtc("PICK ONE", 38, 2, 1)
  local n = #R.choices
  local cw = 100
  local x0 = (SW - n * (cw + 4) + 4) / 2
  for i, c in ipairs(R.choices) do
    local x, y = x0 + (i - 1) * (cw + 4), 52
    local on = (i == self.cur)
    box(x, y, cw, 142, on and 25 or 0, on and 14 or 22, 240)
    spr("spr_ico_" .. c.icon, 0, x + cw / 2, y + 24, 2.4)
    if c.new then txt("NEW!", x + cw / 2 - 16, y + 46, 6) end
    local ty = y + 58
    for _, l in ipairs(ui.wrap(c.title, 11)) do txt(l, x + (cw - #l * 8) / 2, ty, on and 14 or 3, 1, x + cw - 2); ty = ty + 9 end
    ty = ty + 5
    for _, l in ipairs(ui.wrap(c.text, 11)) do if ty < y + 134 then txt(l, x + (cw - #l * 8) / 2, ty, on and 3 or 2, 1, x + cw - 2) end; ty = ty + 9 end
  end
  txtc("A: PICK" .. (R.rerolls > 0 and ("   Y: REROLL (" .. R.rerolls .. ")") or ""), 202, 3)
  local wl = ""
  for _, w in ipairs(R.weapons) do wl = wl .. data.WEAPONS[w.id].name:sub(1, 5) .. w.lv .. " " end
  txtc(wl, 220, 1)
end

function Play:draw_pause()
  box(0, 0, SW, SH, 0, nil, 150)
  box(100, 70, 120, 90, 0, 22, 240)
  txtc("PAUSED", 80, 14, 2)
  txtc("RESUME", 108, self.cur == 1 and 3 or 2); txtc("GIVE UP", 128, self.cur == 2 and 3 or 2)
  spr("spr_ico_cursor", self.tick / 8, 112, self.cur == 1 and 112 or 132)
end

function Play:draw_ui()
  self:draw_hud()
  if self.mode == "levelup" then self:draw_levelup() elseif self.mode == "pause" then self:draw_pause() end
end

return Play
