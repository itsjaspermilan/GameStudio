-- Enemy fire that hurts the player. The kinds (shot, shot2, bossshot, mine, meteor) build on this and only change how it looks and how big it is.
local run = require "lib.run"

local EBullet = gs.entity{
  tags = { "ebullet" },
  depth = 40,
  hitbox = { r = 2 },
  kind = "shot",
  dmg = 5,
  life = 3.2,
}

function EBullet:create() run.nbullets = run.nbullets + 1 end
function EBullet:on_destroy() run.nbullets = run.nbullets - 1 end

function EBullet:update(dt)
  self.life = self.life - dt
  local P = run.P
  if self.life <= 0 or math.abs(self.x - P.x) > 500 or math.abs(self.y - P.y) > 500 then self:destroy() end
end

-- a bullet is used up when it touches the player, even if the player was protected at that moment (meteors keep going)
function EBullet:on_collide_player(p)
  run.hurt_player(self.dmg, self.kind)
  if self.kind ~= "meteor" then self:destroy() end
end

return EBullet
