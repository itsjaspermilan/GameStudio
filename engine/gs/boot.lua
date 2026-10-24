-- Boot: loads the game (game.lua), builds the public `gs` API out of the framework modules, and defines the init / update / draw the
-- runtime calls. Everything a game uses lives on the one global `gs` table; the runtime's own low-level calls are kept in gs.raw.
local raw = {}
for k, v in pairs(gs) do raw[k] = v end
gs.raw = raw

local entity = require("gs.entity")
entity.install_require()
local json = require("gs.json")
local assets = require("gs.assets")
local timers = require("gs.timers")
local camera = require("gs.camera")
local input = require("gs.input")
local dr = require("gs.draw")
local ui = require("gs.ui")
local save = require("gs.save")
local sound = require("gs.sound")
local world = require("gs.world")
local reload = require("gs.reload")
local inspect = require("gs.inspect")

local DEV = os.getenv("GS_DEV") ~= nil
local STATS = os.getenv("GS_STATS") ~= nil -- the studio's Handheld panel asks for a line of numbers every second
local FF = math.max(1, tonumber(os.getenv("GS_FF") or "1") or 1)
local STEP = 1 / 60

-- ---------------------------------------------------------------- the public API
gs.entity, gs.scene = entity.entity, entity.scene
gs.spawn, gs.each, gs.all, gs.first, gs.count = world.spawn, world.each, world.all_of, world.first, world.count
gs.nearest, gs.in_radius, gs.in_rect, gs.send = world.nearest, world.in_radius, world.in_rect, world.send
local particles = require("gs.particles")
gs.burst, gs.particle_count = particles.burst, particles.count
gs.path = world.path
gs.pause, gs.defaults = world.pause, world.defaults
gs.goto_scene, gs.load_room, gs.add_layer, gs.layer, gs.tile_at, gs.set_tile = world.goto_scene, world.load_room, world.add_layer, world.layer, world.tile_at, world.set_tile
gs.flash = world.flash
gs.world, gs.assets = world, assets
gs.camera = setmetatable(camera, { __call = function(_, x, y) raw.camera(x, y) end }) -- gs.camera(x, y) is still the raw offset
gs.input, gs.draw, gs.ui, gs.save = input, dr, ui, save
gs.sfx, gs.music, gs.music_stop, gs.sfx_stop = sound.sfx, sound.music, sound.music_stop, sound.sfx_stop
gs.after = function(seconds, fn) return timers.after(nil, seconds, fn) end
gs.every = function(seconds, fn) return timers.every(nil, seconds, fn) end
gs.go = function(fn) return timers.go(nil, fn) end
gs.tween = function(target, props, seconds, easing, on_done) return timers.tween(nil, target, props, seconds, easing, on_done) end
gs.wait, gs.wait_until = timers.wait, timers.wait_until
local talk = require("gs.talk")
gs.say, gs.ask = talk.say, talk.ask
gs.color = dr.color
gs.dev = DEV

-- small helpers
function gs.clamp(v, lo, hi) return v < lo and lo or v > hi and hi or v end
function gs.lerp(a, b, t) return a + (b - a) * t end
function gs.sign(v) return v > 0 and 1 or v < 0 and -1 or 0 end
function gs.dist(x1, y1, x2, y2) local dx, dy = x2 - x1, y2 - y1; return math.sqrt(dx * dx + dy * dy) end
function gs.angle(x1, y1, x2, y2) return math.deg(math.atan(y2 - y1, x2 - x1)) % 360 end -- degrees clockwise: 0 right, 90 down
function gs.random(a, b)
  if a == nil then return math.random() end
  if b == nil then return math.random(a) end
  if math.type(a) == "integer" and math.type(b) == "integer" then return math.random(a, b) end
  return a + math.random() * (b - a)
