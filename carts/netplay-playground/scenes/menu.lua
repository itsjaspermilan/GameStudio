local P = require "lib.playground"
local Menu = gs.scene{}
local choices = { "Host on Wi-Fi", "Join on Wi-Fi", "Practice here", "Choose your name" }
local descriptions = {
  "One device hosts. The others join.",
  "Both devices need the same Wi-Fi.",
  "Try both games on this device.",
  "Left / right picks a player name.",
}

function Menu:enter(reason)
  self.page, self.choice, self.mode, self.name_index = "home", 1, 1, 1
  self.player_name = gs.net.name()
  if self.player_name == "" then self.player_name = P.names[1] end
  for i, name in ipairs(P.names) do if name == self.player_name then self.name_index = i end end
  self.message = reason or gs.net.error or ""
  self.sessions, self.selected, self.starting = {}, 1, false
end

function Menu:attempt(action)
  local ok, err = pcall(action)
  if not ok then
    self.message = tostring(err)
    io.stderr:write("Playground: " .. self.message .. "\n")
  end
  return ok
end

function Menu:update()
  local input = gs.input
  if self.page == "home" then
    if input.pressed("down") then self.choice = self.choice % #choices + 1 end
    if input.pressed("up") then self.choice = (self.choice - 2) % #choices + 1 end
    if self.choice == 4 and (input.pressed("left") or input.pressed("right") or input.pressed("a")) then
      self.name_index = (self.name_index + (input.pressed("left") and -2 or 0)) % #P.names + 1
      self.player_name = P.names[self.name_index]
      self.message = "Pick a different name on each device."
    elseif input.pressed("a") then
      self.message = ""
      if self.choice == 1 then
        if self:attempt(function() gs.net.host(self.player_name) end) then self.page = "host" end
      elseif self.choice == 2 then
        if self:attempt(function() self.sessions = gs.net.find() end) then self.page = "find" end
      elseif self.choice == 3 then
        self.page = "practice"
      end
    end
  elseif self.page == "find" then
    if input.pressed("b") then gs.net.leave(); self.page = "home"; return end
    if not self:attempt(function() self.sessions = gs.net.find() end) then self.page = "home"; return end
    if #self.sessions > 0 then
      if input.pressed("down") then self.selected = self.selected % #self.sessions + 1 end
      if input.pressed("up") then self.selected = (self.selected - 2) % #self.sessions + 1 end
      self.selected = math.min(self.selected, #self.sessions)
      if input.pressed("a") then
        if self:attempt(function() gs.net.join(self.sessions[self.selected].id, self.player_name) end) then self.page = "guest" end
      end
    end
  elseif self.page == "practice" then
    if input.pressed("b") then self.page = "home"; return end
    if input.pressed("left") or input.pressed("right") then self.mode = 3 - self.mode end
    if input.pressed("a") then gs.goto_scene(P.scenes[self.mode]) end
  else
    if input.pressed("b") then gs.net.leave(); self.page = "home"; self.starting = false; return end
    if gs.net.state == "off" then
      self.page, self.message, self.starting = "home", gs.net.error or "The session ended.", false
      return
    end
    if self.page == "host" and not self.starting then
      if input.pressed("left") or input.pressed("right") then self.mode = 3 - self.mode end
      if input.pressed("a") and gs.net.count >= 2 then
        self.starting = self:attempt(function() gs.net.start(P.scenes[self.mode]) end)
      end
    end
  end
end

function Menu:draw_ui()
  P.background()
  P.header("Netplay Playground", "Two games. One shared adventure.")
  if self.page == "home" then
    P.panel(16, 51, 224, 90, true)
    for i, label in ipairs(choices) do
      if i == 4 then label = "Name: " .. self.player_name end
      P.text((i == self.choice and "> " or "  ") .. label, 26, 58 + (i - 1) * 19)
    end
    P.text(descriptions[self.choice], 12, 149, nil, true)
    P.footer("{a} Choose   {up}/{down} Move")
  elseif self.page == "find" then
    P.panel(16, 51, 224, 112, true)
    P.center("Looking for nearby hosts", 60, nil, true)
    if #self.sessions == 0 then
      P.center("Ask a friend to choose Host.", 88)
      P.center("Enable Wi-Fi on both devices.", 111)
    else
      local first = math.max(1, self.selected - 2)
      for i = first, math.min(#self.sessions, first + 2) do
        local session = self.sessions[i]
        P.text((i == self.selected and "> " or "  ") .. session.name:sub(1, 16), 26, 84 + (i - first) * 22)
        P.text(session.players .. "/" .. session.max, 200, 86 + (i - first) * 22, nil, true)
      end
    end
    P.footer("{a} Join   {up}/{down} Pick host   {b} Back")
  elseif self.page == "practice" then
    P.panel(16, 51, 224, 112, true)
    P.center("Practice on this device", 61, nil, true)
    P.center("< " .. P.modes[self.mode] .. " >", 88)
    P.center(self.mode == 1 and "Two players pass the handheld." or "Jump and collect five stars.", 116)
    P.footer("{left}/{right} Game   {a} Play   {b} Back")
  else
    P.panel(16, 51, 224, 112, true)
    P.text(self.page == "host" and "Your lobby" or "Joining the lobby", 26, 57, nil)
    local peers = gs.net.peers()
    for i, peer in ipairs(peers) do
      P.badge(i, 34, 86 + (i - 1) * 17)
      P.text(P.label(i) .. " " .. peer.name:sub(1, 18), 48, 77 + (i - 1) * 17)
      if i == gs.net.me then P.text("you", 211, 80 + (i - 1) * 17, nil, true) end
    end
    if self.page == "host" then
      P.center("< " .. P.modes[self.mode] .. " >", 147)
      P.footer(self.starting and "Sharing the host's save... {b} Cancel" or gs.net.count < 2 and "Waiting for a friend... {b} Back" or "{left}/{right} Game   {a} Start   {b} Leave")
    else
      P.center("The host picks a game and starts.", 147)
      P.footer("{b} Leave lobby")
    end
  end
  if self.message ~= "" then
    P.panel(8, 143, 240, 32, true)
    local lines = gs.draw.wrap(self.message, 224, 1, "round_small")
    for i = 1, math.min(2, #lines) do P.text(lines[i], 16, 149 + (i - 1) * 10, "#903860", true) end
  end
end

return Menu
