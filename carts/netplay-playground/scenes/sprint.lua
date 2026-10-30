local P = require "lib.playground"
local course = require "lib.course"
local Sprint = gs.scene{}

function Sprint:next_star()
  local previous = self.star
  self.star = math.random(1, #course.stars - (previous and 1 or 0))
  if previous and self.star >= previous then self.star = self.star + 1 end
  local position = course.stars[self.star]
  self.star_x, self.star_y = position.x, position.y
end

function Sprint:enter()
  self.count, self.winner, self.elapsed = P.count(1), 0, 0
  self.runners = {}
  for player = 1, self.count do
    self.runners[player] = gs.spawn("runner", 24 + (player - 1) * 64, 168, { player = player })
  end
  self:next_star()
end

function Sprint:update()
  if P.exit_pressed(self.count) then return end
  if self.winner ~= 0 then P.result_input(2); return end
  self.elapsed = self.elapsed + 1
  -- Resolve simultaneous pickups in player order on every device, never just for gs.net.me.
  for player, runner in ipairs(self.runners) do
    if math.abs(runner.x - self.star_x) <= 14 and math.abs(runner.y - 17 - self.star_y) <= 19 then
      runner.score = runner.score + 1
      if runner.score >= 5 then self.winner = player; gs.sfx("win")
      else self:next_star(); gs.sfx("star") end
      break
    end
  end
end

function Sprint:draw()
  P.background()
  gs.draw.rect(0, 48, 256, 128, "#c0d8c0")
  gs.draw.rect(0, 130, 256, 46, "#a0c0a0")
  for _, platform in ipairs(course.platforms) do
    for x = platform.x, platform.x + platform.w - 16, 16 do gs.draw.sprite("ground", x, platform.y) end
  end
  gs.draw.sprite("star", self.star_x, self.star_y)
  for player, runner in ipairs(self.runners) do
    local look = P.runners[player]
    look.frame, look.flip = runner.frame, runner.flip
    gs.draw.sprite("runner", math.floor(runner.x), math.floor(runner.y), look)
    P.text(P.label(player), math.floor(runner.x) - 7, math.floor(runner.y) - 39, "#304850", true)
  end
end

function Sprint:draw_ui()
  P.panel(8, 6, 240, 32, true)
  for player, runner in ipairs(self.runners) do
    local x = 20 + (player - 1) * 58
    P.badge(player, x, 22)
    P.text(runner.score .. "/5", x + 12, 14)
  end
  if self.count == 1 then P.text("Star sprint", 124, 14) end
  P.footer("{left}/{right} Run   {a} Jump   {down} Drop   {b} Leave")
  if self.winner ~= 0 then
    P.result(self.count == 1 and "Five stars! Well played." or "Player " .. self.winner .. " wins!")
  else
    P.text(P.online() and "You: P" .. gs.net.me or "Practice", 10, 42, "#304850", true)
  end
end

Sprint.on_net_end = P.on_net_end
return Sprint
