-- Wren. D-pad runs and aims (Up aims up, Down crouches or aims down in the air), B jumps, Y shoots,
-- X fires a missile, A dashes,
-- L flips the Lens (Now and Then), Up or R uses what Wren stands at (terminals, people), Down + B
-- on a thin floor drops through it.
-- Abilities come from lib/state (data.has): lens, dash, wall, charge, missile, double.
-- It moves itself against the solid tile layer (lib/tiles) rather than by vx/vy, and keeps its own
-- speed in speed_x and speed_y (vx and vy would make the engine move it too). x is the middle of
-- the feet, y the bottom.
local tiles = require "lib.tiles"
local state = require "lib.state"
local art = require "lib.art"
local lens = require "lib.lens"

-- what the hero reads while a cutscene has the controls: nothing pressed
local NO_INPUT = { held = function() return false end, pressed = function() return false end, dir = function() return 0, 0 end }

local Hero = gs.entity{
  sprite = "spr_hero",
  tags = { "hero" },
  depth = 10,
  hitbox = { -6, -28, 12, 28 },
  w = 12, h = 28, crouch_h = 22,

  -- running: a quick start and an even quicker stop, so landings on small ledges are easy
  run = 110, accel = 1100, stop = 1800, air_accel = 800,
  -- jumping: about three and a half tiles high with B held, one tile with a tap
  gravity = 900, fall_max = 330, jump_speed = 320, jump_cut = 0.4,
  coyote = 0.1,      -- seconds after leaving a ledge that B still jumps
  buffer = 0.1,      -- seconds before landing that a B press is remembered
  air_jump_speed = 280,
  wall_slide = 70, wall_push = 150, wall_lock = 0.15,
  dash_speed = 270, dash_time = 0.16, dash_rest = 0.3,
  fire_rate = 0.16, charge_time = 0.7,

  face = 1,
  speed_x = 0, speed_y = 0,
  on_ground = false, since_ground = 0, jump_mem = 0, rising = false,
  air_jumps = 0, air_dash = true,
  wall_dir = 0, lock_t = 0,
  dash_t = 0, dash_cd = 0,
  drop_t = 0,
  crouching = false, aim = "fwd",
  fire_t = 0, charge = 0,
  anim_t = 0, land_t = 0, step = -1,
  hurt_t = 0, grace_t = 0, safe_x = 0, safe_y = 0,
  inv_time = 1.0,      -- seconds of flicker after a hit
}

-- the scarf's tail: a short rope of points hanging from the back of the neck
local SCARF_N, SCARF_LINK = 8, 2.5

function Hero:create()
  self.safe_x, self.safe_y = self.x, self.y
  self.trail, self.burned = {}, {}
  self.scarf = {}
  local nx, ny = self:neck()
  for i = 1, SCARF_N do
    local x = nx - (i - 1) * SCARF_LINK * self.face
    self.scarf[i] = { x = x, y = ny, px = x, py = ny }
  end
end

-- how far the current frame's body sits below standing (crouches, bobs)
function Hero:bob() return art.HERO_DY[self.frame + 1] or 0 end

-- the back of the neck, where the scarf is tied (the art's knot is at x 11-19, y 12-14 of the 32x32
-- frame)
function Hero:neck() return self.x - 4 * self.face, self.y - 19 + self:bob() end

-- ---------- moving

local function approach(v, target, step)
  if v < target then return math.min(v + step, target) end
  return math.max(v - step, target)
end

function Hero:box_h() return self.crouching and self.crouch_h or self.h end

function Hero:touching_wall(dir)
  local hw = self.w / 2
  local x = dir > 0 and self.x + hw or self.x - hw - 2
  return tiles.box_wall(x, self.y - self:box_h() + 2, x + 2, self.y - 2)
end

