-- Conversations with portraits. The engine's gs.say / gs.ask type the words, page them and pick
-- answers; this gives them a look: a box along the bottom and a 48x48 portrait in a frame to its
-- left. Use inside gs.go (scripts that can wait):
--   talk.say("ossie", "Tower, this is Okafor.", 1)      -- who, words, the portrait's frame (expression)
--   local pick = talk.ask("wren", "What now?", { "KEEP HIM", "LET HIM GO" })
-- Portrait sprites are spr_por_<who>; a speaker with none (a sign, Wren's thoughts) shows no frame.
local M = {}

local WHO = {
  wren = { name = "WREN", color = "#ffa38c" },
  tender = { name = "TENDER", color = "#f5d94a" },
  ossie = { name = "OSSIE", color = "#a6f4e6" },
  note = { name = nil },
  thought = { name = nil },
}
M.who = WHO

local current = { who = nil, frame = 0 }

-- The look, as the four named things gs.say reads from the scene (see engine/gs/talk.lua). Called
-- by each room scene's enter.
function M.style(scene)
  scene.dialogue_box = {
    x = 58, y = 162, w = 258, h = 74,
    draw = function(self)
      gs.draw.rect(self.x, self.y, self.w, self.h, "#0b1020f0")
      gs.draw.frame(self.x, self.y, self.w, self.h, "#45d1c5")
      gs.draw.frame(self.x + 1, self.y + 1, self.w - 2, self.h - 2, "#1f8a96")
      local w = current.who
      if w and gs.assets.sprite and WHO[w] and WHO[w].name and M.has_portrait(w) then
        gs.draw.rect(4, 162, 52, 52, "#0b1020f0")
        gs.draw.frame(4, 162, 52, 52, "#45d1c5")
        gs.draw.sprite("spr_por_" .. w, 6, 164, { frame = current.frame })
      end
    end,
  }
  scene.dialogue_name = { x = 66, y = 168, color = "#45d1c5" }
  scene.dialogue_text = { x = 66, y = 180, color = "#ffffff", size = 1 }
end

local portraits = { wren = true, tender = true, ossie = true }
function M.has_portrait(who) return portraits[who] end

local function set(who, frame)
  current.who, current.frame = who, frame or 0
  local s = gs.world.scene
  if s and s.dialogue_name then s.dialogue_name.color = (WHO[who] and WHO[who].color) or "#45d1c5" end
end

function M.say(who, text, frame)
  set(who, frame)
  local w = WHO[who]
  if w and w.name then gs.say(w.name, text) else gs.say(text) end
end

function M.ask(who, text, answers, frame)
  set(who, frame)
  local w = WHO[who]
  return gs.ask(text, answers, w and w.name)
end

-- Run a conversation (a function using say/ask) unless one is already running.
function M.run(fn)
  if M.busy then return end
  M.busy = true
  gs.go(function()
    fn()
    M.busy = false
  end)
end

return M
