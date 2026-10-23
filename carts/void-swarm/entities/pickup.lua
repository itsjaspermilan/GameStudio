-- Things to pick up: gems (experience), coins (credits), hearts, a magnet that pulls every gem in,
-- a bomb that clears the screen.
-- They are drawn toward the player when close; the player's on_collide_pickup calls collect.
local run = require "lib.run"
local audio = require "lib.audio"

local Pickup = gs.entity{
  tags = { "pickup" },
  depth = 80,
  hitbox = { r = 8 },
  kind = "gem",
  v = 1,                              -- a gem's experience, a heart's health
  t = 0,
  pulled = false,
  anim_speed = 0,
}

local SPRITES = { gem = "spr_pk_gem", coin = "spr_pk_coin", heart = "spr_pk_heart", magnet = "spr_pk_magnet", bomb = "spr_pk_bomb" }

function Pickup:create()
  self.sprite = SPRITES[self.kind]
  if self.kind ~= "gem" then self.anim_speed = self.kind == "coin" and 1 or 10 / 6 end
end

function Pickup:update(dt)
  local R, P = run.R, run.P
  self.t = self.t + dt
  if self.kind == "gem" then -- small, medium and large gems look different, and sparkle
    self.frame = (self.v >= 8 and 4 or self.v >= 3 and 2 or 0) + (math.floor(self.t * 4) % 2)
  end
  local dx, dy = P.x - self.x, P.y - self.y
  local d = math.sqrt(dx * dx + dy * dy) + 0.001
  if R.magnet_all and self.kind == "gem" then self.pulled = true end
  if d < 38 * (1 + P.mods.magnet) or self.pulled then
    self.pulled = true
    local speed = 150 + (R.magnet_all and 150 or 0)
    self.x, self.y = self.x + dx / d * speed * dt, self.y + dy / d * speed * dt
  end
end

function Pickup:collect()
  local R, P = run.R, run.P
  local k = self.kind
  if k == "gem" then run.add_xp(self.v); audio.sfx("sfx_gem", 2)
  elseif k == "coin" then R.coin_count = R.coin_count + 1; audio.sfx("sfx_coin", 3)
  elseif k == "heart" then P.hp = math.min(P.maxhp, P.hp + self.v); audio.sfx("sfx_heal", 3); run.fx("pop", P.x, P.y, 0.4, 2)
  elseif k == "magnet" then R.magnet_all = 2.5; audio.sfx("sfx_magnet", 3)
  elseif k == "bomb" then
    audio.sfx("sfx_explode", 1); gs.camera:shake(3.2, 0.4); R.flash = 0.3
    local list = gs.all("enemy")
    for i = 1, #list do
      local e = list[i]
      if not e._dead and math.abs(e.x - P.x) < 170 and math.abs(e.y - P.y) < 130 then e:hurt(e.boss and 150 or 500, 0, 0) end
    end
    local bullets = gs.all("ebullet")
    for i = 1, #bullets do if bullets[i].kind ~= "meteor" then bullets[i]:destroy() end end
  end
  self:destroy()
end

return Pickup
