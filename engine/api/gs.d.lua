---@meta
-- The GameStudio API as the editor sees it: completion, hover help and type checking come from this file. It is read by the studio
-- (studio/src/lua-intel-core.js) and by the Lua language server. It is NOT part of a game and is never packed. Keep it in step with engine/gs/*.lua:
-- a doc line ("---") above a function is its hover text, "---@param name type description" documents an argument.

---@alias Color string|integer|number[]  "#rrggbb", "#rrggbbaa" (aa: 00 invisible to ff solid), "bank:place" (a colour of the game's colour banks, like "sky:3"), a number from the console's classic palette, or {r, g, b [, a]}
---@alias BlendMode "normal"|"add"|"darken"  normal: see-through by alpha; add: adds light (glows); darken: multiplies (shadows, tints)
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
---@field anim string|nil Name of the animation playing (nil: the sprite's first animation shows, if it has any).
---@field anim_speed number 1 is normal speed.
---@field depth number Draw order: larger is further back.
---@field sprite string|nil Name of a file in sprites/.
---@field bank string|nil Draw the sprite with another colour bank, place for place (a palette swap: one drawing, red and blue soldiers).
---@field screen boolean|nil True draws in screen space (a HUD piece), ignoring the camera.
---@field blend BlendMode|nil How it mixes with what is behind it: "add" glows (fire, magic, light), "darken" shades (shadows, tinted glass). Its alpha is the strength.
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
---Play one of the sprite's named animations. Does nothing if it is already playing (unless restart is true). Until an entity plays one, it shows the sprite's first animation.
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
---Draw the sprite in one colour for a moment: the GBA's flash when something is hit. self:flash(0.08)
---@param seconds? number 0.08 when left out
---@param color? string white when left out ("#rrggbb")
---@param strength? number 1 (the default) draws the sprite all in the colour; below 1 lays the colour over the sprite (0.5 for crowds)
function Entity:flash(seconds, color, strength) end
---Draw this entity. Define your own `draw` to draw something else; call this to also draw the sprite.
function Entity:draw() end

-- Methods you can write on an entity. Each is optional.
---Called once when the entity is made, after its starting values are set.
function Entity:create() end
---Called every step (60 times a second) with the time since the last step in seconds. Kinds of entity update in the order they were
---first spawned (all of one kind, then all of the next), then everything moves by vx, vy, then collisions, then the scene's update:
---spawn a moving platform before the hero so it has moved when the hero stands on it.
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
---This one entity's hitbox, instead of its kind's: x, y, w, h from its position, or { r = 6 } for a round one; nil goes back to its
---kind's. (A `hitbox` given to gs.spawn does the same.)
---@param x number|table|nil
---@param y? number
---@param w? number
---@param h? number
function Entity:set_hitbox(x, y, w, h) end
---Move by dx, dy pixels (sideways first, then up or down), stopping against the tiles of the layers marked solid. Returns which way each
---move was stopped: hit_x -1 (a wall on the left), 1 (on the right) or 0; hit_y 1 (landed), -1 (bumped a ceiling) or 0. A tileset's
---"kinds" say what its tiles are: "oneway" platforms only stop things coming down onto them (self.drop_through = true falls through);
---any other kind ("spike", "ice") stops nothing but can be asked about, unless the tileset's "solid_kinds" names it (["ice"]: a wall or
---floor you can still tell apart). Every tile not listed is "solid". No slopes.
---  local hx, hy = self:slide(self.dx * dt, self.dy * dt)
---  if hy ~= 0 then self.dy = 0 end
---  self.on_ground = hy == 1
---@param dx number
---@param dy number
---@return integer hit_x
---@return integer hit_y
function Entity:slide(dx, dy) end
---The first tile of a kind ("spike", "solid", ...) of a solid layer under the hitbox: its top-left corner in the world, or nil.
---inset shrinks the hitbox first (grazing a spike's edge is forgiven).
---@param kind string
---@param inset? number
---@return number|nil x
---@return number|nil y
function Entity:touching_tile(kind, inset) end

---@class Scene
---@field enter fun(self: Scene, ...) Called when the scene starts; gets the extra arguments of gs.goto_scene.
---@field update fun(self: Scene, dt: number) Called every step.
---@field draw fun(self: Scene) Draws after the world (layers and entities), in world space.
---@field draw_ui fun(self: Scene) Draws on top of everything, in screen space (score, menus).
---@field leave fun(self: Scene) Called when another scene takes over. enter, update, draw, draw_ui and leave are the engine's: a method of your own with one of these names (a leave() that goes back to the board) runs at those times.
---@field on_net_end fun(self: Scene, reason: string) Wi-Fi play ended. Without this hook the game returns to the scene that opened the session.
Scene = {}
---Call fn once, after a delay in seconds. It belongs to the scene: leaving the scene cancels it.
---@param seconds number
---@param fn fun(self: Scene)
---@return Timer
function Scene:after(seconds, fn) end
---Call fn every so many seconds until the scene ends or the timer is cancelled.
---@param seconds number
---@param fn fun(self: Scene)
---@return Timer
function Scene:every(seconds, fn) end
---Run a little script that can wait (gs.wait), belonging to the scene.
---@param fn function
---@return Timer
function Scene:go(fn) end
---Glide fields of the scene to new values over time.
---@param props table
---@param seconds number
---@param easing? Easing
---@param on_done? function
---@return Timer
function Scene:tween(props, seconds, easing, on_done) end

-- ------------------------------------------------------------------ the game
---@class GameSpec
---@field title string
---@field console "glow43"|"glow169"|table The handheld this game is made for. It sets the screen, palette and limits.
---@field start string The first scene, e.g. "scenes.title".
---@field preload? boolean Load every sprite and tileset at start (default true).
---@field buttons? ButtonStyle How {a}, {start} and the other button icons in texts look (default "gba").
---@field players? integer Maximum Wi-Fi players, 1 to 4 (default 1).

---@alias ButtonStyle "gba"|"snes"|"nes"|"mono"
---@alias ButtonIcon "a"|"b"|"x"|"y"|"l"|"r"|"start"|"select"|"up"|"down"|"left"|"right"|"dpad"

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
---and are capped by the console's particle limit (300 on Glow43). Example: gs.burst(x, y, { count = 20, color = "#ffd08a", gravity = 200 }).
---@param x number
---@param y number
---@param opts? { count: integer, color: Color, size: number, speed: number|number[], life: number|number[], angle: number, spread: number, gravity: number, drag: number, fade: boolean, shrink: boolean, depth: number, sprite: string, blend: BlendMode } blend = "add" makes sparks glow where they overlap; speed and life take one number or { min, max }; angle and spread in degrees (0 right, 90 down; spread 360 = every way); gravity in pixels a second squared; depth like an entity's.
function gs.burst(x, y, opts) end
---How many particles are alive now.
---@return integer
function gs.particle_count() end
---Call target:on_<message>(...) if the target has such a method.
---@param target Entity
---@param message string
function gs.send(target, message, ...) end

---Freeze the world: no entity moves or thinks and no timer, tween or gs.go script runs (gs.say's box and the script it belongs to do).
---The scene's update and draw_ui keep running, so a pause menu or a level-up choice can read buttons.
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
---@param opts? { fade: number, look: "black"|"white"|"mosaic" } fade = seconds to fade out and in; look = to black (the default), to white, or a mosaic that breaks the picture into blocks as it darkens (how GBA games went between areas)
function gs.goto_scene(name, opts, ...) end
---Light the whole screen up in a colour and fade back: a level-up, a bomb, a boss going down. gs.flash("#ffffff", 0.3)
---@param color? Color white when left out
---@param seconds? number 0.3 when left out
function gs.flash(color, seconds) end
---Build another scene's layout into the scene that is running: its background, tile layers, entities, texts, pictures and paths. For
---picking a level from code or building a level from pieces; named things become fields of the running scene. A scene's own layout is
---built for you when it starts, so this is only for more.
---  gs.load_layout("levels.level" .. n)     -- scenes/levels/level3.layout.lua
---@param name string
---@return table
function gs.load_layout(name) end
---The older name of gs.load_layout (it also reads the older rooms/<name>.lua files).
---@param name string
---@return table
function gs.load_room(name) end
---A path of the layout built last: a list of points { {x, y}, ... } (loop = true if it goes round). Paths are drawn in the layout editor.
---@param name string
---@return number[][]
function gs.path(name) end
---Add a tile layer: { tileset = "name", data = { {0, 1}, {2, 3} }, depth = 100, scroll_x = 1, wrap_x = false, alpha = 1, blend = "normal", ... }.
---alpha and blend make it see-through, glowing ("add": light shafts, mist) or shading ("darken": shadows, night). A layer's x, y is where its
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
---Take a tile layer out of the world. Returns true if it was there.
---@param layer table|string The layer or its name
---@return boolean
function gs.remove_layer(layer) end
---Draw a layer with another tileset (a night version of the same tiles). Its tile kinds come from the new tileset.
---@param layer table|string
---@param tileset string A file in tilesets/
function gs.set_tileset(layer, tileset) end
---The kind of the tile at a world position ("solid", "oneway", or a name from the tileset's kinds), nil for none. With layer nil, the
---first layer marked solid that has a tile there.
---@param layer table|string|nil
---@param x number
---@param y number
---@return string|nil
function gs.tile_kind(layer, x, y) end
---The name of the scene that is running, without "scenes." ("level3"). Ten layouts that share one scene's code (code = "level") can
---tell which they are by it.
---@return string
function gs.scene_name() end

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
---The player's volume for the music and for the sound effects, 0 to 1 each (leave one out to keep it). Returns both. For a settings menu.
---@param music? number
---@param sfx? number
---@return number music, number sfx
function gs.volume(music, sfx) end

---The colour behind everything in this scene (a layout's background sets it too). A new scene starts black.
---@param color string|integer[] "#rrggbb", a palette colour or "bank:place"
function gs.background(color) end

-- ------------------------------------------------------------------ time
---Game time in seconds: it counts steps, so it follows gs.time_scale and stands still while the studio pauses the game. Use it for
---anything in the game (cooldowns, blinking, "ignore buttons for a moment").
---@return number
function gs.now() end
---Real time in seconds since the game started (the computer's clock): the same for every step of one frame, and it runs on while
---the game is paused or slowed. For measuring, not for game logic: use gs.now.
---@return number
function gs.time() end
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
---Show a text box and wait until the player has read it (A goes on; holding A or B types faster). The world stands still meanwhile,
---and so do timers and scripts other than this one: a gs.after started before it waits too. Use it inside gs.go or self:go.
---The box's look comes from the scene's layout: a panel named dialogue_box, texts named dialogue_text and dialogue_name, a picture
---named dialogue_cursor. Without them it is a plain box at the bottom. gs.ui.style.text_speed (letters a second) and
---gs.ui.style.on_letter (a function for a blip) set how it types.
---@param name string Who speaks (leave out for no name: gs.say("A locked door."))
---@param text? string What they say; long text wraps and runs onto more pages
---@param opts? { auto: number } auto: go on by itself this many seconds after a page is typed (a CPU player's turn)
function gs.say(name, text, opts) end
---Ask a question in the text box and wait for an answer (up and down choose, A picks). Use it inside gs.go or self:go.
---@param question string
---@param answers (string|{ [1]: string, enabled: boolean })[] e.g. { "YES", "NO" }; { "SELL", enabled = false } is dim and cannot be picked
---@param name? string Who asks
---@param opts? { back: integer } back: the answer B picks (none when left out)
---@return integer The number of the answer picked
function gs.ask(question, answers, name, opts) end

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
---@param opts? { smooth: number, bounds: number[], offset_x: number, offset_y: number } smooth: 0 snaps; otherwise the share of the way the camera moves each step, so larger is quicker (0.1 lazy, 0.5 quick). The target can be any table with x and y. bounds: { x, y, w, h }.
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
---@param player? integer Player 1 to 4 (default 1). During Wi-Fi play, every device reads the same buttons for each player.
---@return boolean
function gs.input.held(name, player) end
---Did the button go down since the last step? True for exactly one step.
---@param name Button
---@param player? integer Player 1 to 4 (default 1).
---@return boolean
function gs.input.pressed(name, player) end
---Did the button come up since the last step?
---@param name Button
---@param player? integer Player 1 to 4 (default 1).
---@return boolean
function gs.input.released(name, player) end
---The D-pad as two numbers, each -1, 0 or 1: dx, dy.
---@param player? integer Player 1 to 4 (default 1).
---@return integer dx, integer dy
function gs.input.dir(player) end

-- ------------------------------------------------------------------ local Wi-Fi play
gs.net = {}
---@type string "off", "hosting", "joining", "lobby", "playing" or "waiting".
gs.net.state = "off"
---@type integer This device's player number. Use only in draw/draw_ui, never to choose gameplay updates.
gs.net.me = 1
---@type integer Number of players in the session (1 outside a session).
gs.net.count = 1
---@type integer Input delay in steps (currently 2, about 33 ms).
gs.net.delay = 2
---@type string|nil The last session error or reason it ended. Show this in your menu.
gs.net.error = nil
---@type string|nil The player whose buttons the session is waiting for.
gs.net.waiting_for = nil
---The player name this game remembered on this device (empty the first time).
---@return string
function gs.net.name() end
---Host on this Wi-Fi network. Ask for the player's name in your game's menu first.
---@param name string 1 to 32 bytes, without control characters.
function gs.net.host(name) end
---Find sessions of this game on the local Wi-Fi. Call again to refresh; results arrive in following frames.
---@return table[] Sessions with id, name, players and max. Internet play is not supported.
function gs.net.find() end
---Ask to join a session from gs.net.find(). Watch state and error for the result.
---@param id string The session's id from gs.net.find().
---@param name string This player's name.
function gs.net.join(id, name) end
---Players in the lobby/session, each with player (number) and name.
---@return table[]
function gs.net.peers() end
---The host starts every device in this scene, with the same random seed and the host's save.
---Use a full module name such as "scenes.arena". Start gameplay state afresh in enter().
---This first implementation shares up to 64 KB of saves and uses a fixed two-step delay.
---@param scene string
function gs.net.start(scene) end
---Leave discovery or Wi-Fi play. During play on_net_end(reason) runs, or the game returns to its menu.
function gs.net.leave() end

-- ------------------------------------------------------------------ drawing (use these in draw or draw_ui)
gs.draw = {}
---How everything drawn next mixes with what is already there, until you change it back with gs.draw.blend(): "add" adds light
---(glows), "darken" multiplies (shadows), "normal" is plain see-through by alpha. The world puts "normal" back after each thing it draws.
---@param mode? BlendMode
function gs.draw.blend(mode) end
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
---@alias BuiltinFont "round_small"|"round_tall"|"square_small"|"square_tall"|"bold_small"|"bold_tall"|"sans"|"serif"|"mono"
---@class TextOptions
---@field font? BuiltinFont Pixel fonts: small 8 pixels high, tall 12. Smooth fonts: sans, serif, mono, all 16 high. round_small when left out
---@field shadow? boolean|Color A drop shadow right of and under the letters: true makes one from the text's colour
---@field alpha? number 0 to 1
---Text in a built-in font: pixel round, square or bold (small or tall), or smooth sans, serif or mono. A button's name in
---braces shows its icon: {a} {b} {x} {y} {l} {r} {start} {select} {up} {down} {left} {right} {dpad}.
---  gs.draw.text("Hello!", 8, 8, "#404040", 1, { font = "round_tall", shadow = true })
---  gs.draw.text("Press {a} to jump", 8, 20, "#ffffff")
---opts can be just a font's name ("bold_small"). Drawn every frame, make the options table once at the top of the file
---(local BIG = { font = "round_tall", shadow = true }) rather than a new one in each call.
---@param str any
---@param x number
---@param y number
---@param color? Color
---@param scale? number
---@param opts? TextOptions|BuiltinFont
function gs.draw.text(str, x, y, color, scale, opts) end
---Text centered on the screen.
---@param str any
---@param y number
---@param color? Color
---@param scale? number
---@param opts? TextOptions
function gs.draw.text_centered(str, y, color, scale, opts) end
---Text that ends at x (right aligned).
---@param str any
---@param x number
---@param y number
---@param color? Color
---@param scale? number
---@param opts? TextOptions
function gs.draw.text_right(str, x, y, color, scale, opts) end
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
---Width of text in pixels, in a built-in font (round_small when left out).
---@param str any
---@param scale? number
---@param font? BuiltinFont
---@return number
function gs.draw.text_width(str, scale, font) end
---One button icon on its own, small unless opts.size is "tall"; opts.color is the colour of the "mono" style.
---  gs.draw.button("start", 8, 8, { size = "tall" })
---@param name ButtonIcon
---@param x number
---@param y number
---@param opts? { size?: "small"|"tall", scale?: number, alpha?: number, color?: Color }
function gs.draw.button(name, x, y, opts) end
---Change how button icons look while the game runs (game.lua's buttons = "..." sets it at the start).
---@param style ButtonStyle
function gs.draw.buttons(style) end
---How many letters a text has, a button icon counting as one: for text that types out letter by letter.
---@param str string
---@return integer
function gs.draw.letters(str) end
---The first n letters of a text, a button icon counting as one.
---@param str string
---@param n integer
---@return string
function gs.draw.first_letters(str, n) end
---Split text into lines that fit a width in pixels.
---@param text string
---@param width number
---@param scale? number
---@param font? string A built-in font or a sprite font (round_small when left out)
---@return string[]
function gs.draw.wrap(text, width, scale, font) end
---Draw a sprite by name at a position.
---@param name string A file in sprites/
---@param x number
---@param y number
---@param opts? { frame: number, angle: number, scale: number, sx: number, sy: number, alpha: number, flip: boolean, bank: string, blend: BlendMode } bank: draw it with another colour bank's colours (a palette swap); blend: "add" glows, "darken" shades
function gs.draw.sprite(name, x, y, opts) end
---A window the way GBA games drew them: a light border with rounded corners, a darker line inside it, and the fill (dark blue unless
---given). { fill = "#f8f8f0", border = "#38486a", inner = "#a8c4e0" } is the pale look of gs.say's box; inner = false leaves out the line.
---The other GBA look is a bevel: light (a line along the inside's top and left) and shade (bottom and right) in place of inner, with fill2
---for a lower half in another colour, and round = 2 for deeper cut corners. Make the table once when a window is drawn every frame.
---  gs.draw.panel(x, y, w, h, { border = "#0e1230", light = "#8aa8e0", fill = "#2e3c6ee6", fill2 = "#24305ae6" })
---@param opts? { fill: Color, fill2: Color, border: Color, inner: Color|false, light: Color, shade: Color, round: 1|2 }
function gs.draw.panel(x, y, w, h, opts) end
---Draw something once into a picture and show the picture afterwards: a backdrop of hundreds of rectangles becomes one draw a frame.
---fn draws with gs.draw.* as usual, (0, 0) being the picture's top-left. Baking the same name again redraws into the same picture, so
---bake in enter (or when something changes), never every frame. A picture starts see-through: paint a backdrop's background first.
---  self.sky = gs.draw.bake("sky", 256, 192, function() gs.draw.rect(0, 0, 256, 192, "#203058") ... end)
---@param name string
---@param w integer
---@param h integer
---@param fn function
---@return table picture
function gs.draw.bake(name, w, h, fn) end
---Draw a picture made by gs.draw.bake at x, y (in the world inside draw, on the screen inside draw_ui).
---@param picture table
---@param x number
---@param y number
---@param alpha? number 0 to 1
---@param scale? number
function gs.draw.picture(picture, x, y, alpha, scale) end
---A bar that shows value out of max (health, progress).
---@param opts? { color: Color, back: Color, border: Color }
function gs.draw.bar(x, y, w, h, value, max, opts) end

-- ------------------------------------------------------------------ interface
gs.ui = {}
---How menus look and sound, and how gs.say types: color, selected, disabled, value (a value not chosen; the item's colour when nil),
---cursor, line, on_move, on_pick, on_back, on_refuse (A on a dim item) (functions for sounds), repeat_delay and repeat_every (a held direction), open_time (seconds a menu or gs.say's box takes to open or close, 0.12;
---0 for none), text_speed (letters a second, 40) and on_letter (called as letters type).
gs.ui.style = {}
---@class Menu
---@field cur integer The selected item.
---@field items (string|MenuItem)[]
---@field closed boolean True once menu:close() has rolled it away.
local Menu = {}
---@class MenuItem
---@field [1] string The label
---@field enabled? boolean false: drawn dim and skipped
---@field hint? string A line about the item (menu:hint() gives the chosen one's)
---@field values? string[] Left and right choose one ("OFF", "ON")
---@field value? integer Which of the values is chosen (1 when left out)
---@field wrap? boolean false: the values stop at the ends instead of going round
---@field on_change? fun(item: MenuItem, value: string) Called when left or right changed the value
---Handle the buttons: up / down move (held, they repeat), left / right change a value, A picks, B goes back. Returns the number of the
---item picked, "back" for B (unless opts.back = false), otherwise nil (also while it rolls open or shut). Start does not pick
---(it is the pause button) unless opts.start = true.
---@return integer|"back"|nil
function Menu:update() end
---Draw the items with a cursor. The first time it is drawn it rolls open, line by line.
---@param x number
---@param y number
function Menu:draw(x, y) end
---Roll the menu away, last line first; menu.closed is true when it is gone.
function Menu:close() end
---Roll a closed menu open again.
function Menu:open() end
---How far it has rolled open, 0 to 1.
---@return number
function Menu:unfolded() end
---The chosen item (a string or its table).
---@return string|MenuItem
function Menu:item() end
---The chosen item's hint, or nil.
---@return string|nil
function Menu:hint() end
---An item's value as shown ("ON"); the chosen item when i is left out.
---@param i? integer
---@return string|nil
function Menu:value(i) end
---Move the cursor to the next item that can be chosen (by -1 or 1). Returns false when none can.
---@param by integer
---@return boolean
function Menu:move(by) end
---A list of choices to pick with the D-pad.
---  gs.ui.menu({ "PLAY", { "CONTINUE", enabled = false }, { "MUSIC", values = { "OFF", "ON" }, value = 2 } }, { width = 120 })
---@param items (string|MenuItem)[]
---@param opts? { scale: number, line: number, width: number, back: boolean, start: boolean, at: table, cursor: table|fun(x: number, y: number, menu: Menu), font: string, shadow: boolean|string, indent: number, skip: boolean, cycle: boolean, roll: boolean } roll = false: no rolling open or shut, buttons work at once (also for a menu the game draws itself); cycle: A steps an item with values on instead of picking it; skip = false: the cursor stops on dim items (A on one is refused); indent: pixels from x to the labels (the cursor's room); width: values are right-aligned this far from x; cursor: a layout picture, or a function that draws it at the chosen line's x, y
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
---Remove a saved value (an empty save slot, a forgotten setting).
---@param key string
function SaveSlot.delete(key) end
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
---One of the game's colour banks (palette.json) by name: { name, colors = { {r, g, b}, ... } } with places 1 to 15.
---@param name string
---@return table
function gs.assets.bank(name) end
---A sprite as it looks with another bank's colours, place for place (what an entity's bank field draws). Made once, then kept.
---@param sprite table What gs.assets.sprite returns
---@param bank string
---@return table
function gs.assets.swapped(sprite, bank) end

gs.world = {}
---How many entities are alive.
---@return integer
function gs.world.count_alive() end
