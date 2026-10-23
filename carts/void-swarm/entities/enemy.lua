-- The base of every enemy. A kind (a file in entities/enemies/) builds on this and gives its
-- numbers (hp, speed, touch damage, the experience it drops, its hit radius) and, if it does
-- anything but walk toward the player, a think() method that returns the velocity it wants this
-- step.
--   cap    the most of this kind that may be alive at once (a director rule, read with gs.defaults)
--   group  how many appear together
--   split  what it breaks into when killed
local run = require "lib.run"
local audio = require "lib.audio"

local sqrt, max, min, random = math.sqrt, math.max, math.min, math.random

local Enemy = gs.entity{
  tags = { "enemy" },
  depth = 50,
  hitbox = { r = 9 },
  kind = "enemy",
  hp = 10, spd = 38, dmg = 5, xp = 1, armor = 0,
  slows = false,                      -- touching it slows the player
  strays = true,                      -- brought back to the front of the player when it is left far behind
  turns = true,                       -- faces the player
  collide_every = { enemy = 4 },      -- enemies push each other apart; with a hundred of them a quarter of the checks each step (and four times the push) is plenty
}

function Enemy:create()
  local R = run.R
  local hp = self.hp * R.hpmul * (1 + (R.t / 75) ^ 1.6)
  self.hp, self.maxhp = hp, hp
  self.t = random() * 2
  self.dir = random() < 0.5 and -1 or 1
  self.kx, self.ky = 0, 0             -- knockback, fading away
  self.hit_t, self.bhit, self.st = 0, 0, 0
  self.face = 1
  self.cx, self.cy = 0, 0
  self:setup()
end

function Enemy:setup() end

function Enemy:radius() return self:hit_radius() end

-- what it wants to do this step: the velocity. The default is to walk straight at the player.
function Enemy:think(dt, dx, dy, d, nx, ny) return nx * self.spd, ny * self.spd end

function Enemy:update(dt)
  local P = run.P
  local dx, dy = P.x - self.x, P.y - self.y
  local d = sqrt(dx * dx + dy * dy) + 0.001
  local nx, ny = dx / d, dy / d
  self.t = self.t + dt
  self.face = (dx >= 0) and 1 or -1
  if self.turns then self.flip = self.face < 0 end
  local vx, vy = self:think(dt, dx, dy, d, nx, ny)
  if self._dead then return end
  self.bhit = self.bhit - dt
  if self.hit_t > 0 then self.hit_t = self.hit_t - dt end
  self.kx, self.ky = self.kx * 0.88, self.ky * 0.88
  self.vx, self.vy = vx + self.kx, vy + self.ky       -- the engine moves it
  if self.strays and d > 380 then self.x, self.y = run.ring_pos(210) end
end

function Enemy:hurt(amount, kx, ky)
  if self._dead or self.ghosted then return end
  amount = max(amount * 0.25, amount - self.armor)
  self.hp = self.hp - amount
  self.hit_t = 0.07
  self:flash(0.07) -- drawn white for a moment, as GBA games show a hit
  if not self.boss then self.kx, self.ky = self.kx + (kx or 0), self.ky + (ky or 0) end
  if self.hp <= 0 then self:kill() else audio.sfx("sfx_hit", 3) end
end

function Enemy:kill()
  run.R.kills = run.R.kills + 1
  run.fx("pop", self.x, self.y, 0.3, self:hit_radius() > 12 and 1.5 or 1)
  audio.sfx("sfx_kill", 4)
  run.drop(self)
  if self.split then
    for i = 1, 2 do
      local c = run.spawn_enemy(self.split, self.x + (i == 1 and -5 or 5), self.y, true)
      if c then c.kx, c.ky = (i == 1 and -60 or 60), 0 end
    end
  end
  self:destroy()
end

-- touching the player hurts them and shoves the enemy back (ghosts and enemies still warning
-- cannot)
function Enemy:on_collide_player(p)
  if self.ghosted or (self.warn and self.warn > 0) then return end
  run.hurt_player(self.dmg, self.kind)
  if self.slows then p.slow = 1.2 end
  if not self.boss then
    local dx, dy = self.x - p.x, self.y - p.y
    local d = sqrt(dx * dx + dy * dy) + 0.01
    self.kx, self.ky = self.kx + dx / d * 90, self.ky + dy / d * 90
  end
end

-- a crowd spreads out instead of becoming one dot: touching enemies push each other apart a little
function Enemy:on_collide_enemy(o)
  if self.boss or o.boss then return end
  local dx, dy = self.x - o.x, self.y - o.y
  local d = sqrt(dx * dx + dy * dy) + 0.01
  self.x, self.y = self.x + dx / d * 0.6, self.y + dy / d * 0.6
end

-- things a kind draws besides its sprite (warning lines, an aura)
function Enemy:draw_extras() end

function Enemy:draw()
  local cam = gs.camera
  local sx, sy = self.x - cam.x, self.y - cam.y
  if sx < -40 or sx > 360 or sy < -40 or sy > 280 then return end      -- off the screen: nothing to draw
  self:draw_sprite()
  self:draw_extras()
end

return Enemy
