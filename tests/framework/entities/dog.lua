local Animal = require "entities.animal"
local Dog = gs.entity(Animal, { sound = "woof", tags = { "dog" } })
function Dog:speak() return "the dog says " .. self.sound end
return Dog
