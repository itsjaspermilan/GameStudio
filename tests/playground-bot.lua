local role = os.getenv("GS_PLAYGROUND_ROLE") or "practice"
local expected = tonumber(os.getenv("GS_PLAYGROUND_PLAYERS") or "2")
local first_mode = tonumber(os.getenv("GS_PLAYGROUND_MODE") or "1")
local input = gs.input
local buttons = { "up", "down", "left", "right", "a", "b", "x" }
local born, frame, command = gs.raw.time(), 0, nil
local previous_scene, rounds, won_at, rematched, leaving = nil, 0, nil, false, false
local named = role == "host" or role == "practice"
local sprint_target

local function menu_key(scene)
  if leaving then return end
  if scene.page == "home" then
    if not named then
      if scene.choice ~= 4 then return "down" end
      if scene.player_name == "Clover" then return "right" end
      named = true
    end
    local choice = role == "practice" and 3 or role == "host" and 1 or 2
    if scene.choice ~= choice then return "down" end
    return "a"
  elseif scene.page == "practice" then
    if scene.mode ~= first_mode then return "right" end
    return "a"
  elseif scene.page == "host" then
    if scene.mode ~= first_mode then return "right" end
    if gs.net.count == expected and not scene.starting then return "a" end
  elseif scene.page == "find" and #scene.sessions > 0 then
    return "a"
  end
end

local function board_key(scene)
  local player = role == "practice" and scene.turn or gs.net.me
  if player ~= scene.turn then return end
  local marks = select(2, scene.board:gsub(tostring(player), ""))
  local target = ({ 1, 21, 16, 11 })[player] + marks
  local x, y = (scene.cursor - 1) % 5, (scene.cursor - 1) // 5
  local tx, ty = (target - 1) % 5, (target - 1) // 5
  if x < tx then return "right" elseif x > tx then return "left" end
  if y < ty then return "down" elseif y > ty then return "up" end
  return "a"
end

local function sprint_keys(scene)
  local player = role == "practice" and 1 or gs.net.me
  local runner = assert(scene.runners[player])
  if runner.grounded or not sprint_target then
    sprint_target = scene.star_x
    if scene.star_y < 100 and runner.y > 134 then sprint_target = runner.x < 128 and 40 or 216 end
  end
  local target = sprint_target
  if runner.x < target - 3 then input.sim_hold("right", true)
  elseif runner.x > target + 3 then input.sim_hold("left", true) end
  if runner.grounded and runner.y - 30 > scene.star_y then
    input.sim_hold("a", true)
    if role == "practice" then input.sim_press("a") end
  end
  if runner.y < scene.star_y - 4 then input.sim_hold("down", true) end
end

function bot_step()
  frame = frame + 1
  for _, button in ipairs(buttons) do input.sim_hold(button, false) end
  local name, scene = gs.scene_name(), gs.world.scene
  if not scene then return end
  if (leaving or rematched) and name == "menu" then
    assert(gs.net.state == "off")
    print("PLAYGROUND TEST PASS " .. role)
    gs.raw.quit()
    return
  end
  if name == "menu" then
    if frame % 8 == 0 then
      local key = menu_key(scene)
      if key then input.sim_press(key) end
    end
  else
    if scene ~= previous_scene then
      previous_scene, command, won_at, sprint_target = scene, nil, nil, nil
      print("PLAYGROUND ENTER " .. name)
      if rounds == 2 then
        rematched = true
        print("PLAYGROUND REMATCH PASS")
      end
    end
    if rematched then
      if not won_at then won_at = gs.world.step_id end
      if gs.world.step_id - won_at > 60 then
        leaving = true
        if role == "practice" then input.sim_press("b")
        elseif gs.net.me == expected then input.sim_hold("b", true) end
      end
    elseif scene.winner ~= 0 then
      if not won_at then
        rounds, won_at = rounds + 1, gs.world.step_id
        assert(scene.winner == 1 or name == "sprint", "unexpected board winner")
        print("PLAYGROUND WON " .. name .. " " .. scene.winner)
      end
      if gs.world.step_id - won_at > 60 and (role == "host" or role == "practice") then
        local key = rounds == 1 and "x" or "a"
        input.sim_hold(key, gs.world.step_id % 12 < 4)
        if role == "practice" and gs.world.step_id % 12 == 0 then input.sim_press(key) end
      end
    elseif name == "board" then
      if gs.world.step_id % 12 == 0 then
        command = board_key(scene)
        if role == "practice" and command then input.sim_press(command) end
      end
      if command and gs.world.step_id % 12 < 4 then input.sim_hold(command, true) end
    elseif name == "sprint" then
      sprint_keys(scene)
    end
  end
  if gs.raw.time() - born > 40 then
    error("playground timed out in " .. tostring(name) .. " / " .. gs.net.state .. " / rounds " .. rounds)
  end
end
