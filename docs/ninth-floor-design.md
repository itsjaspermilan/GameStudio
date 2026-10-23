# Keeper of the Ninth Floor: the plan for a 4-6 hour reverse RPG

A design for an RPG played from the dungeon's side: you build the floors, raise the monsters and fight the heroes who raid you,
for the Dot handheld (320x240, D-pad, A B X Y, L R, Start, Select). It covers the hook, the story, the monsters, building a floor,
a raid, the battles, the heroes, the seasons, the look, the sound, how it is built and the order to build it in. Nothing here is
built yet. The cart will be `carts/ninth-floor`.

## The pitch in one line

**You are the monsters.** Heroes keep raiding your dungeon to take its heart. You lay out the rooms, place the monsters and traps,
raise and talk with your creatures, and command them in turn-based battles against the classic RPG party, until you learn why
the heroes are really being sent.

What makes it its own game:

1. **Two halves that feed each other.** **Build** (between raids): lay out rooms on a floor grid, place monsters and traps with a
   budget, raise monsters. **Defend** (a raid): watch the hero party walk through your floor, and fight every room they enter in a
   turn-based battle where you command the monsters.
2. **The heroes play like RPG heroes.** They heal when hurt, the mage hits everyone, the thief opens your chests, they rest at a
   campfire between rooms and go back to town to level up when beaten. You are playing against the habits every RPG player knows,
   and exploiting them is the fun (put a mirror slime where the mage always opens with fire).
