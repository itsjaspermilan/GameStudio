local checked_board = false
local function mark(board, index, player)
  return board:sub(1, index - 1) .. player .. board:sub(index + 1)
end

function bot_step()
  local scene = gs.world.scene
  if not scene then return end
  if gs.scene_name() == "board" and not checked_board then
    for _, line in ipairs({ { 1, 2, 3 }, { 1, 6, 11 }, { 1, 7, 13 }, { 5, 9, 13 } }) do
      scene:enter()
      scene.count, scene.turn = 4, 4
      scene.board = mark(mark(scene.board, line[1], 4), line[2], 4)
      scene.cursor, scene.moves = line[3], 2
      scene:place()
      assert(scene.winner == 4, "every line direction must work for player 4")
    end
    scene:enter()
    scene.board, scene.cursor, scene.moves, scene.turn = mark(scene.board, 1, 1), 1, 1, 2
    scene:place()
    assert(scene.moves == 1 and scene.turn == 2 and scene.winner == 0, "an occupied cell must not consume a turn")
    scene.cursor = 2
    scene:place()
    assert(scene.moves == 2 and scene.turn == 1 and scene:piece(1, 0) == 2)
    scene:enter()
    scene.board, scene.cursor = mark(mark(scene.board, 5, 1), 6, 1), 7
    scene:place()
    assert(scene.winner == 0, "a line must not wrap around the board")
    scene:enter()
    scene.count, scene.board, scene.moves, scene.cursor = 4, "1234134123123413412312340", 24, 25
    scene:place()
    assert(scene.winner == -1, "a full board with no line is a draw")
    checked_board = true
    gs.goto_scene("scenes.sprint")
  elseif gs.scene_name() == "sprint" then
    scene.count = 2
    scene.runners[2] = gs.spawn("runner", 24, 168, { player = 2 })
    for _, runner in ipairs(scene.runners) do
      runner.x, runner.y, runner.score = scene.star_x, scene.star_y + 17, 4
    end
    scene:update()
    assert(scene.winner == 1 and scene.runners[1].score == 5 and scene.runners[2].score == 4,
      "simultaneous pickups must resolve in player order")
    print("PLAYGROUND RULES PASS")
    gs.raw.quit()
  end
end
