# Tidewake: the plan for a 5-7 hour turn-based RPG

A design for a story-driven, turn-based RPG in the spirit of Sea of Stars, for the Dot handheld (320x240, D-pad, A B X Y, L R,
Start, Select). It covers the hook, the story, the party, the battle system, exploring, growth, the islands, enemies, the look, the
sound, how it is built and the order to build it in. Nothing here is built yet. The cart will be `carts/tidewake`.

## The pitch in one line

**The moon is falling, and the tide rises every chapter.** Three young lighthouse keepers sail an archipelago to relight the old
beacons that are said to hold the moon up, and find out halfway that the beacons are what pull it down.

What makes it more than a Sea of Stars copy:

1. **The tide is the map.** Every island has a low tide and a high tide (two tile layers, like Then & Now's two times). Low tide
   opens sandbars, caves and wrecks; high tide floods paths but lets the boat sail over walls. A tide bell on each island flips it.
   As the story goes on, the world's resting tide rises for good, so islands you knew change shape.
2. **Breaking intents.** An enemy winding up a big move shows a row of element icons over its head. Each hit of a matching element
   knocks one off; knock them all off before its turn and the move is cancelled and the enemy is stunned. Choosing who acts, and with
   what, is the puzzle of every fight.
3. **Timed presses, always.** Press A as your attack lands for a bonus hit; press A as an enemy hit lands to block a third of the damage.
   No turn is just menu work.
4. **The second half runs backwards.** After the twist the party sails back through the islands they already saved, now at the
   high resting tide, to put the beacons out again. Same maps, new shapes, new enemies, new story beats: a lot of game from few new assets.

## Story

**Setting.** The Shallows, a ring of small islands around a calm inner sea. The moon here is big and close, and every year it is a
little bigger. Old songs say the Keepers of old built seven beacons to hold it up, and that the beacons went dark when the last
Keeper Order broke up a hundred years ago.

**Act 1: Relight.** On Saltgrass, the home island, the tide floods the village well for the first time anyone can remember.
**Nell** and her friend **Corin**, apprentice keepers at Saltgrass light, find the Order's old logbook in the lighthouse cellar and
set out to relight the beacons. Nell's little brother **Bo** stows away on the boat. Each island has a beacon tower (a short dungeon),
a guardian (a boss) and people with their own trouble with the rising water.

**The twist (at the fifth beacon, the Drowned Abbey).** The Abbey's archive shows that the beacons were never built to hold the moon
up. The old Order built them to **call it down**: the moon is a sleeping creature (the Tidemother), and its fall would leave behind
its heart, a source of endless light the Order wanted. The Order broke up when its own keepers refused to finish the job. The
Lantern Guild, the island traders who funded the party's trip and sold them their maps, knows this; its head, **Admiral Vey**, wants
the heart.

**Act 2: Douse.** The party sails back through the islands at high resting tide to put the beacons out, racing the Guild, which
relights them behind them. The moon now fills the sky. A retired keeper, **Old Grieve**, joins as the fourth member.

**Ending.** At Tidecrown, the island closest to the moon, the party reaches the last beacon with Vey. The Tidemother half wakes. The
final fight is against Vey and the Guild flagship; the last "boss" is the Tidemother itself, which you do not beat: you break its
intents (the last beacon's pull) until it can rise again. The moon goes back up; the tide falls back over the closing credits, and
the islands show their old shapes.

Tone: warm, funny and a little sad, like a seaside summer. **No deaths on screen**: defeated foes flee, faint or fall into the sea and
swim off.

### The party

| Who | Role | Element | Weapon | Field skill |
| --- | --- | --- | --- | --- |
| **Nell** (16) | Lead, steady hitter, the timing expert | **Sun** | Oar-blade | **Jump** short gaps and ledges (A at an edge) |
| **Corin** (17) | Magic, slow but heavy, the worrier | **Moon** | Lantern staff | **Lantern** lights dark rooms and shows hidden tiles |
| **Bo** (12) | Fast, tricky, low health | **Tide** | Harpoon line | **Hook** pulls blocks and crosses gaps to posts |
| **Old Grieve** (70, Act 2) | Tank and cook, slow | **Stone** | Anchor | **Lift** heavy stones |

Four elements: **Sun, Moon, Tide, Stone**. Each fighter has a normal attack (their element, or a plain "blunt" for Grieve's anchor
swing) and four skills learned over the game, with other elements mixed in so every element can be reached by two members.

Supporting cast: **Admiral Vey** (charming, generous, the villain), **Marta**, the Saltgrass light-keeper who raised Nell and Bo,
**the Archivist** at the Abbey (a crab who has read every book there; comic, and the one who tells the truth), merchants and
islanders on each island.

## The battle system

Battles happen where the enemies are: walking into a visible enemy on the field starts a fight (no random encounters). The screen
cuts to the battle scene, whose backdrop is a layout drawn from that island's tileset, so the fight looks like it is on the spot.

### Turns

- Fighters act in a fixed order each round (by speed), shown as a row of small portraits at the top. Enemies' turns are in it too.
- On a party member's turn: **Attack, Skills, Items, Swap** (bring in the bench member from Act 2 on, free once a round), **Defend**.
- Up to three on the field. Enemies: one to four, up to two of them big.

### Timed presses

- **Attack timing.** A flash on the weapon at the moment of impact. A in the window (8 frames at 60 fps, about 130 ms) gives a
  second hit (Nell, Bo) or more damage (Corin, Grieve).
- **Block timing.** A flash on the defender. A in the window takes a third off the damage; a "perfect" press (the first 3 frames)
  takes half off.
- **Skill timing.** Some skills have their own small press: hold A and let go in a marked zone (Corin's Moonfall), tap A as many
  times as you can in a second (Bo's Reel), press as rings close (Nell's Dawnstrike).
- **Settings > Timing:** Normal, Wide (double windows) and Auto (always "good", never "perfect"). Beginners must be able to finish.

### Intents (the locks)

- A big enemy move is announced a turn ahead: the enemy glows and shows **1 to 4 element icons** and a count of turns until it goes off.
- Each hit of a matching element removes one icon (a multi-hit skill can remove several). Removing all of them **cancels the move**
  and **stuns** the enemy for a turn. Each icon you removed weakens the move anyway (25% each), so trying is always worth it.
- Bosses chain intents and sometimes show a "?" icon that takes any element, or a locked icon that only a skill can remove.

### Tide meter and combos

- Every timed press fills the shared **Tide meter** (three marks). One mark: a **Combo** between two members (Nell + Bo:
  Riptide, an all-enemy Tide hit; Nell + Corin: Eclipse, Sun and Moon at once, which removes one icon of each). Three marks: a
  **Spring Tide** with all three (one per act).
- Normal attacks also give back **Glow** (the magic points): Glow is small (max 10), skills cost 2-6, and an attack gives 1. You attack
  to power skills, like Sea of Stars' live mana, so there is no resting just for magic.

### Numbers

- Health 30-400 across the game, damage = power x (attack / defence), plus 10% random spread, at least 1. Weak element x1.5,
  resisted x0.5. Keep the numbers small and readable on a 320x240 screen (at most three digits until the last island).
- Levels 1 to 20, the whole party shares experience (the bench too). Fighting everything on an island levels you right for its
  boss. Enemies do not come back until you rest at a campfire, so there is no grinding loop.

## Exploring

- **Top-down, three-quarter view**, 16x16 tiles, 8-way walking. A is the one action button (talk, jump at an edge, use the field
  skill of the lead), B runs, L and R swap the lead (whose field skill A uses), X opens the menu, Y is the tide bell when you stand
  on one, Start pauses, Select shows the map.
- **Puzzles** use the tide and the field skills: push and hook blocks, light hidden paths, flood a room to float a crate to a ledge,
  time a run across a sandbar before the bell turns.
- **Campfires** save, heal and cook (two ingredients make a dish that heals or gives a buff in the next fight). One per island part.
- **Sailing** on a small sea map between islands: the boat steers with the D-pad, currents push it, rocks show at low tide.
  Act 2 adds storms and Guild patrol boats (a visible enemy that starts a fight).
- **Side things:** a fishing mini-game (a timing bar, tied to cooking), a shell collection (24 rare shells; trade them at Brine
  Market for gear), and one helper per island with a short quest.

## The islands

| # | Island | What it is | Beacon dungeon | Guardian | Act 2 change |
| --- | --- | --- | --- | --- | --- |
| 1 | **Saltgrass** | Home: village, light, beach. Tutorial | The cellar under Saltgrass light (short) | **Bramblecrab** (teaches intents) | The village has moved uphill; Marta's light is an island of its own |
| 2 | **Gullrock** | Cliffs, birds, a rope-bridge village | The Gull Tower: climbing, wind | **Skua Queen** (flies out of reach: Bo's Hook pulls her down) | The lower village is under water; wreck diving |
| 3 | **Kelpwood** | A forest of giant kelp on a reef, half water | The Root Light: tide puzzles | **Old Eelmother** (two heads, two intents at once) | Kelp grown into a maze at high tide |
| 4 | **Brine Market** | A floating town of boats; the Guild's base. Shops, the arena | None: the beacon is in the Guild's tower, stolen | **The arena champion** (optional), then Vey's lieutenant **Hask** | Shut to the party; a stealth night visit |
| 5 | **Drowned Abbey** | A sunk monastery, mostly underwater | The Abbey: Corin's lantern in the deep dark | **The Abbot's Bell** (a living bell; its intents grow) | The twist happens here, so Act 2 starts here |
| 6 | **Coldharbour** | Ice island far north, only open in Act 2 | Frozen light: sliding puzzles | **Frostback whale** (Grieve joins after it) | n/a |
| 7 | **Tidecrown** | Ring of stone under the moon; the end | The Crown | **Vey and the flagship**, then the **Tidemother** | n/a |

Act 1 covers islands 1-5 (about 3.5 hours); Act 2 visits 2, 3, 4 again in new shapes, adds 6, ends at 7 (about 2.5 hours).

## Enemies

Around 30 normal kinds (5 per island plus Act 2 variants as palette swaps with one new move), 9 bosses. Each kind has one gimmick,
written in a line of data:

- **Shore crab**: blocks the first hit each turn with its shell. **Gull**: dodges ground (Stone) hits. **Jellyfloat**: stings back
  when hit by a normal attack. **Mudskipper**: swaps places with another enemy. **Kelp knot**: heals the others, show its intent first.
- **Guild sailor** and **Guild gunner** (Act 2): they carry items and use them. **Lamp moth**: drains Glow. **Coral golem**: big,
  three-icon intents every other turn. **Ice seal**: slides into the back of the party and hits the bench (Act 2 only).

Every enemy has an entry in the **Bestiary** (in the menu): its weaknesses show once you have hit it with that element.

## Growth and items

- **Levels** raise stats; **skills** come at fixed levels (four per person, plus combos learned from story moments).
- **Gear:** one weapon and one charm each. Weapons are found or bought (four per person across the game); charms give one rule
  ("+1 Glow on a perfect block", "timed hits add Tide"). About 30 charms, so the build choice lives there.
- **Items:** Tonic (heal), Big tonic, Sea salt (cure), Ember (revive), Spark (Glow), Bomb fruit; at most 9 of each. Dishes from cooking.
- **Money:** shells (the currency) from fights and chests.

## Look

- Dot's fixed 32-colour palette. Bright summer seaside: teal sea, warm sand, white lighthouses, purple night with a huge pale moon.
- **Field sprites** 16x24 (party, people), 4-way facing, 4-frame walk, plus run, jump, hook, lift, talk.
- **Battle sprites** 32x32 for the party and normal enemies (idle 2 frames, attack 3-4, hurt, block, KO), big enemies 48x48,
  bosses 64x64 or built from several sprites.
- **Portraits** 48x48 for the dialogue box: the four party members with three faces each (normal, happy, worried), Vey, Marta, the
  Archivist, one per island's main person.
- **The moon** is a big sprite in the sky of sky-visible maps, drawn larger each chapter (four sizes). It is the clock of the story.
- Tilesets: one per island at two tides (shared shapes, the water line moved), plus interiors. Read `help('art')` and
  `help('sizes')` before drawing.

## Dialogue

- `gs.say` / `gs.ask` from `engine/gs/talk.lua`, styled by the layout's `dialogue_box` panel; add a portrait slot (a picture item)
  in the layout. Lines are short: two lines of about 36 characters per page.
- Story moments are small `gs.go` scripts: people walk along paths (`follow_path`), the camera pans, lines play.
- **Story flags** are plain fields in the save (`flags.met_vey = true`); each island's talking lives in `lib/story/<island>.lua`
  as functions that check and set flags. Every person's line depends on the chapter, so the world talks about what just happened.

## Sound

- General MIDI through the SoundFont, 4 music tracks and 4 sound channels (Dot's limits). Read `help('music')` before composing.
- Songs: title, Saltgrass (home theme: accordion and guitar), sailing (strings over a rolling 6/8), one per island, beacon dungeons
  (sparser versions of the island song), battle (fast, steel drums and brass), boss, Vey's theme, the Tidemother (choir pad), the
  ending (the home theme, slow).
- Act 2's island songs are the Act 1 songs in a minor key, slower, with a different lead instrument.
- Sound effects: hits by element, perfect press chime, block clank, intent break (a glass crack), tide bell, waves, menu, level up.

## How it is built (technically)

- **Scenes:** `title`, `field` (the code for every map; each map is a layout `scenes/maps/<island>_<nn>.layout.lua` with
  `code = "field"`), `battle` (one scene; each island has a backdrop layout `scenes/battle/<island>.layout.lua` with
  `code = "battle"`), `sail`, `menu`, `shop`, `ending`.
- **Tide layers:** each map has `low` and `high` solid layers plus their drawn layers; `lib/tides.lua` picks which one is live and
  answers "is this tile solid / water / deep?".
- **Battle rules are pure:** `lib/battle.lua` has no drawing and no buttons. `battle.new(party, encounter, seed)`, `b:actions()`,
  `b:choose(action, target)`, `b:press(result)` ("perfect" / "good" / "miss"), and a list of events (hit, block, icon broken,
  intent cancelled, KO, level up) that the battle scene turns into animation, numbers and sound. Same seed, same fight.
- **Data:** `lib/data/party.lua`, `skills.lua`, `enemies.lua`, `encounters.lua`, `items.lua`, `charms.lua`, `shops.lua`,
  `islands.lua` (maps, links, campfires). A test makes sure every map door has a partner and every encounter names real enemies.
- **State:** `lib/state.lua` is the save: party levels and gear, items, shells, flags, chapter, tides, bestiary, map seen; one
  `gs.save` table, saved at campfires.
- **Bots and tests:** `lib/bot.lua` plays battles with chosen timing skill. `GS_SELFTEST=1` fights every encounter and boss at the
  level the story expects, once with perfect timing and once with Auto timing, and prints `TIDEWAKE TEST PASS` only when the Auto run
  still wins every normal fight and every boss within a turn limit (balance check), and the perfect run is not too short. Shortcuts
  in `lib/debug.lua`: `GS_MAP=<map>`, `GS_BATTLE=<encounter>`, `GS_CHAPTER=n`, `GS_SCREEN=menu|shop|bestiary|sail`.
- **Assets** come from `scripts/make-tidewake.mjs` (art in `scripts/tidewake/*.mjs`, maps in `scripts/tidewake/maps.mjs`, writes
  `lib/art.lua` if needed); like the other generators, it never touches code or `meta/info.json`.
- **Budget:** under 100 entities on a map, battles under 30 (fighters, numbers, effects use `gs.burst`). The cart stays well under 16 MB.

## Order of work

1. **Battle core** with grey boxes: `lib/battle.lua` with the party of three, timed presses, intents, Glow, the Tide meter and one
   combo, five enemies and one boss, and the self-test bot. Get the feel right here; this is most of the game.
2. **Field core:** walking, talking, tide layers and the bell, a campfire with saving, a door, a visible enemy that starts a fight,
   the menu (party, items, gear, bestiary).
3. **Vertical slice: Saltgrass and Gullrock**, with final art, songs and dialogue, up to the Skua Queen (about 40 minutes). **Stop
   here** for a playtest on the handheld: timing windows on the device's screen and pad, text size, battle speed.
4. Kelpwood, Brine Market and the Drowned Abbey with the twist (end of Act 1).
5. Act 2: the changed islands, Coldharbour, Grieve, Tidecrown and the ending.
6. Polish: fishing, shells, cooking, bestiary, balance with the bot, speed on the handheld, title screen and credits.

## Building it alongside the other games

Several sessions build different games at the same time, so keep to this game's own files:

- Everything lives in `carts/tidewake/`, `scripts/make-tidewake.mjs` and `scripts/tidewake/`.
- **Do not change the engine** (`engine/`, `runtime/`) or the studio. If the game truly needs something the engine lacks, first look
  for a way in the cart's `lib/`; if there is none, make the engine change small, additive and tested, in a commit of its own, and
  say so in the commit message, since other sessions may need to merge it.
- Shared files get only one added line each, at the end of the work: a row in `carts/AGENTS.md`, the cart in `tests/run.sh`, an
  item in `TODO.md`.

## Open questions (decide in the first playtest)

- Is 8 frames the right timing window on the device? Measure input delay there first.
- Battles in a separate scene (planned) or on the field map itself, like Sea of Stars? Separate is far simpler; revisit only if
  the cut feels bad.
- Does the party need a fourth member before Act 2?
