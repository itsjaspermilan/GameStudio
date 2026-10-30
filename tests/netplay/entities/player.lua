local Player = gs.entity{ player = 1, presses = 0, releases = 0 }
function Player:update()
  local dx, dy = gs.input.dir(self.player)
  self.x, self.y = self.x + dx, self.y + dy
  if gs.input.pressed("a", self.player) then self.presses = self.presses + 1 end
  if gs.input.released("a", self.player) then self.releases = self.releases + 1 end
end
return Player
