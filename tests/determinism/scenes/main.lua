local Main = gs.scene{}
local determinism = require("gs.determinism")
local random, randomseed = math.random, math.randomseed
local noise = tonumber(os.getenv("GS_DRAW_NOISE") or "0")

function Main:enter()
  local seed = tonumber(os.getenv("GS_SESSION_SEED"))
  if seed then
    randomseed(12345)
    local expected = { random(), random(0), random(-100, 100) }
    randomseed(12345)
    determinism.drawing(true)
    randomseed(67890)
    random(); random(0); random(-100, 100)
    assert(not pcall(random, 3, 2), "bad random ranges must still raise errors")
    determinism.drawing(false)
    assert(expected[1] == random() and expected[2] == random(0) and expected[3] == random(-100, 100),
      "cached random/randomseed must isolate draw calls")
    determinism.seed(seed)
  else
    randomseed(12345)
    random()
    local expected = random()
    randomseed(12345)
    determinism.drawing(true); random(); determinism.drawing(false)
    assert(random() == expected, "unseeded single-player random semantics changed")
  end

  local a = { step_id = 1, time = 0, next_id = 2, scene_name = "main", scene = { score = 2 }, all = {
    setmetatable({ id = 1, x = 0, hp = 5 }, { __name = "mover" }) } }
  local b = { step_id = 1, time = 0, next_id = 2, scene_name = "main", scene = { score = 2 }, all = {
    setmetatable({ hp = 5, x = 0, id = 1 }, { __name = "mover" }) } }
  local initial = determinism.checksum(a)
  assert(initial == determinism.checksum(b), "field insertion order changed the hash")
  b.all[1].hp = 6
  assert(initial ~= determinism.checksum(b), "entity field drift was missed")
  b.all[1].hp = 5; b.scene.score = 3
  assert(initial ~= determinism.checksum(b), "scene field drift was missed")
  b.scene.score = 2; getmetatable(b.all[1]).__name = "other"
  assert(initial ~= determinism.checksum(b), "entity class drift was missed")
  getmetatable(b.all[1]).__name = "mover"; b.scene.score = "2"
  assert(initial ~= determinism.checksum(b), "scalar types were not distinguished")

  self.boot_roll = DETERMINISM_BOOT_RANDOM
  self.score = 0
  local weights, order = {}, {}
  for i = 1, 120 do weights["choice_" .. i] = i end
  for k, v in pairs(weights) do
    order[#order + 1] = k
    self.score = self.score + v * random(1, 100)
  end
  self.order = table.concat(order, ",")
  for i = 1, 3 do gs.spawn("mover", i * 10, 20, { hp = i }) end
  print("DETERMINISM TEST PASS")
end

function Main:update()
  self.score = self.score + gs.random(0.25, 1.75)
end

function Main:draw()
  for i = 1, noise do random() end
end

function Main:draw_ui()
  for i = 1, noise do gs.random(); gs.choose("a", "b") end
  if os.getenv("GS_DRAW_TRACE") and gs.world.step_id % 60 == 0 then
    print(string.format("@@gsdraw %d %016x", gs.world.step_id, random(0)))
  end
end

return Main
