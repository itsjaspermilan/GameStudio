local Main = gs.scene{}
local plain = os.getenv("GS_BANKS_PLAIN")
local failed = 0
local function check(what, ok, got)
  if not ok then failed = failed + 1; print("FAIL " .. what .. (got ~= nil and (": " .. tostring(got)) or "")) end
end

function Main:enter()
  local b = gs.assets.bank("red")
  check("a bank's places", #b.colors == 3 and b.colors[2][1] == 0xff and b.colors[2][2] == 0x84, #b.colors)
  check("tile banks share the names", gs.assets.bank("sky").colors[2][3] == 0xa5)
  local r, g, bl = gs.draw.color("red:3")
  check("a bank colour in code", r == 255 and g == 255 and bl == 0, r .. "," .. g .. "," .. bl)
  check("an unknown bank is an error", not pcall(gs.draw.color, "nope:1"))
  check("a place past the bank is an error", not pcall(gs.draw.color, "red:9"))
  local s = gs.assets.sprite("chip")
  check("a sprite knows its bank", s.bank == "blue", s.bank)
  local swapped = gs.assets.swapped(s, "red")
  check("a swap is a new picture", swapped.img.id ~= s.img.id and swapped.fw == s.fw)
  check("a swap is made once", gs.assets.swapped(s, "red") == swapped)
  check("its own bank is the sprite itself", gs.assets.swapped(s, "blue") == s)
  check("a sprite without a bank cannot be swapped", not pcall(gs.assets.swapped, gs.assets.sprite("plain"), "red"))
  if not plain then gs.spawn("chip_thing", 0, 8) end
end

local n = 0
function Main:update()
  n = n + 1
  if n == 3 then
    if failed == 0 then print("BANKS TEST PASS") end
    gs.quit()
  end
end

-- chip.png is 4x1: places 1, 2, (see-through), 3. Drawn 4x as big, swapped to red, at the top and
-- (as an entity) 8 pixels down.
function Main:draw_ui()
  if plain then
    for _, y in ipairs({ 0, 8 }) do
      gs.draw.rect(0, y, 4, 4, "#ff0000"); gs.draw.rect(4, y, 4, 4, "#ff8400"); gs.draw.rect(12, y, 4, 4, "#ffff00")
    end
  else
    gs.draw.sprite("chip", 0, 0, { scale = 4, bank = "red" })
  end
end
return Main
