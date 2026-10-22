local Blinker = gs.entity{ sprite = "flash", ended = 0 }
function Blinker:on_animation_end(name) self.ended = self.ended + 1; self.last_end = name end
return Blinker
