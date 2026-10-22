-- The pilot's ship. It moves with the D-pad, dashes with A or B, collects pickups it touches, and
-- runs the weapons. Its stats live in lib/run.lua.
local run = require "lib.run"
local weapons = require "lib.weapons"
local controls = require "lib.controls"
local audio = require "lib.audio"

local Player = gs.entity{
  tags = { "player" },
  depth = 30,
  hitbox = { r = 7 },
  inv = 0,                            -- seconds of being unhurtable
  dash = 0,                           -- seconds of dashing left
  dash_cd = 0,
  slow = 0,                           -- slowed by a leech
  flash = 0,                          -- red flash of the screen after a hit
  px = 0, py = 0,                     -- pushes from pulling enemies and hazards, used up every step
  face_a = 0,                         -- the way it is facing, as an angle
  xp = 0,
  revived = false,
}

function Player:create()
  run.init_player(self)
  self.dx, self.dy = 0, 0
end

function Player:update(dt)
  local mods = self.mods
  local mx, my = controls.move()
  local speed = 82 * mods.spd * (self.slow > 0 and 0.6 or 1)
  local moving = (mx ~= 0 or my ~= 0)
  if moving then
    local l = math.sqrt(mx * mx + my * my)
    mx, my = mx / l, my / l
    self.face_a = math.atan(my, mx)
    if mx ~= 0 then self.flip = mx < 0 end
  end
  if self.dash > 0 then
    self.dash = self.dash - dt
    self.x, self.y = self.x + self.dx * 270 * dt, self.y + self.dy * 270 * dt
    run.fx("puff", self.x, self.y, 0.25)
  else
    self.x, self.y = self.x + mx * speed * dt, self.y + my * speed * dt
    if controls.dash() and self.dash_cd <= 0 then
      self.dash = 0.17
      self.dash_cd = 1.8 * (1 + mods.dashcd)
      self.dx, self.dy = moving and mx or math.cos(self.face_a), moving and my or math.sin(self.face_a)
      self.inv = math.max(self.inv, 0.17 + 0.1 + mods.dashinv)
      audio.sfx("sfx_dash", 4)
    end
  end
  self.x, self.y = self.x + self.px * dt, self.y + self.py * dt
  self.px, self.py = 0, 0
  self:play(moving and "walk" or "idle")
  self.dash_cd = math.max(0, self.dash_cd - dt)
  self.inv = math.max(0, self.inv - dt)
  self.slow = math.max(0, self.slow - dt)
  self.flash = math.max(0, self.flash - dt)
  self.alpha = self.dash > 0 and 0.59 or 1
  -- blinks while protected after a hit
  self.visible = not (self.inv > 0 and self.dash <= 0 and math.floor(gs.world.step_id / 3) % 2 == 0 and self.flash > 0)
  if mods.regen > 0 then self.hp = math.min(self.maxhp, self.hp + mods.regen * dt) end
  weapons.update(self, dt)
end

function Player:on_collide_pickup(pickup)
  pickup:collect()
end

return Player
