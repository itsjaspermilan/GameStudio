-- The base of the ten sector bosses (files in entities/bosses/). A boss is an enemy with a health
-- bar, phases and a list of attacks it cycles through:
--   ring n      a ring of n slow shots            aim n      n shots fanned at the player          spiral     a spinning stream of shots
--   charge      stops, aims, then rams            summon k n n enemies of kind k                    strike n   n warned blasts around the player
--   pull        drags the player for two seconds
-- Below half health it moves faster, attacks more often and its rings and strikes grow.
local Enemy = require "entities.enemy"
local run = require "lib.run"
local audio = require "lib.audio"

local TAU = math.pi * 2

local Boss = gs.entity(Enemy, {
  boss = true,
  depth = 49,
  strays = false,
  turns = false,
  name = "Boss",
  gap = 2.2,                          -- seconds between attacks
  atk = {},
})

local CHARGE_LINE = { 234, 90, 75, 160 }

function Boss:create()
  local R = run.R
  local hp = self.hp * 1.6 * (1 + (R.t / 150) ^ 1.4)
  self.hp, self.maxhp = hp, hp
  self.t, self.dir, self.face = 0, 1, 1
  self.kx, self.ky, self.hit_t, self.bhit, self.st, self.cx, self.cy = 0, 0, 0, 0, 0, 0, 0
  self.atk_i, self.atk_t, self.phase, self.spiral, self.charge, self.pulltime = 1, 2, 1, 0, 0, 0
  R.boss = self
  R.boss_alert = 3
end

function Boss:think(dt, dx, dy, d, nx, ny)
  local P = run.P
  local p2 = self.hp < self.maxhp * 0.5
  if p2 and self.phase == 1 then
    self.phase = 2
    run.fx("boom", self.x, self.y, 0.5, 3)
    gs.camera:shake(3.2, 0.44)
    audio.sfx("sfx_explode", 1)
  end
  local spd = self.spd * (p2 and 1.3 or 1)
  local vx, vy = 0, 0
  if self.charge > 0 then
    self.charge = self.charge - dt
    if self.charge > 0.7 then self.cx, self.cy = nx, ny            -- aiming
    else vx, vy = self.cx * 250, self.cy * 250 end                  -- ramming
  elseif d > 70 then
    vx, vy = nx * spd, ny * spd
  end
  if self.spiral > 0 then
    self.spiral = self.spiral - dt
    self.sp_t = (self.sp_t or 0) - dt
    if self.sp_t <= 0 then
      self.sp_t = p2 and 0.07 or 0.1
      self.sp_a = (self.sp_a or 0) + 0.5
      run.enemy_bullet(self.x, self.y, self.sp_a, 85, 9, "bossshot")
    end
  end
  if self.pulltime > 0 then
    self.pulltime = self.pulltime - dt
    P.px, P.py = P.px + nx * 70 * dt * 60 * 0.5, P.py + ny * 70 * dt * 60 * 0.5
  end
  self.atk_t = self.atk_t - dt
  if self.atk_t <= 0 and self.charge <= 0 then
    self.atk_t = self.gap * (p2 and 0.7 or 1)
    local a = self.atk[self.atk_i]
    self.atk_i = self.atk_i % #self.atk + 1
    self:attack(a, nx, ny, p2)
  end
  return vx, vy
end

function Boss:attack(a, nx, ny, p2)
  local kind = a[1]
  local speed = p2 and 1.15 or 1
  if kind == "ring" then
    local n, o = a[2] + (p2 and 4 or 0), math.random() * TAU
    for i = 0, n - 1 do run.enemy_bullet(self.x, self.y, o + i * TAU / n, 85 * speed, 9, "bossshot") end
  elseif kind == "aim" then
    local n, base = a[2], math.atan(ny, nx)
    for i = 1, n do run.enemy_bullet(self.x, self.y, base + (i - (n + 1) / 2) * 0.16, 118 * speed, 9, "shot") end
  elseif kind == "spiral" then self.spiral = 3
  elseif kind == "charge" then self.charge = 1.3
  elseif kind == "summon" then
    for _ = 1, a[3] do
      local an = math.random() * TAU
      run.spawn_enemy(a[2], self.x + math.cos(an) * 26, self.y + math.sin(an) * 26)
    end
    run.fx("pop", self.x, self.y, 0.4, 3)
  elseif kind == "strike" then
    local P = run.P
    for i = 1, a[2] + (p2 and 2 or 0) do
      local an, r = math.random() * TAU, 14 + math.random() * 90
      local k = (i == 1) and 0.1 or 1
      gs.spawn("strike", P.x + math.cos(an) * r * k, P.y + math.sin(an) * r * k, { t = 1.0, total = 1.0, r = 26, dmg = 18 })
    end
    audio.sfx("sfx_warn", 3)
  elseif kind == "pull" then self.pulltime = 2 end
end

-- a boss leaves no drops: the run's scene notices it fell (run.R.boss_down) and ends the sector
function Boss:kill()
  run.R.kills = run.R.kills + 1
  run.R.boss_down = { x = self.x, y = self.y }
  self:destroy()
end

function Boss:draw_extras()
  if self.charge > 0.7 then gs.draw.line(self.x, self.y, self.x + self.cx * 140, self.y + self.cy * 140, CHARGE_LINE) end
end

return Boss
