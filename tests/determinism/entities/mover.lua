local Mover = gs.entity{ tags = { "mover" } }
local random, randomseed = math.random, math.randomseed
local noise = tonumber(os.getenv("GS_DRAW_NOISE") or "0")
local reseed = os.getenv("GS_DRAW_RESEED") == "1"

function Mover:update(dt)
  local dx, dy = gs.input.dir()
  self.vx, self.vy = dx * 20 + gs.random(-5, 5), dy * 20 + random(-5, 5)
  self.hp = self.hp + (gs.input.pressed("a") and 7 or 0)
  self.roll = gs.choose(3, 5, 11)
end

function Mover:draw()
  if noise > 0 then
    if reseed then randomseed(gs.world.step_id, self.id) end
    for i = 1, noise do random(); random(0); random(-100, 100) end
  end
end

return Mover