end
function gs.choose(...) local n = select("#", ...); return (select(math.random(n), ...)) end
-- a random generator with its own seed, for things that must repeat: local rng = gs.rng(42); rng:int(1, 6); rng:float(); rng:pick(list)
function gs.rng(seed)
  local state = (seed or os.time()) % 2147483647
  if state <= 0 then state = state + 2147483646 end
  local r = {}
  local function nxt() state = (state * 48271) % 2147483647; return state / 2147483647 end
  function r:float(a, b) local v = nxt(); if a == nil then return v end return a + v * ((b or 1) - a) end
  function r:int(a, b) return a + math.floor(nxt() * (b - a + 1)) end
  function r:pick(list) return list[self:int(1, #list)] end
  return r
end

-- ---------------------------------------------------------------- the game
local spec
function gs.game(s) spec = s; return s end

local SPECS = require("gs.console_specs")
local console = {}
-- A console is built in (dot, dash) or carried by the game as consoles/<id>.json (the studio writes that copy when a game uses one of
-- your own consoles), so a game runs the same on any machine.
-- Glow43 and Glow169 were called Dot and Dash: games made then still say so in game.lua
local RENAMED = { dot = "glow43", dash = "glow169" }
local function load_console(c)
  if type(c) == "string" then
    c = RENAMED[c] or c
    local text = SPECS[c] or raw.load("consoles/" .. c .. ".json")
    if not text then error("game.lua: console = '" .. c .. "' is not a console (built in: glow43, glow169; your own needs consoles/" .. c .. ".json in the game)", 0) end
    local ok, spec = pcall(json.decode, text)
    if not ok or type(spec) ~= "table" then error("consoles/" .. c .. ".json is not a console spec: " .. tostring(spec), 0) end
    return spec
  end
  return c or json.decode(SPECS.glow43)
end

local function fail_message(text) return tostring(text) end

local fatal -- the message of the error that stopped the game (development only)
local note, note_t = nil, 0

local function guard(fn, ...)
  if not DEV then return fn(...) end
  local ok, err = xpcall(fn, function(m) return debug.traceback(tostring(m), 2) end, ...)
  if not ok then
    fatal = err
    io.stderr:write("error: " .. tostring(err) .. "\n")
  end
end

-- start the game: run game.lua, set the screen, load sound and pictures, enter the first scene
local booted = false
local function boot()
  local ok, err = pcall(require, "game")
  if not ok then error("game.lua: " .. tostring(err), 0) end
  if not spec then error("game.lua must call gs.game{ title = ..., console = \"dot\", start = \"scenes.title\" }", 0) end
  console = load_console(spec.console)
  if spec.buttons then dr.buttons(spec.buttons) end
  local screen = console.screen or { width = 256, height = 192 }
  raw.set_resolution(screen.width, screen.height)
  world.view_w, world.view_h = screen.width, screen.height
  camera.view_w, camera.view_h = screen.width, screen.height
  dr.palette = {}
  for i, hex in ipairs((console.palette and console.palette.colors) or {}) do
    dr.palette[i] = { tonumber(hex:sub(2, 3), 16), tonumber(hex:sub(4, 5), 16), tonumber(hex:sub(6, 7), 16) }
  end
  local limits = console.limits or {}
  gs.limits = { screen_w = screen.width, screen_h = screen.height, entities = limits.instances_alive, particles = limits.particles,
    budgets = console.budgets or {}, console = console.name or "custom" }
  particles.limit = limits.particles or 300
  world.limits = { entities = limits.instances_alive }
  sound.load(console.audio)
  if spec.preload ~= false then assets.preload() end
  if DEV then reload.start() end
  local bot_path = os.getenv("GS_BOT_LUA")
  if bot_path and bot_path ~= "" then
    local fn, e = loadfile(bot_path)
    if not fn then error("GS_BOT_LUA: " .. tostring(e), 0) end
    input.sim_begin()
    fn()
  end
  booted = true
  world.goto_scene(spec.start or "scenes.main")
end

function init()
  local ok, err = xpcall(boot, function(m) return debug.traceback(tostring(m), 2) end) -- a traceback for anything that goes wrong while starting
  if not ok then error(err, 0) end
end

local acc, reload_clock = 0, 0
gs.time_scale = 1

-- ---------------------------------------------------------------- numbers for the studio (only when GS_STATS is set)
-- One line a second on stderr: "@@gs {json}". Times are the CPU time of this computer, per step and per frame; the handheld is slower, so the
-- studio shows them as a guide and treats the entity count (exact on both) as the number to watch.
local clock = os.clock
local wall = raw.time -- seconds, real time: frames a second must be measured with it, not with CPU time
local stat = { update = 0, draw = 0, steps = 0, frames = 0, peak = 0, since = wall(), checks = 0, screens = 0, calls = 0 }
local function stats_tick()
  local now = wall()
  if now - stat.since < 1 then return end
  local alive = world.alive
  local limit = world.limits.entities
  -- checks, screens and calls: the busiest step and frame of this second (collision checks; pixels drawn, in screens, overlaps counted;
  -- drawing calls). ram: the console's RAM in use now and at most, and its size, when Lua's memory is that fixed block (the handheld's
  -- libretro core, and the studio's Play panel); without it the game has the computer's memory and only mem_kb is known.
  local used, most, size = raw.ram()
  local ram = used and string.format(',"ram_kb":%d,"ram_peak_kb":%d,"ram_size_kb":%d', used // 1024, most // 1024, size // 1024) or ""
  io.stderr:write(string.format('@@gs {"entities":%d,"peak":%d,"limit":%s,"update_ms":%.3f,"draw_ms":%.3f,"fps":%d,"mem_kb":%d,"checks":%d,"screens":%.2f,"calls":%d%s}\n',
    alive, stat.peak, limit and tostring(limit) or "null", stat.steps > 0 and stat.update / stat.steps * 1000 or 0,
    stat.frames > 0 and stat.draw / stat.frames * 1000 or 0, math.floor(stat.frames / (now - stat.since) + 0.5), math.floor(collectgarbage("count")),
    stat.checks, stat.screens, stat.calls, ram))
  stat.update, stat.draw, stat.steps, stat.frames, stat.since, stat.checks, stat.screens, stat.calls = 0, 0, 0, 0, now, 0, 0, 0
end

function update(dt)
  input.begin_frame()
  if DEV then
    reload_clock = reload_clock + dt
    if reload_clock >= 0.5 then
      reload_clock = 0
      local msg = reload.poll()
      if msg then
        note, note_t = msg, 2.5
        io.stderr:write(msg .. "\n")
        if reload.last_error then io.stderr:write(reload.last_error .. "\n") else fatal = nil end
      end
      if note_t > 0 then note_t = note_t - 0.5 end
    end
  end
  if fatal then return end
  local t0 = STATS and clock()
  if inspect.enabled then
    inspect.poll(dt)
    if inspect.paused then -- the studio's Pause: no step at all, except the ones its Step button asks for
      if inspect.pending_steps == 0 then input.end_step() end -- presses made while paused belong to no step
      while inspect.pending_steps > 0 and not fatal do
        inspect.pending_steps = inspect.pending_steps - 1
        guard(world.step, STEP)
        input.end_step()
      end
      acc = 0
      if STATS then stat.update = stat.update + (clock() - t0) end
      return
    end
    inspect.pending_steps = 0
  end
  acc = acc + dt * FF * gs.time_scale * (inspect.enabled and inspect.speed or 1)
  local steps = 0
  while acc >= STEP and steps < 4 * FF do
    acc = acc - STEP
    steps = steps + 1
    if rawget(_G, "bot_step") then bot_step() end
    guard(world.step, STEP)
    if STATS then
      stat.steps = stat.steps + 1
      if world.alive > stat.peak then stat.peak = world.alive end
      if world.checks > stat.checks then stat.checks = world.checks end
    end
    input.end_step()
    if fatal then break end
  end
  if steps >= 4 * FF then acc = 0 end
  if STATS then stat.update = stat.update + (clock() - t0) end
end

local function error_overlay()
  raw.camera(0, 0)
  raw.zoom(1) -- a draw that failed half way may have left the world's zoom on
  dr.rect(0, 0, world.view_w, world.view_h, { 0, 0, 0, 215 })
  dr.text("ERROR", 8, 8, "#ea5a4b", 2)
  local y = 30
  for line in (reload.last_error or fatal):gmatch("[^\n]+") do
    for _, l in ipairs(dr.wrap(line, world.view_w - 16)) do
      if y < world.view_h - 20 then dr.text(l, 8, y, "#ffffff"); y = y + 10 end
    end
  end
  dr.text("fix the file and save: the game continues by itself", 8, world.view_h - 12, "#8a90a8")
end

function draw()
  if not booted then return end
  if fatal then
    error_overlay()
    return
  end
  local t0 = STATS and clock()
  guard(world.draw)
  if STATS then
    stat.draw = stat.draw + (clock() - t0); stat.frames = stat.frames + 1
    local px, calls, screen = raw.stats() -- the frame before this one: the runtime counts pixels as they are drawn
    if px / screen > stat.screens then stat.screens = px / screen end
    if calls > stat.calls then stat.calls = calls end
    stats_tick()
  end
  if fatal then error_overlay() return end
  if note_t > 0 and note then dr.text(note, 4, world.view_h - 10, "#6ccf4f") end
  if reload.last_error then
    dr.rect(0, 0, world.view_w, 12, { 180, 40, 58, 230 })
    dr.text("reload failed: see the output", 4, 2, "#ffffff")
  end
end
