-- The camera: where the screen looks into the world. x, y is the world position of the screen's top-left corner.
--   gs.camera:follow(player)                       -- keep an entity in the middle
--   gs.camera:follow(player, { smooth = 0.1, bounds = { 0, 0, 1024, 1024 } })
--   gs.camera:shake(4, 0.3)                        -- 4 pixels, for 0.3 seconds
--   gs.camera:set(x, y)  gs.camera:stop()
--   gs.camera.zoom = 2                             -- the world twice as big (whole numbers keep pixel art crisp); the UI is not zoomed
-- Calling gs.camera(x, y) still moves the raw drawing offset, as it always did.
local M = { x = 0, y = 0, zoom = 1, target = nil, smooth = 0, bounds = nil, view_w = 320, view_h = 240, shake_amount = 0, shake_time = 0, shake_total = 0, dx = 0, dy = 0 }

-- how much of the world the screen shows: the screen size divided by the zoom
function M:view()
  local z = self.zoom
  if type(z) ~= "number" or z < 0.125 or z > 16 then error("gs.camera.zoom must be a number from 0.125 to 16 (1 is normal size), not " .. tostring(z), 0) end
  return self.view_w / z, self.view_h / z
end

function M:set(x, y) self.x, self.y = x, y; self:clamp() end
function M:follow(target, opts)
  self.target = target
  opts = opts or {}
  self.smooth = opts.smooth or 0
  self.bounds = opts.bounds or self.bounds
  self.offset_x, self.offset_y = opts.offset_x or 0, opts.offset_y or 0
  if target then local vw, vh = self:view(); self:set(target.x - vw / 2 + self.offset_x, target.y - vh / 2 + self.offset_y) end
end
function M:stop() self.target = nil end
function M:limit(x, y, w, h) self.bounds = { x, y, w, h } end -- the camera never shows outside this rectangle of the world
function M:shake(amount, seconds) self.shake_amount, self.shake_time, self.shake_total = amount, seconds, seconds end

function M:clamp()
  local b = self.bounds
  if b then
    local vw, vh = self:view()
    local maxx, maxy = b[1] + b[3] - vw, b[2] + b[4] - vh
    self.x = math.max(b[1], math.min(self.x, math.max(b[1], maxx)))
    self.y = math.max(b[2], math.min(self.y, math.max(b[2], maxy)))
  end
end

function M:update(dt)
  local t = self.target
  if t and not t._dead then
    local vw, vh = self:view()
    local tx, ty = t.x - vw / 2 + (self.offset_x or 0), t.y - vh / 2 + (self.offset_y or 0)
    if self.smooth > 0 then
      local k = 1 - (1 - math.min(self.smooth, 1)) ^ (dt * 60)
      self.x, self.y = self.x + (tx - self.x) * k, self.y + (ty - self.y) * k
    else self.x, self.y = tx, ty end
    self:clamp()
  end
  if self.shake_time > 0 then
    self.shake_time = self.shake_time - dt
    local a = self.shake_amount * math.max(0, self.shake_time / self.shake_total)
    self.dx, self.dy = (math.random() * 2 - 1) * a, (math.random() * 2 - 1) * a
  else self.dx, self.dy = 0, 0 end
end

-- the offset to draw the world with this frame, on whole screen pixels (at zoom 2 that is half a world pixel)
function M:offset()
  local z = self.zoom
  return math.floor((self.x + self.dx) * z + 0.5) / z, math.floor((self.y + self.dy) * z + 0.5) / z
end

function M:reset()
  self.x, self.y, self.target, self.bounds, self.smooth, self.shake_time, self.dx, self.dy, self.zoom = 0, 0, nil, nil, 0, 0, 0, 0, 1
end
function M:to_screen(wx, wy) return (wx - self.x) * self.zoom, (wy - self.y) * self.zoom end
function M:to_world(sx, sy) return sx / self.zoom + self.x, sy / self.zoom + self.y end

return M