3. **Win by making them leave.** Heroes are not killed: they **flee** when their courage breaks (a party's morale bar), knocked out
   heroes are carried out by the others. Your monsters **faint** and are back next raid. Courage is the real target: scary rooms,
   traps, surprise and stolen supplies break it as well as damage does.
4. **The heroes are people too.** Each raid party has names, banter and grudges, and comes back stronger. Over the seasons you can
   learn who they are, spare them, scare them home for good, or turn them.

## Story

**Setting.** The Ninth Floor is the deepest floor of the Hollowmount dungeon, around the **Heart**: a warm, slow-beating crystal that
keeps the mountain alive (and, it turns out, the valley's crops growing). The floors above are long abandoned. The old Keeper, a
huge ancient dragon called **Grandmother Ash**, has just died of old age.

**You.** **Mossy**, a small, clever slime who was Grandmother Ash's helper, becomes the new Keeper because the Heart chose them. Mossy
has never fought anything. The monsters of the Ninth Floor (about a dozen to start) are unsure about a slime in charge.

**The heroes.** **King Aurel** of the valley sends heroes "to slay the evil in the mountain and bring back its treasure". The first
parties are eager young adventurers; later ones are veterans; the last are the King's own champions.

**What is going on (learned slowly).** The valley's harvests are failing because Aurel has been draining the mountain's streams for
his gold mines. His advisor tells him the Heart could power the mines forever. The heroes are mostly poor kids promised land and
gold. Taking the Heart would kill the mountain *and* the valley's fields: the King does not believe it.

**Acts by season.**

- **Spring (raids 1-5):** learning to build and fight; the monsters start trusting Mossy; the first heroes are a joke and then not.
- **Summer (raids 6-10):** veteran parties; you learn about the valley through a captured, chatty bard (**Linnet**), who stays
  as a prisoner-turned-guest and tells you what heroes say in town.
- **Autumn (raids 11-15):** the **hero you keep scaring off**, **Sir Garret**, a stubborn young knight, comes back every season;
  you can talk to him after a defeat. The King's champions arrive.
- **Winter (raids 16-20):** the King comes himself, with his advisor and the champions. The final raid uses every floor.

**Endings.**

- **The Mountain Holds:** the King's last raid fails. The Heart is safe; the valley keeps starving; Mossy is a feared Keeper.
- **The Valley Wakes** (the good one): you spare and send home enough heroes, turn Garret and Linnet, and in the last raid break the
  advisor's courage, not the King's. The King sees the Heart and the streams; the mines close; heroes visit as guests.
- **The Heart Moves:** if the Heart's health hits zero in the last raid, Mossy carries it deeper and the floors collapse behind; a
  bittersweet ending, the game is still "won".

Tone: funny, warm, a little sad, in the vein of a Saturday-morning cartoon. **No killing and no gore**: heroes flee or are carried
off, monsters faint.

## The monsters

About 20 kinds, each with a role, two or three moves, a personality and a line of talk per season. You start with six kinds and
recruit more (by sparing wild ones on the upper floors, by hatching, by visitors).

| Kind | Role | Signature move | Personality |
| --- | --- | --- | --- |
| **Slime** (incl. Mossy) | Cheap blocker | **Split** into two small slimes when hit hard | Cheerful |
| **Goblin** | Fast hitter, steals | **Pilfer** a hero's potion | Greedy, loyal if fed |
| **Bat swarm** | Dodgy, drains | **Screech** lowers courage | Gossips |
| **Skeleton** | Sturdy, comes back | **Reassemble** once per battle | Formal, polite |
| **Mimic** | Trap and bruiser | **Surprise!** (first turn free if a hero opened it) | Shy |
| **Mirror slime** | Reflects magic | **Mirror** the next spell back | Vain |
| **Mushroom folk** | Healers | **Spores** heal monsters, sleep heroes | Sleepy |
| **Ogre** | Big, slow, scary | **Roar** (big courage hit) | Gentle; loves flowers |
| **Gargoyle** | Wall, hard to hurt | **Stone** (cannot act, takes almost no damage) | Grumpy |
| **Will-o-wisp** | Lures | **Lure** pulls the healer away from the party | Mischievous |
| **Wyrmling** | Late, strong | **Ember breath** on all heroes | Grandmother Ash's last egg; hatches in autumn |

Monsters have levels (1-15), gain experience in raids, learn a third move at level 8, and have **Mood** (0-5): happy monsters
fight better; mood goes up with food, rest, talks and wins, down with being fainted often or placed in rooms they hate (an ogre in
a cramped room). Each kind has a small likes/dislikes list.

## Building a floor

- **The floor grid:** each floor is a 5x4 grid of room slots, shown on one screen (each slot a 48x40 cell). Heroes enter at the top
  stairs; the Heart (on the Ninth) or the stairs down (on upper floors, opened in later seasons) is the goal.
- **Rooms:** dig rooms in slots and connect them with corridors (the path matters: heroes take the shortest unexplored path, a
  rule shown to the player). Room kinds: **plain**, **narrow** (only two heroes can fight at once), **dark** (accuracy down), **flooded**
  (slow), **treasure** (the thief always goes there first: bait), **nest** (monsters there heal between battles), **shrine** (the
  heroes' campfire spot: they will always rest there; trap it).
- **Placing:** each room holds up to three monsters and one trap. A **Dread** budget (grows each season) limits the total.
- **Traps:** pit (removes one hero for a battle), alarm (the next room's monsters get a free turn), gas (poison), cage door (splits
  the party for one room), fake treasure (courage down when opened).
- **Floors unlocked over seasons:** the Ninth only in spring, then the Eighth, Seventh and Sixth (four floors by winter), so the
  last raids are long.
- **A preview:** before a raid, the scouting bat reports the party (classes, levels, gear), so you can rebuild to counter them.

## A raid

- The raid map shows the floor grid and the party's marker moving room to room (a step per second, faster with R held). The heroes'
  courage bar and the Heart's health are at the top.
- Entering a room with monsters starts a **battle**. Empty rooms with traps play the trap. The shrine room: the heroes rest
  (heal half) and you see their banter.
- Heroes **flee** when courage hits zero (the raid is won), or **go back** when their health is low and no healer is up (a partial
  win: they return next raid stronger). If they reach the Heart, they strike it (damage to its health, carried across raids, healed
  slowly by mood); then they leave with a "piece of treasure" and the raid is lost.
- After a raid: experience, Dread earned, a report ("The mage is afraid of bats"), and loot the heroes dropped.

## Battles

- **Side view:** heroes on the left (up to four), your monsters on the right (up to three, the room's). Turn order by speed, shown at
  the top.
- **On a monster's turn:** **Move** (one of its 2-3 moves), **Guard**, **Swap** (with another monster in the next room, once per
  battle, if a corridor joins them), **Taunt** (heroes target this one).
- **Two bars on every hero:** health and **courage**. Damage lowers courage a little; scary moves (Roar, Screech, Surprise, a
  fainted ally) lower it a lot. The party's courage is their sum; when it breaks, they flee the whole raid, not just the room.
- **Hero AI:** classic and readable. Every class has a fixed priority list shown in the Bestiary of heroes once seen: the **Knight**
  hits the biggest monster and guards the healer; the **Cleric** heals anyone below half; the **Mage** opens with her best area spell;
  the **Thief** steals, then flees at low health; the **Ranger** hits the lowest-health monster; the **Bard** buffs courage.
  Learning these and building against them is the game.
- **Numbers:** small (monsters 10-120 health, heroes 20-200), damage = power x (attack / defence), 10% spread. Elements: Fire, Ice,
  Holy, Dark, and plain.
- **No timed presses:** it is about planning, like the building half.

## The hero parties

- 20 raids; each party is three or four heroes from 6 classes, with names, portraits and two lines of banter each per room kind.
- **Recurring heroes:** Sir Garret (knight, every season), **Pell and Pim** (twin thieves), **Maga Lorne** (old mage, autumn),
  the **King's champions** (winter): **Dame Hesper** (paladin), **Orrin** (archmage), **the Advisor** (who never fights, only buffs,
  and whose courage is the key to the good ending).
- **Sparing:** when a hero is knocked out in a battle, you may **spare** them (they are carried home and come back friendlier, or not
  at all) or **scare** them (their courage max drops for good). Linnet the bard is caught, not spared: a story event in summer.

## Between raids (the lair)

- **The lair** is Mossy's home room: walk around (top-down, small), talk to monsters (each has a line per mood and season), feed
  them from the larder (food from loot), and visit Linnet's cell (later her room).
- **Raising:** feed (mood), train (spend raid experience on one monster), hatch eggs (new monsters), and **evolve** at level 10 (a
  slime becomes a king slime, a goblin a goblin chief): one choice of two forms per kind.
- **The Heart:** talk to it; it shows memories of Grandmother Ash (the story is delivered partly here).

## Look

- Dot's fixed palette: cosy cave browns and mossy greens, warm torchlight, the Heart's pink-purple glow; heroes in bright primary
  colours so they read as "the invaders".
- **Battle sprites** 32x32 for monsters and heroes, big monsters (ogre, wyrmling grown) 48x48; idle 2 frames, attack 3, hurt, faint
  (monsters) or flee (heroes, running off the left edge).
- **Raid map** icons 16x16 (party marker, room kinds, traps, monsters).
- **Lair** sprites 16x24 for Mossy (a slime, so 16x16 is enough) and the monsters walking around (small versions).
- **Portraits** 48x48: Mossy (four faces), Linnet, Garret, the King, the Advisor, Grandmother Ash (in memories), one per monster
  kind (one face). Read `help('art')` and `help('sizes')` first.

## Dialogue

- `gs.say` / `gs.ask` with a portrait slot. Monster talk is short and personal; heroes' banter during raids is shown in a small bar
  at the bottom (one line, no stop), so raids keep moving.
- Talk lives in `lib/story/<season>.lua` (story scenes) and `lib/talk/<kind>.lua` (each monster kind's lines by mood and season).

## Sound

- General MIDI, 4 music tracks, 4 sound channels. Read `help('music')` first.
- Songs: title, the lair (a cosy bassoon and pizzicato tune), building (calm, marimba), the raid (a sneaky march), battle (bouncy
  and a bit silly; brass and xylophone), the heroes' fanfare (a classic RPG fanfare, played when they enter: the joke is that it is
  theirs), the champions, the King, the Heart (music box and choir), each season's lair theme a variation of the first.
- Sound effects: dig, place, trap triggers, courage break (a sad trombone, quietly), hero flee, monster faint (a soft "plop"), level up.

## How it is built (technically)

- **Scenes:** `title`, `lair` (top-down; a layout with `code = "lair"`), `build` (the floor grid editor), `raid` (the raid map),
  `battle` (one scene; backdrops per room kind as layouts `scenes/rooms/<kind>.layout.lua` with `code = "battle"`), `report`,
  `ending`.
- **Rules are pure:** `lib/floor.lua` (the grid, rooms, corridors, placing, Dread), `lib/raid.lua` (the heroes' path choice, room
  by room, traps, resting, courage), `lib/battle.lua` (turns, moves, courage, hero AI from `lib/heroes_ai.lua`); no drawing, no
  buttons; same seed, same raid.
- **Data:** `lib/data/monsters.lua`, `moves.lua`, `heroes.lua` (classes and named heroes), `raids.lua` (the 20 parties by season),
  `rooms.lua`, `traps.lua`, `food.lua`.
- **State:** one `gs.save` table: season, raid number, floors (layouts), monsters (kind, level, mood, evolution), larder, Dread,
  Heart health, heroes met and their state, flags; saved after each raid and in the lair.
- **Tests and bots:** `GS_SELFTEST=1` plays every raid with a builder bot (a simple fixed layout for each season) and a battle bot,
  checks each raid can be won and that the default layout does not win too easily (balance), checks the hero AI never picks an
  illegal action, and prints `NINTH FLOOR TEST PASS`. Shortcuts in `lib/debug.lua`: `GS_RAID=n`, `GS_SEASON=`,
  `GS_BATTLE=<room>`, `GS_SCREEN=lair|build|raid|report`.
- **Assets** from `scripts/make-ninth-floor.mjs` (art in `scripts/ninth-floor/*.mjs`); never touches code or `meta/info.json`.
- **Budget:** tiny; battles under 20 entities.

## Order of work

1. **The battle core** with grey boxes: `lib/battle.lua` with four monster kinds and four hero classes, courage, hero AI, and the
   battle bot.
2. **The floor and the raid:** the 5x4 grid editor, rooms, corridors, two traps, the Dread budget, the heroes' path, rest at the
   shrine, raid results.
3. **Vertical slice: spring** (raids 1-5) with the lair, feeding and talking, final art, songs and dialogue (about 45 minutes).
   **Stop here** for a playtest on the handheld: is the floor editor easy on a D-pad, are raids too slow, is the courage idea clear.
4. Summer and autumn: Linnet, Garret, more monsters, evolving, the Eighth and Seventh floors.
5. Winter: the champions, the King, four floors, the endings.
6. Polish: banter, balance with the bots, speed on the handheld, title and credits.

## Building it alongside the other games

Several sessions build different games at the same time, so keep to this game's own files:

- Everything lives in `carts/ninth-floor/`, `scripts/make-ninth-floor.mjs` and `scripts/ninth-floor/`.
- **Do not change the engine** (`engine/`, `runtime/`) or the studio. If the game truly needs something the engine lacks, first look
  for a way in the cart's `lib/`; if there is none, make the engine change small, additive and tested, in a commit of its own, and
  say so in the commit message, since other sessions may need to merge it.
- Shared files get only one added line each, at the end of the work: a row in `carts/AGENTS.md`, the cart in `tests/run.sh`, an
  item in `TODO.md`.

## Open questions (decide in the first playtest)

- Should the player be able to fight in raids at full speed only, or also let the monsters auto-battle (a toggle on Select)?
- 5x4 rooms per floor is a guess; 4x3 may be enough in spring.
- Is courage alone a clear enough win condition, or do heroes also need a "turns left" timer?
