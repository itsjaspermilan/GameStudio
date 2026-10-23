-- Kitchen Rush: cook what the customers order before they lose patience. Every button on the
-- handheld has a kitchen job (see scenes/play.lua). The rules are plain Lua in lib/kitchen.lua; the
-- screens are scenes drawn in code. Art and sound come from scripts/make-kitchen-rush.mjs.
return gs.game{
  title = "Kitchen Rush",
  console = "glow43",
  start = "scenes.title",
}
