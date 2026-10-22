-- Classes for entities and scenes.
--
--   local Enemy = gs.entity { sprite = "grub", tags = { "enemy" }, hp = 10 }     -- a new kind of entity
--   local Boss  = gs.entity(Enemy, { sprite = "boss", hp = 500 })                -- builds on another one
--   function Enemy:update(dt) ... end                                            -- methods are plain Lua functions on the class
--
-- Speed: an instance's metatable is its class and the class table holds every method it can use, including the ones it inherits. They are
-- copied in once, the first time the class is used ("flattening"), so a method call is one table lookup however deep the family tree is.
--
-- Live reload: a class is identified by the name of the file it was loaded from. Loading that file again fills the SAME table, so every
-- living instance picks up the new methods at once and keeps its state. Children are flattened again afterwards (refresh).

local M = { registry = {}, loading = nil, base = {} }
local registry = M.registry

-- spec fields the engine reads itself; every other field is a default value for new instances
local RESERVED = { tags = true, sprite = true, depth = true, hitbox = true, screen = true, collide_every = true }

local function define(kind, a, b)
  local parent, spec
  if b ~= nil then parent, spec = a, b
  elseif type(a) == "table" and rawget(a, "__kind") then parent, spec = a, {}
  else spec = a or {} end
  if parent ~= nil and not (type(parent) == "table" and rawget(parent, "__kind")) then
    error("gs." .. kind .. "(parent, spec): the first argument must be another " .. kind .. " (did the file forget to 'return' it?)", 3)
  end
  local name = M.loading
  local cls = name and registry[name]
  local subs
  if cls then -- the same file again: keep the table (and who builds on it), empty the rest
    subs = rawget(cls, "__subs")
    for k in pairs(cls) do cls[k] = nil end
  else
    cls = {}
    if name then registry[name] = cls end
  end
  cls.__index, cls.__kind, cls.__name = cls, kind, name or "(unnamed)"
  cls.__parent = parent or M.base[kind]
  cls.__spec, cls.__subs, cls.__flat = spec, subs or {}, false
  local p = cls.__parent
  if p then
    local list, present = p.__subs, false
    for _, c in ipairs(list) do if c == cls then present = true end end
    if not present then list[#list + 1] = cls end
  end
  return cls
end

function M.entity(a, b) return define("entity", a, b) end
function M.scene(a, b) return define("scene", a, b) end

-- Copy inherited methods into the class and work out its defaults, tags, hitbox and collision handlers. Called once before first use.
function M.finalize(cls)
  if cls.__flat then return cls end
  local parent = cls.__parent
  if parent and parent ~= cls then M.finalize(parent) end
  local inherited = {}
  if parent then
    for k, v in pairs(parent) do
      if type(k) == "string" and k:sub(1, 2) ~= "__" and rawget(cls, k) == nil then cls[k] = v; inherited[k] = true end
    end
  end
  cls.__inh = inherited
  local spec = cls.__spec
  local defaults, tags = {}, {}
  if parent and parent.__defaults then
    for k, v in pairs(parent.__defaults) do defaults[k] = v end
    for t in pairs(parent.__tags) do tags[t] = true end
  end
  for k, v in pairs(spec) do
    if k == "tags" then for _, t in ipairs(v) do tags[t] = true end
    elseif not RESERVED[k] then defaults[k] = v end
  end
  cls.__defaults, cls.__tags = defaults, tags
  cls.__sprite = spec.sprite or (parent and parent.__sprite)
  cls.__depth = spec.depth or (parent and parent.__depth) or 0
  cls.__hitbox = spec.hitbox or (parent and parent.__hitbox)
  if spec.screen ~= nil then cls.__screen = spec.screen elseif parent then cls.__screen = parent.__screen end
  -- collide_every = { enemy = 4 } checks that tag's handler only every 4th step for each entity (staggered), for handlers that can afford to be late
  local every = {}
  if parent and parent.__every then for t, n in pairs(parent.__every) do every[t] = n end end
  if spec.collide_every then for t, n in pairs(spec.collide_every) do every[t] = n end end
  cls.__every = every
  -- methods called on_collide_<tag> are collision handlers: they run when this entity overlaps an entity with that tag
  local handlers = {}
  for k, v in pairs(cls) do
    if type(k) == "string" and type(v) == "function" then
      local tag = k:match("^on_collide_(.+)$")
      if tag then handlers[#handlers + 1] = { tag = tag, name = k, every = every[tag] or 1 } end
    end
  end
  table.sort(handlers, function(x, y) return x.tag < y.tag end)
  cls.__collide = handlers
  cls.__flat = true
  return cls
end

-- After a class was loaded again: flatten it and everything built on it afresh.
local function unflatten(cls)
  for k in pairs(rawget(cls, "__inh") or {}) do cls[k] = nil end
  cls.__flat = false
  for _, sub in ipairs(cls.__subs or {}) do unflatten(sub) end
end
local function reflatten(cls)
  M.finalize(cls)
  for _, sub in ipairs(cls.__subs or {}) do reflatten(sub) end
end
function M.refresh(cls)
  unflatten(cls)
  reflatten(cls)
end

function M.is_a(cls, other)
  while cls do
    if cls == other then return true end
    cls = rawget(cls, "__parent")
  end
  return false
end

-- A class from a name: "grub" -> the file entities/grub.lua, "enemies.grub" -> entities/enemies/grub.lua, "scenes.play" is used as it is.
function M.resolve(what, kind)
  if type(what) == "table" then return what end
  if type(what) ~= "string" then error("expected an entity name or class, got " .. type(what), 3) end
  local mod = what
  if not (what:find("^entities%.") or what:find("^scenes%.")) then mod = (kind == "scene" and "scenes." or "entities.") .. what end
  local cls = require(mod)
  if type(cls) ~= "table" or not rawget(cls, "__kind") then error(mod .. ".lua must end with 'return <the class>' (it returned " .. tostring(cls) .. ")", 3) end
  return cls
end

-- Replace the global require so the engine knows which file a class is being defined in (and so every file name is a module name).
local plain_require = require
function M.install_require()
  _G.require = function(name)
    if package.loaded[name] ~= nil then return package.loaded[name] end
    local previous = M.loading
    M.loading = name
    local ok, res = pcall(plain_require, name)
    M.loading = previous
    if not ok then error(res, 0) end
    return res
  end
end

return M
