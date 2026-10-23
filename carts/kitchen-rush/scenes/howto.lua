-- How to play, from the title screen (the page itself is lib/howto.lua).
local ui = require "lib.ui"
local page = require "lib.howto"

local Howto = gs.scene{}

function Howto:enter() ui.backdrop() end

function Howto:update(dt)
  if gs.input.pressed("a") or gs.input.pressed("b") or gs.input.pressed("start") then
    gs.sfx("back")
    gs.goto_scene("scenes.title", { fade = 0.3 })
  end
end

function Howto:draw_ui() page.draw("A: back") end

return Howto
