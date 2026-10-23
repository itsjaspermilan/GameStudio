-- A shot from the hero: "bolt" (the blaster), "charged" (a held Y with Charge Shot) or "missile". It flies straight in one of four
-- directions, stops at walls and hurts what it hits.
local tiles = require "lib.tiles"

local KINDS = {
  bolt = { frame = 0, speed = 300, damage = 1, life = 0.6, r = 3 },
  charged = { frame = 1, speed = 260, damage = 4, life = 0.8, r = 5, pierce = true },
  missile = { frame = 2, speed = 340, damage = 5, life = 1.0, r = 3 },
}

local Shot = gs.entity{
  sprite = "spr_shot",
  tags = { "shot" },
  depth = 9,
  hitbox = { r = 3 },
  kind = "bolt", dir_x = 1, dir_y = 0,
}

function Shot:create()
  local k = KINDS[self.kind]
  self.k, self.life, self.frame = k, k.life, k.frame
  self.hitbox = { r = k.r }
  self.vx, self.vy = self.dir_x * k.speed, self.dir_y * k.speed
  self.angle = self.dir_y < 0 and -90 or self.dir_y > 0 and 90 or 0
  self.flip = self.dir_x < 0
  self.hits = {}
  gs.sfx(self.kind == "missile" and "sfx_missile" or self.kind == "charged" and "sfx_charge" or "sfx_shoot", self.kind == "bolt" and 0.35 or 0.6)
end

function Shot:pop()
  local big = self.kind ~= "bolt"
  gs.burst(self.x, self.y, { count = big and 14 or 5, color = self.kind == "charged" and "#a6f4e6" or "#fff6a8",
    speed = { 20, big and 90 or 50 }, spread = 360, life = 0.25, depth = 8 })
  self:destroy()
end

function Shot:update(dt)
  self.life = self.life - dt
  if self.life <= 0 then self:destroy() return end
  if tiles.wall_at(self.x + self.dir_x * 3, self.y + self.dir_y * 3) then self:pop() end
end

function Shot:on_collide_drone(d)
  if self.hits[d] then return end
  self.hits[d] = true
  d:hurt(self.k.damage)
  if not self.k.pierce then self:pop() end
end

return Shot
