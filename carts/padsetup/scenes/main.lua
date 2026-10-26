-- Asks for one button at a time and stores the raw button numbers with gs.pad_set (the runtime's
-- own call, not a framework one).
local STEPS = {
  { "a", "A  (main action)" }, { "b", "B  (back)" }, { "x", "X" }, { "y", "Y" },
  { "l", "L  (left shoulder)" }, { "r", "R  (right shoulder)" }, { "start", "START" }, { "select", "SELECT" },
  { "hotkey", "HOTKEY  (Menu)" },
  { "l2", "L2  (left trigger)" }, { "r2", "R2  (right trigger)" }, { "l3", "L3  (left stick)" }, { "r3", "R3  (right stick)" },
}
local Main = gs.scene{}

function Main:enter()
  gs.pad_last() -- forget a press from before the setup started
  self.got, self.used, self.step, self.idle, self.done_t, self.saved = {}, {}, 1, 0, 0, nil
end

function Main:save()
  self.saved = true
  for i, s in ipairs(STEPS) do if self.got[i] then self.saved = gs.pad_set(s[1], self.got[i]) and self.saved end end
end

function Main:update(dt)
  if self.step > #STEPS then
    self.done_t = self.done_t + dt
    if self.done_t > 2.5 then gs.quit() end
    return
  end
  local n = gs.pad_last()
  if n == nil then
    self.idle = self.idle + dt
    if self.idle > 30 then self:save(); gs.quit() end -- nothing pressed for a while: keep what was set and leave
    return
  end
  self.idle = 0
  -- a button already taken by an earlier name skips this one (a device without sticks has no L3 or
  -- R3)
  if not self.used[n] then self.used[n] = true; self.got[self.step] = n end
  self.step = self.step + 1
  if self.step > #STEPS then self:save() end
end

function Main:draw()
  gs.draw.rect(0, 0, 256, 192, "#14141e")
  gs.draw.text("PAD SETUP", 12, 8, "#ffffff", 2)
  if self.step <= #STEPS then
    gs.draw.text("Press the button you want for:", 12, 32, "#b4b4c8")
    gs.draw.text(STEPS[self.step][2], 12, 46, "#ffc828", 2)
    gs.draw.text("(" .. self.step .. " of " .. #STEPS .. ") No such button? Press", 12, 68, "#b4b4c8")
    gs.draw.text("one you already set to skip it.", 12, 78, "#b4b4c8")
  else
    gs.draw.text(self.saved and "Saved! You can play now." or "Could not save the buttons.", 12, 46, "#78ff78", 2)
  end
  for i, s in ipairs(STEPS) do
    local col, y = (i - 1) // 7, 96 + ((i - 1) % 7) * 20
    local x = 12 + col * 154
    local got = self.got[i]
    gs.draw.text(s[1], x, y, "#ffffff")
    gs.draw.text(got and ("button " .. got) or (i < self.step and "skipped" or "..."), x + 56, y, got and "#78ff78" or "#5a5a6e")
  end
end

return Main
