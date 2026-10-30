local P = require "lib.playground"
local Board = gs.scene{}
local SIZE, CELL, X, Y = 5, 23, 16, 54
local directions = { { 1, 0 }, { 0, 1 }, { 1, 1 }, { 1, -1 } }

function Board:enter()
  self.count, self.turn, self.cursor = P.count(2), 1, 13
  self.board, self.moves, self.winner = string.rep("0", SIZE * SIZE), 0, 0
  self.message = "Make a line of three."
end

function Board:piece(x, y)
  if x < 0 or y < 0 or x >= SIZE or y >= SIZE then return 0 end
  return tonumber(self.board:sub(y * SIZE + x + 1, y * SIZE + x + 1))
end

function Board:place()
  if self.board:sub(self.cursor, self.cursor) ~= "0" then
    self.message = "That square is taken."
    return
  end
  self.board = self.board:sub(1, self.cursor - 1) .. self.turn .. self.board:sub(self.cursor + 1)
  self.moves = self.moves + 1
  gs.sfx("place")
  local x, y = (self.cursor - 1) % SIZE, (self.cursor - 1) // SIZE
  for _, dir in ipairs(directions) do
    local run = 1
    for _, sign in ipairs({ -1, 1 }) do
      local dx, dy = dir[1] * sign, dir[2] * sign
      for distance = 1, 2 do
        if self:piece(x + dx * distance, y + dy * distance) ~= self.turn then break end
        run = run + 1
      end
    end
    if run >= 3 then self.winner = self.turn; gs.sfx("win"); return end
  end
  if self.moves == SIZE * SIZE then self.winner = -1; return end
  self.turn = self.turn % self.count + 1
  self.message = "Make a line of three."
end

function Board:update()
  if P.exit_pressed(self.count) then return end
  if self.winner ~= 0 then P.result_input(1); return end
  -- Local practice passes one handheld; Wi-Fi always reads the active player's indexed buttons.
  local player = P.online() and self.turn or 1
  local x, y = (self.cursor - 1) % SIZE, (self.cursor - 1) // SIZE
  if gs.input.pressed("left", player) then x = (x - 1) % SIZE end
  if gs.input.pressed("right", player) then x = (x + 1) % SIZE end
  if gs.input.pressed("up", player) then y = (y - 1) % SIZE end
  if gs.input.pressed("down", player) then y = (y + 1) % SIZE end
  self.cursor = y * SIZE + x + 1
  if gs.input.pressed("a", player) then self:place() end
end

function Board:draw_ui()
  P.background()
  P.header("Three in a row", P.online() and "Take turns, across the same Wi-Fi." or "Pass the handheld after each turn.")
  P.panel(10, 48, 128, 125)
  for y = 0, SIZE - 1 do
    for x = 0, SIZE - 1 do
      local index = y * SIZE + x + 1
      gs.draw.rect(X + x * CELL, Y + y * CELL, 21, 21, (x + y) % 2 == 0 and "#f0e0b0" or "#e0c898")
      local player = self:piece(x, y)
      if player > 0 then P.badge(player, X + x * CELL + 10, Y + y * CELL + 10) end
      if self.winner == 0 and index == self.cursor then
        gs.draw.frame(X + x * CELL, Y + y * CELL, 21, 21, "#584048")
        gs.draw.frame(X + x * CELL + 1, Y + y * CELL + 1, 19, 19, "#a06830")
      end
    end
  end
  P.panel(144, 51, 104, 119, true)
  for player = 1, self.count do
    P.badge(player, 160, 68 + (player - 1) * 20)
    P.text(P.label(player) .. (player == self.turn and " turn" or ""), 173, 60 + (player - 1) * 20)
  end
  P.text(P.online() and "You: P" .. gs.net.me or "Local practice", 152, 144, nil, true)
  P.footer(self.message == "That square is taken." and self.message or "{dpad} Move   {a} Place   {b} Leave")
  if self.winner ~= 0 then
    P.result(self.winner < 0 and "A friendly draw!" or "Player " .. self.winner .. " wins!")
  end
end

Board.on_net_end = P.on_net_end
return Board
