-- A day in the kitchen. The rules live in lib/kitchen.lua; this scene turns buttons into kitchen
-- actions, turns the kitchen's events into sounds, poses and sparks, and draws it all.
-- The foods are drawn in two diamonds shaped like the handheld's buttons (the D-pad on the left,
-- X A B Y on the right), so the button for a food is the one in the same spot. L bins the plate, R
-- serves it, Start pauses.
local data = require "lib.data"
local K = require "lib.kitchen"
local ui = require "lib.ui"
local bot = require "lib.bot"
local howto = require "lib.howto"

local d = gs.draw
local Play = gs.scene{}

-- where things are on the 320x240 screen
local TICKET = { x = 6, y = 17, w = 100, h = 60, step = 104 }
local SLOT = 30                            -- a food's square in a diamond
local SPOT = {                             -- the centre of each button's square
  up = { 60, 134 }, down = { 60, 202 }, left = { 26, 168 }, right = { 94, 168 },
  x = { 260, 134 }, b = { 260, 202 }, y = { 226, 168 }, a = { 294, 168 },
}
local CHEF = { x = 144, y = 98 }
local PLATE = { x = 140, y = 210 }
local POSE = { idle = 0, add = 3, serve = 5, oops = 6 }

function Play:enter(day_no, opts)
  opts = opts or {}
  ui.backdrop()
  self.k = K.new(day_no, opts.seed)
  self.bot = opts.bot
  self.bot_wait = 0
  self.intro = opts.quick and 0 or 2.2        -- the day's name and tip before the clock starts
  self.mode = "play"                           -- "play", "pause" or "help"
  self.cur = 1
  self.lit = {}                                -- button -> seconds it stays lit
  self.pose, self.pose_t = POSE.idle, 0
  self.floats = {}                             -- rising "+12" texts
  self.end_t = nil
  self.last_tick = nil
  gs.music(day_no >= 5 and "msc_rush" or "msc_kitchen")
  if self.intro > 0 then gs.sfx("order") end
end

-- ---------- input
local FOOD_BUTTONS = { "x", "a", "b", "y", "up", "right", "down", "left" }

function Play:press(button)
  local k = self.k
  self.lit[button] = 0.15
  if button == "l" then K.bin(k)
  elseif button == "r" then K.serve(k)
  else K.add(k, data.BY_BUTTON[button].id) end
end

function Play:update(dt)
  for b, t in pairs(self.lit) do self.lit[b] = t > dt and t - dt or nil end
  if self.mode == "pause" then return self:update_pause() end
  if self.mode == "help" then
    if gs.input.pressed("a") or gs.input.pressed("b") or gs.input.pressed("start") then self.mode = "pause"; gs.sfx("back") end
    return
  end
  if self.end_t then
    self.end_t = self.end_t - dt
    if self.end_t <= 0 then gs.goto_scene("scenes.results", { fade = 0.4 }, self:result()) end
    self:effects(dt)
    return
  end
  if self.intro > 0 then
    self.intro = self.intro - dt
    if self.intro <= 0 then gs.sfx("go") end
    return
  end
  if gs.input.pressed("start") then self.mode, self.cur = "pause", 1; gs.pause(true); gs.sfx("select"); return end

  local k = self.k
  if self.bot then
    self.bot_wait = self.bot_wait - dt
    if self.bot_wait <= 0 then
      local b = bot.act(k)
      if b then self.lit[b] = 0.15 end
      self.bot_wait = 0.4
    end
  else
    for _, b in ipairs(FOOD_BUTTONS) do if gs.input.pressed(b) then self:press(b) end end
    if gs.input.pressed("l") then self:press("l") end
    if gs.input.pressed("r") then self:press("r") end
  end
  K.step(k, dt)
  -- the last ten seconds tick
  local s = math.ceil(k.time_left)
  if s <= 10 and s ~= self.last_tick and not k.over then self.last_tick = s; gs.sfx("tick") end
  self:effects(dt)
  if k.over and not self.end_t then
    self.end_t = 1.6
    gs.music_stop(0.5)
  end
end

-- ---------- the kitchen's events: sounds, the chef's pose, sparks and floating coins
local function ticket_x(i) return TICKET.x + (i - 1) * TICKET.step end

function Play:set_pose(p, t) self.pose, self.pose_t = p, t or 0.25 end

