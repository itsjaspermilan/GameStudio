-- Live reload (development only: the studio runs the game with GS_DEV=1). Every half second the game's .lua and asset files are checked
-- for changes. A changed Lua file is loaded again and its class is filled in place, so everything alive keeps its state and starts using
-- the new code at once; a file with a mistake is rejected and the old code keeps running, with the error shown on screen.
-- A changed sprite or tileset file is read again. Changes to what entities START with (create(), default fields) only apply to
-- entities made afterwards; restart the scene (select + start held for a second, or run again from the studio) to see them everywhere.
local entity = require("gs.entity")
local assets = require("gs.assets")
local world = require("gs.world")

local M = { mtimes = {}, clock = 0, last_error = nil }

local function module_of(path) return (path:gsub("%.lua$", ""):gsub("/", ".")) end

local function scan()
  local found = {}
  for _, p in ipairs(gs.list("")) do
    if p:find("%.lua$") or p:find("^sprites/.+%.json$") or p:find("^tilesets/.+%.json$") or p:find("^sprites/.+%.png$") or p:find("^tilesets/.+%.png$") or p == "palette.json" then
      found[p] = gs.mtime(p)
    end
  end
  return found
end

function M.start()
  M.mtimes = scan()
end

local function snapshot(t)
  local c = {}
  for k, v in pairs(t) do c[k] = v end
  return c
end
local function restore(t, snap)
  for k in pairs(t) do t[k] = nil end
  for k, v in pairs(snap) do t[k] = v end
end

local function reload_module(mod)
  local old = package.loaded[mod]
  local cls = entity.registry[mod]
  local snap = cls and snapshot(cls)
  local old_snap = (old and not cls and type(old) == "table") and snapshot(old) or nil
  package.loaded[mod] = nil
  local ok, res = pcall(require, mod)
  if not ok then
    package.loaded[mod] = old
    if cls then restore(cls, snap); entity.refresh(cls) end
    return false, res
  end
  if cls and type(res) == "table" and res == cls then
    entity.refresh(cls)
  elseif old and type(old) == "table" and type(res) == "table" and old ~= res then
    -- a plain module: fill the old table so files that already hold it see the change
    for k in pairs(old) do old[k] = nil end
    for k, v in pairs(res) do old[k] = v end
    package.loaded[mod] = old
  end
  return true
end

-- Check for changes now. Returns a short message about what happened (or nil), and sets M.last_error to a message while a file is broken.
function M.poll()
  local now = scan()
  local message
  for path, t in pairs(now) do
    local before = M.mtimes[path]
    if before ~= t then
      M.mtimes[path] = t
      if before ~= nil then
        if path:find("%.lua$") then
          local mod = module_of(path)
          if mod == "game" then
            message = "game.lua changed: restart the game to apply it"
          elseif path:find("%.layout%.lua$") then -- a scene's layout is built when the scene starts: start it again
            if path == world.scene_layout or path == world.layout_file() then world.restart_scene(); message = "reloaded " .. path end
          elseif package.loaded[mod] ~= nil then
            local ok, err = reload_module(mod)
            if ok then message = "reloaded " .. path; M.last_error = nil
            else M.last_error = path .. ": " .. tostring(err):gsub("^[^\n]-:%d+: ", function(m) return m end); message = "could not reload " .. path end
          end
        elseif path == "palette.json" then -- new bank colours: palette swaps are made again from them, and code colours like "sky:3" change
          assets.forget("palette")
          require("gs.draw").forget_colors()
          message = "reloaded palette.json"
        else
          local kind, name = path:match("^(%a+)/(.+)%.%a+$")
          if kind and (kind == "sprites" or kind == "tilesets") then
            assets.fresh = true
            assets.forget(kind, name)
            local ok, err = pcall(kind == "sprites" and assets.sprite or assets.tileset, name)
            assets.fresh = false
            if ok then message = "reloaded " .. path else M.last_error = tostring(err) end
          end
        end
      end
    end
  end
  return message
end

return M
