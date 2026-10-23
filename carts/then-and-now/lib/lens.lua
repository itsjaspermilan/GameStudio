-- The Lens: Wren's goggles flip the room between Now (the wreck) and Then (the station as it was,
-- full of echoes).
-- Each room has a tile layer per era (now, then, back_now, back_then); flipping shows one pair and
-- makes tiles.lua read its walls.
-- Time spent in Then builds Static (lib/state static, up to static_max); at the top it overloads
-- and throws Wren back to Now.
-- Flipping just before a hit lands is a phase dodge (the hero asks dodging()).
local tiles = require "lib.tiles"
local state = require "lib.state"

local M = {
  era = "now",
  since = 99,            -- seconds since the last flip
  flash = 0,             -- the white-out after a flip, fading
  DODGE = 0.18,          -- a hit this soon after a flip is dodged
  RISE = 5,              -- Static a second in Then
  FALL = 9,              -- Static a second back in Now
  overload_t = 0,
}

local layers = {}

-- A room starts: find its layers and show the era the Lens is in.
function M.enter()
  layers.now, layers["then"] = gs.layer("now"), gs.layer("then")
  layers.back_now, layers.back_then = gs.layer("back_now"), gs.layer("back_then")
  tiles.use(layers.now, layers["then"])
  M.since, M.flash = 99, 0
  M.show(M.era)
  M.ghost = nil
end

function M.show(era)
  M.era, tiles.era = era, era
  local now = era == "now"
  if layers.now then layers.now.visible = now end
  if layers["then"] then layers["then"].visible = not now end
  if layers.back_now then layers.back_now.visible = now end
  if layers.back_then then layers.back_then.visible = not now end
  M.ghost = nil -- the faint picture of the other era is made again when needed
end

-- Does an entity of this era (now, then or both) take part in the world the player sees?
function M.sees(era) return era == nil or era == "both" or era == M.era end

-- Try to flip. Refused (false) when the hero would end up inside a wall of the other era.
function M.flip(hero)
  local other = M.era == "now" and "then" or "now"
  if M.locked then
    gs.sfx("sfx_buzz", 0.5)
    M.blocked = 0.6
    state.say("THE LENS WON'T FOCUS HERE", 2)
    return false
  end
  if hero then
    local hw = hero.w / 2
    if tiles.box_wall(hero.x - hw, hero.y - hero:box_h(), hero.x + hw, hero.y, other) then
      gs.sfx("sfx_buzz", 0.5)
      M.blocked = 0.3
      return false
    end
  end
  M.show(other)
  M.since, M.flash = 0, 1
  gs.sfx(other == "then" and "sfx_lens_in" or "sfx_lens_out", 0.6)
  return true
end

-- A flip forced by an Overload (no wall check: Now is where Wren really is, so a Then-only floor
-- gives way).
function M.overload()
  M.show("now")
  M.since, M.flash, M.overload_t = 0, 1, 1.2
  gs.sfx("sfx_overload", 0.7)
  gs.camera:shake(4, 0.4)
end

function M.dodging() return M.since < M.DODGE end

function M.update(dt)
  M.since = M.since + dt
  M.flash = math.max(0, M.flash - dt * 4)
  M.overload_t = math.max(0, M.overload_t - dt)
  if M.blocked then M.blocked = M.blocked - dt; if M.blocked <= 0 then M.blocked = nil end end
  local d = state.data
  if M.era == "then" then
    -- each kept echo is one more voice: Static climbs faster
    local kept = 0
    for _, fate in pairs(d.crew) do if fate == "kept" then kept = kept + 1 end end
    d.static = math.min(d.static_max, d.static + (M.RISE + kept) * dt)
    if d.static >= d.static_max then return "overload" end
  else
    d.static = math.max(0, d.static - M.FALL * dt)
  end
end

-- How strong the hallucinations are: 0 below half Static, rising to 1 at the top.
function M.unease()
  local d = state.data
  return math.max(0, (d.static / d.static_max - 0.5) * 2)
end

-- The other era's walls, faint, so the player can see what a flip would bring (and why one is
-- refused).
function M.draw_ghost()
  local l = M.era == "now" and layers["then"] or layers.now
  if not l then return end
  if not M.ghost then
    local ts = gs.assets.tileset(l.tileset)
    local rows, cols = #l.data, #l.data[1]
    M.ghost = { pic = gs.compose(ts.img, ts.tw, ts.th, ts.cols, ts.count, ts.tw, ts.th, cols, rows, l.data), w = cols * ts.tw, h = rows * ts.th }
  end
  local cx, cy = gs.camera.x, gs.camera.y
  local x0, y0 = math.max(0, math.floor(cx)), math.max(0, math.floor(cy))
  local x1, y1 = math.min(M.ghost.w, x0 + gs.limits.screen_w), math.min(M.ghost.h, y0 + gs.limits.screen_h)
  local alpha = M.blocked and 150 or 46
  if x1 > x0 and y1 > y0 then gs.tile(M.ghost.pic, x0, y0, x1 - x0, y1 - y0, x0, y0, 1, false, 0, 1, alpha) end
end

return M
