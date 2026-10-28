-- The world: every living entity, the tile layers, the scene, collisions and one step of the game.
--
--   gs.spawn("grub", x, y, { hp = 20 })     make an entity (the file entities/grub.lua) and call its create()
--   gs.each("enemy", fn)  gs.all("enemy")  gs.first("player")  gs.count("enemy")
--   gs.nearest(x, y, "enemy", 200)          closest entity with that tag, optionally within a distance
--   gs.in_radius(x, y, 50, "enemy")         a new list of every one within 50 pixels (pass a list as a 5th argument to refill it instead)
--   gs.goto_scene("scenes.play")            leave this screen for another (its layout, scenes/play.layout.lua, is built first: see "scene layouts")
-- Each step (60 a second): timers run, every entity's update(dt) runs, entities move by vx, vy and animate, collisions are reported
-- to the entities' on_collide_<tag> methods, the scene's update(dt) runs, the camera follows. Then draw: layers and entities by depth
-- (a bigger depth is further back), then the scene's draw_ui and the entities flagged screen = true.
local entity = require("gs.entity")
local assets = require("gs.assets")
local timers = require("gs.timers")
local camera = require("gs.camera")
local draw = require("gs.draw")
local particles = require("gs.particles")
local talk = require("gs.talk")

-- checks: hitbox comparisons so far this step (the collision pass and touching()); checks_last: the whole of the last step. The studio
-- compares the busiest step with the console's collision_tests budget.
local W = { all = {}, classes = {}, by_class = {}, tags = {}, layers = {}, scene = nil, alive = 0, dirty = false, step_id = 0, next_id = 1, checks = 0, checks_last = 0,
  limits = {}, bg = "#000000", fade = 0, flash_t = 0, mosaic_now = 1, pending_scene = nil, view_w = 256, view_h = 192, time = 0 }

local floor, sqrt, abs, atan2, rad, deg, cos, sin = math.floor, math.sqrt, math.abs, math.atan, math.rad, math.deg, math.cos, math.sin
local sprite_of = assets.sprite

local warned = {}
local function warn_once(key, text)
  if not warned[key] then warned[key] = true; io.stderr:write("warning: " .. text .. "\n") end
end
W.warn_once = warn_once

-- ---------------------------------------------------------------- what every entity can do
local Entity = {}
entity.base.entity = Entity
-- the bases are finished classes already: they have nothing to flatten and start the family trees
for _, base in ipairs({ Entity }) do base.__subs, base.__flat, base.__defaults, base.__tags, base.__collide, base.__depth = {}, true, {}, {}, {}, 0 end

-- the box an entity collides with, relative to its position: its own hitbox (set_hitbox, or `hitbox` given to gs.spawn), its kind's,
-- or the sprite's mask. Measured once and kept until the sprite or the hitbox changes.
local function box_of(e)
  local name = e.sprite
  local hb = e._hb
  if hb and e._hbn == name then return hb end
  local spec = rawget(e, "hitbox") or getmetatable(e).__hitbox
  if spec then
    if spec.r then hb = { (spec.x or 0) - spec.r, (spec.y or 0) - spec.r, spec.r * 2, spec.r * 2, r = spec.r }
    else hb = { spec[1] or spec.x or 0, spec[2] or spec.y or 0, spec[3] or spec.w or 0, spec[4] or spec.h or 0 } end
  elseif name then
    local s = sprite_of(name)
    local m = s.mask
    hb = { m[1] - s.ox, m[2] - s.oy, m[3], m[4] }
  else
    hb = false
  end
  e._hb, e._hbn = hb, name
  return hb
end

-- the world rectangle an entity covers: x0, y0, x1, y1 (nil without a hitbox)
local function bounds(e)
  local hb = e._hb
  if hb == nil or e._hbn ~= e.sprite then hb = box_of(e) end
  if not hb then return nil end
  local sx, sy = e.sx, e.sy
  local x, y = e.x, e.y
  if sx == 1 and sy == 1 then return x + hb[1], y + hb[2], x + hb[1] + hb[3], y + hb[2] + hb[4] end
  local x0, x1 = x + hb[1] * sx, x + (hb[1] + hb[3]) * sx
  local y0, y1 = y + hb[2] * sy, y + (hb[2] + hb[4]) * sy
  if x0 > x1 then x0, x1 = x1, x0 end
  if y0 > y1 then y0, y1 = y1, y0 end
  return x0, y0, x1, y1
end
W.bounds = bounds

local function overlap(a, b)
  local ax0, ay0, ax1, ay1 = bounds(a)
  local bx0, by0, bx1, by1 = bounds(b)
  if not (ax0 and bx0) then return false end
  if ax0 >= bx1 or bx0 >= ax1 or ay0 >= by1 or by0 >= ay1 then return false end
  local ra, rb = a._hb.r, b._hb.r
  if ra and rb then
    local dx, dy = (ax0 + ax1) - (bx0 + bx1), (ay0 + ay1) - (by0 + by1)
    local rr = (ra * math.max(a.sx, a.sy) + rb * math.max(b.sx, b.sy))
    return dx * dx + dy * dy <= 4 * rr * rr
  end
  return true
end

function Entity.bounds(self) return bounds(self) end
function Entity.overlaps(self, other) return overlap(self, other) end
function Entity.destroy(self)
  if self._dead then return end
  local hook = self.on_destroy
  if hook then hook(self) end
  self._dead = true
  W.alive = W.alive - 1
  W.dirty = true
end
function Entity.is_alive(self) return not self._dead end
-- the size of the sprite on screen (one frame, times the scale)
function Entity.width(self) local s = sprite_of(self.sprite, 2); return s.fw * abs(self.sx) end
function Entity.height(self) local s = sprite_of(self.sprite, 2); return s.fh * abs(self.sy) end
-- the radius of a round hitbox ({ r = }) with scale, so code that measures distances need not keep its own copy; nil for a box
function Entity.hit_radius(self)
  local hb = self._hb
  if hb == nil or self._hbn ~= self.sprite then hb = box_of(self) end
  if not (hb and hb.r) then return nil end
  local sx, sy = abs(self.sx), abs(self.sy)
  return hb.r * (sx > sy and sx or sy)
end
function Entity.move(self, dx, dy) self.x, self.y = self.x + dx, self.y + dy end
-- This one entity's hitbox, unlike its kind's: self:set_hitbox(-6, -14, 12, 14) (x, y, w, h from its position), self:set_hitbox({ r = 6 })
-- for a round one, self:set_hitbox(nil) for its kind's again. (Writing self.hitbox by hand is only read the next time the sprite changes.)
function Entity.set_hitbox(self, x, y, w, h)
  if type(x) == "table" then self.hitbox = x elseif x == nil then self.hitbox = nil else self.hitbox = { x, y, w, h } end
  self._hb, self._hbn = nil, nil
