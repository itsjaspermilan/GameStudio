-- The code of every room (each scenes/rooms/<id>.layout.lua says code = "room"). It places Wren at the door they came through (or a
-- terminal, or the start), runs the Lens and Static, walks Wren out through doors at the room's edges, handles dying, and draws the HUD.
-- Start opens the pause menu (lib/menu.lua), Select the quick map.
local state = require "lib.state"
local lens = require "lib.lens"
local talk = require "lib.talk"
local story = require "lib.story"
local world = require "lib.world"
local hud = require "lib.hud"
local menu = require "lib.menu"

local Room = gs.scene{}
local playing -- the song playing, so walking between rooms of one biome does not restart it

function Room:enter()
  self.room_id = gs.world.scene_name:match("([%w_]+)$")
  self.info = world.rooms[self.room_id]
  self.w, self.h = self.info.w * 320, self.info.h * 240
  local d = state.data
  d.room, d.seen[self.room_id] = self.room_id, true
  state.cutscene, talk.busy = false, false
  self.t, self.stop_t, self.dying, self.map_on, self.hollow_t = 0, 0, nil, false, 3
  talk.style(self)
  lens.enter()
  lens.locked = self.info.lens_lock
  if lens.locked and lens.era == "then" then lens.show("now") end
  gs.spawn("ghost")
  self:place_hero()
  gs.camera:follow(self.hero, { smooth = 0.08, offset_y = -16 })
  if self.info.seals and #self.info.seals > 0 and d.flags.boss_hangar then self:open_seals() end
  if playing ~= self.info.music then playing = self.info.music; gs.music(playing) end
  local debug = require "lib.debug"
  if debug.test then debug.room_entered(self) else story.enter(self.room_id, self) end
end

function Room:place_hero()
  local d = state.data
  local door = d.door and self.info.doors[d.door]
  local x, y, face = nil, nil, 1
  if door then
    face = door.side == "left" and 1 or -1
    x, y = door.side == "left" and door.x + 34 or door.x - 18, door.y
  else
    -- a new game starts by the ship; after that Wren wakes at the room's terminal
    if not d.flags.intro then for _, s in ipairs(gs.all("spot")) do if s.name == "start" then x, y = s.x, s.y end end end
    if not x then for _, t in ipairs(gs.all("usable")) do if t.sprite == "spr_terminal" then x, y = t.x + 20, t.y end end end
  end
  d.door = nil
  self.hero = gs.spawn("hero", x or self.w / 2, y or self.h / 2, { face = face })
end

function Room:go(to, at)
  local d = state.data
  d.room, d.door = to, at
  gs.goto_scene("scenes.rooms." .. to, { fade = 0.15 })
  self.leaving = true
end

-- the story opens a sealed door (a boss beaten): its tiles go in both eras
function Room:open_seals()
  for _, s in ipairs(self.info.seals or {}) do
    local x, y = s[1] * 16 + 8, s[2] * 16 + 8
    gs.set_tile("now", x, y, -1)
    gs.set_tile("then", x, y, -1)
  end
  lens.ghost = nil
end

-- messages from entities (gs.send)
function Room:on_slow(seconds) self.stop_t = math.min(seconds, 0.12); gs.pause(true) end
function Room:on_died()
  if self.dying then return end
  self.dying = 1.6
  state.cutscene = true
  gs.music_stop(0.8)
end
function Room:on_boss_down() self.boss = nil; story.boss_down(self) end

function Room:update(dt)
  state.tick(dt)
  self.t = self.t + dt
  -- a phase dodge stops the world for a moment (a hit-stop)
  if self.stop_t > 0 then
    self.stop_t = self.stop_t - dt
    if self.stop_t <= 0 then gs.pause(false) end
    return
  end
  if self.menu then
    if not self.menu:update(dt) then self.menu = nil; gs.pause(false) end
    return
  end
  if self.dying then
    self.dying = self.dying - dt
    if self.dying <= 0 then
      state.data.deaths = state.data.deaths + 1
      local deaths = state.data.deaths
      state.load()
      state.data.deaths = deaths
      lens.show("now")
      playing = nil
      gs.goto_scene("scenes.rooms." .. state.data.room, { fade = 0.3 })
      self.dying = 99
    end
    return
  end
  if talk.busy then return end
  local I = gs.input
  if I.pressed("start") and not state.cutscene then
    self.menu = menu.open(self)
    gs.pause(true)
    return
  end
  if I.pressed("select") then self.map_on = not self.map_on end

  -- the Lens and Static
  if lens.update(dt) == "overload" and self.hero then
    lens.overload()
    state.say("OVERLOAD", 2)
    self.hero:hurt(1, nil, true)
  end
  self:hallucinate(dt)

  -- out through a door, or off the bottom of the room
  local h = self.hero
  if h and not self.leaving then
    if h.x < 6 or h.x > self.w - 6 then
      local side = h.x < 6 and "left" or "right"
      local best, bd
      for id, door in pairs(self.info.doors) do
        if door.side == side then
          local dist = math.abs(door.y - h.y)
          if not bd or dist < bd then best, bd = door, dist end
        end
      end
      if best and bd < 64 then self:go(best.to, best.at) end
    elseif h.y > self.h + 40 then
      if h:hurt(1, nil, true) then h.x, h.y, h.speed_x, h.speed_y = h.safe_x, h.safe_y, 0, 0 end
    end
  end
end

-- High Static brings Hollows in Then (dark shapes of earlier Wrens). The other effects are drawn by the HUD.
function Room:hallucinate(dt)
  local u = lens.unease()
  if u < 0.35 or lens.era ~= "then" or not self.hero then return end
  self.hollow_t = self.hollow_t - dt
  if self.hollow_t > 0 or gs.count("hollow") >= 2 then return end
  self.hollow_t = 5 - u * 2.5
  local h = self.hero
  local side = gs.choose(-1, 1)
  gs.spawn("hollow", gs.clamp(h.x + side * 170, 16, self.w - 16), gs.clamp(h.y - 60, 24, self.h - 24))
end

function Room:draw_ui()
  hud.draw(self)
  if self.map_on and not self.menu then hud.minimap(self) end
  if self.menu then self.menu:draw() end
  if self.dying then
    local a = math.floor(gs.clamp(1 - self.dying / 1.6, 0, 1) * 255)
    gs.draw.rect(0, 0, 320, 240, { 0, 0, 0, a })
  end
end

return Room
