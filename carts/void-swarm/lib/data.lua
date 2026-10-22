-- Everything about Void Swarm that is a number or a name and is not one kind of thing: pilots, weapons, passives, ship upgrades and the ten sectors.
-- (Each enemy and boss keeps its own numbers in its file: entities/enemies/ and entities/bosses/.) To rebalance the game, edit these tables.
-- Weapon stats: cd = seconds between shots, count = shots / blades / bolts, pierce = extra enemies a shot passes through (arc: extra jumps),
-- area = size multiplier. up = what each in-run level 2..8 adds, pathB = what each permanent rank of the second path adds.
-- A "stat" is dmg, cd, count, pierce, area, speed or dur; dmg, cd, area, speed and dur are fractions, count and pierce are whole numbers.
-- A sector's pool lists the enemies that can appear: { enemy file name, first second it can appear, weight }. The boss is entities/bosses/<name>.lua.

-- ---------------------------------------------------------------- pilots
-- mods: dmg/cd/area/xp/credits/magnet are fractions (0.1 = 10%); hp and spd multiply; regen is health a second.
local PILOTS = {
  { id = "nova",    name = "NOVA",    weapon = "pulse",   cost = 0,    blurb = "A steady all-rounder.",                  mods = {} },
  { id = "bulwark", name = "BULWARK", weapon = "shards",  cost = 250,  blurb = "Slow, tough, blades all around.",         mods = { hp = 1.4, spd = 0.9, armor = 1 } },
  { id = "zephyr",  name = "ZEPHYR",  weapon = "scatter", cost = 400,  blurb = "Fast and fuzzy. Dashes often.",           mods = { spd = 1.2, dashcd = -0.3 } },
  { id = "sparks",  name = "SPARKS",  weapon = "arc",     cost = 600,  blurb = "Charged up: weapons fire faster.",        mods = { cd = -0.12 } },
  { id = "gravis",  name = "GRAVIS",  weapon = "well",    cost = 800,  blurb = "Pulls in gems and enemies alike.",        mods = { magnet = 0.6, area = 0.15 } },
  { id = "mira",    name = "MIRA",    weapon = "missiles",cost = 1000, blurb = "A quick learner: more XP.",               mods = { xp = 0.2 } },
  { id = "vex",     name = "VEX",     weapon = "mines",   cost = 1300, blurb = "Scavenger. Finds extra credits.",         mods = { credits = 0.35 } },
  { id = "lancer",  name = "LANCER",  weapon = "lance",   cost = 1700, blurb = "Hits hard. Aim is everything.",           mods = { dmg = 0.15 } },
  { id = "halo",    name = "HALO",    weapon = "nova",    cost = 2200, blurb = "Slowly heals. Calm in a crowd.",          mods = { regen = 1, hp = 1.1 } },
  { id = "kuro",    name = "KURO",    weapon = "comet",   cost = 3000, blurb = "Shadow pilot. Gets one revive.",          mods = { revive = 1, dmg = 0.1, spd = 1.1 } },
}

