local P = {}
P.banks = { "clover", "comet", "poppy", "sunny" }
P.colors = { "#78c890", "#80b8e0", "#e89090", "#f0c868" }
P.names = { "Clover", "Comet", "Poppy", "Sunny" }
P.modes = { "Three in a row", "Star sprint" }
P.scenes = { "scenes.board", "scenes.sprint" }
local BODY = { font = "round_tall" }
local SMALL = { font = "round_small" }
local TITLE = { font = "bold_tall" }
local WOOD = { border = "#584048", light = "#f0d8a0", shade = "#987050", fill = "#e0b878", fill2 = "#d0a068", round = 2 }
local PAPER = { border = "#786050", light = "#fff0c8", shade = "#c0a878", fill = "#f0e0b0", fill2 = "#e8d0a0", round = 2 }

function P.online()
  return gs.net.state == "playing" or gs.net.state == "waiting"
end

function P.count(practice)
  return P.online() and gs.net.count or practice
end

function P.label(player)
  return "P" .. player
end

function P.text(value, x, y, color, small)
  gs.draw.text(value, x, y, color or "#584048", 1, small and SMALL or BODY)
end

function P.center(value, y, color, title)
  gs.draw.text_centered(value, y, color or "#584048", 1, title and TITLE or BODY)
end

function P.panel(x, y, w, h, paper)
  gs.draw.panel(x, y, w, h, paper and PAPER or WOOD)
end

function P.background()
  gs.draw.rect(0, 0, 256, 192, "#c0d8c0")
  gs.draw.rect(0, 124, 256, 68, "#a0c0a0")
  for i = 0, 15 do
    gs.draw.sprite("ground", i * 16, 176)
  end
end

function P.header(title, subtitle)
  P.panel(8, 6, 240, 40)
  P.center(title, 11, nil, true)
  P.center(subtitle, 29)
end

function P.footer(hint)
  gs.draw.rect(0, 176, 256, 16, "#e8d0a0")
  gs.draw.line(0, 176, 255, 176, "#987050")
  P.text(hint, 10, 181, "#304850", true)
end

function P.badge(player, x, y)
  gs.draw.sprite("token", x, y, P.tokens[player])
end

P.tokens, P.runners = {}, {}
for p = 1, 4 do
  P.tokens[p] = { frame = p - 1, bank = P.banks[p] }
  P.runners[p] = { bank = P.banks[p] }
end

function P.back()
  if P.online() then
    gs.net.leave()
  else
    gs.goto_scene("scenes.menu")
  end
end

function P.exit_pressed(count)
  for p = 1, count do
    if gs.input.pressed("b", P.online() and p or 1) then P.back(); return true end
  end
  return false
end

function P.result(title)
  P.panel(24, 53, 208, 98, true)
  P.center(title, 64, nil, true)
  P.center("A: Play again   X: Other game", 94)
  P.center(P.online() and "Player 1 chooses. B: Leave Wi-Fi" or "B: Back to the playground", 117)
end

function P.result_input(mode)
  if gs.input.pressed("a", 1) then
    gs.goto_scene(P.scenes[mode])
  elseif gs.input.pressed("x", 1) then
    gs.goto_scene(P.scenes[3 - mode])
  end
end

function P.on_net_end(self, reason)
  gs.goto_scene("scenes.menu", nil, reason)
end

return P