end

-- A target is another entity or a pair of numbers.
local function target_xy(a, b)
  if type(a) == "table" then return a.x, a.y end
  return a, b
end
function Entity.distance_to(self, a, b)
  local tx, ty = target_xy(a, b)
  if not tx then return math.huge end
  local dx, dy = tx - self.x, ty - self.y
  return sqrt(dx * dx + dy * dy)
end
-- degrees clockwise on the screen: 0 = right, 90 = down, 180 = left, 270 = up
function Entity.angle_to(self, a, b)
  local tx, ty = target_xy(a, b)
  if not tx then return self.angle end
  return deg(atan2(ty - self.y, tx - self.x)) % 360
end
-- set vx, vy so the entity moves toward a target (or a point) at `speed` pixels a second
function Entity.move_toward(self, a, b, c)
  local tx, ty, speed
  if type(a) == "table" then tx, ty, speed = a.x, a.y, b else tx, ty, speed = a, b, c end
  local dx, dy = tx - self.x, ty - self.y
  local d = sqrt(dx * dx + dy * dy)
  if d < 1e-6 then self.vx, self.vy = 0, 0; return end
  self.vx, self.vy = dx / d * speed, dy / d * speed
end
-- move in a direction: angle in degrees clockwise (0 = right, 90 = down), speed in pixels a second
function Entity.set_velocity(self, angle, speed)
  local a = rad(angle)
  self.vx, self.vy = cos(a) * speed, sin(a) * speed
end
function Entity.speed(self) return sqrt(self.vx * self.vx + self.vy * self.vy) end
function Entity.face_motion(self)
  if self.vx < 0 then self.flip = true elseif self.vx > 0 then self.flip = false end
end

-- play a named animation of the sprite (from its json); does nothing if it is already the one playing
function Entity.play(self, name, restart)
  if self.anim == name and not restart then return end
  local s = sprite_of(self.sprite, 2)
  local a = s.anims[name]
  if not a then error("sprite '" .. tostring(self.sprite) .. "' has no animation called '" .. tostring(name) .. "'", 2) end
  self.anim, self.frame, self._anim_done = name, a.from, false
end
function Entity.set_sprite(self, name, frame)
  if self.sprite ~= name then self.sprite, self.anim, self.frame = name, nil, frame or 0 elseif frame then self.frame = frame end
end

-- everything that touches this entity with a tag: the first one, or all of them
function Entity.touching(self, tag)
  local list = W.tags[tag]
  if not list then return nil end
  W.checks = W.checks + #list
  for i = 1, #list do
    local o = list[i]
    if o ~= self and not o._dead and overlap(self, o) then return o end
  end
  return nil
