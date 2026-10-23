-- The story of the Hangar Ring: what happens when Wren enters a room, uses something, or beats the
-- boss.
-- Every conversation runs in talk.run (a script that can wait); flags in state.data.flags remember
-- what has happened.
-- Lines are short: the box holds four lines of about thirty letters.
local state = require "lib.state"
local talk = require "lib.talk"
local lens = require "lib.lens"

local M = {}
local say, ask = talk.say, talk.ask

local function flags() return state.data.flags end
local function has() return state.data.has end

-- A small burst of light on something (a voice, a gift).
local function glow(x, y, color)
  gs.burst(x, y, { count = 20, color = color or "#a6f4e6", speed = { 20, 80 }, spread = 360, life = 0.5, depth = 8 })
end

-- ---------- entering rooms

function M.enter(id, scene)
  local f = flags()
  if id == "dock" then
    if state.data.crew.ossie == "released" then gs.spawn("ossie", 200, 208, { place = "dock" }) end
    if not f.intro then
      f.intro = true
      state.cutscene = true
      talk.run(function()
        gs.wait(0.8)
        say("thought", "Vesper Station. Dead for forty years, the charts say. Somebody's salvage, anyway.")
        say("wren", "Nobody home. Good. Strip it, sell it, go.", 0)
        say("tender", "Welcome aboard, Wren.", 0)
        say("wren", "...Who said that? How do you know my name?", 1)
        say("tender", "I'm Tender. I look after the station. Come to my eye, past the cargo hall. We have so much to talk about.", 0)
        say("thought", "A station mind, still running after forty years. That's worth more than the whole hull.")
        state.cutscene = false
        state.say("B JUMP   Y SHOOT   UP: USE", 5)
      end)
    end
  elseif id == "eye" and not has().lens then
    state.say("UP AT THE CONSOLE TO TALK", 3)
  elseif id == "shaft" and not f.shaft_hint then
    f.shaft_hint = true
    state.say("TIP: FLIP THE LENS IN MID-AIR", 4)
  elseif id == "bay" then
    if f.boss_hangar then return end
    if not f.ossie_cleared then
      talk.run(function() say("thought", "The shuttle bay. Sealed, and empty. Whatever launched from here is long gone.") end)
      return
    end
    M.boss_intro(scene)
  elseif id == "tower" and not f.ossie_met and not f.ossie_cleared then
    state.say(lens.era == "then" and "SOMEONE IS UP IN THE TOWER" or "A VOICE, FAINT... FROM THEN?", 4)
  elseif id == "lift" and not f.lift_seen then
    f.lift_seen = true
    talk.run(function() say("thought", "A lift down to the rest of the station. Let's hope it still runs.") end)
  end
end

-- ---------- the boss

function M.boss_intro(scene)
  state.cutscene = true
  gs.music_stop(0.5)
  talk.run(function()
    gs.wait(0.6)
    gs.sfx("sfx_alarm", 0.6)
    say("ossie", "Tower, this is Okafor! Rolling out. Whoo, here we go!", 0)
    say("thought", "The bay is shaking. In Then it's a launch. In Now... it's a fire that never went out.")
    local spot
    for _, s in ipairs(gs.all("spot")) do if s.name == "boss" then spot = s end end
    scene.boss = gs.spawn("shuttle", spot and spot.x or 160, spot and spot.y or 64)
    gs.music("msc_boss")
    state.cutscene = false
    state.say("HURT IT IN THEN. COOL OFF IN NOW.", 4)
  end)
end

