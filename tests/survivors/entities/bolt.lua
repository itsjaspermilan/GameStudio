local Bolt = gs.entity{ sprite = "bolt", tags = { "bolt" }, hitbox = { r = 3 } }

function Bolt:create() self:after(0.8, function() self:destroy() end) end

function Bolt:on_collide_bat(bat)
  bat:hurt(1)
  self:destroy()
end

return Bolt
