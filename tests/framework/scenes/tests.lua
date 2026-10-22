-- Every check is a plain function that returns true or fails with a message. The whole script runs as a coroutine (gs.go), so it can wait.
local Tests = gs.scene{}
local failed = 0
local function check(name, ok, detail)
  if not ok then failed = failed + 1; print("FAIL: " .. name .. (detail and (" (" .. tostring(detail) .. ")") or "")) end
end
local function raises(fn, needle)
  local ok, err = pcall(fn)
  return (not ok) and tostring(err):find(needle, 1, true) ~= nil, err
end

-- while the world is paused only the scene is updated: this counts those steps and then lets go
function Tests:update(dt)
  local p = _G.PAUSE_TEST
  if p and gs.world.paused then
    p.steps = p.steps + 1
    local m = gs.first("enemy")
    if m then p.x = p.x or m.x; p.moved = p.moved or (m.x ~= p.x) end
    if p.steps >= 15 then gs.pause(false) end
  end
end

function Tests:enter()
  gs.go(function()
    -- ---- spawning, tags and queries
    local a, b, c = gs.spawn("dummy", 10, 10), gs.spawn("dummy", 50, 10), gs.spawn("dummy", 200, 200)
    check("count by tag", gs.count("enemy") == 3, gs.count("enemy"))
    check("first", gs.first("enemy") == a)
    check("nearest", gs.nearest(48, 12, "enemy") == b)
    check("nearest within distance", gs.nearest(100, 100, "enemy", 20) == nil)
    check("in_radius", #gs.in_radius(10, 10, 45, "enemy") == 2)
    check("in_rect", #gs.in_rect(0, 0, 60, 20, "enemy") == 2)
    local keep = { "stale", "stale", "stale" }
    check("in_radius refills a kept list", gs.in_radius(10, 10, 45, "enemy", keep) == keep and #keep == 2 and keep[3] == nil and keep[1] ~= "stale")
    check("in_rect refills a kept list", gs.in_rect(190, 190, 20, 20, "enemy", keep) == keep and #keep == 1 and keep[1] == c)
    check("in_radius with an unknown tag empties the list", #gs.in_radius(0, 0, 10, "nobody", keep) == 0)
    local round = gs.spawn("roundy", 0, 0)
    check("hit_radius", round:hit_radius() == 5 and a:hit_radius() == nil, round:hit_radius())
    round.sx = -2
    check("hit_radius follows scale", round:hit_radius() == 10, round:hit_radius())
    round:destroy()
    local cr, cg, cb, ca = gs.color("#ff800040")
    check("colors with alpha", cr == 255 and cg == 128 and cb == 0 and ca == 64 and select(4, gs.color("#ff8000")) == 255)
    check("bad color names the alpha form", not pcall(gs.color, "#ff80004"))
    check("defaults", a.hp == 3 and a.alpha == 1 and a.sx == 1)
    local d = gs.spawn("dummy", 0, 0, { hp = 9 })
    check("props beat defaults", d.hp == 9)
    b:destroy()
    gs.wait(0.05)
    check("destroyed entities leave the lists", gs.count("enemy") == 3 and #gs.all("enemy") == 3, #gs.all("enemy"))
    d:destroy(); c:destroy(); a:destroy()

    -- ---- classes: inheritance, flattening, defaults and tags
    local puppy = gs.spawn("puppy", 0, 0)
    check("method from the grandparent", puppy:walk() == 4)
    check("method from the parent", puppy:speak() == "the dog says yip", puppy:speak())
    check("tags are inherited", gs.count("animal") == 1 and gs.count("dog") == 1)
    local Puppy = require "entities.puppy"
    check("flattened: one lookup", rawget(Puppy, "walk") ~= nil and rawget(Puppy, "speak") ~= nil)
    puppy:destroy()

    -- ---- collisions: many entities against a wall, the grid must agree with a plain check
    _G.WALL_HITS, _G.LAST_WALKER = 0, 0
    gs.spawn("wall", 100, 100)
    local rng, expected = gs.rng(5), 0
    local walkers = {}
    for i = 1, 80 do walkers[i] = gs.spawn("walker", rng:float(60, 180), rng:float(60, 180)) end
    local wall = gs.first("wall")
    for _, w in ipairs(walkers) do if w:overlaps(wall) then expected = expected + 1 end end
    gs.wait(0.03)
    check("collision handlers", _G.WALL_HITS >= expected and expected > 0, _G.WALL_HITS .. " vs " .. expected)
    check("touching", walkers[1]:touching("wall") == (walkers[1]:overlaps(wall) and wall or nil))
    for _, w in ipairs(walkers) do w:destroy() end
    wall:destroy()

    -- ---- a handler that is only checked every third step
    _G.LAZY_HITS = 0
    local w2 = gs.spawn("wall", 300, 300)
    local lazy = gs.spawn("lazy", 310, 310)
    gs.wait(1)
    check("collide_every", _G.LAZY_HITS >= 18 and _G.LAZY_HITS <= 22, _G.LAZY_HITS)  -- 60 steps, a third of them
    lazy:destroy(); w2:destroy()

    -- ---- motion and animation
    local m = gs.spawn("dummy", 0, 0)
    m.vx = 100
    gs.wait(0.5)
    check("velocity", math.abs(m.x - 50) < 4, m.x)
    m:destroy()
    local bl = gs.spawn("blinker", 0, 0)
    bl:play("once")
    gs.wait(0.5)
    check("a clip that does not loop rests on its last frame and reports it", math.floor(bl.frame) == 5 and bl.ended >= 1 and bl.last_end == "once", bl.frame)
    bl:play("flash")
    gs.wait(0.3)
    check("a looping clip stays in its range", bl.frame >= 0 and bl.frame < 3, bl.frame)
    check("unknown animation reported", raises(function() bl:play("nope") end, "has no animation called 'nope'"))
    bl:destroy()

    -- ---- timers, tweens, coroutines
    local t = { n = 0, fired = false }
    local owner = gs.spawn("dummy", 0, 0)
    owner:after(0.1, function() t.fired = true end)
    owner:every(0.1, function() t.n = t.n + 1 end)
    local cancelled = owner:after(0.1, function() t.bad = true end)
    cancelled:cancel()
    local x = { v = 0 }
    gs.tween(x, { v = 100 }, 0.2, "linear")
    gs.wait(0.55)
    check("after", t.fired)
    check("every", t.n >= 4 and t.n <= 6, t.n)
    check("cancel", not t.bad)
    check("tween ends exactly on the target", x.v == 100, x.v)
    local dying = gs.spawn("dummy", 0, 0)
    local ran = false
    dying:after(0.2, function() ran = true end)
    dying:destroy()
    gs.wait(0.3)
    check("timers die with their entity", not ran)
    owner:destroy()
    check("wait_until", (function() local flag = false; gs.after(0.1, function() flag = true end); gs.wait_until(function() return flag end); return flag end)())

    -- ---- paths from a room
    gs.load_room("track")
    local w = gs.first("walker")
    check("a room's path is there", #gs.path("square") == 4 and gs.path("square").loop == true)
    w:follow_path("square", 100)
    gs.wait(0.5) -- 50 pixels along the first side
    check("follow_path walks the path", math.abs(w.x - 60) < 4 and math.abs(w.y - 10) < 1, w.x .. "," .. w.y)
    gs.wait(2.2) -- 270 pixels into the 400-pixel lap: 70 pixels along the third side, which runs back to the left
    check("a looping path turns its corners", math.abs(w.x - 40) < 6 and math.abs(w.y - 110) < 1, w.x .. "," .. w.y)
    local ended = false
    w.on_path_end = function() ended = true end
    w:follow_path("line", 300)
    gs.wait(0.2)
    check("a path that does not loop ends and says so", ended and w.x == 30 and w.y == 0 and not w._path, w.x)
    w:follow_path({ { 5, 5 } }, 100, { loop = true })
    gs.wait(0.05)
    check("a one-point looping path does not hang", w.x == 5 and w.y == 5)
    w:stop_path(); w:destroy()

    -- ---- particles
    gs.burst(50, 50, { count = 10, life = 0.2, speed = 100, angle = 0, spread = 0 })
    check("burst makes particles", gs.particle_count() == 10, gs.particle_count())
    gs.wait(0.1)
    check("particles stay away from the entity count", gs.count("enemy") == 0)
    gs.wait(0.2)
    check("particles vanish after their life", gs.particle_count() == 0, gs.particle_count())
    gs.burst(0, 0, { count = gs.limits.particles + 50, life = 5 })
    check("particles stop at the console's limit", gs.particle_count() == gs.limits.particles, gs.particle_count())
    gs.burst(0, 0, { count = 3, sprite = "ball", depth = -5 })
    gs.wait(0.05)
    check("sprite particles at their own depth draw without error", true)

    -- ---- the camera
    local hero = gs.spawn("dummy", 500, 500)
    gs.camera:follow(hero, { bounds = { 0, 0, 640, 480 } })
    gs.wait(0.05)
    check("camera follows within bounds", gs.camera.x == 320 and gs.camera.y == 240, gs.camera.x .. "," .. gs.camera.y)
    hero.x, hero.y = 100, 100
    gs.wait(0.05)
    check("camera follows", math.abs(gs.camera.x - 0) < 1 and math.abs(gs.camera.y - 0) < 1, gs.camera.x)
    gs.camera.zoom = 2 -- the screen shows 160x120 of the world now
    hero.x, hero.y = 500, 500
    gs.wait(0.05)
    check("zoomed camera keeps to the bounds by the zoomed view", gs.camera.x == 420 and gs.camera.y == 360, gs.camera.x .. "," .. gs.camera.y)
    local sx, sy = gs.camera:to_screen(430, 370)
    local wx, wy = gs.camera:to_world(20, 20)
    check("zoomed screen and world positions", sx == 20 and sy == 20 and wx == 430 and wy == 370, sx .. "," .. sy .. " " .. wx .. "," .. wy)
    check("the raw zoom is back to 1 after drawing (the UI is not zoomed)", gs.raw.zoom() == 1)
    gs.camera.zoom = 1
    gs.camera:stop(); hero:destroy()

    -- ---- saving
    gs.save.set("t_number", 12.5)
    gs.save.set("t_table", { a = 1, b = { true, "x" } })
    check("save number", gs.save.get("t_number") == 12.5)
    check("save table", gs.save.get("t_table").b[2] == "x")
    check("save default", gs.save.get("t_missing", 7) == 7)
    gs.save.slot(2).set("level", 3)
    check("save slots are separate", gs.save.slot(2).get("level") == 3 and gs.save.get("level") == nil)
    check("bad save key", raises(function() gs.save.set("no spaces", 1) end, "save key"))

    -- ---- input (a simulated player)
    gs.input.sim_begin()
    gs.input.sim_hold("left", true)
    check("held", gs.input.held("left") and not gs.input.held("right"))
    check("dir", gs.input.dir() == -1)
    gs.input.sim_hold("left", false)

    -- ---- sound
    gs.sfx("blip")
    gs.music("tune")
    gs.music_stop(0.05)
    check("unknown sound effect reported", raises(function() gs.sfx("nope") end, "unknown sound effect 'nope'"))
    check("unknown music reported", raises(function() gs.music("nope") end, "unknown music 'nope'"))

    -- ---- helpful mistakes
    check("unknown entity", raises(function() gs.spawn("nosuchthing") end, "nosuchthing"))
    check("unknown sprite", raises(function() gs.assets.sprite("nosuchsprite") end, "unknown sprite 'nosuchsprite'"))
    check("bad color", raises(function() gs.draw.rect(0, 0, 1, 1, "red") end, "bad color"))

    -- ---- the limit on entities alive
    gs.world.limits.entities = gs.world.alive + 2
    gs.spawn("dummy", 0, 0); gs.spawn("dummy", 0, 0)
    check("entity limit", gs.spawn("dummy", 0, 0) == nil)
    gs.world.limits.entities = nil

    -- ---- live reload: a changed file fills the same class, instances keep their state
    local path = "tests/framework/entities/hot.lua"
    local function write(n) local f = assert(io.open(path, "w")); f:write("local Hot = gs.entity{ n = 0 }\nfunction Hot:value() return " .. n .. " end\nreturn Hot\n"); f:close() end
    write(1)
    local reload = require("gs.reload")
    local hot = gs.spawn("hot", 0, 0)
    hot.n = 42
    reload.start()
    gs.wait(0.1)
    write(2)
    local msg = reload.poll()
    os.remove(path)
    check("reload noticed the file", msg and msg:find("reloaded"), msg)
    check("reload swapped the code", hot:value() == 2, hot:value())
    check("reload kept the state", hot.n == 42)
    hot:destroy()

    -- ---- pausing, and reading starting values
    local d = gs.defaults("dog")
    check("defaults include what is inherited", d.sound == "woof" and d.legs == 4, d.sound)
    local mover = gs.spawn("dummy", 0, 0)
    mover.vx = 100
    _G.PAUSE_TEST = { steps = 0 }
    gs.pause()
    gs.wait(0)                                  -- timers stand still too: this only returns once the scene lets go
    check("the scene ran while paused", _G.PAUSE_TEST.steps >= 15, _G.PAUSE_TEST.steps)
    check("nothing moved while paused", _G.PAUSE_TEST.x and not _G.PAUSE_TEST.moved)
    local after = mover.x
    gs.wait(0.1)
    check("moving again afterwards", mover.x > after)
    mover:destroy()

    -- ---- scenes
    -- the scene changes at the end of the step and this script belongs to this scene, so scenes.second reports the rest
    _G.FINISH = function()
      check("scene arguments", _G.SECOND_ARGS and _G.SECOND_ARGS[1] == 7 and _G.SECOND_ARGS[2] == 8)
      check("scene change clears the world", gs.world.count_alive() == 0, gs.world.count_alive())
      if failed == 0 then print("FRAMEWORK TEST PASS") else print("FRAMEWORK TEST FAILED: " .. failed) end
      gs.raw.quit()
    end
    gs.goto_scene("scenes.second", 7, 8)
  end)
end

return Tests
