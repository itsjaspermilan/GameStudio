-- Reads the runtime's buttons directly (gs.btn), so it shows what the device sends even for names a console does not list.
local NAMES = { "up", "down", "left", "right", "a", "b", "x", "y", "l", "r", "start", "select", "l2", "r2", "l3", "r3" }
local Main = gs.scene{}

function Main:enter() self.held = 0 end

function Main:update(dt)
  if gs.btn("l") and gs.btn("r") then self.held = self.held + dt else self.held = 0 end
  if self.held >= 2 then gs.quit() end
end

function Main:draw()
  gs.draw.rect(0, 0, 320, 240, "#14141e")
  gs.draw.text("BUTTON TEST", 12, 8, "#ffffff", 2)
  gs.draw.text("Press a button: its name lights up.", 12, 30, "#b4b4c8")
  gs.draw.text("Hold L + R for 2 seconds to leave.", 12, 42, "#b4b4c8")
  for i, n in ipairs(NAMES) do
    local col, row = (i - 1) % 4, (i - 1) // 4
    local x, y = 12 + col * 76, 62 + row * 44
    gs.draw.rect(x, y, 70, 38, gs.btn(n) and "#ffc828" or "#323246")
    local k = #n <= 4 and 2 or 1
    gs.draw.text(n, x + 35 - gs.draw.text_width(n, k) / 2, y + 19 - 4 * k, "#ffffff", k)
  end
end

return Main