function Play:effects(dt)
  local k = self.k
  for _, e in ipairs(k.events) do
    local kind = e.kind
    if kind == "add" then
      gs.sfx("plate"); self:set_pose(POSE.add, 0.15)
      local spot = SPOT[data.FOOD[e.a].button]
      gs.burst(spot[1], spot[2], { count = 5, color = 15, speed = { 20, 50 }, gravity = 60, life = { 0.15, 0.3 } })
    elseif kind == "bin" then gs.sfx("bin"); gs.burst(30, 92, { count = 6, color = 2, speed = { 20, 40 }, gravity = 120, life = { 0.2, 0.4 } })
    elseif kind == "serve" then
      gs.sfx("serve"); self:set_pose(POSE.serve, 0.5)
      local x = ticket_x(e.b) + TICKET.w / 2
      self.floats[#self.floats + 1] = { text = "+" .. e.a, x = x, y = TICKET.y + 24, t = 0 }
      gs.burst(x, TICKET.y + 26, { count = 12, color = 14, speed = { 30, 70 }, gravity = 60, life = { 0.3, 0.6 } })
    elseif kind == "wrong" then gs.sfx("wrong"); self:set_pose(POSE.oops, 0.35)
    elseif kind == "order" then gs.sfx("order")
    elseif kind == "lost" then gs.sfx("lost"); gs.camera:shake(2, 0.2)
    elseif kind == "end" then gs.sfx(k.ended == "time" and "go" or "lost")
    end
  end
  k.events = {}
  if self.pose_t > 0 then self.pose_t = self.pose_t - dt; if self.pose_t <= 0 then self.pose = POSE.idle end end
  for i = #self.floats, 1, -1 do
    local f = self.floats[i]
    f.t = f.t + dt; f.y = f.y - 20 * dt
    if f.t > 1 then table.remove(self.floats, i) end
  end
  -- tickets slide in from the right and left into the gaps
  for i, t in ipairs(k.tickets) do
    t.dx = t.dx or 330
    t.dx = t.dx + (ticket_x(i) - t.dx) * math.min(1, dt * 12)
  end
end

function Play:result()
  local k = self.k
  return { day = k.day_no, coins = k.coins, served = k.served, misses = k.misses, stars = K.stars(k), ended = k.ended, best_tip = k.best_tip, bot = self.bot }
end

-- ---------- pause
local PAUSE = { "Keep cooking", "How to play", "Start the day again", "Quit to the days" }

function Play:update_pause()
  local inp = gs.input
  if inp.pressed("up") then self.cur = (self.cur - 2) % #PAUSE + 1; gs.sfx("move") end
  if inp.pressed("down") then self.cur = self.cur % #PAUSE + 1; gs.sfx("move") end
  if inp.pressed("start") or inp.pressed("b") then self.mode = "play"; gs.pause(false); gs.sfx("back"); return end
  if inp.pressed("a") then
    gs.sfx("ok")
    if self.cur == 1 then self.mode = "play"; gs.pause(false)
    elseif self.cur == 2 then self.mode = "help"
    elseif self.cur == 3 then gs.pause(false); gs.goto_scene("scenes.play", { fade = 0.3 }, self.k.day_no)
    else gs.pause(false); gs.goto_scene("scenes.days", { fade = 0.3 }) end
  end
end

-- ---------- drawing
local function urgency_color(f) return f > 0.5 and "#6ccf4f" or f > 0.25 and "#f5d94a" or "#ea5a4b" end

function Play:draw_hud()
  local k = self.k
  d.rect(0, 0, 320, 13, "#000000")
  d.text(k.day.name, 4, 3, "#ffd08a")
  for i = 1, K.MISSES do d.sprite("spr_heart", 84 + (i - 1) * 10, 3, { frame = i <= K.MISSES - k.misses and 0 or 1 }) end
  local clock = ui.clock(k.time_left)
  local blink = k.time_left <= 10 and math.floor(k.clock * 4) % 2 == 0
  d.text(clock, 160 - d.text_width(clock) / 2, 3, blink and "#ea5a4b" or "#ffffff")
  -- coins, then the coins for the first star
  local need = "/" .. k.day.stars[1]
  d.text_right(need, 316, 3, k.coins >= k.day.stars[1] and "#6ccf4f" or "#8a90a8")
  local cx = 316 - d.text_width(need)
  d.text_right(tostring(k.coins), cx, 3, "#f5d94a")
  d.sprite("spr_coin", cx - d.text_width(tostring(k.coins)) - 11, 3)
end

function Play:draw_ticket(i, t)
  local k = self.k
  local x, y = math.floor(t.dx or ticket_x(i)), TICKET.y
  local f = t.wait / t.max
  if f < 0.2 then x = x + (math.floor(gs.world.time * 20) % 2 == 0 and 1 or -1) end
  d.rect(x + 2, y + 2, TICKET.w, TICKET.h, "#000000")
  d.rect(x, y, TICKET.w, TICKET.h, ui.PAPER)
  d.rect(x, y, TICKET.w, 1, "#ffffff")
  d.frame(x, y, TICKET.w, TICKET.h, ui.PAPER_EDGE)
  d.rect(x + 46, y - 2, 8, 4, "#8a90a8")          -- the clip that hangs it on the rail
  local mood = f > 0.5 and 0 or f > 0.25 and 1 or 2
  d.sprite("spr_face", x + 4, y + 4, { frame = t.face * 3 + mood })
  d.text(t.dish.name, x + 24, y + 8, ui.INK)
  for j, id in ipairs(t.dish.items) do
    local ix, iy = x + 4 + (j - 1) * 19, y + 23
    ui.food(id, ix, iy)
    -- a green tick on what the plate already has
    if K.has(k.plate, id) then d.rect(ix + 11, iy + 11, 5, 5, "#000000"); d.rect(ix + 12, iy + 12, 3, 3, "#6ccf4f") end
  end
  d.sprite("spr_coin", x + 4, y + 46)
  d.text(tostring(t.dish.price), x + 14, y + 46, "#9a5324")
  d.rect(x + 34, y + 47, 62, 6, "#c9a227")
  d.rect(x + 35, y + 48, math.max(0, math.floor(60 * f)), 4, urgency_color(f))
end

function Play:draw_tickets()
  local k = self.k
  d.rect(0, 13, 320, 3, "#3b3f55")      -- the rail
  d.rect(0, 13, 320, 1, "#8a90a8")
  for i, t in ipairs(k.tickets) do self:draw_ticket(i, t) end
  if #k.tickets == 0 and self.intro <= 0 and not k.over then ui.shadow_centered("Waiting for customers...", 40, "#a6f4e6") end
end

-- One food's square: the food, and the button's badge in the corner. The foods the plate still
-- needs for the next order glow, so a beginner can always see what to press.
function Play:draw_slot(button, need)
  local k = self.k
  local food = data.BY_BUTTON[button]
  local cx, cy = SPOT[button][1], SPOT[button][2]
  local x, y = cx - SLOT / 2, cy - SLOT / 2
  if not K.open(k, food.id) then
    ui.box(x, y, SLOT, SLOT, "#14234f", "#2d1a4f")
    d.text("?", cx - 3, cy - 4, "#3b3f55")
    return
  end
  local lit = self.lit[button]
  local glow = need[food.id] and math.floor(gs.world.time * 3) % 2 == 0
  ui.box(x, y, SLOT, SLOT, lit and "#a8d4ff" or "#ffd08a", lit and "#ffffff" or "#fff6a8")
  if glow then d.frame(x - 1, y - 1, SLOT + 2, SLOT + 2, "#f5d94a"); d.frame(x - 2, y - 2, SLOT + 4, SLOT + 4, "#f5d94a") end
  ui.food(food.id, cx - 8, cy - 10 + (lit and 1 or 0))
  if ui.BUTTON[button:upper()] then ui.button(button:upper(), x + SLOT - 9, y + SLOT - 9, lit)
  else ui.dpad(button, x + SLOT - 9, y + SLOT - 9, lit) end
end

function Play:draw_kitchen()
  local k = self.k
  -- what the next order still needs (with an empty plate, the customer who has waited longest)
  local need, goal = {}, K.goal(k)
  if goal then for _, id in ipairs(goal.dish.items) do if not K.has(k.plate, id) then need[id] = true end end end
  if self.intro > 0 or k.over then need = {} end
  for button in pairs(SPOT) do self:draw_slot(button, need) end
  -- L and R sit where the shoulder buttons are
  ui.button("L", 6, 88, self.lit.l)
  d.sprite("spr_bin", 22, 82)
  d.text("bin", 42, 90, "#ffd08a")
  d.text_right("serve", 280, 90, "#ffd08a")
  d.sprite("spr_bell", 284, 86)
  ui.button("R", 302, 88, self.lit.r)
  -- the chef, and the plate with the food stacked up as it was added
  local frame = self.pose
  if frame == POSE.idle then frame = math.floor(gs.world.time * 2) % 2 end
  d.sprite("spr_chef", CHEF.x, CHEF.y, { frame = frame })
  d.sprite("spr_plate", PLATE.x, PLATE.y)
  for i, id in ipairs(k.plate) do ui.food(id, PLATE.x + 12, PLATE.y - 6 - (i - 1) * 8) end
  if k.msg then
    local w = d.text_width(k.msg) + 10
    ui.box(math.floor(160 - w / 2), 80, w, 13, "#fff6a8", "#ffffff")
    d.text(k.msg, math.floor(160 - w / 2) + 5, 83, ui.INK)
  end
end

function Play:draw_ui()
  local k = self.k
  self:draw_hud()
  self:draw_tickets()
  self:draw_kitchen()
  for _, f in ipairs(self.floats) do ui.shadow(f.text, math.floor(f.x - 8), math.floor(f.y), "#f5d94a", 2) end
  if self.intro > 0 then
    local tip = d.wrap(k.day.tip, 280)
    ui.box(12, 92, 296, 40 + #tip * 10, "#14234f", "#4f9bf0")
    ui.shadow_centered(self.intro > 0.6 and k.day.name or "Go!", 100, "#f5d94a", 2)
    for i, line in ipairs(tip) do d.text_centered(line, 122 + (i - 1) * 10, "#a8d4ff") end
  end
  if self.end_t then
    ui.box(60, 100, 200, 40, "#14234f", "#4f9bf0")
    ui.shadow_centered(k.ended == "time" and "Closing time!" or "Too many left!", 112, k.ended == "time" and "#f5d94a" or "#ea5a4b", 2)
  end
  if self.mode == "help" then howto.draw("A: back to the pause menu") end
  if self.mode == "pause" then
    ui.box(70, 70, 180, 100, "#14234f", "#4f9bf0")
    ui.shadow_centered("Paused", 80, "#f5d94a", 2)
    ui.rows(PAUSE, self.cur, 80, 102, 160)
  end
end

return Play