-- ---------------------------------------------------------------- weapons
-- cd: seconds between shots. count: shots / blades / bolts. pierce: extra enemies a shot passes through (arc: extra jumps).
-- area: size multiplier. up: what each in-run level 2..8 adds. pathB: what each permanent rank of the second path adds.
-- A "stat" is dmg, cd, count, pierce, area, speed or dur; dmg, cd, area, speed and dur are fractions, count and pierce are whole numbers.
local WEAPONS = {
  pulse = { name = "PULSE BLASTER", icon = "w_pulse", blurb = "Rapid shots at the nearest enemy.", cd = 0.55, dmg = 9, count = 1, speed = 210, pierce = 0, area = 1,
    up = { {"dmg", .2}, {"cd", -.12}, {"count", 1}, {"pierce", 1}, {"dmg", .25}, {"count", 1}, {"cd", -.15} },
    pathB = { {"cd", -.05}, {"speed", .1}, {"pierce", 1}, {"cd", -.07}, {"count", 1} }, pathBname = "Rapid Fire" },
  shards = { name = "ORBIT BLADES", icon = "w_shards", blurb = "Blades that circle and slice.", cd = 0, dmg = 6, count = 2, speed = 1, pierce = 0, area = 1,
    up = { {"count", 1}, {"dmg", .2}, {"speed", .2}, {"area", .2}, {"count", 1}, {"dmg", .25}, {"count", 1} },
    pathB = { {"speed", .08}, {"area", .1}, {"speed", .08}, {"area", .1}, {"count", 1} }, pathBname = "Wide Orbit" },
  nova = { name = "PLASMA NOVA", icon = "w_nova", blurb = "A plasma ring that pushes back.", cd = 2.4, dmg = 14, count = 1, speed = 1, pierce = 0, area = 1,
    up = { {"dmg", .2}, {"area", .2}, {"cd", -.12}, {"dmg", .25}, {"area", .2}, {"cd", -.15}, {"count", 1} },
    pathB = { {"area", .08}, {"cd", -.06}, {"area", .08}, {"cd", -.06}, {"count", 1} }, pathBname = "Shockwave" },
  missiles = { name = "HOMING MISSILES", icon = "w_missiles", blurb = "Homing missiles that explode.", cd = 1.6, dmg = 16, count = 1, speed = 120, pierce = 0, area = 1,
    up = { {"count", 1}, {"dmg", .2}, {"cd", -.1}, {"area", .25}, {"count", 1}, {"dmg", .25}, {"count", 1} },
    pathB = { {"area", .1}, {"cd", -.05}, {"speed", .1}, {"area", .1}, {"count", 1} }, pathBname = "Warheads" },
  arc = { name = "ARC COIL", icon = "w_arc", blurb = "Lightning that chains enemies.", cd = 1.3, dmg = 12, count = 1, speed = 1, pierce = 2, area = 1,
    up = { {"pierce", 1}, {"dmg", .2}, {"count", 1}, {"cd", -.12}, {"pierce", 2}, {"dmg", .25}, {"count", 1} },
    pathB = { {"pierce", 1}, {"area", .1}, {"pierce", 1}, {"cd", -.07}, {"count", 1} }, pathBname = "Conductors" },
  lance = { name = "BEAM LANCE", icon = "w_lance", blurb = "A beam that pierces everything.", cd = 2.0, dmg = 20, count = 1, speed = 1, pierce = 99, area = 1,
    up = { {"dmg", .2}, {"count", 1}, {"area", .25}, {"cd", -.12}, {"dmg", .25}, {"count", 1}, {"cd", -.15} },
    pathB = { {"area", .1}, {"cd", -.05}, {"dur", .15}, {"cd", -.07}, {"count", 1} }, pathBname = "Focus Lens" },
  mines = { name = "MINE LAYER", icon = "w_mines", blurb = "Mines that blow up on contact.", cd = 1.8, dmg = 28, count = 1, speed = 1, pierce = 0, area = 1,
    up = { {"count", 1}, {"dmg", .2}, {"area", .2}, {"cd", -.12}, {"count", 1}, {"dmg", .25}, {"area", .25} },
    pathB = { {"cd", -.06}, {"area", .1}, {"dur", .25}, {"cd", -.06}, {"count", 1} }, pathBname = "Payload" },
  well = { name = "GRAVITY WELL", icon = "w_well", blurb = "A black hole that drags them in.", cd = 7, dmg = 6, count = 1, speed = 1, pierce = 0, area = 1,
    up = { {"area", .2}, {"dur", .2}, {"dmg", .25}, {"cd", -.12}, {"count", 1}, {"area", .2}, {"dmg", .25} },
    pathB = { {"dur", .1}, {"area", .1}, {"cd", -.06}, {"dur", .1}, {"count", 1} }, pathBname = "Event Horizon" },
  scatter = { name = "SCATTER CANNON", icon = "w_scatter", blurb = "A close-range blast of pellets.", cd = 1.1, dmg = 7, count = 5, speed = 190, pierce = 0, area = 1,
    up = { {"count", 1}, {"dmg", .2}, {"cd", -.12}, {"count", 2}, {"pierce", 1}, {"dmg", .25}, {"count", 2} },
    pathB = { {"count", 1}, {"cd", -.05}, {"speed", .1}, {"pierce", 1}, {"count", 2} }, pathBname = "Wide Choke" },
  comet = { name = "COMET STRIKE", cap = 8, icon = "w_comet", blurb = "Calls down comets on your enemies.", cd = 2.2, dmg = 30, count = 2, speed = 1, pierce = 0, area = 1,
    up = { {"count", 1}, {"dmg", .2}, {"area", .2}, {"cd", -.12}, {"count", 1}, {"dmg", .25}, {"area", .25} },
    pathB = { {"cd", -.05}, {"area", .1}, {"cd", -.06}, {"area", .1}, {"count", 1} }, pathBname = "Meteor Shower" },
}
local WEAPON_ORDER = { "pulse", "shards", "nova", "missiles", "arc", "lance", "mines", "well", "scatter", "comet" }
local WEAPON_PATH_A = { stat = "dmg", per = 0.10, name = "Overcharge" } -- every rank: +10% damage

