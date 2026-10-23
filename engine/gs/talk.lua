-- Conversations: a text box that types its words out, and questions with answers to pick. Use them inside a script that can wait
-- (gs.go in a scene, self:go in an entity); the world stands still until the player has read the box:
--   gs.go(function()
--     gs.say("OLD MAN", "It's dangerous to go alone.")      -- the name may be left out: gs.say("A door. It's locked.")
--     if gs.ask("Take this?", { "YES", "NO" }) == 1 then state.sword = true end
--   end)
-- A presses on (and shows the whole page at once while it is still typing); up and down move between answers.
--
-- The look comes from the scene's layout, from things with these names (they are only the pattern, so the game never shows them
-- itself): dialogue_box (a panel: where the box is and its tiles), dialogue_text (a text: where the words start, their font, colour and
-- size), dialogue_name (a text: where the speaker's name goes) and dialogue_cursor (a picture: the arrow in front of the chosen answer
-- and at the end of a page). Without them a pale box sits at the bottom of the screen with dark round_tall letters and their shadow.
local draw = require("gs.draw")
local input = require("gs.input")
local timers = require("gs.timers")

local M = { speed = 40, active = nil } -- speed: letters a second

local PATTERN = { dialogue_box = true, dialogue_text = true, dialogue_name = true, dialogue_cursor = true }
M.pattern = PATTERN

-- the look: the scene's named things, or a pale box with tall letters
local function style(scene, w, h)
  local box, text = scene and scene.dialogue_box, scene and scene.dialogue_text
  local s = {
    box = box, name = scene and scene.dialogue_name, cursor = scene and scene.dialogue_cursor,
    x = box and box.x or 4, y = box and box.y or h - 60, w = box and box.w or w - 8, h = box and box.h or 56,
    font = text and text.font or (not text and "round_tall" or nil), size = text and text.size or 1,
    color = text and text.color or (box and "#ffffff" or "#404048"), shadow = text and text.shadow or (not text and true or nil),
  }
  s.tx, s.ty = text and text.x or s.x + 8, text and text.y or s.y + 8
  -- the words keep the same distance from the right and bottom edges as from the left and top
  s.right, s.bottom = s.x + s.w - (s.tx - s.x), s.y + s.h - (s.ty - s.y)
  local _, line = draw.any_height(s.font)
  s.lh = line * s.size
  -- the cursor's room in front of an answer: a sprite font's letter, or the built-in ">" and a little space
  s.cw = (s.font and not draw.font_of(s.font)) and require("gs.assets").sprite(s.font, 3).fw * s.size or draw.any_width(s.font, ">", s.size) + 2 * s.size
  return s
end

local function text_at(s, str, x, y, color)
  draw.any_text(s.font, str, x, y, color or s.color, s.size, nil, s.shadow)
end

local function open(name, text, answers)
  local W = require("gs.world")
  if not coroutine.isyieldable() or not timers.current then
    error("gs.say and gs.ask wait for the player, so they go inside a script that can wait: gs.go(function() ... end)", 3)
  end
  local s = style(W.scene, W.view_w, W.view_h)
  -- the name goes in its own place, or in front of the words
  local words = (name and not s.name) and (name .. ": " .. text) or text
  local lines = draw.wrap(words, s.right - s.tx, s.size, s.font)
  local rows = math.max(1, math.floor((s.bottom - s.ty + 2 * s.size) / s.lh))
  local pages = {}
  for i = 1, math.max(1, #lines), rows do
    local p = {}
    for k = i, math.min(#lines, i + rows - 1) do p[#p + 1] = lines[k] end
    pages[#pages + 1] = p
  end
  -- the answers go under the last page's words, or on a page of their own when they do not fit
  if answers and #pages[#pages] + #answers > rows then pages[#pages + 1] = {} end
  local t = { name = name, pages = pages, page = 1, shown = 0, answers = answers, pick = 1, style = s, was_paused = W.paused, job = timers.current }
  M.active = t
  t.job.talk = true -- this script keeps running while the world stands still
  W.pause(true)
  timers.wait_until(function() return t.done end)
  t.job.talk = nil
  M.active = nil
  W.pause(t.was_paused == true)
  return t.pick
end

function M.say(a, b) if b == nil then return (open(nil, a)) end open(a, b) end
function M.ask(question, answers, name)
  if type(answers) ~= "table" or #answers == 0 then error("gs.ask(question, { \"YES\", \"NO\" }): give it a list of answers", 2) end
  return open(name, question, answers)
end

local function letters(page) local n = 0; for _, l in ipairs(page) do n = n + #l end return n end

-- called every step, also while the world stands still
function M.update(dt)
  local t = M.active
  if not t or t.done then return end
  local page = t.pages[t.page]
  local total = letters(page)
  local last = t.page == #t.pages
  if t.shown < total then
    t.shown = math.min(total, t.shown + M.speed * dt)
    if input.pressed("a") then t.shown = total end
    return
  end
  if last and t.answers then
    if input.pressed("up") then t.pick = (t.pick - 2) % #t.answers + 1 end
    if input.pressed("down") then t.pick = t.pick % #t.answers + 1 end
  end
  if input.pressed("a") then
    if last then t.done = true else t.page, t.shown = t.page + 1, 0 end
  end
end

-- the cursor: the layout's picture, or ">" in the box's font
local function cursor(s, x, y)
  local c = s.cursor
  if c then require("gs.assets").draw(require("gs.assets").sprite(c.sprite, 3), c.frame, x, y + s.lh / 2 - s.size, 0, c.sx, c.sy, 1, false)
  else text_at(s, ">", x - s.cw / 2, y) end
end

-- drawn above everything else, after the scene's draw_ui
function M.draw()
  local t = M.active
  if not t or t.done then return end
  local s = t.style
  if s.box then s.box.draw(s.box)
  else -- a rounded dark edge, a light line inside it, and a pale page
    draw.rect(s.x + 1, s.y, s.w - 2, s.h, "#38486a"); draw.rect(s.x, s.y + 1, s.w, s.h - 2, "#38486a")
    draw.rect(s.x + 2, s.y + 2, s.w - 4, s.h - 4, "#a8c4e0"); draw.rect(s.x + 3, s.y + 3, s.w - 6, s.h - 6, "#f8f8f0")
  end
  if t.name and s.name then text_at(s, t.name, s.name.x, s.name.y, s.name.color) end
  local page, left = t.pages[t.page], math.floor(t.shown)
  local y = s.ty
  for _, line in ipairs(page) do
    if left <= 0 then break end
    text_at(s, line:sub(1, left), s.tx, y)
    left = left - #line
    y = y + s.lh
  end
  local typed = t.shown >= letters(page)
  if not typed then return end
  if t.page == #t.pages and t.answers then
    y = s.ty + #page * s.lh
    for i, a in ipairs(t.answers) do
      text_at(s, a, s.tx + s.cw * 2, y)
      if i == t.pick then cursor(s, s.tx + s.cw / 2, y) end
      y = y + s.lh
    end
  elseif math.floor(require("gs.world").time * 2) % 2 == 0 then -- there is more: a blinking arrow in the corner
    cursor(s, s.right - s.cw / 2, s.bottom - s.lh + 2 * s.size)
  end
end

return M
