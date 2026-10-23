# Three Days in Hollin: the plan for a 4-6 hour time-loop RPG

A design for a story-driven RPG built around a three-day time loop in one mountain town, for the Dot handheld (320x240, D-pad,
A B X Y, L R, Start, Select). It covers the hook, the story, the people and their schedules, the loop rules, the battles, the
dungeons, the endings, the look, the sound, how it is built and the order to build it in. Nothing here is built yet. The cart will
be `carts/hollin`.

## The pitch in one line

**An avalanche buries Hollin on the third night, and you wake up on the first morning again.** Your levels and items reset each
loop; what you *know* stays. The game is about learning one small town by heart, until you can save everyone in it in a single
three days.

What makes it its own game:

1. **Knowledge is the experience points.** Facts you learn are written in your **Journal** as **Knowings** ("Jory owes money to
   the Stranger", "frost wolves flee from bells"). Knowings persist through loops, and many of them unlock things: a new line to say,
   a door code, a battle technique, a shortcut.
2. **A town on a clock.** Twelve people with their own day plans, hour by hour, across three days. You can follow anyone, and what
   they do changes depending on what you did.
3. **Short, hard battles you win by knowing.** Enemies start as "???" with hidden weaknesses. Every weakness you discover is a
   Knowing, so a fight that was hopeless in loop one is a two-turn win in loop five.
4. **Someone else remembers too.** The Stranger, a travelling salesman, has been looping for two hundred loops and gave up long ago.
   He teaches, lies, bargains and is the closest thing to a rival.

## Story

**Setting.** Hollin, a mining town of about sixty people in a high valley under the peak called the Old Woman. The pass closes in
winter. This year the first snow is late and very heavy.

**You.** **Wyn Tarrow**, apprentice to the Royal Survey, arrives on the evening coach to map the pass before winter. Wyn is curious,
polite, a little stubborn, and good with a compass and a sling.

**What happens if you do nothing.** Day 1: Wyn arrives, finds the inn full of miners, meets the town. Day 2: a festival for the
first snow; the mine owner announces a new seam. Day 3: the foreman blasts the new seam at night, against the old miners' warnings.
At 23:40 the snowfield above the town gives way. The screen goes white. Wyn wakes on the coach at 06:00 on Day 1.

**Why the loop happens (learned slowly).** Forty years ago a girl named **Elsa**, the weaver Orla's daughter, was lost in the old
mine during another avalanche. Her spirit became part of the mountain (the town calls it *the Hollow*). The Hollow cannot stop the
snow, but it can hold time, and it has been looping these three days, choosing someone new each time, hoping someone will finally
bring her mother up to the Peak Shrine where she is. Wyn is the latest. The Stranger was the last one; he failed because he only
tried to stop the avalanche.

**The three things to save.** Each is a chain of Knowings and people's help:

1. **The town** (the avalanche): stop the blast. Expose the forged safety report, get the foreman to refuse, or ruin the charges.
2. **The people** (who dies or is lost on Day 3): evacuate the inn and the lower street, get the doctor to the right house, bring
   the hunter home.
3. **The Hollow** (the reason for the loop): take Orla up to the Peak Shrine on Day 3, through the Ice Caves, with the bell.

**Endings.**

- **Morning** (the best): all three in one loop. Snow falls softly, no avalanche, Orla and Elsa meet; the loop ends.
- **Thaw:** town and people saved, Hollow not. The loop ends, but Wyn hears a girl singing in the mine as the coach leaves.
- **Buried:** you choose to leave on the Day 3 coach. The loop ends without you; the Stranger stays.
- And any loop that ends normally is a quiet reset, never a failure screen: the town is waiting.

Tone: cosy and eerie, like a snowed-in winter story. Sad in places, **never grim**: no bodies, no gore. People caught in the
avalanche "are not found"; the screen fades to white.

## The people

Each has a schedule over three days (where they are each hour), a secret, a Knowing chain, and a change in their schedule when you
interfere. Twelve is the right size for a handheld: you can learn them all.

| Who | Who they are | Secret | Part in the endings |
| --- | --- | --- | --- |
| **Orla** (78) | The weaver, sharp and quiet | She hears Elsa in the wind and has never told anyone | Must be brought to the Shrine on Day 3 (Hollow) |
| **Aldous Crane** (50) | Mine owner, broke and proud | He forged the safety report for the new seam | Persuaded or exposed (town) |
| **Bettany Crane** (19) | His daughter, wants to leave on the coach | She knows where the report is kept | Gives you the report if you help her leave |
| **Jory Pike** (40) | The foreman who blasts on Day 3 | Gambling debt to the Stranger | Refuses to blast if his debt is cleared (town) |
| **Mags** (55) | Innkeeper | Was Elsa's best friend as a girl | Evacuates the inn if she believes you (people) |
| **Pastor Hale** (60) | Keeps the town bell and the shrine key | Has the Shrine's old bell, hidden | Gives you the bell (Hollow) and rings the alarm (people) |
| **Dr. Sefa** (35) | Town doctor, new here | Is out on a house call at the worst moment | Must be at the lower street at 23:00 (people) |
| **Rook** (30) | Hunter who knows the mountain | Goes up the trail on Day 3 and is lost | Brought home; teaches the trail to the Shrine |
| **Kit** (9) | A child who sees the Hollow | Leaves cakes at the mine for "the snow girl" | Shows you where Elsa was lost; never fights |
| **Dunn** (45) | Postman | Has a forty-year-old undelivered letter from Elsa to Orla | The letter convinces Orla to climb |
| **Ma and Pa Ebbe** | Bakers on the lower street | Will not leave the bread oven | Evacuated only after Mags or the bell (people) |
| **The Stranger** (?) | Travelling salesman, also loops | Has been looping 200 loops; his name was Teodor | Sells loop-proof items; may help or hinder |

Party members (one at a time, depending on who you befriended in this loop): **Rook** (bow, fast), **Bettany** (rapier, steals),
**Jory** (pick, strong), **Teodor** (late game, cane, knows everything but is tired). The companion's own story moves on each time
they fight with you.

## The loop rules

- **Clock.** Each day runs 06:00 to 24:00. One in-game hour is 40 real seconds, so a day is 12 minutes and a loop at most
  36 minutes. The clock stops while talking, in menus and in battles. A clock face sits in the corner of the screen.
- **Ending a loop.** At 23:40 on Day 3 (the avalanche), or any time by ringing the **shrine bell stone** in the chapel yard. The
  first loop always runs to the avalanche, so the player sees why.
- **Waiting.** Sit on any bench to skip to the next hour, or to a chosen hour. This keeps "being in the right place" from becoming
  boredom.
- **What carries over:** the Journal (Knowings, people's schedules you have seen, the map), Wyn's techniques (battle skills from
  Knowings), the **Survey compass** (the one item), and **charms** bought from the Stranger (loop-proof, few).
- **What resets:** levels, money, items, the people's memory of you, and everything they did.
- **Levels inside a loop.** Wyn starts each loop at level 1 and can reach level 5 within one; most of the power comes from Knowings.
- **The Journal** has three pages: **People** (a row per person, filled hour by hour as you see them: "Day 2, 14:00, Jory at the
  Rusty Lamp"), **Knowings** (the list, grouped by the three things to save), **Bestiary** (weaknesses found).

## Battles

Battles are short (two to five turns), and come from visible enemies in the mine, the woods, the Ice Caves and the Peak trail. The
town itself has none, except one brawl.

- **Turn order you can see and bend.** A bar at the top shows the next eight turns (like FFX). Fast actions push your next turn
  sooner; heavy actions push it later; some skills push an enemy back. Planning the bar is the main skill.
- **Two on the field:** Wyn and the companion. Commands: **Attack, Technique, Item, Guard, Flee** (always allowed; fleeing costs half an hour).
- **Hidden weaknesses.** Each enemy has two weaknesses among five kinds (**Edge, Blunt, Fire, Cold, Sound**). Unknown, they show "?".
  Hitting one reveals it for good (a Knowing). Hitting a weakness **staggers** the enemy, pushing it far back on the turn bar.
- **Techniques from Knowings.** Examples: *Bell Strike* (Sound, from "frost wolves flee from bells"), *Lamp Oil* (Fire, from "the
  miners keep oil by the north shaft"), *Rook's Snare* (from walking the trail with Rook), *Read the Snow* (see the next 12 turns).
- **Numbers** stay tiny: health 12-80 for Wyn, damage in single and low double digits.
- Enemies: around 16 kinds (rock beetle, mine rat, frost wolf, snow hare (harmless, runs), ice wisp, the Hollowed (old miners'
  echoes, sad and slow), avalanche wraith, cave bat, Crane's hired men in the one brawl), and 4 bosses (the Old Engine in the mine,
  the Wolf Mother on the trail, the Ice Heart in the caves, the Hollow at the Shrine, which is not fought but calmed: you break its
  turn bar with Sound until Orla can reach her).

## Places

- **The town** is one map, about 60x40 tiles of 16 pixels (960x640): the coach road, the square, the inn, the chapel, the mine
  office, the lower street, the bakery, the doctor, the post office, Orla's cottage, the woods' edge. About 12 small interiors.
- **The Old Mine** (open from Day 1): five levels, the new seam on the lowest; where Elsa was lost.
- **The Trail and the Woods** (Day 2 on, with Rook or the map Knowing): the hunter's hut, the wolf den.
- **The Ice Caves** (Day 3 only, after a tremor at 15:00 opens them): the only way to the Peak with Orla, who is slow (escort, but
  short and with her own comments).
- **The Peak Shrine**: the end.
- **Day and night:** the fixed palette has no tint, so evening and night are a see-through dark rectangle over the map
  (`"#rrggbbaa"` colours) with lit-window sprites above it, plus a night tileset for snowfall if needed. Snow falls harder each day
  (particles through `gs.burst`, within Dot's 300).

## Look

- Dot's fixed palette: snow whites and blues, warm lamp oranges, dark pine greens.
- **Field sprites** 16x24, 4-way, 4-frame walk, for Wyn and all twelve people (each person must be easy to tell apart at a
  glance: colour of coat and hat).
- **Battle sprites** 32x32 (Wyn, companions, enemies), bosses 48x48 or 64x64.
- **Portraits** 48x48 for every one of the twelve, two faces each (normal, upset), Wyn with three.
- The **clock face** and the **Journal** are the most-seen screens: give them care. Read `help('art')` and `help('sizes')` first.

## Dialogue

- `gs.say` / `gs.ask` from `engine/gs/talk.lua`, with a portrait slot in the layout. Two lines of about 36 characters a page.
- Each person's talk is a function of (day, hour, flags, Knowings) in `lib/people/<name>.lua`. They react to what you know: having
  a Knowing adds a choice in `gs.ask` marked with a small journal icon ("Ask about the report").
- People notice if you know too much: a few lines exist only for when you say something you could not know ("How do you know my
  sister's name?"). This sells the loop.

## Sound

- General MIDI, 4 music tracks, 4 sound channels. Read `help('music')` first.
- **One town theme in three versions:** Day 1 (bright, celesta and strings), Day 2 (festival, fiddle and accordion), Day 3 (the same
  tune slow, in minor, with a low drone). The music tells you which day it is.
- Night versions of each (sparser), the mine, the woods, the caves, battle, boss, the Stranger's theme (a music box), the Hollow
  (a girl's voice pad), and the morning ending (Day 1's theme, full).
- Sound effects: the clock chiming each hour (soft), the Journal writing a Knowing (a pen scratch, the most rewarding sound in the
  game), footsteps in snow, the bell.

## How it is built (technically)

- **Scenes:** `title`, `town` and `place` (field code; maps are layouts with `code = "field"`: `scenes/maps/town.layout.lua`,
  `scenes/maps/mine_<n>.layout.lua`, ...), `battle`, `journal`, `ending`.
- **Clock:** `lib/clock.lua` (day, minute, stop and go, skip to hour); pure, no drawing.
- **Schedules are data:** `lib/schedule.lua` lists every person's plan as rows `{ day, from, to, place, x, y, doing }`, plus
  overrides keyed by flags (`if flags.jory_debt_paid then ...`). `lib/people.lua` places people on the current map from the
  schedule and walks them between spots along paths.
- **Knowings are data:** `lib/knowings.lua` (`id`, text, group, what it unlocks). Learning one: `knowings.learn(id)` writes it,
  plays the pen sound and shows a small banner.
- **Events:** `lib/events.lua`: timed world events (the festival, the tremor, the blast, the avalanche) with their conditions.
- **Battle rules are pure:** `lib/battle.lua` (turn bar, weaknesses, stagger, techniques), no drawing, same seed same fight.
- **State:** two parts in one `gs.save` table: `persist` (Journal, Knowings, techniques, charms, endings seen, loop count) and
  `loop` (time, flags, levels, items, where people are), saved at the inn's guest book or the owl statue on the trail.
- **Tests and bots:** `GS_SELFTEST=1` checks every person has exactly one place at every minute of all three days, every Knowing
  can be reached, every map door has a partner, and runs a **route bot** that plays the best-ending route in one loop from a save
  with all the needed Knowings and reaches the Morning ending before 23:40; it prints `HOLLIN TEST PASS`. Shortcuts in
  `lib/debug.lua`: `GS_DAY`, `GS_HOUR`, `GS_MAP`, `GS_KNOW=all|id,id`, `GS_BATTLE=<encounter>`, `GS_SCREEN=journal|clock`.
- **Assets** from `scripts/make-hollin.mjs` (art in `scripts/hollin/*.mjs`, maps in `scripts/hollin/maps.mjs`); never touches code
  or `meta/info.json`.
- **Budget:** the town map holds 12 people plus props, well under Dot's limits; snow particles capped at about 120.

## Order of work

1. **The loop core** in grey boxes: the town map, the clock, three people with full schedules, the Journal with Knowings, the
   avalanche and the reset, benches to wait, saving.
2. **The battle core:** the turn bar, weaknesses and stagger, three enemies, two techniques from Knowings, one companion.
3. **Vertical slice:** all twelve people with Day 1 schedules and talk, the Old Mine's first two levels, the Stranger's first scene,
   and one complete small chain (Bettany and the report). Final art for the town. **Stop here** for a playtest on the handheld: is
   the clock too fast, is the Journal readable, do people feel alive.
4. Days 2 and 3 for everyone, the festival, the brawl, the rest of the mine, the town and people chains.
5. The trail, the Ice Caves, Orla's climb, the Shrine, the Hollow, the endings.
6. Polish: lines for knowing too much, the Stranger's arc, balance, music, speed on the handheld, title and credits.

## Building it alongside the other games

Several sessions build different games at the same time, so keep to this game's own files:

- Everything lives in `carts/hollin/`, `scripts/make-hollin.mjs` and `scripts/hollin/`.
- **Do not change the engine** (`engine/`, `runtime/`) or the studio. If the game truly needs something the engine lacks, first look
  for a way in the cart's `lib/`; if there is none, make the engine change small, additive and tested, in a commit of its own, and
  say so in the commit message, since other sessions may need to merge it.
- Shared files get only one added line each, at the end of the work: a row in `carts/AGENTS.md`, the cart in `tests/run.sh`, an
  item in `TODO.md`.

## Open questions (decide in the first playtest)

- 40 seconds an hour: too fast for reading, too slow for waiting? Benches help; tune on the device.
- Should the first loop be shorter (end at Day 2 night) so players reach the reset sooner?
- How many Knowings in all: about 60 feels right (5 per person, the rest from places and fights).