-- ---------------------------------------------------------------- passives (picked while playing, up to 5 levels each)
local PASSIVES = {
  power   = { name = "POWER CELL",  icon = "p_power",   text = "+10% damage",           key = "dmg",     per = 0.10 },
  haste   = { name = "OVERCLOCK",   icon = "p_haste",   text = "-8% weapon cooldown",   key = "cd",      per = -0.08 },
  reach   = { name = "WIDE LENS",   icon = "p_reach",   text = "+10% area",             key = "area",    per = 0.10 },
  thrust  = { name = "THRUSTERS",   icon = "p_thrust",  text = "+7% move speed",        key = "spd",     per = 0.07 },
  plating = { name = "PLATING",     icon = "p_plating", text = "+15 max health",        key = "hp",      per = 15 },
  magnet  = { name = "TRACTOR",     icon = "p_magnet",  text = "+25% pickup range",     key = "magnet",  per = 0.25 },
  repair  = { name = "NANITES",     icon = "p_repair",  text = "+0.4 health a second",  key = "regen",   per = 0.4 },
  scholar = { name = "DATA CORE",   icon = "p_scholar", text = "+8% XP gained",         key = "xp",      per = 0.08 },
}
local PASSIVE_ORDER = { "power", "haste", "reach", "thrust", "plating", "magnet", "repair", "scholar" }

-- ---------------------------------------------------------------- ship upgrades (permanent, 4 paths x 5 ranks)
local SHIP_PATHS = {
  { id = "hull", name = "HULL", icon = "s_hull", cost = 80, ranks = {
    { "Reinforced Plating", "+20 max health", { hp_add = 20 } },
    { "Repair Nanites",     "+0.5 health a second", { regen = 0.5 } },
    { "Ablative Armor",     "Every hit hurts 1 less", { armor = 1 } },
    { "Bulkheads",          "+30 max health", { hp_add = 30 } },
    { "Phoenix Core",       "Revive once at half HP", { revive = 1 } } } },
  { id = "engine", name = "ENGINE", icon = "s_engine", cost = 70, ranks = {
    { "Ion Thrusters",  "+6% move speed", { spd_add = 0.06 } },
    { "Tractor Beam",   "+30% pickup range", { magnet = 0.3 } },
    { "Phase Dash",     "Dash recharges faster", { dashcd = -0.25 } },
    { "Afterburners",   "+6% move speed", { spd_add = 0.06 } },
    { "Warp Core",      "Safer, longer dashes", { dashinv = 0.15 } } } },
  { id = "tactics", name = "TACTICS", icon = "s_tactics", cost = 90, ranks = {
    { "Sharp Lenses",   "+5% damage", { dmg = 0.05 } },
    { "Overclock",      "-5% weapon cooldown", { cd = -0.05 } },
    { "Wide Optics",    "+8% area", { area = 0.08 } },
    { "Targeting AI",   "+7% damage", { dmg = 0.07 } },
    { "Supernova",      "+8% dmg, +1 first shot", { dmg = 0.08, startbonus = 1 } } } },
  { id = "salvage", name = "SALVAGE", icon = "s_salvage", cost = 75, ranks = {
    { "Scrap Magnet",   "+10% credits", { credits = 0.1 } },
    { "Data Cache",     "+10% XP gained", { xp = 0.1 } },
    { "Lucky Star",     "+1 reroll each run", { reroll = 1 } },
    { "Rich Veins",     "+15% credits", { credits = 0.15 } },
    { "Head Start",     "Start each run at LV3", { startlevel = 2 } } } },
}

