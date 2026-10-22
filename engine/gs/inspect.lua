-- The studio's inspector. When the studio runs a game it sets GS_INSPECT to a small file it writes commands into; this reads it a few
-- times a second and, while the Inspector tab is open, answers with one "@@gsi {json}" line on stderr twice a second:
--   commands: { "open": true, "paused": false, "step_seq": 3, "speed": 0.5, "class": "entities.enemy", "entity": 12, "watch": ["#gs.all('enemy')"] }
--   answer:   { "paused", "speed", "step", "classes": [{ name, count, update_ms, draw_ms, collide_ms }], "list": [{ id, x, y }], "entity": { fields }, "watch": [...] }
-- Paused means no step runs at all (drawing goes on); each new step_seq runs that many steps. Nothing here runs without GS_INSPECT.
local json = require("gs.json")
local world = require("gs.world")

local M = { paused = false, speed = 1, open = false, pending_steps = 0 }
local path = os.getenv("GS_INSPECT")
M.enabled = path ~= nil
local last_text, poll_t, send_t, frames = nil, 0, 0, 0
local cmd = {}

-- ---------- a small JSON writer (the reader in gs.json is all the framework needed so far)
local function enc(v, depth)
  local t = type(v)
  if t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    return math.type(v) == "integer" and tostring(v) or string.format("%.4g", v)
  elseif t == "string" then
    return '"' .. v:gsub('[%c"\\]', function(c) return string.format("\\u%04x", c:byte()) end) .. '"'
  elseif t == "boolean" then return tostring(v)
  elseif t == "table" and (depth or 0) < 4 then
    local n = #v
    if n > 0 or next(v) == nil then
      local out = {}
      for i = 1, n do out[i] = enc(v[i], (depth or 0) + 1) end
      return "[" .. table.concat(out, ",") .. "]"
    end
    local out = {}
    for k, x in pairs(v) do out[#out + 1] = enc(tostring(k)) .. ":" .. enc(x, (depth or 0) + 1) end
    return "{" .. table.concat(out, ",") .. "}"
  end
  return "null"
end

-- an entity's own values as text a person can read (functions and private fields left out; tables shown short)
local function show(v)
  local t = type(v)
  if t == "number" then return math.type(v) == "integer" and tostring(v) or string.format("%.2f", v) end
  if t == "string" then return string.format("%q", v) end
  if t == "table" then
    if rawget(v, "__kind") then return "class " .. tostring(rawget(v, "__name")) end
    if rawget(v, "id") and rawget(v, "x") then return "entity " .. tostring(rawget(v, "id")) end
    local n = 0; for _ in pairs(v) do n = n + 1 end
    return "{ " .. n .. " values }"
  end
  return tostring(v)
end
local function fields(e)
  local out = {}
  for k, v in pairs(e) do
    if type(k) == "string" and k:sub(1, 1) ~= "_" and type(v) ~= "function" then out[k] = show(v) end
  end
  return out
end

local function find_entity(id)
  for i = 1, #world.all do local e = world.all[i]; if e.id == id and not e._dead then return e end end
  return nil
end

local function watch(exprs, e)
  local out = {}
  for i, src in ipairs(exprs or {}) do
    local env = setmetatable({ e = e, self = e, gs = gs }, { __index = _G })
    local fn, err = load("return " .. tostring(src), "watch", "t", env)
    if not fn then out[i] = "error: " .. tostring(err):gsub("^.-:%d+: ", "")
    else
      local ok, v = pcall(fn)
      out[i] = ok and show(v) or "error: " .. tostring(v):gsub("^.-:%d+: ", "")
    end
  end
  return out
end

function M.report()
  local classes = {}
  for _, entry in ipairs(world.classes) do
    local n = 0
    for i = 1, #entry.list do if not entry.list[i]._dead then n = n + 1 end end
    local f = math.max(1, frames)
    classes[#classes + 1] = { name = entry.cls.__name, count = n,
      update_ms = (entry.t_update or 0) * 1000 / f, draw_ms = (entry.t_draw or 0) * 1000 / f, collide_ms = (entry.t_collide or 0) * 1000 / f }
    entry.t_update, entry.t_draw, entry.t_collide = 0, 0, 0
  end
  frames = 0
  local list, sel = {}, nil
  if cmd.class then
    for _, entry in ipairs(world.classes) do
      if entry.cls.__name == cmd.class then
        for i = 1, #entry.list do
          local e = entry.list[i]
          if not e._dead and #list < 60 then list[#list + 1] = { id = e.id, x = math.floor(e.x + 0.5), y = math.floor(e.y + 0.5) } end
        end
      end
    end
  end
  if cmd.entity then sel = find_entity(cmd.entity) end
  local scene = world.scene
  io.stderr:write("@@gsi " .. enc({
    paused = M.paused, speed = M.speed, step = world.step_id, alive = world.alive, particles = gs.particle_count(),
    scene = scene and getmetatable(scene) and getmetatable(scene).__name or "", classes = classes, list = list,
    entity = sel and fields(sel) or (cmd.entity and false) or nil, watch = watch(cmd.watch, sel),
  }) .. "\n")
  io.stderr:flush()
end

-- Called once a frame with the real time that passed.
function M.poll(dt)
  if not path then return end
  frames = frames + 1
  poll_t = poll_t + dt
  if poll_t >= 0.15 then
    poll_t = 0
    local f = io.open(path, "r")
    if f then
      local text = f:read("a"); f:close()
      if text and text ~= "" and text ~= last_text then
        last_text = text
        local ok, c = pcall(json.decode, text)
        if ok and type(c) == "table" then
          local seq, before = tonumber(c.step_seq) or 0, tonumber(cmd.step_seq) or 0
          if seq > before then M.pending_steps = M.pending_steps + math.min(600, seq - before) end
          cmd = c
          M.paused, M.speed, M.open = c.paused == true, tonumber(c.speed) or 1, c.open == true
          world.profile = M.open
        end
      end
    end
  end
  if M.open then
    send_t = send_t + dt
    if send_t >= 0.5 then send_t = 0; M.report() end
  end
end

return M
