# Lanternfall: the plan for a 5-6 hour story tactics game

A design for a grid tactics game with a story between battles, in the spirit of Into the Breach and Fire Emblem, for the Dot
handheld (320x240, D-pad, A B X Y, L R, Start, Select). It covers the hook, the story, the caravan, the rules of a battle, the
light, the enemies, the campaign and camp, the look, the sound, how it is built and the order to build it in. Nothing here is built
yet. The cart will be `carts/lanternfall`.

## The pitch in one line

**The dark is the enemy, and your light shrinks every turn.** You lead a caravan carrying the last lit lantern across a world where
the sun has gone out. Every battle is a small board where the shades show you exactly what they will do next turn, and you have a
few moves to push, block and redirect them before the lantern's light closes in.

What makes it its own game:

1. **Perfect information.** Enemies show their next move (an arrow and the tiles they will hit). Nothing is random in a fight. Each
   turn is a small puzzle with a clean answer, which suits short handheld sessions.
2. **The light is the board.** The lantern lights a circle of tiles. In the light, shades are weak and your people are safe from the
   cold; in the dark, shades are strong and your people lose health each turn. The circle **shrinks by one ring every two turns**,
   and some actions spend oil to grow it back.
3. **Push, don't just hit.** Most damage comes from pushing enemies into each other, into walls, into water, or into the light,
   where they burn. Shades fear light the way your people fear the dark.
4. **People leave.** Between battles you camp. Morale, choices and who you stand by decide who stays. A character with no morale left
   leaves the caravan for good (they live: they walk off to a village you passed). The story bends around who is still with you.

## Story

**Setting.** The Long Night. Nine years ago the sun went out. Nobody knows why. The world lives by lamps and fires; outside the
walls of the few lit towns, the dark moves, and in it are **shades**: shapes of cold that put out fires and people.

**The Lantern.** The last flame of the old sun temple at Emberfall, kept alive in a brass lantern on a cart. The temple's last
keeper sends it east to **Dawnhold**, a city on the edge of the world where, the old texts say, the sun can be lit again.

**You.** **Tamsin Reyes**, 20, a lamplighter's daughter chosen to lead the caravan because no one else would. She is careful and
unsure; she grows into a leader, or into someone who saves the lantern at any cost, depending on your camp choices.

**The twist (region 4).** The shades are not the dark's creatures; they are what is left of the people of the old sun temple, who
**stole the sun's fire** to keep it for themselves, and put the sun out by doing it. The Lantern *is* the sun's fire. The shades
follow the caravan because they want to give it back. Some have been trying to tell you for the whole game (the "whispering"
shades that never attack, region 2 on).

**The ending choice at Dawnhold.**

- **Light the beacon:** the Lantern lights a new small sun over Dawnhold. One city lives in daylight; the rest of the world stays
  dark. The shades fade.
- **Give it back:** carry the Lantern into the dark at the world's edge and open it. The sun comes back, slowly, for everyone; the
  Lantern goes out, and so does the caravan's purpose. The last battle is harder (the light is gone in its last turns).
- Who is still in the caravan changes the last scenes and the epilogue cards (one per character).

Tone: dark fairy tale, warm between the battles. **Not grim**: shades "fade", people "fall" (knocked out for the battle, back at
camp), and a character only leaves through choices, never by dying.

## The caravan

Eight characters, three to four fight in a battle (choose before each). Each has health 3-6 (small whole numbers, like Into the
Breach), a move range, one main action and one passive.

| Who | Role | Move | Action | Passive |
| --- | --- | --- | --- | --- |
| **Tamsin** | Leader (always fields) | 3 | **Shove**: push one adjacent tile, 1 damage | Units next to her cannot be pushed |
| **Brother Aldo** | The old temple keeper's novice | 2 | **Kindle**: spend 1 oil, light ring +1 | Heals 1 to allies in the light at turn end |
| **Wick** (14) | Runner, fast | 5 | **Swap** places with any unit in a line | Ignores the cold for one turn |
| **Maud** | Smith, heavy | 2 | **Hammer**: 2 damage, push 2 tiles | Blocks a tile behind her from attacks |
| **Corvo** | Ex-soldier, archer | 3 | **Shot**: 1 damage at range, push 1 | Shots pass over units |
| **Sister Ivy** | A shade-hunter, joins in region 2 | 3 | **Brand**: mark a shade; it burns in any light | Sees whispering shades |
| **Fen** | A thief who steals oil, joins in region 3 | 4 | **Pull**: pull a unit 2 tiles toward her | Picks up oil from 2 tiles away |
| **The Whisper** | A shade who joins in region 4 | 3 (flies) | **Embrace**: absorb an enemy's attack into itself | Is weak in the light, like enemies |

The **Lantern cart** is on every board: it moves 1 (pushed by an adjacent unit), has 4 health; if it is destroyed the battle is lost.
The light circle is centred on it, so moving the cart moves the light.

## A battle

