import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { png } from "../scripts/png.mjs";

const root = resolve(import.meta.dirname, "..");
const core = ["gs_libretro.so", "gs_libretro.dylib"].map(name => join(root, "build", name)).find(existsSync);
const runner = join(root, "build/retro-run");
const skip = !core || !existsSync(runner);
function fixture(t, code) {
  const dir = mkdtempSync(join(tmpdir(), "gs-performance-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "scenes"));
  writeFileSync(join(dir, "game.lua"), 'return gs.game{ console = "glow43", start = "scenes.main" }\n');
  writeFileSync(join(dir, "scenes/main.lua"), code);
  return dir;
}
function run(dir, frames = 4, extra = {}, image) {
  const result = spawnSync(runner, [core, dir, String(frames), ...(image ? [image] : [])], {
    cwd: root, encoding: "utf8", timeout: 60000,
    env: { ...process.env, GS_SAVE_DIR: join(dir, "saves"), SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_SESSION_SEED: "1", ...extra },
  });
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 0, output);
  assert.doesNotMatch(output, /(?:^|\n)(?:error:|FAIL|lua error:|Lua:)/);
  return output;
}

test("dynamic depths stay bounded, preserve draw order and release destroyed entities", { skip }, t => {
  const dir = fixture(t, `
local Main = gs.scene{}
function Main:enter()
  local Kind = gs.entity{}
  local order = {}
  function Kind:draw() order[#order + 1] = self.id end
  local a, b, c = gs.spawn(Kind, 0, 0), gs.spawn(Kind, 0, 0), gs.spawn(Kind, 0, 0)
  a.depth, b.depth, c.depth = -5, 5, 5
  gs.world.draw()
  assert(order[1] == b.id and order[2] == c.id and order[3] == a.id)
  order = {}
  collectgarbage("collect")
  local before = collectgarbage("count")
  for i = 1, 4000 do
    a.depth = i + 10
    gs.world.draw()
    for k = #order, 1, -1 do order[k] = nil end
  end
  collectgarbage("collect")
  assert(collectgarbage("count") - before < 16, "depth cache grew")
  local weak = setmetatable({a, b, c}, {__mode = "v"})
  a:destroy(); b:destroy(); c:destroy()
  a, b, c = nil, nil, nil
  gs.world.step(1 / 60)
  gs.world.draw()
  collectgarbage("collect")
  assert(next(weak) == nil, "draw cache retained destroyed entities")
  print("DEPTH CACHE PASS")
  gs.quit()
end
return Main
`);
  assert.match(run(dir), /DEPTH CACHE PASS/);
});

test("particle drawers do not retain historical depths", { skip }, t => {
  const dir = fixture(t, `
local Main = gs.scene{}
function Main:enter()
  local particles = require("gs.particles")
  collectgarbage("collect")
  local before = collectgarbage("count")
  for i = 1, 4000 do
    gs.burst(0, 0, { count = 1, depth = i, life = 0.01 })
    gs.world.draw()
    particles.update(1)
  end
  gs.world.draw()
  collectgarbage("collect")
  assert(collectgarbage("count") - before < 32, "particle depth cache grew")
  print("PARTICLE CACHE PASS")
  gs.quit()
end
return Main
`);
  assert.match(run(dir), /PARTICLE CACHE PASS/);
});

test("live queries match ordered scans after direct writes, rehashes, spawns and destruction", { skip }, t => {
  const dir = fixture(t, `
local Main = gs.scene{}
function Main:enter()
  local Box = gs.entity{ tags = {"target"}, hitbox = {-3, -4, 6, 8} }
  local Round = gs.entity{ tags = {"target"}, hitbox = {r = 5} }
  local rng = gs.rng(42)
  local list, out = {}, {}
  for i = 1, 128 do list[i] = gs.spawn(i % 2 == 0 and Box or Round, rng:float(-80, 80), rng:float(-80, 80)) end
  local function same(actual, expected)
    assert(#actual == #expected, "query length")
    for i = 1, #expected do assert(actual[i] == expected[i], "query order") end
  end
  for step = 1, 24 do
    local changed = list[step]
    changed.x, changed.y, changed.sx, changed.sy = step, -step, -2, 0.5
    changed:set_hitbox(step % 2 == 0 and {r = 3} or {0, 0, 10, 4})
    for k = 1, step * 5 do changed["property_" .. k] = k end
    if step % 3 == 0 then list[step + 1]:destroy() end
    if step % 4 == 0 then list[#list + 1] = gs.spawn(Box, step, step) end
    local x, y, radius = rng:float(-80, 80), rng:float(-80, 80), 30
    local nearby, rect, touching = {}, {}, {}
    local nearest, best = nil, radius * radius
    for _, e in ipairs(list) do
      if not e._dead then
        local dx, dy = e.x - x, e.y - y
        local d = dx * dx + dy * dy
        if d <= radius * radius then nearby[#nearby + 1] = e end
        if d < best then nearest, best = e, d end
        local x0, y0, x1, y1 = e:bounds()
        if x0 < x + 40 and x1 > x and y0 < y + 20 and y1 > y then rect[#rect + 1] = e end
        if e ~= changed and changed:overlaps(e) then touching[#touching + 1] = e end
      end
    end
    same(gs.in_radius(x, y, radius, "target", out), nearby)
    assert(gs.nearest(x, y, "target", radius) == nearest, "nearest")
    same(gs.in_rect(x, y, 40, 20, "target", out), rect)
    same(changed:touching_all("target"), touching)
    assert(changed:touching("target") == touching[1], "touching")
  end
  same(gs.in_radius(0, 0, 10, "missing", out), {})
  local Tie = gs.entity{tags = {"tie"}}
  local first = gs.spawn(Tie, 0, 0)
  local second = gs.spawn(Tie, 0, 0)
  assert(gs.nearest(0, 0, "tie") == first)
  assert(gs.nearest(0, 0, "tie", 0) == nil)
  first.x = nil
  getmetatable(first).x = 50
  assert(gs.nearest(50, 0, "tie") == first, "inherited coordinates")
  first._dead = nil
  getmetatable(first)._dead = true
  assert(gs.nearest(50, 0, "tie") == second, "inherited dead flag")
  local Mask = gs.entity{tags = {"mask"}}
  local masked = gs.spawn(Mask, 1000, 1000)
  assert(#gs.in_rect(1001, 1001, 1, 1, "mask") == 0, "missing hitbox")
  masked.sprite = "tiny"
  assert(gs.in_rect(1001, 1001, 1, 1, "mask")[1] == masked, "sprite supplied a hitbox")
  masked.sprite = "wide"
  assert(#gs.in_rect(1001, 1001, 1, 1, "mask") == 0, "sprite edit invalidated old hitbox")
  assert(gs.in_rect(1013, 1013, 1, 1, "mask")[1] == masked)
  masked.sx = -1
  assert(gs.in_rect(987, 1013, 0.5, 0.5, "mask")[1] == masked, "live mirrored sprite hitbox")
  print("LIVE QUERIES PASS")
  gs.quit()
end
return Main
`);
  mkdirSync(join(dir, "sprites"));
  const image = png(16, 16, new Uint8Array(16 * 16 * 4).fill(255));
  for (const [name, mask] of [["tiny", [0, 0, 2, 2]], ["wide", [12, 12, 4, 4]]]) {
    writeFileSync(join(dir, `sprites/${name}.json`), JSON.stringify({ origin: [0, 0], mask }));
    writeFileSync(join(dir, `sprites/${name}.png`), image);
  }
  assert.match(run(dir), /LIVE QUERIES PASS/);
});

test("batched radius searches match live queries, reuse results and keep snapshot membership", { skip }, t => {
  const dir = fixture(t, `
local Main = gs.scene{}
function Main:enter()
  local Kind = gs.entity{tags = {"target"}}
  local points, out = {}, {}
  local rng = gs.rng(91)
  for i = 1, 128 do points[i] = gs.spawn(Kind, rng:float(-80, 80), rng:float(-80, 80)) end
  for round = 1, 12 do
    points[round].x, points[round].y = round, -round
    if round % 3 == 0 then points[round + 1]:destroy() end
    if round % 4 == 0 then gs.spawn(Kind, round, round) end
    local previous = out[1]
    assert(gs.in_radius_batch(points, 20, "target", out) == out)
    if previous then assert(out[1] == previous, "batch did not reuse result list") end
    for i, p in ipairs(points) do
      local reference = gs.in_radius(p.x, p.y, 20, "target")
      assert(#out[i] == #reference, "batch count")
      for k, e in ipairs(reference) do assert(out[i][k] == e, "batch order") end
    end
  end
  local Tie = gs.entity{tags = {"tie"}}
  local a, b = gs.spawn(Tie, 0, 0), gs.spawn(Tie, 0, 0)
  local result = gs.in_radius_batch({{x = 0, y = 0}}, 0, "tie")
  assert(result[1][1] == a and result[1][2] == b, "zero radius and ties")
  a.x = 100
  assert(#gs.in_radius(0, 0, 0, "tie") == 1, "live query did not see movement")
  assert(#result[1] == 2 and result[1][1] == a, "snapshot membership changed")
  assert(#gs.in_radius_batch({}, 10, "target", out) == 0, "outer result not trimmed")
  assert(#gs.in_radius_batch(points, 10, "missing", out) == #points)
  for _, list in ipairs(out) do assert(#list == 0, "missing tag returned entities") end
  assert(not pcall(gs.in_radius_batch, points, -1, "target"))
  assert(not pcall(gs.in_radius_batch, points, 0/0, "target"))
  assert(not pcall(gs.in_radius_batch, {{x = math.huge, y = 0}}, 1, "target"))
  assert(not pcall(gs.in_radius_batch, {{x = 0}}, 1, "target"))
  assert(not pcall(gs.in_radius_batch, points, 1, "target", points))
  local shared = {}
  assert(not pcall(gs.in_radius_batch, points, 1, "target", {shared, shared}), "aliased result lists accepted")
  gs.in_radius_batch(points, 20, "target", out)
  collectgarbage("collect")
  local before = collectgarbage("count")
  for _ = 1, 100 do gs.in_radius_batch(points, 20, "target", out) end
  collectgarbage("collect")
  assert(collectgarbage("count") - before < 8, "batch retained scratch snapshots")
  print("BATCH QUERIES PASS")
  gs.quit()
end
return Main
`);
  assert.match(run(dir), /BATCH QUERIES PASS/);
});

test("native field caches and batch results survive table rehashes across rewind and Resume", { skip }, t => {
  const dir = fixture(t, `
local Main = gs.scene{}
function Main:enter()
  local Kind = gs.entity{tags = {"target"}, hitbox = {-2, -2, 4, 4}}
  self.entities = {}
  for i = 1, 16 do self.entities[i] = gs.spawn(Kind, i * 10, 0) end
  self.n = 0
end
function Main:update()
  self.n = self.n + 1
  for i, e in ipairs(self.entities) do
    for k = 1, self.n * 10 do e["property_" .. k] = k end
    e.x = i * 10 + self.n
    assert(gs.nearest(e.x, e.y, "target") == e, "stale nearest after rewind")
    assert(gs.in_radius(e.x, e.y, 1, "target")[1] == e, "stale radius after rewind")
    assert(gs.in_rect(e.x, e.y, 1, 1, "target")[1] == e, "stale hitbox after rewind")
  end
  self.batch = gs.in_radius_batch(self.entities, 1, "target", self.batch or {})
  for i, e in ipairs(self.entities) do assert(self.batch[i][1] == e, "stale batch after rewind") end
  if self.n == 4 then print("QUERY STATE PASS") end
end
return Main
`);
  const state = join(dir, "state");
  const replay = run(dir, 10, { RETRO_SAVE: `3:${state}`, RETRO_LOAD: `8:${state}` });
  assert.equal((replay.match(/QUERY STATE PASS/g) || []).length, 2);
  assert.match(run(dir, 1, { RETRO_LOAD: `0:${state}` }), /QUERY STATE PASS/);
});

const layerCode = `
local function make_layer(cols, tile)
  local data = {}
  for r = 1, 16 do data[r] = {}; for c = 1, cols do data[r][c] = tile end end
  return gs.add_layer{ name = "ground", tileset = "test", data = data }
end
local Main = gs.scene{}
function Main:enter()
  self.layer = make_layer(16, 0)
  self.n = 0
end
function Main:update()
  self.n = self.n + 1
  if self.n == 2 then
    gs.set_tile(self.layer, 16, 16, 1)
    gs.set_tile(self.layer, 48, 32, -1)
    gs.set_tile(self.layer, 64, 48, 2)
  elseif self.n == 3 then
    gs.set_tile(self.layer, 16, 16, -1)
    gs.set_tile(self.layer, 48, 32, 1)
    gs.set_tile(self.layer, 64, 48, 3)
  elseif self.n == 4 then
    gs.set_tile(self.layer, 16, 16, 0)
    gs.set_tile(self.layer, 48, 32, 0)
    gs.set_tile(self.layer, 64, 48, 0)
  elseif self.n == 5 then
    gs.world.layers = {}
    self.layer = make_layer(16, 1)
    gs.set_tile(self.layer, 16, 16, 0)
  elseif self.n == 6 or self.n == 7 then
    for r = 0, 15 do for c = 0, 15 do gs.set_tile(self.layer, c * 16, r * 16, self.n == 6 and -1 or 0) end end
    gs.set_tile(self.layer, 0, 0, 0)
  elseif self.n == 8 then
    gs.world.layers = {}
    self.layer = make_layer(8, 1)
  end
end
return Main
`;
function layerFixture(t) {
  const dir = fixture(t, layerCode);
  mkdirSync(join(dir, "tilesets"));
  writeFileSync(join(dir, "tilesets/test.json"), '{"tile_w":16,"tile_h":16}');
  const pixels = new Uint8Array(64 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 64; x++) {
    const at = (y * 64 + x) * 4;
    pixels[at] = x < 16 ? 220 : 40;
    pixels[at + 1] = x < 16 ? 40 : 200;
    pixels[at + 2] = 60;
    pixels[at + 3] = x < 16 ? 255 : x < 32 ? (x % 2 ? 255 : 0) : x < 48 ? 128 : 0;
  }
  writeFileSync(join(dir, "tilesets/test.png"), png(64, 16, pixels));
  return dir;
}
test("dirty tile patches match direct draws, including transparency and old state recipes", { skip }, t => {
  const dir = layerFixture(t);
  for (const frame of [2, 3, 4, 5, 6, 7, 8]) {
    const patched = join(dir, `patch-${frame}.bmp`), plain = join(dir, `plain-${frame}.bmp`);
    run(dir, frame, {}, patched);
    run(dir, frame, { GS_NO_LAYER_PICTURES: "1" }, plain);
    assert.deepEqual(readFileSync(patched), readFileSync(plain));
  }
  const state = join(dir, "state"), before = join(dir, "before.bmp");
  run(dir, 4, { RETRO_SAVE: `2:${state}`, RETRO_DUMP: `3:${before}`, RETRO_LOAD: `4:${state}` });
  assert.deepEqual(readFileSync(before), readFileSync(before + ".again.bmp"));
  const resumed = join(dir, "resumed.bmp");
  run(dir, 1, { RETRO_LOAD: `0:${state}` }, resumed);
  const plain = join(dir, "plain-3.bmp");
  assert.deepEqual(readFileSync(resumed), readFileSync(plain));
});

test("libretro finalizes draw counters and emits performance and Lua profiles", { skip }, t => {
  const dir = fixture(t, `
local Main = gs.scene{}
function Main:draw()
  gs.draw.rect(0, 0, 256, 192, "#ff0000")
  for i = 1, 4000 do self.value = i * i end
end
return Main
`);
  const output = run(dir, 180, { GS_PERF: "1", GS_PROF: "1" });
  assert.match(output, /core perf: .*readback\+video/);
  assert.match(output, /profile: \d+ samples/);
  const checked = fixture(t, `
local Main = gs.scene{}
function Main:update()
  self.n = (self.n or 0) + 1
  if self.n == 2 then
    local pixels, calls = gs.raw.stats()
    assert(pixels >= 256 * 192 and calls > 0, "missing core drawing counters")
    print("CORE COUNTERS PASS")
    gs.quit()
  end
end
function Main:draw() gs.draw.rect(0, 0, 256, 192, "#ff0000") end
return Main
`);
  assert.match(run(checked), /CORE COUNTERS PASS/);
});