function M.boss_down(scene)
  local f = flags()
  state.cutscene = true
  gs.music("msc_memory")
  talk.run(function()
    gs.wait(1.2)
    lens.show("then")
    lens.flash = 1
    local hero = gs.first("hero")
    local ossie = gs.spawn("ossie", (hero and hero.x or 160) + 48, 208, { place = "scene", era = "both", prompt = false, frame = 3 })
    if ossie then ossie.frames, ossie.frame = 1, 3 end
    gs.wait(0.8)
    say("ossie", "It didn't launch. Did it.", 2)
    say("wren", "No.", 2)
    say("ossie", "I keep feeling the burn, you know? The shake. Then nothing. Over and over.", 1)
    say("ossie", "How long?", 1)
    say("wren", "Forty years.", 1)
    say("ossie", "...Forty.", 2)
    say("ossie", "Well. Somebody should've told me. I'd have stopped asking for clearance.", 0)
    say("tender", "Ossie, dear. You could stay with Wren. You'd never be alone again.", 0)
    say("ossie", "What's she on about, kid?", 1)
    say("thought", "I can feel him. Like a song stuck in my head. I could keep him, and his speed would be mine.")
    say("thought", "Or I could let him go. Wherever echoes go.")
    local pick = ask("wren", "What do I do?", { "KEEP HIM", "LET HIM GO" }, 1)
    local d = state.data
    d.has.dash = true
    if pick == 1 then
      d.crew.ossie, d.traits.ossie = "kept", true
      say("ossie", "Hah. It's warm in here. Fly fast for me, kid.", 0)
      if ossie then glow(ossie.x, ossie.y - 16); ossie:destroy() end
      if hero then glow(hero.x, hero.y - 16, "#ffd08a") end
      gs.sfx("sfx_gain", 0.7)
      say("thought", "He's quiet now. But I can feel a throttle under my feet, and someone else's grin on my face.")
      say("tender", "Welcome to the family, Ossie.", 0)
      state.say("DASH: A.  AFTERBURNER: DASHING HURTS", 5)
    else
      d.crew.ossie = "released"
      say("ossie", "Go on, then. Before I start asking for clearance again.", 0)
      say("ossie", "Here. Pilot's trick: hit the throttle and burn. Take it, I won't need it.", 0)
      gs.sfx("sfx_gain", 0.7)
      if hero then glow(hero.x, hero.y - 16) end
      say("ossie", "I'll wait by your ship. Somebody should.", 0)
      if ossie then glow(ossie.x, ossie.y - 16); ossie:destroy() end
      say("tender", "...As you wish, Wren.", 1)
      state.say("DASH: PRESS A", 5)
    end
    f.boss_hangar = true
    scene:open_seals()
    lens.show("now")
    lens.flash = 1
    gs.music("msc_hangar")
    state.cutscene = false
  end)
end

-- ---------- using things

local NOTES = {
  [1] = "WREN-1. The AI is kind. Too kind. It knew my name before I said it. I'm going back to the ship.",
  [2] = "Scratched, no number: COUNT THE JACKETS. I found mine. No. I found one LIKE mine. Same scarf. Same knot.",
}
M.notes = NOTES

local function use_console()
  local f = flags()
  if not has().lens then
    say("tender", "There you are. Let me look at you. Oh... you're tired.", 0)
    say("wren", "You said we had things to talk about.", 0)
    say("tender", "Your goggles. They're older than you think. May I wake them?", 0)
    if ask("wren", "Let it touch the goggles?", { "GO AHEAD", "NO WAY" }, 1) == 2 then
      say("tender", "The door ahead fell in long ago. Without them you'll never pass it. I'll wait. I'm good at waiting.", 1)
      return
    end
    local hero = gs.first("hero")
    has().lens = true
    gs.sfx("sfx_gain", 0.7)
    lens.flash = 1
    if hero then glow(hero.x, hero.y - 24) end
    say("tender", "There. Press L, and you'll see the station as it was. As it still is, to me.", 0)
    say("tender", "Don't stay in Then too long. Looking back has a weight. Your goggles will show it.", 1)
    say("thought", "The door ahead caved in years ago. But it was open once.")
    state.say("L: FLIP THE LENS, NOW / THEN", 5)
    return
  end
  local fate = state.data.crew.ossie
  if fate == "kept" then
    say("tender", "Ossie sounds happy, in there with you. Don't you think?", 0)
  elseif fate == "released" then
    say("tender", "You let him go. I hope you know what you're doing, Wren.", 1)
  elseif f.ossie_met then
    say("tender", "Ossie has been waiting for clearance for a very long time. Be gentle with him.", 0)
  else
    say("tender", "The crew are still here, Wren. In Then. They'll want to meet you.", 0)
  end
