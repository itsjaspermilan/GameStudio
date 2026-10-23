-- What the kitchen has: the foods, the dishes people order and the five days of the week.
-- Every food sits on the screen where its button is on the handheld: the face buttons on the right
-- (X top, A right, B bottom, Y left) and the D-pad on the left. Press the button in the same spot
-- as the food and it goes on the plate. Monday uses only the face buttons; each later day adds one
-- food on the D-pad.
local M = {}

M.FOODS = {
  { id = "bun",     name = "Bun",     button = "x",     day = 1 },
  { id = "patty",   name = "Patty",   button = "a",     day = 1 },
  { id = "cheese",  name = "Cheese",  button = "b",     day = 1 },
  { id = "lettuce", name = "Lettuce", button = "y",     day = 1 },
  { id = "tomato",  name = "Tomato",  button = "up",    day = 2 },
  { id = "egg",     name = "Egg",     button = "right", day = 3 },
  { id = "fish",    name = "Fish",    button = "down",  day = 4 },
  { id = "sauce",   name = "Sauce",   button = "left",  day = 5 },
}
M.FOOD, M.BY_BUTTON = {}, {}
for _, f in ipairs(M.FOODS) do M.FOOD[f.id] = f; M.BY_BUTTON[f.button] = f end

-- Names fit a ticket (9 letters at most). A dish pays 2 coins a food, plus a tip for serving fast.
M.DISHES = {
  burger   = { name = "Burger",    items = { "bun", "patty" } },
  cheesy   = { name = "Cheesy",    items = { "bun", "patty", "cheese" } },
  leafy    = { name = "Leafy",     items = { "bun", "patty", "lettuce" } },
  salad    = { name = "Salad",     items = { "lettuce", "tomato" } },
  deluxe   = { name = "Deluxe",    items = { "bun", "patty", "cheese", "lettuce", "tomato" } },
  eggbun   = { name = "Egg Bun",   items = { "bun", "egg", "cheese" } },
  brekkie  = { name = "Brekkie",   items = { "bun", "egg", "patty" } },
  fishbun  = { name = "Fish Bun",  items = { "bun", "fish", "lettuce" } },
  fishdish = { name = "Fish Dish", items = { "fish", "tomato", "lettuce" } },
  saucy    = { name = "Saucy",     items = { "bun", "patty", "sauce" } },
  bigstack = { name = "Big Stack", items = { "bun", "patty", "cheese", "egg", "sauce" } },
}
for id, d in pairs(M.DISHES) do d.id = id; d.price = 2 * #d.items end

-- A day: the dishes on the menu (the new ones are ordered a little more often), how long the shift
-- is, how often people come and how long they wait, and the coins for one, two and three stars. One
-- star opens the next day.
M.DAYS = {
  { name = "Monday", dishes = { "burger", "cheesy", "leafy" }, new = { "burger", "cheesy", "leafy" },
    secs = 75, gap = { 6, 9 }, wait = 30, stars = { 40, 80, 115 },
    tip = "Press the button in the same spot as the food. R serves!" },
  { name = "Tuesday", dishes = { "burger", "cheesy", "leafy", "salad", "deluxe" }, new = { "salad", "deluxe" },
    secs = 80, gap = { 5.5, 8 }, wait = 28, stars = { 45, 95, 135 },
    tip = "New: tomato. It is on the D-pad, up." },
  { name = "Wednesday", dishes = { "cheesy", "leafy", "salad", "eggbun", "brekkie" }, new = { "eggbun", "brekkie" },
    secs = 90, gap = { 5, 7.5 }, wait = 26, stars = { 50, 100, 145 },
    tip = "New: egg. D-pad right." },
  { name = "Thursday", dishes = { "burger", "salad", "eggbun", "fishbun", "fishdish", "deluxe" }, new = { "fishbun", "fishdish" },
    secs = 90, gap = { 4.5, 7 }, wait = 25, stars = { 50, 105, 145 },
    tip = "New: fish. D-pad down." },
  { name = "Friday", dishes = { "cheesy", "leafy", "deluxe", "brekkie", "fishbun", "saucy", "bigstack" }, new = { "saucy", "bigstack" },
    secs = 100, gap = { 4, 6.5 }, wait = 24, stars = { 60, 125, 190 },
    tip = "New: sauce, D-pad left. Friday rush!" },
}

return M
