local Gem = gs.entity{ sprite = "gem", tags = { "gem" }, hitbox = { r = 3 } }

function Gem:update(dt)
  local hero = gs.first("hero")
  if hero and self:distance_to(hero) < 40 then self:move_toward(hero, 120) end
end

return Gem