function Hero:update(dt)
  local I = state.cutscene and NO_INPUT or gs.input
  local dx, dy = I.dir()
  local has = state.data.has
  self.hurt_t = math.max(0, self.hurt_t - dt)
  self.grace_t = math.max(0, self.grace_t - dt)
  if not lens.dodging() then self.dodged = false end

  self.fire_t = math.max(0, self.fire_t - dt)
  self.dash_cd = math.max(0, self.dash_cd - dt)
  self.lock_t = math.max(0, self.lock_t - dt)
  self.drop_t = math.max(0, self.drop_t - dt)
  self.jump_mem = I.pressed("b") and self.buffer or math.max(0, self.jump_mem - dt)
  self.since_ground = self.on_ground and 0 or self.since_ground + dt

  -- L flips the Lens
  if I.pressed("l") and has.lens and lens.overload_t <= 0 then lens.flip(self) end

  -- Up (or R) at something usable uses it instead of aiming: a terminal, a console, someone to talk
  -- to
  if (I.pressed("up") or I.pressed("r")) and self.on_ground then
    for _, u in ipairs(self:touching_all("usable")) do
      if lens.sees(u.era) and u.use then u:use(self); break end
    end
  end

  -- crouch: Down on the ground stops you, like Super Metroid; stand up only where there is head
  -- room
  local want_crouch = self.on_ground and dy > 0 and self.dash_t <= 0
  if want_crouch then
    self.crouching = true
  elseif self.crouching then
    local hw = self.w / 2
    if not tiles.box_wall(self.x - hw, self.y - self.h, self.x + hw, self.y - self.crouch_h) then self.crouching = false end
  end

  -- dash: along the ground or once per jump
  if I.pressed("a") and has.dash and self.dash_cd <= 0 and (self.on_ground or self.air_dash) and not self.crouching then
    if dx ~= 0 then self.face = dx end
    self.dash_t, self.dash_cd = self.dash_time, self.dash_time + self.dash_rest
    self.burned = {}
    if not self.on_ground then self.air_dash = false end
    self.speed_y = 0
    gs.sfx("sfx_dash", 0.6)
  end

  -- sideways
  if self.dash_t > 0 then
    self.dash_t = self.dash_t - dt
    self.speed_x = self.face * self.dash_speed
    if self.dash_t <= 0 then self.speed_x = self.face * self.run end
  elseif self.lock_t <= 0 then
    local target = self.crouching and 0 or dx * self.run
    local rate = not self.on_ground and self.air_accel or (target == 0 or target * self.speed_x < 0) and self.stop or self.accel
    -- turning round on the ground is instant: a platformer should never feel like it skids
    if self.on_ground and target * self.speed_x < 0 then self.speed_x = 0 end
    self.speed_x = approach(self.speed_x, target, rate * dt)
    if dx ~= 0 then self.face = dx end
  end

  -- walls and wall slides
  self.wall_dir = 0
  if not self.on_ground then
    if self:touching_wall(1) then self.wall_dir = 1 elseif self:touching_wall(-1) then self.wall_dir = -1 end
  end
  local sliding = has.wall and self.wall_dir ~= 0 and dx == self.wall_dir and self.speed_y > 0 and self.dash_t <= 0

  -- jumping, in order: from the ground (or just after leaving it), off a wall, then in the air
  local dropping = false
  if self.jump_mem > 0 and self.on_ground and dy > 0 and tiles.on_thin_only(self.x, self.y, self.w) then
    -- Down + B on a thin floor: fall through it instead of jumping
    self.drop_t, self.jump_mem, dropping = 0.2, 0, true
    self.crouching = false
  elseif self.jump_mem > 0 and (self.on_ground or self.since_ground < self.coyote) and self.speed_y >= 0 then
    self:jump(self.jump_speed)
  elseif self.jump_mem > 0 and has.wall and self.wall_dir ~= 0 then
    self:jump(self.jump_speed * 0.95)
    self.speed_x, self.face, self.lock_t = -self.wall_dir * self.wall_push, -self.wall_dir, self.wall_lock
    self.dash_t = 0
  elseif I.pressed("b") and has.double and self.air_jumps > 0 and not self.on_ground then
    self.air_jumps = self.air_jumps - 1
    self:jump(self.air_jump_speed)
    gs.burst(self.x, self.y - 2, { count = 8, color = "#a6f4e6", speed = { 30, 70 }, angle = 90, spread = 120, life = 0.25, depth = 11 })
  end
  -- letting go of B early makes a short hop
  if self.rising and not I.held("b") and self.speed_y < 0 then self.speed_y = self.speed_y * self.jump_cut; self.rising = false end
  if self.speed_y >= 0 then self.rising = false end

  -- falling
  if self.dash_t <= 0 then
    self.speed_y = math.min(self.speed_y + self.gravity * dt, sliding and self.wall_slide or self.fall_max)
  end

  -- move: sideways first, then up or down, each stopped by walls
  local h = self:box_h()
  local hit
  self.x, hit = tiles.move_x(self.x, self.y, self.w, h, self.speed_x * dt)
  if hit then self.speed_x = 0; self.dash_t = 0 end
  local was_ground = self.on_ground
  local fall_speed = self.speed_y
  local side
  self.y, side = tiles.move_y(self.x, self.y, self.w, h, self.speed_y * dt, self.drop_t > 0 or dropping)
  self.on_ground = side == "floor"
  if side then self.speed_y = 0 end
  if self.on_ground then
    self.air_jumps, self.air_dash = 1, true
    if not was_ground then
      self.since_ground = 0
      if fall_speed > 200 then
        self.land_t = 0.1
        self:dust(-1, 4); self:dust(1, 4)
      end
    end
  end
  self.land_t = math.max(0, self.land_t - dt)

  -- hazards (sparking cables, fire): a hit, then back to the last safe ground
  local hw = self.w / 2
  if tiles.box_hazard(self.x - hw + 2, self.y - h + 4, self.x + hw - 2, self.y) then
    if self:hurt(1, nil, true) then self.x, self.y, self.speed_x, self.speed_y = self.safe_x, self.safe_y, 0, 0 end
  elseif self.on_ground and not tiles.on_thin_only(self.x, self.y, self.w) and self.dash_t <= 0
    and not tiles.box_hazard(self.x - hw - 16, self.y - 4, self.x + hw + 16, self.y + 1) then
      self.safe_x, self.safe_y = self.x, self.y
    end

    -- aim: Up always aims up; Down aims down only in the air
    self.aim = dy < 0 and "up" or (dy > 0 and not self.on_ground) and "down" or "fwd"

    self:shoot(dt)
    self:animate(dt, sliding)
    self:update_scarf()
    if self.dash_t > 0 then
      table.insert(self.trail, 1, { x = self.x, y = self.y, frame = self.frame, flip = self.flip, t = 0.15 })
    end
    for i = #self.trail, 1, -1 do
      local p = self.trail[i]
      p.t = p.t - dt
      if p.t <= 0 then table.remove(self.trail, i) end
    end
  end

  -- ---------- getting hurt

  -- Take a hit of n hearts from something at from_x (it knocks Wren away). A hit just after a Lens
  -- flip is a phase dodge.
  -- Returns true when it hurt. `always` hurts even during the flicker (hazards always send Wren
  -- back).
  function Hero:hurt(n, from_x, always)
    if (self.hurt_t > 0 or self.grace_t > 0) and not always then return false end
    if lens.dodging() and not always then
      if not self.dodged then
        self.dodged = true
        gs.sfx("sfx_dodge", 0.6)
        gs.burst(self.x, self.y - 14, { count = 12, color = "#a6f4e6", speed = { 30, 80 }, spread = 360, life = 0.3, depth = 9 })
        state.say("PHASE DODGE", 1)
        self.dash_cd = 0
        self.hurt_t = 0.4 -- the rest of that attack passes through too
        gs.send(gs.world.scene, "slow", 0.35)
      end
      return false
    end
    local d = state.data
    d.hp = math.max(0, d.hp - n)
    self.hurt_t = self.inv_time
    gs.sfx("sfx_hurt", 0.7)
    gs.camera:shake(3, 0.2)
    if from_x then
      local away = self.x < from_x and -1 or 1
      self.speed_x, self.speed_y, self.lock_t, self.dash_t = away * 140, -160, 0.2, 0
    end
    if d.hp <= 0 then gs.send(gs.world.scene, "died") end
    return true
  end

  function Hero:on_collide_enemy(e)
    -- a kept Ossie's Afterburner: a dash goes through enemies and hurts them
    if self.dash_t > 0 and state.data.traits.ossie and lens.sees(e.era) and not e.dead then
      if not self.burned[e] then
        self.burned[e] = true
        self.grace_t = 0.4 -- coming out of a burning dash inside the enemy does not hurt
        e:hurt(2, { era = lens.era })
        gs.burst(e.x, e.y - (e.mid or 8), { count = 10, color = "#ffd08a", speed = { 30, 90 }, spread = 360, life = 0.3, depth = 8 })
      end
      return
    end
    if e.contact and e.contact > 0 and lens.sees(e.era) and not e.dead then self:hurt(e.contact, e.x) end
  end

  function Hero:on_collide_enemy_shot(s)
    if lens.sees(s.era) then
      if self:hurt(s.damage or 1, s.x) then s:destroy() end
    end
  end

  function Hero:jump(speed)
    if self.on_ground then self:dust(-self.face, 5) end
    self.speed_y = -speed
    self.on_ground, self.rising, self.jump_mem, self.since_ground = false, true, 0, self.coyote
    self.crouching = false
  end

  -- ---------- shooting

  -- where the gun's tip is, by aim (matches the art in scripts/then-and-now/art.mjs)
  function Hero:muzzle()
    local dy = self:bob()
    if self.aim == "up" then return self.x + 8.5 * self.face, self.y - 32 + dy, 0, -1 end
    if self.aim == "down" then return self.x + 1.5 * self.face, self.y - 2 + dy, 0, 1 end
    return self.x + 14.5 * self.face, self.y - 16.5 + dy, self.face, 0
  end

  function Hero:fire(kind)
    local x, y, ax, ay = self:muzzle()
    local d = state.data
    if kind == "missile" then
      if d.missiles <= 0 then gs.sfx("sfx_empty", 0.5); state.say("NO MISSILES: USE A TERMINAL", 1.5); return end
      d.missiles = d.missiles - 1
    end
    gs.spawn("shot", x, y, { kind = kind, dir_x = ax, dir_y = ay, era = lens.era })
    self.fire_t = self.fire_rate
  end

  function Hero:shoot(dt)
    local I = state.cutscene and NO_INPUT or gs.input
    local has = state.data.has
    if self.dash_t > 0 then return end
    -- missiles have their own button, so there is never a weapon to switch to
    if I.pressed("x") and has.missile then self:fire("missile") end
    if has.charge then
      -- tap fires at once; holding fills the charge and letting go fires a big shot
      if I.pressed("y") then self:fire("bolt"); self.charge = 0 end
      if I.held("y") then
        local before = self.charge
        self.charge = self.charge + dt
        if before < self.charge_time and self.charge >= self.charge_time then gs.sfx("sfx_switch", 0.4) end
      elseif self.charge > 0 then
        if self.charge >= self.charge_time then self:fire("charged") end
        self.charge = 0
      end
    elseif I.held("y") and self.fire_t <= 0 then
      self:fire("bolt")
    end
  end

  -- ---------- looks

  function Hero:animate(dt, sliding)
    local F = art.HERO
    local up = self.aim == "up"
    self.anim_t = self.anim_t + dt
    self.flip = self.face < 0
    if self.hurt_t > self.inv_time - 0.25 then
      self.frame = F.hurt
    elseif self.dash_t > 0 then
      self.frame = F.dash
    elseif sliding then
      self.frame = F.slide
      self.flip = self.wall_dir > 0      -- back to the wall, gun out
    elseif not self.on_ground then
      local falling = self.speed_y > 0
      if self.aim == "down" then self.frame = falling and F.fall_down or F.jump_down
      elseif up then self.frame = falling and F.fall_up or F.jump_up
      else self.frame = falling and F.fall or F.jump end
    elseif self.crouching then
      self.frame = F.crouch
    elseif self.land_t > 0 and not up then
      self.frame = F.land
    elseif math.abs(self.speed_x) > 5 then
      local step = math.floor(self.anim_t * 12) % 6
      self.frame = (up and F.run_up or F.run) + step
      -- a puff of dust each time a foot comes down
      if step ~= self.step and step % 3 == 0 then self:dust(-self.face, 2) end
      self.step = step
    else
      self.frame = (up and F.idle_up or F.idle) + math.floor(self.anim_t * 2) % 2
    end
  end

  -- a little dust at the feet, blown one way (-1 back, 1 forward relative to the screen's x)
  function Hero:dust(dir, count)
    gs.burst(self.x - dir * 2, self.y - 1, { count = count, color = "#8a90a8", size = 2, speed = { 15, 45 }, angle = dir > 0 and 0 or 180,
      spread = 50, life = { 0.15, 0.3 }, gravity = -40, depth = 9, fade = true })
  end

  -- The scarf: each point keeps going the way it was going (a little slowed), sags, and flutters;
  -- then every link is pulled back to its length. Moving makes the tail stream out behind for free.
  function Hero:update_scarf()
    local p = self.scarf
    p[1].x, p[1].y = self:neck()
    local t = self.anim_t
    for i = 2, SCARF_N do
      local q = p[i]
      local vx, vy = (q.x - q.px) * 0.86, (q.y - q.py) * 0.86
      q.px, q.py = q.x, q.y
      q.x = q.x + vx - self.face * 0.12
      q.y = q.y + vy + 0.1 + math.sin(t * 10 - i * 0.9) * 0.12
    end
    for _ = 1, 3 do
      for i = 2, SCARF_N do
        local a, b = p[i - 1], p[i]
        local dx, dy = b.x - a.x, b.y - a.y
        local d = math.sqrt(dx * dx + dy * dy)
        if d > SCARF_LINK then
          local k = SCARF_LINK / d
          b.x, b.y = a.x + dx * k, a.y + dy * k
        end
      end
    end
  end

  function Hero:draw_scarf()
    local p, floor = self.scarf, math.floor
    for i = 2, SCARF_N do
      local r = i < 5 and 3 or 2
      gs.draw.rect(floor(p[i].x) - 1, floor(p[i].y) - 1, r + 2, r + 2, "#000000")
    end
    for i = 2, SCARF_N do
      local r = i < 5 and 3 or 2
      gs.draw.rect(floor(p[i].x), floor(p[i].y), r, r, i % 3 == 0 and "#b0293a" or "#ea5a4b")
    end
  end

  function Hero:draw()
    self:draw_scarf()
    for i = #self.trail, 1, -1 do
      local p = self.trail[i]
      gs.draw.sprite("spr_hero", p.x, p.y, { frame = p.frame, flip = p.flip, alpha = p.t / 0.15 * 0.5 })
    end
    -- flicker while hurt
    if self.hurt_t > 0 and math.floor(self.hurt_t * 20) % 2 == 0 then return end
    self:draw_sprite()
    -- in Then the goggles glow
    if lens.era == "then" and self.frame ~= art.HERO.hurt then
      local gx = self.x + (self.face > 0 and 2 or -7)
      gs.draw.rect(gx, self.y - 25 + self:bob(), 5, 2, "#a6f4e6")
    end
    if self.charge > 0.15 then
      local x, y = self:muzzle()
      local full = self.charge >= self.charge_time
      local r = full and 3 + math.floor(self.anim_t * 20) % 2 or 1 + 2 * self.charge / self.charge_time
      gs.draw.circle(x, y, r, full and "#a6f4e6" or "#45d1c5")
    end
  end

  return Hero
