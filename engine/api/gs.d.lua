---@meta
-- The GameStudio API as the editor sees it: completion, hover help and type checking come from this file. It is read by the studio
-- (studio/src/lua-intel-core.js) and by the Lua language server. It is NOT part of a game and is never packed. Keep it in step with engine/gs/*.lua:
-- a doc line ("---") above a function is its hover text, "---@param name type description" documents an argument.

---@alias Color string|integer|number[]  "#rrggbb", "#rrggbbaa" (aa: 00 invisible to ff solid), a number from the console's palette, or {r, g, b [, a]}
---@alias Easing "linear"|"in_quad"|"out_quad"|"in_out_quad"|"in_cubic"|"out_cubic"|"in_out_cubic"|"out_back"|"out_bounce"
---@alias Button "up"|"down"|"left"|"right"|"a"|"b"|"x"|"y"|"l"|"r"|"start"|"select"|"l2"|"r2"|"l3"|"r3"

---@class Timer
---@field cancel fun(self: Timer) Stop it before it fires.

---@class Entity
---@field x number World position (the sprite's origin sits here).
---@field y number
---@field vx number Velocity in pixels a second; the engine moves the entity by it every step.
---@field vy number
---@field angle number Rotation in degrees, clockwise (0 = right, 90 = down).
---@field sx number Horizontal scale (negative mirrors).
---@field sy number Vertical scale.
---@field alpha number 0 (invisible) to 1.
---@field visible boolean
---@field flip boolean Mirror the sprite sideways.
---@field frame number Frame of the sprite being shown.
---@field anim string|nil Name of the animation playing.
---@field anim_speed number 1 is normal speed.
---@field depth number Draw order: larger is further back.
---@field sprite string|nil Name of a file in sprites/.
---@field screen boolean|nil True draws in screen space (a HUD piece), ignoring the camera.
---@field id integer A number that is different for every entity.
Entity = {}

---Remove this entity at the end of the step. Its timers stop with it. Safe to call twice.
function Entity:destroy() end
---Is it still in the game?
---@return boolean
function Entity:is_alive() end
---Move by an amount (the same as adding to x and y).
---@param dx number
---@param dy number
function Entity:move(dx, dy) end
---Does the hitbox overlap another entity's hitbox?
---@param other Entity
---@return boolean
function Entity:overlaps(other) end
---The first entity with this tag that touches this one, or nil.
---@param tag string
---@return Entity|nil
function Entity:touching(tag) end
---Every entity with this tag that touches this one.
---@param tag string
---@return Entity[]
function Entity:touching_all(tag) end
---Width of the sprite on screen (with scale).
---@return number
function Entity:width() end
---Height of the sprite on screen (with scale).
---@return number
function Entity:height() end
---The radius of a round hitbox (hitbox = { r = 6 }) with the entity's scale, or nil if the hitbox is a box.
---@return number|nil
function Entity:hit_radius() end
---Distance to another entity or to a point.
---@param a Entity|number Another entity, or the x of a point
---@param b? number The y of the point
---@return number
function Entity:distance_to(a, b) end
---Angle toward another entity or a point, in degrees clockwise (0 = right, 90 = down).
---@param a Entity|number
---@param b? number
---@return number
function Entity:angle_to(a, b) end
---Set vx and vy so the entity moves toward a target at a speed in pixels a second.
---@param a Entity|number Another entity, or the x of a point
---@param b number Speed (entity form) or y (point form)
---@param c? number Speed (point form)
function Entity:move_toward(a, b, c) end
---Move in a direction: an angle in degrees clockwise and a speed in pixels a second.
---@param angle number
---@param speed number
function Entity:set_velocity(angle, speed) end
---How fast it moves right now, in pixels a second.
---@return number
function Entity:speed() end
---Mirror the sprite to face where it is moving (left or right).
function Entity:face_motion() end
---Play one of the sprite's named animations. Does nothing if it is already playing (unless restart is true).
---@param name string An animation from the sprite's file
---@param restart? boolean
function Entity:play(name, restart) end
---Show another sprite.
---@param name string
---@param frame? number
function Entity:set_sprite(name, frame) end
---Run a function once after some seconds. It stops if the entity is destroyed.
---@param seconds number
---@param fn fun()
---@return Timer
function Entity:after(seconds, fn) end
---Run a function again and again. It stops if the entity is destroyed.
---@param seconds number
---@param fn fun()
---@return Timer
function Entity:every(seconds, fn) end
---Run a function as a coroutine that can pause with gs.wait(seconds). It stops if the entity is destroyed.
---@param fn fun()
---@return Timer
function Entity:go(fn) end
---Change number fields of this entity smoothly over time.
---@param props table Target values, e.g. { x = 100, alpha = 0 }
---@param seconds number
---@param easing? Easing
---@param on_done? fun()
function Entity:tween(props, seconds, easing, on_done) end
---Draw this entity. Define your own `draw` to draw something else; call this to also draw the sprite.
function Entity:draw() end

-- Methods you can write on an entity. Each is optional.
---Called once when the entity is made, after its starting values are set.
function Entity:create() end
---Called every step (60 times a second) with the time since the last step in seconds.
---@param dt number
function Entity:update(dt) end
---Called when the entity is removed.
function Entity:on_destroy() end
---Called when a clip that does not loop reaches its last frame.
---@param name string
function Entity:on_animation_end(name) end
---Walk along a path at a speed (pixels a second): a path's name from the room (drawn in the room editor) or a table of points { {x, y}, ... }.
---It starts at the first point unless opts.from_here. A looping path (loop = true, or opts.loop) goes round for ever; otherwise on_path_end runs at the end.
---@param path string|number[][]
---@param speed number
---@param opts? { loop: boolean, reverse: boolean, from_here: boolean }
function Entity:follow_path(path, speed, opts) end
---Stop walking a path (the entity stays where it is).
function Entity:stop_path() end
---Called when the entity reaches the end of a path that does not loop.
function Entity:on_path_end() end

---@class Scene
---@field enter fun(self: Scene, ...) Called when the scene starts; gets the extra arguments of gs.goto_scene.
---@field update fun(self: Scene, dt: number) Called every step.
---@field draw fun(self: Scene) Draws after the world (layers and entities), in world space.
---@field draw_ui fun(self: Scene) Draws on top of everything, in screen space (score, menus).
---@field leave fun(self: Scene) Called when another scene takes over.
Scene = {}

-- ------------------------------------------------------------------ the game
---@class GameSpec
---@field title string
---@field console "dot"|"dash"|table The handheld this game is made for. It sets the screen, palette and limits.
---@field start string The first scene, e.g. "scenes.title".
---@field preload? boolean Load every sprite and tileset at start (default true).

gs = {}
---@type boolean True while the game runs from the studio with live reload.
gs.dev = false
---@type table Limits of the console: screen_w, screen_h, entities, particles, budgets.
gs.limits = {}

---Describe the game. Put this in game.lua and return it.
---@param spec GameSpec
---@return GameSpec
function gs.game(spec) end
---Make a new kind of thing. Write methods on the result and `return` it from the file. A second argument builds on another entity.
---@param spec table Starting values. Special keys: sprite, tags = { "enemy" }, depth, hitbox = { x, y, w, h } or { r = radius }, screen, collide_every = { enemy = 4 } (check that tag's on_collide handler only every 4th step, staggered: for a crowd that does not need exact timing).
---@return Entity
---@overload fun(parent: Entity, spec: table): Entity
function gs.entity(spec) end
---Make a new scene (a screen of your game). Write enter / update / draw_ui on it and `return` it from the file.
---@param spec? table
---@return Scene
function gs.scene(spec) end

---Make an entity by the name of its file in entities/ ("grub", or "enemies.grub" for entities/enemies/grub.lua).
---@param name string|Entity
---@param x? number
---@param y? number
---@param props? table Values that replace the entity's starting values
---@return Entity|nil nil when the console's limit of entities is reached
function gs.spawn(name, x, y, props) end
---Call a function for every entity with a tag.
---@param tag string
---@param fn fun(e: Entity)
function gs.each(tag, fn) end
---The list of entities with a tag (do not change the list while looping over it; use gs.each).
---@param tag string
---@return Entity[]
function gs.all(tag) end
---The first entity with a tag, or nil.
---@param tag string
---@return Entity|nil
function gs.first(tag) end
---How many entities have a tag.
---@param tag string
---@return integer
function gs.count(tag) end
---The entity with a tag closest to a point (optionally no further than max_distance).
---@param x number
---@param y number
---@param tag string
---@param max_distance? number
---@return Entity|nil
function gs.nearest(x, y, tag, max_distance) end
---Every entity with a tag within a radius of a point.
---@param x number
---@param y number
---@param radius number
---@param tag string
---@param out? Entity[] A list to empty and fill instead of making a new one (keep it in a field to make no garbage every step).
---@return Entity[]
function gs.in_radius(x, y, radius, tag, out) end
---Every entity with a tag inside a rectangle.
---@param x number
---@param y number
---@param w number
---@param h number
---@param tag string
---@param out? Entity[] A list to empty and fill instead of making a new one.
---@return Entity[]
function gs.in_rect(x, y, w, h, tag, out) end
---A puff of particles: small squares (or a sprite's frames) that fly, fall, fade and vanish by themselves. They are not entities, never collide,
---and are capped by the console's particle limit (300 on Dot). Example: gs.burst(x, y, { count = 20, color = "#ffd08a", gravity = 200 }).
---@param x number
---@param y number
---@param opts? { count: integer, color: Color, size: number, speed: number|number[], life: number|number[], angle: number, spread: number, gravity: number, drag: number, fade: boolean, shrink: boolean, depth: number, sprite: string } speed and life take one number or { min, max }; angle and spread in degrees (0 right, 90 down; spread 360 = every way); gravity in pixels a second squared; depth like an entity's.
function gs.burst(x, y, opts) end
---How many particles are alive now.
---@return integer
function gs.particle_count() end
---Call target:on_<message>(...) if the target has such a method.
---@param target Entity
---@param message string
function gs.send(target, message, ...) end

---Freeze the world: no entity moves or thinks and no timer runs. The scene's update and draw_ui keep running, so a pause menu or a level-up choice can read buttons.
---A new scene starts unfrozen. Call gs.pause(false) to carry on.
---@param on? boolean true (the default) to freeze, false to carry on
function gs.pause(on) end
---The starting values of an entity kind, without making one: { hp = 3, speed = 40, ... } (including what it inherits). For reading numbers like a cap or a cost. Do not change the table.
---@param name string|Entity
---@return table
function gs.defaults(name) end

---Go to another scene at the end of this step. Its layout (scenes/<name>.layout.lua) is built first: everything named in it is a field of
---the scene (self.logo) before enter() runs. Anything after the options is passed to the scene's enter(). The options may be left out or be nil; to pass a table as
---the first argument to enter(), give the options first ({} for none).
---@param name string A scene, e.g. "scenes.play"
---@param opts? { fade: number } fade = seconds to fade out and in
function gs.goto_scene(name, opts, ...) end
---Build a room from rooms/<name>.lua: its background, tile layers and the entities it places.
---@param name string
---@return table
function gs.load_room(name) end
---A path of the room loaded last: a list of points { {x, y}, ... } (loop = true if it goes round). Paths are drawn in the room editor.
---@param name string
---@return number[][]
function gs.path(name) end
---Add a tile layer: { tileset = "name", data = { {0, 1}, {2, 3} }, depth = 100, scroll_x = 1, wrap_x = false, ... }. A layer's x, y is where its
---top-left corner is in the world (0, 0): change them every step to slide it, e.g. a sky that drifts on a title screen.
---@param spec table
---@return table
function gs.add_layer(spec) end
---A tile layer by name.
---@param name string
---@return table|nil
function gs.layer(name) end
---The tile number at a world position (nil outside the layer).
---@param layer table
---@param x number
---@param y number
---@return integer|nil
function gs.tile_at(layer, x, y) end
---Change a tile at a world position.
---@param layer table
---@param x number
---@param y number
---@param tile integer
function gs.set_tile(layer, x, y, tile) end

-- ------------------------------------------------------------------ sound
---Play a sound effect from sfx/.
---@param name string
---@param volume? number 0 to 1
function gs.sfx(name, volume) end
---Stop all sound effects.
function gs.sfx_stop() end
---Play a song from music/ (it replaces the one playing).
---@param name string
function gs.music(name) end
---Stop the music, fading out over some seconds.
---@param fade_seconds? number
function gs.music_stop(fade_seconds) end

-- ------------------------------------------------------------------ time
---Run a function once after some seconds (when no entity owns it; use entity:after to tie it to one).
---@param seconds number
---@param fn fun()
---@return Timer
function gs.after(seconds, fn) end
---Run a function again and again.
---@param seconds number
---@param fn fun()
---@return Timer
function gs.every(seconds, fn) end
---Run a function as a coroutine; inside it gs.wait(seconds) pauses.
---@param fn fun()
---@return Timer
function gs.go(fn) end
---Change number fields of a table smoothly over time.
---@param target table
---@param props table
---@param seconds number
---@param easing? Easing
---@param on_done? fun()
function gs.tween(target, props, seconds, easing, on_done) end
---Pause a coroutine (gs.go / entity:go) for some seconds.
---@param seconds number
function gs.wait(seconds) end
---Pause a coroutine until a function returns true.
---@param fn fun(): boolean
function gs.wait_until(fn) end
---Show a text box and wait until the player has read it (A goes on). The world stands still meanwhile. Use it inside gs.go or self:go.
---The box's look comes from the scene's layout: a panel named dialogue_box, texts named dialogue_text and dialogue_name, a picture
---named dialogue_cursor. Without them it is a plain box at the bottom.
---@param name string Who speaks (leave out for no name: gs.say("A locked door."))
---@param text? string What they say; long text wraps and runs onto more pages
function gs.say(name, text) end
---Ask a question in the text box and wait for an answer (up and down choose, A picks). Use it inside gs.go or self:go.
---@param question string
---@param answers string[] e.g. { "YES", "NO" }
---@param name? string Who asks
---@return integer The number of the answer picked
function gs.ask(question, answers, name) end

-- ------------------------------------------------------------------ maths and helpers
---Keep a number between a low and a high value.
---@param v number
---@param lo number
---@param hi number
---@return number
function gs.clamp(v, lo, hi) end
---A number a fraction t of the way from a to b.
---@param a number
---@param b number
---@param t number
---@return number
function gs.lerp(a, b, t) end
----1, 0 or 1.
---@param v number
---@return integer
function gs.sign(v) end
---Distance between two points.
---@return number
function gs.dist(x1, y1, x2, y2) end
---Angle from one point to another, in degrees clockwise (0 = right, 90 = down).
---@return number
function gs.angle(x1, y1, x2, y2) end
---A random number: gs.random() is 0 to 1, gs.random(n) is 1 to n, gs.random(a, b) is a to b.
---@param a? number
---@param b? number
---@return number
function gs.random(a, b) end
---One of the arguments, picked at random.
---@return any
function gs.choose(...) end
---A random generator with its own seed, for things that must repeat.
---@param seed? integer
---@return { float: fun(self, a?: number, b?: number): number, int: fun(self, a: integer, b: integer): integer, pick: fun(self, list: table): any }
function gs.rng(seed) end
---Turn "#rrggbb", "#rrggbbaa" or a palette number into r, g, b, a (0 to 255).
---@param color Color
---@return integer r, integer g, integer b, integer a
function gs.color(color) end

-- ------------------------------------------------------------------ the camera
---@class Camera
---@field x number World position of the screen's top-left corner.
---@field y number
---@field zoom number How much bigger the world is drawn (1 = normal, 2 = twice as big; whole numbers keep pixel art crisp). The UI (draw_ui, screen entities) is not zoomed. Back to 1 when the scene changes.
gs.camera = {}
---Look at a world position.
---@param x number
---@param y number
function gs.camera:set(x, y) end
---Keep an entity in the middle of the screen.
---@param target Entity
---@param opts? { smooth: number, bounds: number[], offset_x: number, offset_y: number } smooth: 0 snaps, larger is lazier. bounds: { x, y, w, h }.
function gs.camera:follow(target, opts) end
---Stop following.
function gs.camera:stop() end
---Never show anything outside this rectangle of the world.
---@param x number
---@param y number
---@param w number
---@param h number
function gs.camera:limit(x, y, w, h) end
---Shake the screen.
---@param amount number Pixels
---@param seconds number
function gs.camera:shake(amount, seconds) end
---World position to screen position.
---@return number, number
function gs.camera:to_screen(wx, wy) end
---Screen position to world position.
---@return number, number
function gs.camera:to_world(sx, sy) end

-- ------------------------------------------------------------------ buttons
gs.input = {}
---Is the button down right now?
---@param name Button
---@return boolean
function gs.input.held(name) end
---Did the button go down since the last step? True for exactly one step.
---@param name Button
---@return boolean
function gs.input.pressed(name) end
---Did the button come up since the last step?
---@param name Button
---@return boolean
function gs.input.released(name) end
---The D-pad as two numbers, each -1, 0 or 1: dx, dy.
---@return integer dx, integer dy
function gs.input.dir() end

-- ------------------------------------------------------------------ drawing (use these in draw or draw_ui)
gs.draw = {}
---A filled rectangle.
---@param x number
---@param y number
---@param w number
---@param h number
---@param color Color
function gs.draw.rect(x, y, w, h, color) end
---An outlined rectangle.
---@param x number
---@param y number
---@param w number
---@param h number
---@param color Color
function gs.draw.frame(x, y, w, h, color) end
---A line.
---@param color Color
function gs.draw.line(x1, y1, x2, y2, color) end
---A filled circle.
---@param color Color
function gs.draw.circle(x, y, radius, color) end
---Text in the built-in 8x8 font.
---@param str any
---@param x number
---@param y number
---@param color? Color
---@param scale? number
function gs.draw.text(str, x, y, color, scale) end
---Text centered on the screen.
---@param str any
---@param y number
---@param color? Color
---@param scale? number
function gs.draw.text_centered(str, y, color, scale) end
---Text that ends at x (right aligned).
---@param str any
---@param x number
---@param y number
---@param color? Color
---@param scale? number
function gs.draw.text_right(str, x, y, color, scale) end
---Text in a font of your own: a sprite whose frames are the letters, from the space (frame 0) on in ASCII order. Each letter is a frame
---wide; letters the sprite has no frame for leave a gap. The sprite's own colours are used.
---@param font string A sprite name
---@param str string
---@param x number
---@param y number
---@param scale? number
function gs.draw.font_text(font, str, x, y, scale) end
---How wide text is in a sprite font, in pixels.
---@param font string
---@param str string
---@param scale? number
---@return number
function gs.draw.font_width(font, str, scale) end
---Width of text in pixels.
---@param str any
---@param scale? number
---@return number
function gs.draw.text_width(str, scale) end
---Split text into lines that fit a width in pixels.
---@param text string
---@param width number
---@param scale? number
---@return string[]
function gs.draw.wrap(text, width, scale) end
---Draw a sprite by name at a position.
---@param name string A file in sprites/
---@param x number
---@param y number
---@param opts? { frame: number, angle: number, scale: number, sx: number, sy: number, alpha: number, flip: boolean }
function gs.draw.sprite(name, x, y, opts) end
---A box with a border, for menus and dialogs.
---@param opts? { fill: Color, border: Color }
function gs.draw.panel(x, y, w, h, opts) end
---A bar that shows value out of max (health, progress).
---@param opts? { color: Color, back: Color, border: Color }
function gs.draw.bar(x, y, w, h, value, max, opts) end

-- ------------------------------------------------------------------ interface
gs.ui = {}
---@class Menu
---@field cur integer The selected item.
---@field items string[]
local Menu = {}
---Handle up / down / A. Returns the number of the item when A is pressed, otherwise nil.
---@return integer|nil
function Menu:update() end
---Draw the items with a cursor.
---@param x number
---@param y number
function Menu:draw(x, y) end
---A list of choices to pick with the D-pad.
---@param items string[]
---@param opts? { scale: number, line: number }
---@return Menu
function gs.ui.menu(items, opts) end

-- ------------------------------------------------------------------ saving
---@class SaveSlot
local SaveSlot = {}
---A saved value (numbers, strings, booleans and tables of those). Returns default when nothing was saved.
---@param key string Letters, digits and _
---@param default? any
---@return any
function SaveSlot.get(key, default) end
---Save a value. It survives closing the game.
---@param key string
---@param value any
function SaveSlot.set(key, value) end
---Was something saved under this key?
---@param key string
---@return boolean
function SaveSlot.has(key) end
gs.save = SaveSlot
---A separate set of saved values (slot 1, 2, 3...).
---@param n integer
---@return SaveSlot
function gs.save.slot(n) end

-- ------------------------------------------------------------------ assets and the world
gs.assets = {}
---Load a sprite by name (usually not needed: sprites load when first used).
---@param name string
---@return table
function gs.assets.sprite(name) end
---Load a tileset by name.
---@param name string
---@return table
function gs.assets.tileset(name) end
---Load every sprite and tileset now.
---@return integer
function gs.assets.preload() end

gs.world = {}
---How many entities are alive.
---@return integer
function gs.world.count_alive() end
