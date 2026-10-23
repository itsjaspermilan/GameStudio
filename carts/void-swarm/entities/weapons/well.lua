-- A gravity well: it drags enemies toward its middle and hurts them four times a second until it
-- fades.
local Well = gs.entity{
  tags = { "well" },
  depth = 90,
  sprite = "spr_p_hole",
  t = 3.5,
  r = 55,
  dmg = 1,
  tick = 0,
  alpha = 0.82,
}

function Well:create()
  local k = self.r / 24 * 0.9
  self.sx, self.sy = k, k
end

function Well:update(dt)
  self.t = self.t - dt
  self.tick = self.tick - dt
  local hurt = self.tick <= 0
  if hurt then self.tick = 0.25 end
  local list = gs.all("enemy")
  for i = 1, #list do
    local e = list[i]
    if not e._dead then
      local dx, dy = self.x - e.x, self.y - e.y
      local d = math.sqrt(dx * dx + dy * dy)
      if d <= self.r + e:radius() then
        if not e.boss and d > 3 then
          local pull = 55 * dt
          e.x, e.y = e.x + dx / d * pull, e.y + dy / d * pull
        end
        if hurt then e:hurt(self.dmg, 0, 0) end
      end
    end
  end
  if self.t <= 0 then self:destroy() end
end

return Well