end
function Entity.touching_all(self, tag)
  local out, list = {}, W.tags[tag]
  if not list then return out end
  W.checks = W.checks + #list
  for i = 1, #list do
    local o = list[i]
    if o ~= self and not o._dead and overlap(self, o) then out[#out + 1] = o end
  end
  return out
end

function Entity.after(self, seconds, fn) return timers.after(self, seconds, fn) end
function Entity.every(self, seconds, fn) return timers.every(self, seconds, fn) end
function Entity.go(self, fn) return timers.go(self, fn) end
-- Drawn in one colour (white unless given) for a moment: the GBA's flash when something is hit. self:flash(0.08). strength below 1
-- lays the colour over the sprite instead (0.5: lit up, still itself), for crowds where a solid white shape would be too much.
function Entity.flash(self, seconds, color, strength) self._flash = { W.time + (seconds or 0.08), color or "#ffffff", strength or 1 } end
function Entity.tween(self, props, seconds, easing, on_done) return timers.tween(self, self, props, seconds, easing, on_done) end

-- the default drawing: the sprite at the entity's position
function Entity.draw(self)
  local name = self.sprite
  if name then
    local s = sprite_of(name)
    if self.bank then s = assets.swapped(s, self.bank, 2) end -- a palette swap: self.bank = "red_soldier"
    local fl = self._flash
    if fl and W.time < fl[1] then
      local white = assets.silhouette(s, fl[2], 2)
      if fl[3] >= 1 then s = white
      else -- a softer flash: the sprite, lit up by its silhouette laid over it
        assets.draw(s, self.frame, self.x, self.y, self.angle, self.sx, self.sy, self.alpha, self.flip)
        s = white
        return assets.draw(s, self.frame, self.x, self.y, self.angle, self.sx, self.sy, self.alpha * fl[3], self.flip)
      end
    end
    assets.draw(s, self.frame, self.x, self.y, self.angle, self.sx, self.sy, self.alpha, self.flip)
  end
end
Entity.draw_sprite = Entity.draw
local default_draw = Entity.draw

-- the base of scenes: timers that belong to the scene, so they stop when it is left (self:after(2, fn) in enter)
local Scene = {}
entity.base.scene = Scene
Scene.__subs, Scene.__flat, Scene.__defaults, Scene.__tags, Scene.__collide, Scene.__depth = {}, true, {}, {}, {}, 0
Scene.after, Scene.every, Scene.go, Scene.tween = Entity.after, Entity.every, Entity.go, Entity.tween

-- ---------------------------------------------------------------- making and finding entities
local function entry_for(cls)
  local entry = W.by_class[cls]
  if not entry then
    entry = { cls = cls, list = {} }
    W.by_class[cls] = entry
    W.classes[#W.classes + 1] = entry
  end
  return entry
end

function W.spawn(what, x, y, props)
  local cls = entity.resolve(what, "entity")
  if not cls.__flat then entity.finalize(cls) end
  local cap = W.limits.entities
  if cap and W.alive >= cap then
    warn_once("entities", string.format("more than %d entities alive at once (this console's limit); new ones are ignored. The first one refused was '%s'.", cap, tostring(cls.__name)))
    return nil
  end
  local e = { x = x or 0, y = y or 0, vx = 0, vy = 0, angle = 0, sx = 1, sy = 1, alpha = 1, visible = true, flip = false, frame = 0, anim_speed = 1,
    id = W.next_id, _dead = false, depth = cls.__depth, sprite = cls.__sprite, screen = cls.__screen }
  W.next_id = W.next_id + 1
  for k, v in pairs(cls.__defaults) do
    if type(v) == "table" then local c = {}; for a, b in pairs(v) do c[a] = b end; v = c end
    e[k] = v
  end
  if props then for k, v in pairs(props) do e[k] = v end end
  setmetatable(e, cls)
  W.all[#W.all + 1] = e
  W.alive = W.alive + 1
  local list = entry_for(cls).list
  list[#list + 1] = e
  for t in pairs(cls.__tags) do
    local tl = W.tags[t]
    if not tl then tl = {}; W.tags[t] = tl end
    tl[#tl + 1] = e
  end
  local create = cls.create
  if create then create(e) end
  return e
end

-- freeze the world (a pause menu, a level-up choice); the scene's update and draw_ui still run. A new scene starts unfrozen.
function W.pause(on) W.paused = on ~= false end

-- the starting values of an entity kind (what is in its gs.entity{ ... } table, plus what it inherits), without making one: { hp = 3, speed = 40, ... }
function W.defaults(what)
  local cls = entity.resolve(what, "entity")
  if not cls.__flat then entity.finalize(cls) end
  return cls.__defaults
end

function W.all_of(tag) return W.tags[tag] or {} end
function W.each(tag, fn)
  local list = W.tags[tag]
  if not list then return end
  for i = 1, #list do
    local e = list[i]
    if not e._dead then fn(e) end
  end
end
function W.first(tag)
  local list = W.tags[tag]
  if not list then return nil end
  for i = 1, #list do if not list[i]._dead then return list[i] end end
  return nil
end
function W.count(tag)
  local list, n = W.tags[tag], 0
  if not list then return 0 end
  -- dead entries only sit in the lists between a destroy and the end of the step (compact), so most calls need no walk
  if not W.dirty then return #list end
  for i = 1, #list do if not list[i]._dead then n = n + 1 end end
  return n
end
function W.nearest(x, y, tag, max_distance)
  local list = W.tags[tag]
  if not list then return nil end
  local best, bd = nil, (max_distance or math.huge) ^ 2
  for i = 1, #list do
    local e = list[i]
    if not e._dead then
      local dx, dy = e.x - x, e.y - y
      local d = dx * dx + dy * dy
      if d < bd then best, bd = e, d end
    end
  end
  return best
end
-- Both queries can refill a list the caller keeps (out), so a crowd asking every step makes no garbage.
local function trim(out, n) for i = #out, n + 1, -1 do out[i] = nil end return out end
function W.in_radius(x, y, radius, tag, out)
  local list, r2, n = W.tags[tag], radius * radius, 0
  out = out or {}
  if not list then return trim(out, 0) end
  for i = 1, #list do
    local e = list[i]
    if not e._dead then
      local dx, dy = e.x - x, e.y - y
      if dx * dx + dy * dy <= r2 then n = n + 1; out[n] = e end
    end
  end
  return trim(out, n)
end
-- everything with a tag whose box touches a rectangle
function W.in_rect(x, y, w, h, tag, out)
  local list, n = W.tags[tag], 0
  out = out or {}
  if not list then return trim(out, 0) end
  for i = 1, #list do
    local e = list[i]
    if not e._dead then
      local x0, y0, x1, y1 = bounds(e)
      if x0 and x0 < x + w and x1 > x and y0 < y + h and y1 > y then n = n + 1; out[n] = e end
    end
  end
  return trim(out, n)
end
-- send a message: calls target:on_<message>(...) if it has such a method
function W.send(target, message, ...)
  if target._dead then return end
  local fn = target["on_" .. message]
  if fn then return fn(target, ...) end
end

-- ---------------------------------------------------------------- tile layers and levels
function W.add_layer(spec)
  local l = assets.make_layer(spec)
  W.layers[#W.layers + 1] = l
  return l
end
function W.layer(name)
  for _, l in ipairs(W.layers) do if l.name == name then return l end end
  return nil
end
function W.tile_at(layer, x, y)
  local l = type(layer) == "string" and W.layer(layer) or layer
  return l and assets.tile_at(l, x, y)
end
function W.set_tile(layer, x, y, v)
  local l = type(layer) == "string" and W.layer(layer) or layer
  if l then assets.set_tile(l, x, y, v) end
end
-- take a layer out of the world (by name or the layer itself); true if it was there
function W.remove_layer(layer)
  local l = type(layer) == "string" and W.layer(layer) or layer
  for i, v in ipairs(W.layers) do if v == l then table.remove(W.layers, i); return true end end
  return false
end
-- draw a layer with another tileset (a night version of the same tiles); its tile kinds come from the new one
function W.set_tileset(layer, name)
  local l = type(layer) == "string" and W.layer(layer) or layer
  if not l then error("gs.set_tileset: there is no layer " .. tostring(layer), 2) end
  local ts = assets.tileset(name, 2)
  if l.cell[1] == l.ts.tw and l.cell[2] == l.ts.th then l.cell = { ts.tw, ts.th } end
  l.ts, l.tileset, l.dirty = ts, name, true
end

-- ---------------------------------------------------------------- moving against tiles
-- A layer with solid = true is ground and walls: Entity:slide moves an entity's hitbox through it and stops at its tiles. Every tile of
-- such a layer is "solid" unless its tileset gives it another kind (tilesets/<name>.json: "kinds": { "oneway": [8, 9], "spike": [20] }):
-- "oneway" is a thin platform that only stops what comes down onto it from above, and any other name stops nothing but can be asked
-- about (self:touching_tile("spike"), gs.tile_kind), unless the tileset lists it in "solid_kinds" (ice and crates are walls you still
-- want to tell apart). Nothing here runs unless a game calls it; games with physics of their own read
-- gs.tile_at as before. Slopes are not handled: a game that wants them reads the tiles itself.
local EPS = 1e-6
local ceil = math.ceil

local function kind_of(l, v)
  if v == nil or v < 0 or v >= l.ts.count then return nil end
  local k = l.ts.kinds
  return k and k[v] or "solid"
end
W.kind_of = kind_of

-- does a row (or column) of cells hold a tile that stops movement? oneway counts only for something coming down onto it
local SOLID_ONLY = { solid = true }
local function stops(l, k, down)
  return k ~= nil and ((l.ts.solid or SOLID_ONLY)[k] or (down and k == "oneway"))
end

-- how far a box (x0, y0)-(x1, y1) may go along one axis before a solid layer's tile stops it, and which way it was stopped (-1, 0, 1).
-- Only cells the box moves into are looked at, so a box that starts inside a wall is not held there, and a fast mover cannot pass
-- through a tile (every cell on the way is checked, however far it goes in one step).
local function sweep(x0, y0, x1, y1, d, across, drop)
  local hit = 0
  local layers = W.layers
  for li = 1, #layers do
    local l = layers[li]
    if l.solid then
      local data, cw, ch, lx, ly = l.data, l.cell[1], l.cell[2], l.x, l.y
      local rows = #data
      if across then -- moving sideways: the rows the box covers, the columns ahead of it
        local r0, r1 = floor((y0 - ly) / ch + EPS), ceil((y1 - ly) / ch - EPS) - 1
        if r0 < 0 then r0 = 0 end
        if r1 > rows - 1 then r1 = rows - 1 end
        if d > 0 then
          for c = ceil((x1 - lx) / cw - EPS), ceil((x1 + d - lx) / cw - EPS) - 1 do
            local found = false
            for r = r0, r1 do if stops(l, kind_of(l, data[r + 1][c + 1]), false) then found = true; break end end
            if found then d, hit = lx + c * cw - x1, 1; break end
          end
        elseif d < 0 then
          for c = floor((x0 - lx) / cw + EPS) - 1, floor((x0 + d - lx) / cw + EPS), -1 do
            local found = false
            for r = r0, r1 do if stops(l, kind_of(l, data[r + 1][c + 1]), false) then found = true; break end end
            if found then d, hit = lx + (c + 1) * cw - x0, -1; break end
          end
        end
      else -- moving up or down: the columns the box covers, the rows ahead of it
        local c0, c1 = floor((x0 - lx) / cw + EPS), ceil((x1 - lx) / cw - EPS) - 1
        if d > 0 then
          for r = ceil((y1 - ly) / ch - EPS), ceil((y1 + d - ly) / ch - EPS) - 1 do
            local row = data[r + 1]
            local found = false
            if row then for c = c0, c1 do if stops(l, kind_of(l, row[c + 1]), not drop) then found = true; break end end end
            if found then d, hit = ly + r * ch - y1, 1; break end
          end
        elseif d < 0 then
          for r = floor((y0 - ly) / ch + EPS) - 1, floor((y0 + d - ly) / ch + EPS), -1 do
            local row = data[r + 1]
            local found = false
            if row then for c = c0, c1 do if stops(l, kind_of(l, row[c + 1]), false) then found = true; break end end end
            if found then d, hit = ly + (r + 1) * ch - y0, -1; break end
          end
        end
      end
    end
  end
  return d, hit
end

-- Move by dx, dy pixels (sideways first, then up or down), stopping against the tiles of the solid layers. Returns which way each
-- move was stopped: hit_x is -1 (a wall on the left), 1 (on the right) or 0; hit_y is 1 (landed on something), -1 (bumped a ceiling)
-- or 0. self.drop_through = true lets it fall through oneway platforms. An entity without a hitbox just moves.
--   local hx, hy = self:slide(self.dx * dt, self.dy * dt)
--   if hy ~= 0 then self.dy = 0 end
--   self.on_ground = hy == 1
function Entity.slide(self, dx, dy)
  local hx, hy = 0, 0
  if dx ~= 0 then
    local x0, y0, x1, y1 = bounds(self)
    if x0 then dx, hx = sweep(x0, y0, x1, y1, dx, true, false) end
    self.x = self.x + dx
  end
  if dy ~= 0 then
    local x0, y0, x1, y1 = bounds(self)
    if x0 then dy, hy = sweep(x0, y0, x1, y1, dy, false, self.drop_through) end
    self.y = self.y + dy
  end
  return hx, hy
end

-- The first tile of a kind ("spike", "oneway", "solid", ...) in a solid layer under this entity's hitbox: its top-left corner in the
-- world (x, y), or nil. inset (pixels, default 0) shrinks the hitbox first, so grazing a spike's edge is forgiven.
function Entity.touching_tile(self, kind, inset)
  local x0, y0, x1, y1 = bounds(self)
  if not x0 then return nil end
  inset = inset or 0
  x0, y0, x1, y1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
  local layers = W.layers
  for li = 1, #layers do
    local l = layers[li]
    if l.solid then
      local data, cw, ch, lx, ly = l.data, l.cell[1], l.cell[2], l.x, l.y
      for r = floor((y0 - ly) / ch + EPS), ceil((y1 - ly) / ch - EPS) - 1 do
        local row = data[r + 1]
        if row then
          for c = floor((x0 - lx) / cw + EPS), ceil((x1 - lx) / cw - EPS) - 1 do
            if kind_of(l, row[c + 1]) == kind then return lx + c * cw, ly + r * ch end
          end
        end
      end
    end
  end
  return nil
end

-- The kind of the tile at a point of the world: of that layer, or with layer nil of the first solid layer with a tile there. nil for none.
function W.tile_kind(layer, x, y)
  if layer ~= nil then
    local l = type(layer) == "string" and W.layer(layer) or layer
    return l and kind_of(l, assets.tile_at(l, x, y))
  end
  for _, l in ipairs(W.layers) do
    if l.solid then
      local k = kind_of(l, assets.tile_at(l, x, y))
      if k then return k end
    end
  end
  return nil
end

-- ---------------------------------------------------------------- scene layouts (and the older rooms)
-- A scene can have a layout beside its code: scenes/<name>.layout.lua, plain data the studio's layout editor writes. It is built when the
-- scene starts, before enter(), and everything in it with a name becomes a field of the scene (self.player, self.logo, self.prompt).
--   return { width = 640, height = 480, background = "#000000",          -- the size is how far the camera may scroll
--            layers = { { tileset = "ground", data = { {0, 1}, ... }, depth = 100, scroll_x = 1 } },
--            entities = { { "player", 160, 120, { hp = 3 }, name = "player" }, { "brick", 32, 16 }, ... },
--            texts = { { "PRESS A", 160, 206, name = "prompt", color = 3, size = 2, align = "center", font = "spr_font" } },
--            pictures = { { "spr_logo", 80, 20, name = "logo", frame = 0, scale = 2 } },   (texts, pictures, panels and layers also take
--            alpha = 0.5 and blend = "add" or "darken": see-through, glowing or shadowing)
--            panels = { { 0, 0, 320, 22, tileset = "ts_ui", tile = 0, name = "bar" } },   -- x, y, w, h: panels and bars made of tiles
--            paths = { patrol = { { 0, 0 }, { 64, 0 }, loop = true } },
--            code = "level" }        -- optional: run another scene's code with this layout (ten levels, one set of rules)
-- A layout with no code file of its own (and no `code`) is a scene that only shows its layout. Texts, pictures and panels are entities of the
-- kinds gs.world.Text, gs.world.Picture and gs.world.Panel: move them, hide them (visible = false), change their text or tile, tween them.
-- In one layout panels are drawn first, then pictures, then texts (a panel under its picture under its words), each in the order listed.
-- A panel is a 3x3 block of tiles from a tileset (`tile` is its top-left one): the corners stay as drawn, the edges and the middle repeat
-- to fill the size. One tile high (or wide) it is a bar: only the block's top row (or left column). A text's `font` is a built-in font
-- ("round_small" when there is none, "round_tall", "square_small", ... see gs.draw) in its color, or a sprite, one frame a letter from
-- " " (frame 0) on in ASCII order, in the sprite's own colours. `shadow = true` (or a colour) gives built-in letters a drop shadow.
-- gs.load_layout(name) builds another scene's layout into the scene that is running (picking a level from code, a level made of
-- pieces); its named things become fields of the running scene. rooms/<name>.lua is the older home of the same data: gs.load_layout
-- falls back to it, and gs.load_room is the older name of gs.load_layout.

-- Classes are named after the file that is loading; this file makes three, so each gets a name of its own (one name would be one class).
local function builtin(name, kind, spec)
  local was = entity.loading
  entity.loading = name
  local cls = entity[kind](spec)
  entity.loading = was
  return cls
end
W.Text = builtin("gs.text", "entity", { text = "", color = "#ffffff", size = 1, align = "left" })
function W.Text.draw(self)
  local s = self.text
  if s == nil or s == "" then return end
  s = tostring(s)
  local font = self.font
  local w = draw.any_width(font, s, self.size)
  local x = self.align == "center" and self.x - w / 2 or self.align == "right" and self.x - w or self.x
  draw.any_text(font, s, x, self.y, self.color, self.size, self.alpha, self.shadow)
end
W.Picture = builtin("gs.picture", "entity", {})
-- A panel's tiles are put together once into one picture (gs.compose) for each tileset, block and size, and drawn in at most four pieces:
-- the composed grid is whole tiles, so the right column and the bottom row are drawn where the size says, over the repeated middle.
W.Panel = builtin("gs.panel", "entity", { w = 32, h = 32, tile = 0 })
local panel_pics = {}
function W.Panel.draw(self)
  local ts = assets.tileset(self.tileset, 2)
  local tw, th = ts.tw, ts.th
  local w, h = math.max(1, floor(self.w)), math.max(1, floor(self.h))
  local cols, rows = math.max(1, math.ceil(w / tw)), math.max(1, math.ceil(h / th))
  if w > tw and cols < 2 then cols = 2 end
  if h > th and rows < 2 then rows = 2 end
  local key = ts.name .. ":" .. self.tile .. ":" .. cols .. "x" .. rows
  local pic = panel_pics[key]
  if not pic then
    local data = {}
    for r = 1, rows do
      local part_r = rows == 1 and 0 or r == 1 and 0 or r == rows and 2 or 1
      local row = {}
      for c = 1, cols do
        local part_c = cols == 1 and 0 or c == 1 and 0 or c == cols and 2 or 1
        row[c] = self.tile + part_r * ts.cols + part_c
      end
      data[r] = row
    end
    pic = gs.compose(ts.img, tw, th, ts.cols, ts.count, tw, th, cols, rows, data)
    panel_pics[key] = pic
  end
  local x, y = floor(self.x), floor(self.y)
  -- what of the grid's last column and row is left over after the middle: the right and bottom edges go at the far side of the size
  local lw, lh = cols > 1 and w - tw or w, rows > 1 and h - th or h
  local tile, a = gs.tile, (self.alpha or 1) * 255 -- the pieces meet without overlapping, so a see-through panel is even
  tile(pic, 0, 0, lw, lh, x, y, 1, false, 0, 1, a)
  if cols > 1 then tile(pic, (cols - 1) * tw, 0, tw, lh, x + w - tw, y, 1, false, 0, 1, a) end
  if rows > 1 then
    tile(pic, 0, (rows - 1) * th, lw, th, x, y + h - th, 1, false, 0, 1, a)
    if cols > 1 then tile(pic, (cols - 1) * tw, (rows - 1) * th, tw, th, x + w - tw, y + h - th, 1, false, 0, 1, a) end
  end
end

-- names a layout may not use: what every scene already has
local TAKEN = { enter = true, leave = true, update = true, draw = true, draw_ui = true, after = true, every = true, go = true, tween = true }

local function build(data, where, scene)
  if data.background then W.bg = data.background end
  if data.width then camera:limit(0, 0, data.width, data.height or W.view_h); W.room_w, W.room_h = data.width, data.height or W.view_h end
  for _, l in ipairs(data.layers or {}) do W.add_layer(l) end
  W.paths = data.paths or {}
  local function named(item, e)
    local n = item.name
    if not (n and scene and e) then return end
    if talk.pattern[n] then e.visible = false end -- the look of gs.say's box: a pattern, not something on the screen
    if TAKEN[n] or type(scene[n]) == "function" then error(where .. ": '" .. n .. "' is the name of something every scene has; give it another name", 0) end
    scene[n] = e
  end
  for _, s in ipairs(data.entities or {}) do named(s, W.spawn(s[1] or s.class, s[2] or s.x, s[3] or s.y, s[4] or s.props)) end
  for _, t in ipairs(data.panels or {}) do
    if not t.tileset then error(where .. ": a panel needs a tileset (tileset = \"name\")", 0) end
    named(t, W.spawn(W.Panel, t[1] or t.x, t[2] or t.y, { w = t[3] or t.w or 32, h = t[4] or t.h or 32, tileset = t.tileset, tile = t.tile or 0,
      depth = t.depth or 0, screen = t.screen or false, alpha = t.alpha or 1, blend = t.blend }))
  end
  for _, t in ipairs(data.pictures or {}) do
    local sc = t.scale or 1
    named(t, W.spawn(W.Picture, t[2] or t.x, t[3] or t.y, { sprite = t[1] or t.sprite, frame = t.frame or 0, sx = sc, sy = sc, depth = t.depth or 0, screen = t.screen or false,
      alpha = t.alpha or 1, blend = t.blend }))
  end
  for _, t in ipairs(data.texts or {}) do
    named(t, W.spawn(W.Text, t[2] or t.x, t[3] or t.y, { text = t[1] or t.text or "", color = t.color or "#ffffff", size = t.size or 1, align = t.align or "left", font = t.font, shadow = t.shadow,
      depth = t.depth or -10, screen = t.screen or false, alpha = t.alpha or 1, blend = t.blend }))
  end
  return data
end


-- "title", "scenes.title" -> "scenes.title"; its files are scenes/title.lua and scenes/title.layout.lua
local function scene_module(name) return name:find("^scenes%.") and name or "scenes." .. name end
local function file_of(mod) return (mod:gsub("%.", "/")) end

-- A scene's layout as a table, or nil when it has none. Layouts are data: they run with nothing to call.
function W.layout_of(name)
  local path = file_of(scene_module(name)) .. ".layout.lua"
  local text = gs.raw.load(path)
  if not text then return nil end
  local chunk, err = load(text, "@" .. path, "t", {})
  if not chunk then error(err, 0) end
  local ok, data = pcall(chunk)
  if not ok then error(data, 0) end
  if type(data) ~= "table" then error(path .. " must end with 'return { ... }'", 0) end
  return data, path
end

-- Build a layout into the scene that is running: a scene's (scenes/<name>.layout.lua), else an older room (rooms/<name>.lua).
function W.load_layout(name)
  local data, path = W.layout_of(name)
  if data then return build(data, path, W.scene) end
  local room = name:gsub("^rooms%.", "")
  if not gs.raw.load("rooms/" .. room:gsub("%.", "/") .. ".lua") then
    error("gs.load_layout: there is no layout '" .. name .. "' (no " .. file_of(scene_module(name)) .. ".layout.lua)", 2)
  end
  local old = require("rooms." .. room)
  if type(old) ~= "table" then error("rooms/" .. room .. ".lua must end with 'return { ... }'", 2) end
  return build(old, "rooms/" .. room .. ".lua", nil)
end
W.load_room = W.load_layout

-- ---------------------------------------------------------------- paths
-- A path is a list of points, drawn in the room editor or written by hand: paths = { patrol = { { 0, 0 }, { 64, 0 }, loop = true } }.
function W.path(name)
  local p = W.paths and W.paths[name]
  if not p then error("no path called '" .. tostring(name) .. "' in this room", 2) end
  return p
end
-- Walk self along a path at `speed` pixels a second. `path` is a path's name or a table of points; opts.loop goes round for ever (the
-- path's own loop = true does too), opts.reverse walks it backwards. on_path_end(self) runs at the end of a path that does not loop.
function Entity.follow_path(self, path, speed, opts)
  local pts = type(path) == "string" and W.path(path) or path
  opts = opts or {}
  local n = #pts
  if n == 0 then return end
  local order = {}
  for i = 1, n do order[i] = opts.reverse and pts[n + 1 - i] or pts[i] end
  self._path = { pts = order, i = 1, speed = speed or 60, loop = opts.loop or pts.loop or false }
  if not opts.from_here then self.x, self.y = order[1][1], order[1][2] end
end
function Entity.stop_path(self) self._path = nil end
local function step_path(e, dt)
  local p = e._path
  local left = p.speed * dt
  -- at most one lap a step (a looping path whose points are all in one place would otherwise never use up `left`)
  for _ = 1, #p.pts + 1 do
    if left <= 0 then return end
    local target = p.pts[p.i]
    local dx, dy = target[1] - e.x, target[2] - e.y
    local d = sqrt(dx * dx + dy * dy)
    if d > left then e.x, e.y = e.x + dx / d * left, e.y + dy / d * left; return end
    e.x, e.y = target[1], target[2]
    left = left - d
    if p.i < #p.pts then p.i = p.i + 1
    elseif p.loop then p.i = 1
    else
      e._path = nil
      local done = e.on_path_end
      if done then done(e) end
      return
    end
  end
end

-- ---------------------------------------------------------------- collisions
-- One grid for each tag that something asks about, rebuilt at most once a step. Lua works out each living entity's box (slot k: the
-- k-th living entity of the tag, so slots run in the order things were made) and the runtime does the rest (gs.raw.grid_build and
-- grid_query in runtime/main.c): each box goes into the cell its centre is in, a query looks at the cells within half the biggest box of
-- its own and gives back the slots that touch it, in order. Cells are about as big as the things in them (a power of two from 16 to 64
-- pixels, from the average size of the step before).
-- Measured with tests/survivors (bats chasing a hero and pushing each other apart). The first grid put every box into each cell it
-- touched and sorted every candidate into id order: 300 / 500 bats in a still crowd took 37 / 133 ms a step on the RG35XX Pro (3.4 / 6.8 on
-- an M4). One cell per box, boxes in flat arrays and only hits sorted, still in Lua: 11.8 / 29.5 (1.5 / 2.9). The same in C: 8.3 / 11.0
-- (0.6 / 1.3 for the collision pass alone on the M4). Measuring each box once a step (a query reuses the box its grid took) saved
-- 3-4% more there (8-13% on the M4); what is left is mostly the calls into the game's own on_collide handlers, one per touching pair.
local CELL_MIN, CELL_MAX = 16, 64
local grids, ngrids = {}, 0
local grid_build, grid_query = gs.grid_build, gs.grid_query

-- a round hitbox's radius with the entity's scale, or 0 for a box
local function scaled_r(e)
  local r = e._hb.r
  if not r then return 0 end
  local sx, sy = e.sx, e.sy
  if sx == 1 and sy == 1 then return r end
  return r * (sx > sy and sx or sy)
end

local function grid_for(tag)
  local list = W.tags[tag]
  if not list then return nil end
  local g = grids[tag]
  if not g then
    g = { id = ngrids, step = -1, size = 32, n = 0, ents = {}, boxes = {} }
    ngrids = ngrids + 1
    grids[tag] = g
  end
  if g.step ~= W.step_id then
    g.step = W.step_id
    if g.want then g.size = g.want end
    local ents, B, step = g.ents, g.boxes, W.step_id
    local k, span = 0, 0
    for i = 1, #list do
      local e = list[i]
      if not e._dead then
        local x0, y0, x1, y1 = bounds(e)
        if x0 then
          local o = k * 5
          k = k + 1
          ents[k] = e
          B[o + 1], B[o + 2], B[o + 3], B[o + 4], B[o + 5] = x0, y0, x1, y1, scaled_r(e)
          e._bstep, e._bbox, e._bat = step, B, o -- its box this step, for its own query (collide_pass)
          local w, h = x1 - x0, y1 - y0
          span = span + (w > h and w or h)
        end
      end
    end
    for i = k + 1, g.n do ents[i] = nil end -- the grid must not keep the dead alive
    g.n = k
    grid_build(g.id, B, k, g.size)
    -- grow when the things are bigger than a cell, shrink only when they fit well inside half of one (no flipping at the edge)
    local size, avg = g.size, k > 0 and span / k or g.size
    if avg > size and size < CELL_MAX then g.want = size * 2
    elseif avg < size * 0.4 and size > CELL_MIN then g.want = size // 2
    else g.want = nil end
  end
  return g
end

local hits = {}

local function collide_pass()
  for ci = 1, #W.classes do
    local entry = W.classes[ci]
    local handlers = entry.cls.__collide
    if handlers and #handlers > 0 then
      local list = entry.list
      for hi = 1, #handlers do
        local h = handlers[hi]
        local g = grid_for(h.tag)
        if g then
          local fn = entry.cls[h.name]
          local every, step = h.every, W.step_id
          local t0 = W.profile and os.clock()
          local ents = g.ents
          for i = 1, #list do
            local a = list[i]
            if not a._dead and (every == 1 or (step + a.id) % every == 0) then
              -- a box is measured once a step: the one a grid took already (bats against bats), else measured now
              local ax0, ay0, ax1, ay1, ar
              if a._bstep == step then
                local B, o = a._bbox, a._bat
                ax0, ay0, ax1, ay1, ar = B[o + 1], B[o + 2], B[o + 3], B[o + 4], B[o + 5]
              else
                ax0, ay0, ax1, ay1 = bounds(a)
                ar = ax0 and scaled_r(a)
              end
              if ax0 then
                local n, seen = grid_query(g.id, ax0, ay0, ax1, ay1, ar, hits)
                W.checks = W.checks + seen
                for j = 1, n do
                  local b = ents[hits[j]]
                  -- an earlier handler may have removed either of them
                  if b ~= a and not b._dead and not a._dead then fn(a, b) end
                end
              end
            end
          end
          if t0 then entry.t_collide = (entry.t_collide or 0) + (os.clock() - t0) end
        end
      end
    end
  end
end

-- ---------------------------------------------------------------- one step
local function advance(dt)
  local all = W.all
  for i = 1, #all do
    local e = all[i]
    if not e._dead then
      local vx, vy = e.vx, e.vy
      if vx ~= 0 or vy ~= 0 then e.x, e.y = e.x + vx * dt, e.y + vy * dt end
      if e._path then step_path(e, dt) end
      local name = e.sprite
      if name then
        local s = sprite_of(name)
        if s.frames > 1 then
          local anim = e.anim or s.first_anim
          if anim then
            if not e._anim_done then
              local a = s.anims[anim]
              if a then
                local span = a.to - a.from + 1
                local t = (e.frame - a.from) + (a.fps or s.fps or 8) * e.anim_speed * dt
                if t < 0 then t = 0 end -- a frame set by hand before the animation's own
                if t >= span then
                  if a.loop == false then t = span - 1; e._anim_done = true else t = t % span end
                  local hook = e.on_animation_end
                  if hook then hook(e, anim) end
                end
                e.frame = a.from + t
              end
            end
          elseif s.fps > 0 then
            e.frame = (e.frame + s.fps * e.anim_speed * dt) % s.frames
          end
        end
      end
    end
  end
end

local function compact()
  local function clean(list)
    local j = 0
    for i = 1, #list do
      local e = list[i]
      if not e._dead then j = j + 1; list[j] = e end
    end
    for i = #list, j + 1, -1 do list[i] = nil end
  end
  clean(W.all)
  for i = 1, #W.classes do clean(W.classes[i].list) end
  for _, list in pairs(W.tags) do clean(list) end
  W.dirty = false
end

-- the scene of a layout that has no code
local LayoutOnly = builtin("gs.layout", "scene", {})

local function enter_scene(name, args)
  local mod = scene_module(name)
  local layout, layout_path = W.layout_of(mod)
  local code = layout and layout.code and scene_module(layout.code) or mod
  local cls
  if layout and not gs.raw.load(file_of(code) .. ".lua") then
    if layout.code then error(layout_path .. ": its code '" .. layout.code .. "' is not a scene (no " .. file_of(code) .. ".lua)", 0) end
    cls = LayoutOnly
  else
    cls = entity.resolve(code, "scene")
  end
  entity.finalize(cls)
  if W.scene then
    local leave = W.scene.leave
    if leave then leave(W.scene) end
  end
  for i = 1, #W.all do W.all[i]._dead = true end
  W.alive, W.dirty = 0, true
  compact()
  for k in pairs(W.tags) do W.tags[k] = nil end
  W.layers = {}
  W.paused = false
  W.bg, W.room_w, W.room_h = "#000000", nil, nil
  timers.clear()
  talk.active = nil
  particles.clear()
  W.paths = {}
  camera:reset()
  local s = setmetatable({}, cls)
  for k, v in pairs(cls.__defaults) do s[k] = v end
  W.scene = s
  W.scene_name, W.scene_args, W.scene_layout = name, args, layout_path
  if layout then build(layout, layout_path, s) end
  local enter = s.enter
  if enter then enter(s, table.unpack(args or {})) end
end

-- the name of the scene that is running, as gs.goto_scene was given it without "scenes." ("level3"): with ten layouts sharing one
-- scene's code (`code = "level"` in each), the layout's own name, so the code can tell which level it is
function W.current_scene() return W.scene_name and (W.scene_name:gsub("^scenes%.", "")) end

-- the layout file of the scene that is running (whether it has one yet or not)
function W.layout_file() return W.scene_name and file_of(scene_module(W.scene_name)) .. ".layout.lua" end

-- start the scene that is running again, with what it was given (live reload does this when its layout changes)
function W.restart_scene()
  if W.scene_name then W.pending_scene = { name = W.scene_name, args = W.scene_args or {} }; W.fade_state = nil end
end

-- leave for another scene. opts.fade = seconds of fade out and in (default none); opts.look = how: "black" (the default), "white" or
-- "mosaic" (the picture breaks into ever bigger blocks as it darkens, as GBA games went between areas)
function W.goto_scene(name, opts, ...)
  if opts ~= nil and type(opts) ~= "table" then
    W.pending_scene = { name = name, args = { opts, ... } }          -- no options: what follows is for enter()
  else
    W.pending_scene = { name = name, args = { ... }, fade = opts and opts.fade, look = opts and opts.look }   -- options (or nil for none), then what enter() gets
  end
  W.fade_state = nil
end

function W.step(dt)
  W.step_id = W.step_id + 1
  W.time = W.time + dt
  local pending = W.pending_scene
  if pending then
    if pending.fade and pending.fade > 0 then
      W.fade_state = W.fade_state or { phase = "out", t = 0, look = pending.look }
      local f = W.fade_state
      f.t = f.t + dt
      W.fade = math.min(1, f.t / pending.fade)
      if f.t >= pending.fade then
        W.pending_scene, W.fade_state = nil, { phase = "in", t = 0, total = pending.fade, look = pending.look }
        enter_scene(pending.name, pending.args)
      end
      return
    end
    W.pending_scene = nil
    enter_scene(pending.name, pending.args)
  end
  local f = W.fade_state
  if f and f.phase == "in" then
    f.t = f.t + dt
    W.fade = 1 - math.min(1, f.t / f.total)
    if f.t >= f.total then W.fade, W.fade_state = 0, nil end
  end
  if W.flash_t > 0 then W.flash_t = math.max(0, W.flash_t - dt) end
  W.checks_last, W.checks = W.checks, 0
  if W.paused then -- frozen: no entity moves or thinks, no timer runs; only the scene hears about the step (so a pause menu can read buttons)
    talk.update(dt) -- and a conversation, with the script it belongs to
    timers.update(dt, true)
    local scene = W.scene
    if scene and scene.update then scene.update(scene, dt) end
    return
  end
  timers.update(dt)
  local classes, profile = W.classes, W.profile
  for ci = 1, #classes do
    local entry = classes[ci]
    local update = entry.cls.update
    if update then
      local list = entry.list
      local t0 = profile and os.clock()
      for i = 1, #list do
        local e = list[i]
        if not e._dead then update(e, dt) end
      end
      if profile then entry.t_update = (entry.t_update or 0) + (os.clock() - t0) end
    end
  end
  advance(dt)
  particles.update(dt)
  collide_pass()
  local scene = W.scene
  if scene and scene.update then scene.update(scene, dt) end
  camera:update(dt)
  if W.dirty then compact() end
end

-- ---------------------------------------------------------------- drawing
local buckets, bucket_keys, bucket_count = {}, {}, 0

local function bucket(depth)
  local b = buckets[depth]
  if not b then
    b = { n = 0 }
    buckets[depth] = b
    bucket_count = bucket_count + 1
    bucket_keys[bucket_count] = depth
    table.sort(bucket_keys, function(x, y) return x > y end)
  end
  return b
end

-- screen-fixed entities are drawn back to front (made once: a new comparison function every frame was garbage)
local function by_depth(a, b) if a.depth ~= b.depth then return a.depth > b.depth end return a.id < b.id end

-- Draw one thing in its own blend mode (blend = "add" or "darken"; its alpha is the strength), and put "normal" back after it: a draw()
-- of your own that changed the mode and forgot cannot spill onto the next thing.
local function draw_item(item)
  local bm = item.blend
  if bm and bm ~= "normal" then draw.blend(bm) end
  item:draw()
  if draw.mode ~= "normal" then draw.blend("normal") end
end

function W.draw()
  draw.mode = "normal" -- the runtime starts each frame at normal blending
  local r, g, bl = draw.color(W.bg)
  gs.raw.clear(r, g, bl)
  local zoom = camera.zoom
  local vw, vh = camera:view() -- the part of the world on screen (and a clear error for a bad zoom)
  local cx, cy = camera:offset()
  for _, b in pairs(buckets) do b.n = 0 end
  for i = 1, #W.layers do
    local l = W.layers[i]
    if l.visible then local b = bucket(l.depth); b.n = b.n + 1; b[b.n] = l end
  end
  local all = W.all
  local screen_list, ns = W.screen_list or {}, 0
  W.screen_list = screen_list
  for i = 1, #all do
    local e = all[i]
    if e.visible and not e._dead then
      if e.screen then
        ns = ns + 1; screen_list[ns] = e
      else
        local name = e.sprite
        local cull = false
        if name and e.draw == default_draw then
          local s = sprite_of(name)
          local rr = math.max(s.fw, s.fh) * math.max(abs(e.sx), abs(e.sy))
          if e.x < cx - rr or e.x > cx + vw + rr or e.y < cy - rr or e.y > cy + vh + rr then cull = true end
        end
        if not cull then local b = bucket(e.depth); b.n = b.n + 1; b[b.n] = e end
      end
    end
  end
  for i = ns + 1, #screen_list do screen_list[i] = nil end
  local pd = W.particle_drawables or {}
  W.particle_drawables = pd
  for i = 1, particles.drawables(pd) do local item = pd[i]; local b = bucket(item.depth); b.n = b.n + 1; b[b.n] = item end
  gs.raw.zoom(zoom)
  for k = 1, bucket_count do
    local b = buckets[bucket_keys[k]]
    for i = 1, b.n do
      local item = b[i]
      if item.ts then
        local bm = item.blend
        if bm and bm ~= "normal" then draw.blend(bm) end
        assets.draw_layer(item, cx, cy, vw, vh)
        if draw.mode ~= "normal" then draw.blend("normal") end
      else
        gs.raw.camera(cx, cy)
        if W.profile and item.id then -- the inspector's time per kind: only while it is open
          local t0 = os.clock()
          draw_item(item)
          local entry = W.by_class[getmetatable(item)]
          if entry then entry.t_draw = (entry.t_draw or 0) + (os.clock() - t0) end
        else
          draw_item(item)
        end
      end
    end
  end
  gs.raw.camera(cx, cy)
  local scene = W.scene
  if scene and scene.draw then scene.draw(scene); draw.blend("normal") end
  gs.raw.camera(0, 0)
  gs.raw.zoom(1)
  if #screen_list > 1 then table.sort(screen_list, by_depth) end
  for i = 1, #screen_list do draw_item(screen_list[i]) end
  if scene and scene.draw_ui then scene.draw_ui(scene); draw.blend("normal") end
  talk.draw()
  local look = W.fade_state and W.fade_state.look
  if W.fade > 0 then
    local v = look == "white" and 255 or 0
    -- a mosaic darkens late, so the blocks are seen first
    local a = look == "mosaic" and W.fade * W.fade or W.fade
    draw.rect(0, 0, W.view_w, W.view_h, { v, v, v, math.floor(255 * a) })
  end
  local m = look == "mosaic" and W.fade > 0 and 1 + math.floor(W.fade * 15) or 1
  if m ~= W.mosaic_now then gs.raw.mosaic(m); W.mosaic_now = m end
  if W.flash_t > 0 then local c = W.flash_color; draw.rect(0, 0, W.view_w, W.view_h, { c[1], c[2], c[3], math.floor(c[4] * W.flash_t / W.flash_len) }) end
end

-- The whole screen lights up in a colour (white by default) and fades back over `seconds`: a level-up, a bomb, a boss going down.
function W.flash(color, seconds)
  local r, g, b, a = draw.color(color or "#ffffff")
  W.flash_color, W.flash_len = { r, g, b, a }, seconds or 0.3
  W.flash_t = W.flash_len
end

function W.count_alive() return W.alive end

return W