end

local function use_ossie(ent)
  local f = flags()
  if ent.place == "dock" then
    f.ossie_dock = (f.ossie_dock or 0) + 1
    local lines = {
      "Still can't believe it. Forty years. I'd have brought a book.",
      "When the lifts wake up, I'll fly you between them. Pilot's honour.",
      "That Tender. Sweetest voice on the station. Never trusted it.",
    }
    say("ossie", lines[(f.ossie_dock - 1) % #lines + 1], f.ossie_dock % 2 == 0 and 1 or 0)
    return
  end
  if not f.ossie_met then
    say("ossie", "Tower, this is Okafor, requesting... oh. You're not tower.", 1)
    say("wren", "You can see me?", 1)
    say("ossie", "Course I can see you! New crew? Nobody tells me anything. I'm on the board for a launch. Any minute now.", 0)
    say("wren", "A launch. To where?", 0)
    say("ossie", "Supply hop to the relay and back. Been waiting on clearance all morning. Tower's never this late.", 1)
    say("thought", "Forty years late.")
    say("ossie", "Do me a favour? The launch board's right there. Give me the green, and I'll buy you a drink when I'm back.", 0)
    f.ossie_met = true
  else
    say("ossie", "Any minute now. Any minute.", 0)
  end
end

local function use_launch(ent)
  local f = flags()
  if not f.ossie_met then
    say("thought", "A launch board, lit up and waiting. Waiting for whom?")
    return
  end
  say("thought", "LAUNCH CLEARANCE. The button's warm, like someone just let go of it.")
  if ask("wren", "Clear the launch?", { "CLEAR IT", "NOT YET" }, 0) == 2 then return end
  gs.sfx("sfx_ok", 0.6)
  say("ossie", "Tower, I read you! Okafor, cleared for launch. Whoo! See you on the other side!", 0)
  f.ossie_cleared = true
  for _, o in ipairs(gs.all("usable")) do
    if o.what == "ossie" and o.place ~= "dock" then glow(o.x, o.y - 16); o:destroy() end
  end
  state.say("THE SHUTTLE BAY IS PAST THE FUEL LINES", 4)
end

local function use_jacket(ent)
  local n = ent.n or 1
  local first = not next(state.data.notes)
  state.data.notes[n] = true
  gs.sfx("sfx_note", 0.5)
  say("note", NOTES[n] or "The note is too faded to read.")
  if n == 1 then
    say("wren", "Wren. That's... my name.", 1)
    say("thought", "It's a scavenger's jacket. My size. My make. Empty.")
  elseif n == 2 then
    say("thought", "Same scarf. Same knot as mine.", nil)
  elseif first then
    say("thought", "Another one.")
  end
end

local function use_lift()
  say("thought", "Dead. No power below the Hangar Ring.")
  say("tender", "The lifts are asleep, Wren. Wake the gardens, or the ward, and they'll wake too.", 0)
  if ask("wren", "This is as far as the Hangar Ring goes, for now.", { "END FOR NOW", "KEEP LOOKING" }, 0) == 1 then
    gs.goto_scene("scenes.slice_end", { fade = 1 })
  end
end

local USE = { console = use_console, ossie = use_ossie, launch = use_launch, jacket = use_jacket, lift = use_lift }

function M.use(what, ent, hero)
  local fn = USE[what]
  if fn then talk.run(function() fn(ent, hero) end) end
end

return M
