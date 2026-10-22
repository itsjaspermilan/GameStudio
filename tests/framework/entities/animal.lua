local Animal = gs.entity{ legs = 4, sound = "...", tags = { "animal" } }
function Animal:speak() return "the animal says " .. self.sound end
function Animal:walk() return self.legs end
return Animal