- **Board:** 8x6 tiles of 32x32 pixels (256x192) in the left of the screen; a 64-pixel side panel for the selected unit and the
  turn count, a 48-pixel bar below for the hint line and buttons. Terrain: floor, wall, rubble (blocks, breaks after one push into
  it), water (pushed units fall in: a shade fades, a person is knocked out), oil spills (step on to collect), braziers (light them
  for a small extra light ring).
- **Turn order:** (1) the **enemy shows its moves** (arrows, highlighted tiles), (2) **you act** with every unit, in any order,
  each one moving then acting, (3) **the enemies act** exactly as shown, (4) the **light shrinks** if it is a shrinking turn, (5)
  units in the dark take 1 cold damage, new shades rise in the dark from marked spawn tiles.
- **Undo:** one free **Rewind** per battle puts the whole turn back to its start (like Into the Breach's reset). Inside a turn, a
  unit's move (not its action) can be undone with B until it acts.
- **Goals:** survive N turns (most), reach the exit with the cart, light all braziers, protect a village gate, or defeat a big
  shade. A side goal on most boards (keep the cart above 3 health, collect 2 oil) gives a camp reward.
- **Oil:** the caravan's shared resource, carried between battles: Kindle costs it, the camp uses it to cook, it is found on boards.
- **Controls:** D-pad moves the cursor, A selects / confirms, B cancels, L and R cycle your units, X shows the enemy moves list,
  Y ends the turn (with a check if a unit has not acted), Select toggles the threat view (every tile that will be hit), Start pauses.

## The enemies

About 12 shade kinds, each with one clear rule shown in its tooltip:

- **Wisp:** moves 3, hits 1 adjacent. **Creeper:** moves 2, pushes the unit it hits. **Lancer:** hits a full line. **Snuffer:**
  moves toward the cart and puts out a light ring if it touches it. **Bloat:** when it fades, it hits all around it.
- **Shroud:** makes the tiles around it dark even inside the light. **Caller:** raises a new wisp next turn (shown).
- **Whispering shade** (region 2 on): never attacks; if it fades in the light, a line of story plays. Sparing them all is a
  secret condition for an extra epilogue.
- **Big shades** (one per region's last battle): 2x2 tiles, two actions shown per turn, parts that can be broken (the Gate
  Warden, the Drowned Bell, the Antlered One, the Hollow King, and at Dawnhold, the Last Keeper).
- Enemy rules are deterministic: given the board, a shade always chooses the same move (a fixed priority list), so what is shown
  is what happens.

## The campaign

Five regions, each a short chain of **four to six battles** and a big shade, with camps between battles: about 25 battles in all,
10-15 minutes each.

| Region | Place | New idea | Joins | Big shade |
| --- | --- | --- | --- | --- |
| 1 | **The Ash Road** (leaving Emberfall) | Light, pushing, the cart. Tutorial battles | (start: Tamsin, Aldo, Wick, Maud) | **Gate Warden** |
| 2 | **The Mere** (drowned farms) | Water, whispering shades | Corvo, Sister Ivy | **Drowned Bell** |
| 3 | **Thornwood** | Rubble, darkness inside the light, choices of route | Fen | **Antlered One** |
| 4 | **The Glass Waste** (the old temple ruins) | Mirrors that bounce light; the twist | The Whisper | **Hollow King** |
| 5 | **Dawnhold** | Everything; the ending choice | | **The Last Keeper** |

- **Route map:** each region is a small map of nodes (battle, camp, village, oil cache). Some forks let you skip a battle at a cost
  (less oil, a morale hit).
- **Villages** on the route: talk, trade oil for supplies, and a choice (stay a night and lose a turn of the Long Night's clock, or
  pass on).

## Camp

Between battles, a small scene by the cart's fire:

- **Talk** with up to two people (each conversation is a short `gs.say` / `gs.ask` scene; it moves their story and morale).
- **Rations:** give a hot meal (oil) to one person, or share it out.
- **Choices** that come up in story ("Wick wants to go back for his sister": let him go, forbid it, go with him and lose a day).
- **Morale** per character, 0-5, shown as a small flame by their portrait. At 5 they get a stronger action in the next region (a
  "spark" upgrade); at 0 they leave after the next battle, with a goodbye scene. Tamsin cannot leave.
- **Upgrades:** each region gives 2 **embers** to spend on one character's upgrade (+1 health, +1 move, a second action).

## Look

- Dot's fixed palette: deep blues and purples for the dark, warm golds and oranges for the light. The light circle is the main
  visual: lit tiles drawn from a bright version of the tileset, dark tiles from a dark version, with a dithered edge ring.
- **Board units** 32x32 (one per tile), idle 2 frames, act 3 frames, hurt, fallen. Shades are drawn mostly in 2 dark colours with
  bright eyes so they read in the dark.
- **Portraits** 48x48 for the eight caravan members (three faces), the temple keeper, the Last Keeper.
- **Camp** is a layout with the fire as an animated sprite and the caravan sitting around it (who is there changes).
- Arrows and tile highlights are a small sprite set (8x8 and 32x32 overlays) in clear, distinct colours: red for enemy hits, gold
  for your reach. Read `help('art')` and `help('sizes')` first.

## Sound

- General MIDI, 4 music tracks, 4 sound channels. Read `help('music')` first.
- Songs: title, the road (a slow march, low strings and a hand drum), camp (guitar and flute, the caravan's theme), a battle song
  per region (built on the camp theme: the Mere with harp, Thornwood with woodwinds, the Glass Waste with bells), big shades, the
  twist (a choir), Dawnhold, two endings.
- The battle song gets sparser as the light shrinks (play a quieter arrangement on the last two rings, switching at the start of
  the turn, never mid-phrase).
- Sound effects: push thump, wall crunch, splash, light ring grow and shrink (a breath), cold tick, shade fade, rewind (a reversed
  chime), turn end.

## How it is built (technically)

- **Scenes:** `title`, `route` (the region map), `camp`, `village`, `battle` (one scene; each board is a layout
  `scenes/boards/<region>_<nn>.layout.lua` with `code = "battle"`, holding the terrain tiles, spawn marks and entity starts),
  `ending`.
- **Rules are pure and exact:** `lib/tactics.lua` holds the board, units, light, oil and turn phases, with no drawing and no
  buttons: `t:reachable(unit)`, `t:targets(unit)`, `t:move(unit, x, y)`, `t:act(unit, x, y)`, `t:end_turn()`, `t:enemy_plans()`,
  `t:snapshot()` / `t:restore()` (for Rewind), returning events the battle scene animates. No random numbers at all.
- **Enemy logic:** `lib/shades.lua` gives each kind a fixed priority list; `t:enemy_plans()` uses it, so the shown plan and the
  played plan are the same code.
- **Data:** `lib/data/units.lua`, `shades.lua`, `regions.lua` (routes, battles, goals), `camp.lua` (conversations, choices,
  morale effects), in `lib/story/<region>.lua` for the talk.
- **State:** one `gs.save` table: region, route position, caravan (morale, upgrades, who has left), oil, embers, flags; saved at camp.
- **Tests and bots:** `GS_SELFTEST=1` checks every board with a search bot (`lib/solver.lua`, a small depth-limited search over your
  moves each turn) that must win every battle with the default caravan for that point in the story and finds how many turns it had
  spare; boards that the bot wins with no margin or cannot win are reported. It also checks that plans shown equal plans played on
  random positions, and prints `LANTERNFALL TEST PASS`. Shortcuts in `lib/debug.lua`: `GS_BOARD=<region>_<nn>`, `GS_REGION=n`,
  `GS_SCREEN=route|camp|village`.
- **Assets** from `scripts/make-lanternfall.mjs` (art in `scripts/lanternfall/*.mjs`, boards in `scripts/lanternfall/boards.mjs`);
  never touches code or `meta/info.json`.
- **Budget:** tiny: under 30 units on a board, one tile layer for the board and one for the light.

## Order of work

1. **The rules** with grey boxes: `lib/tactics.lua` with Tamsin, Maud and Wick, the cart, the light circle, cold, three shade
   kinds, enemy plans shown, Rewind, and the solver bot. Four test boards. Get the puzzle feel right here.
2. **The battle screen:** cursor, reach and threat views, the side panel, animations from events, the hint line.
3. **Vertical slice: region 1** (the Ash Road) with four battles, two camps, the Gate Warden, final art, songs and dialogue (about
   50 minutes). **Stop here** for a playtest on the handheld: are 32-pixel tiles clear, are the arrows readable, is the shrinking
   light too harsh.
4. Regions 2 and 3: water, whispers, rubble, route forks, villages, morale and leaving.
5. Regions 4 and 5: mirrors, the twist, the Whisper, Dawnhold, both endings and epilogue cards.
6. Polish: side goals, balance with the solver, speed on the handheld, title and credits.

## Building it alongside the other games

Several sessions build different games at the same time, so keep to this game's own files:

- Everything lives in `carts/lanternfall/`, `scripts/make-lanternfall.mjs` and `scripts/lanternfall/`.
- **Do not change the engine** (`engine/`, `runtime/`) or the studio. If the game truly needs something the engine lacks, first look
  for a way in the cart's `lib/`; if there is none, make the engine change small, additive and tested, in a commit of its own, and
  say so in the commit message, since other sessions may need to merge it.
- Shared files get only one added line each, at the end of the work: a row in `carts/AGENTS.md`, the cart in `tests/run.sh`, an
  item in `TODO.md`.

## Open questions (decide in the first playtest)

- Board size: 8x6 at 32 pixels (planned) or 10x7 at 24 pixels for more room? 32 is clearer on a 3.5-inch screen.
- Light shrinking every two turns: test every one and every three.
- Should leaving be permanent on the first play, or offer a "gentle" setting where morale cannot reach 0?