-- ---------------------------------------------------------------- sectors (levels)
-- time: seconds before the boss arrives. pool: enemy, first second it can appear, weight.
local STAGES = {
  { name = "ASTEROID BELT",  bg = "belt",    music = "msc_s1", time = 600, boss = "rockking", hazard = "meteors",
    blurb = "Rocks, bugs and a grumpy king.",
    pool = { {"grub", 0, 5}, {"gnat", 15, 3}, {"rockling", 40, 2}, {"jelly", 60, 2}, {"boomer", 85, 2} } },
  { name = "ION NEBULA",     bg = "ion",     music = "msc_s2", time = 600, boss = "stormeye", hazard = "strikes",
    blurb = "Lightning and watchful eyes.",
    pool = { {"jelly", 0, 4}, {"gnat", 0, 3}, {"ringdrone", 15, 3}, {"saucer", 40, 2}, {"rammer", 60, 2}, {"sentinel", 95, 1} } },
  { name = "DEAD MOON",      bg = "moon",    music = "msc_s3", time = 600, boss = "lunarmaw", hazard = "none",
    blurb = "Old craters, hungry things.",
    pool = { {"grub", 0, 4}, {"amoeba", 8, 3}, {"rammer", 30, 2}, {"boomer", 50, 3}, {"leech", 70, 2}, {"golem", 105, 1} } },
  { name = "CRYSTAL REEF",   bg = "reef",    music = "msc_s4", time = 600, boss = "crystalmother", hazard = "strikes",
    blurb = "Beautiful, sharp and shielded.",
    pool = { {"gnat", 0, 4}, {"imp", 10, 3}, {"medic", 30, 2}, {"knight", 50, 2}, {"golem", 70, 2}, {"saucer", 90, 2} } },
  { name = "JUNKYARD",       bg = "junk",    music = "msc_s5", time = 600, boss = "scraptitan", hazard = "meteors",
    blurb = "Scrap, mines and gun turrets.",
    pool = { {"rockling", 0, 3}, {"minelayer", 10, 3}, {"hive", 35, 1}, {"sentinel", 60, 2}, {"knight", 80, 2}, {"boomer", 100, 2} } },
  { name = "PULSAR RIM",     bg = "pulsar",  music = "msc_s6", time = 600, boss = "pulsar", hazard = "meteors",
    blurb = "Fast things in the glare.",
    pool = { {"jelly", 0, 4}, {"comet", 10, 3}, {"wraith", 25, 3}, {"leech", 40, 3}, {"ringdrone", 55, 3}, {"reaper", 130, 1} } },
  { name = "HIVE MOON",      bg = "hive",    music = "msc_s7", time = 600, boss = "hivequeen", hazard = "none",
    blurb = "The nest is awake.",
    pool = { {"gnat", 0, 5}, {"hive", 10, 2}, {"spore", 30, 2}, {"amoeba", 50, 3}, {"leech", 60, 3}, {"medic", 80, 2} } },
  { name = "EVENT HORIZON",  bg = "horizon", music = "msc_s8", time = 600, boss = "horizon", hazard = "pull",
    blurb = "Everything falls inward.",
    pool = { {"imp", 0, 4}, {"vortex", 10, 2}, {"wraith", 25, 3}, {"spore", 55, 2}, {"sniper", 80, 2}, {"reaper", 120, 2} } },
  { name = "DARK FLEET",     bg = "fleet",   music = "msc_s9", time = 600, boss = "dread", hazard = "strikes",
    blurb = "An armada, all aimed at you.",
    pool = { {"rammer", 0, 4}, {"saucer", 10, 3}, {"knight", 30, 3}, {"sniper", 45, 2}, {"sentinel", 70, 2}, {"reaper", 100, 2}, {"minelayer", 120, 2} } },
  { name = "THE CORE",       bg = "core",    music = "msc_s10", time = 600, boss = "voidheart", hazard = "strikes",
    blurb = "The heart of the swarm.",
    pool = { {"grub", 0, 4}, {"imp", 12, 3}, {"wraith", 25, 3}, {"knight", 40, 3}, {"golem", 55, 2}, {"vortex", 70, 2}, {"sniper", 85, 2}, {"reaper", 100, 3}, {"hive", 120, 1}, {"spore", 140, 2} } },
}

-- Every sector lasts 15 minutes: the boss arrives at the 10 minute mark (`time`). The pools above were written for a few minutes; stretch them.
for _, st in ipairs(STAGES) do for _, p in ipairs(st.pool) do p[2] = math.floor(p[2] * 3.5) end end
return {
  PILOTS = PILOTS, WEAPONS = WEAPONS, WEAPON_ORDER = WEAPON_ORDER, WEAPON_PATH_A = WEAPON_PATH_A,
  PASSIVES = PASSIVES, PASSIVE_ORDER = PASSIVE_ORDER, SHIP_PATHS = SHIP_PATHS, STAGES = STAGES,
}
