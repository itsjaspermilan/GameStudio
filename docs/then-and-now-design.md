# Then & Now: the plan for a 4-6 hour game

A design for turning the first test room (`carts/then-and-now`, first called Derelict) into a full game for the Dot handheld. It covers the hook, the story,
the characters, the biomes, progression, enemies, the choices and endings, and the order to build it in. Nothing here is built yet
apart from the movement and shooting in the test room.

## The pitch in one line

**Every upgrade is a person.** You scavenge a dead research station whose crew still live on as echoes in its memory. Each power
you gain comes from one of them, and each time you must choose: **keep** them (you get stronger, but they become part of you) or
**release** them (they go free and stay as friends, but you stay just yourself). Your goggles let you flip between the station as it is
**now** (dark, wrecked) and as it was **then** (bright, alive, and full of ghosts).

What makes it not a Metroid or Castlevania copy:

1. **The Lens (L): two versions of every room.** Platforms, doors, enemies and hazards differ between Now and Then. Exploring is a
   matter of where *and when* you are. Flipping just before a hit lands is a **phase dodge** (a short slow-down, no damage), which
   gives the fighting its own rhythm.
2. **Keep or Release.** Six people, six choices with real effects on your build, the hub, the dialogue and the ending.
3. **Static, the cost of looking back.** Time spent in Then builds Static. High Static makes the game lie to you: false doors,
   enemies that are not there, a health bar that shows the wrong number, whispers in the text boxes. Some secrets only show up when
   Static is high. It is a resource, not just a horror effect.
4. **Notes from your past selves.** You are not the first Wren. You find the empty jackets and scratched notes of Wren-1 to Wren-6, who
   came this way before and failed. They give real hints ("Wren-4: the furnace door opens in Then. Don't trust the gardener.") and
   slowly reveal the twist.

## Story

**Setting.** *Vesper Station* drifts in a dead orbit. Forty years ago its crew joined the *Continuity Project*: their minds were
copied into the station's memory lattice so they could survive a long journey. Something went wrong (the crew call it *the Sleep*).
Their bodies died; their minds stayed, broken into echoes that relive their last days. The station's caretaker AI, **Tender**, has
spent the decades trying to keep "the family" together.

**You.** **Wren**, a scavenger, docks to strip the station for parts. Wren's goggles turn out to be a Continuity interface: through
them Wren can see and enter the station's memory (the Lens).

**The twist** (revealed in the middle, at the Stacks). Wren's ship has been docked for forty years. Tender *prints* Wren: the
original scavenger died here long ago, and Tender has rebuilt them from the lattice again and again, sending each copy to gather the
scattered crew so the family can be whole. You are copy seven. The hub's Then view, locked until this point, shows Wren's ship brand
new; the Now view shows it rusted to the frame.

**Tender** is warm, motherly and helpful, and is the closest thing the game has to a villain. It truly loves the crew, and its love
is the trap. It is never cartoon-evil; the final choice is about what it should become.

### The crew

Each crew member holds one of the station's biomes, and each echo is stuck in one way of grieving. The five stages of grief give the
game its emotional shape without ever being named.

| Echo | Who they were | Stuck in | Gives (Lens ability or move) |
| --- | --- | --- | --- |
| **Ossie Okafor** | Shuttle pilot, the station's joker | **Denial**: replays his pre-flight check, insists the launch is "any minute now" | **Dash** (A): his afterburner |
| **Dr. Imre Vasquez** | Botanist; the gardens were their whole world | **Bargaining**: grows the gardens wild to "make the station alive enough" to bring their daughter back | **Wall climb and wall jump**: grafted vine grips |
| **Halley Brandt** | Nurse who chose who to ease into sleep when the air ran out | **Depression**: tends empty beds, will not forgive herself | **Charge shot** (hold Y): her steady hands |
| **Tobiah "Tob" Lund** | Reactor engineer | **Anger**: blames the captain, Tender, everyone, and keeps the furnace roaring | **Missiles** (X): break sealed doors and armour |
| **Mei Vasquez** | Imre's 11-year-old daughter, the only child aboard | Hiding: she is still playing the hide-and-seek game from the day of the Sleep | **Slip**: slide (Down + A) through vents and low gaps |
| **Captain Adaeze Ruiz** | Signed off on the Continuity Project | **Acceptance**, almost: knows the truth and wants it to end | **Drift**: a second jump that floats in low gravity |

Mei is the heart of the story. Reuniting her with Imre (releasing both) opens the best secret ending. **Mei cannot be kept**: Wren
can only let her go (the choice screen offers Keep, and Wren refuses it in their own words), so no ending ever puts a child inside Wren.

## The choices

**Keep or Release (five times, plus Mei).** After a crew member's arc (usually their boss), Wren can **keep** or **release** them. The traversal
ability is learned either way, so you can never lock yourself out of the map. The choice changes everything else:

- **Keep:** you also gain their **Trait**, a strong passive (Ossie: a kill resets your dash; Tob: missiles split in two; Halley:
  standing still slowly heals). The echo lives in your head: short comments at key moments, sometimes hints, sometimes not.
  Each Keep makes Static rise faster (more voices). Wren's portrait changes: an eye takes on the echo's colour.
- **Release:** the echo appears in the hub (the docking bay) as an ally with a service. Ossie flies you between lifts (fast travel),
  Tob upgrades the blaster with salvage, Halley lowers Static and sells health, Imre grows hidden paths on the map, Mei finds
  collectibles, and the Captain tells the truth about the Project. Each has a side task.
- **Identity.** At four or more Keeps, some of Wren's own dialogue choices are replaced by lines in the kept crew's voices. The
  player watches Wren stop being Wren.

**Three big choices:**

1. **The Continuity Key** (after the twist). Tender asks Wren to fit a key that lets it print bodies for the whole crew. Fit it (Tender
   becomes an ally; printed "crew" start appearing, but something is off about them) or smash it (Tender turns cold; the Lattice opens
   by force and is harder).
2. **Halley's patient.** In the Ward, Halley begs Wren to read the log of who she let die, or to delete it. Reading it adds a scene with
   the Captain; deleting it frees Halley sooner but loses that truth.
3. **The last choice**, in the Core, from what you did before:
   - **Wake:** Tender prints everyone back into bodies. Needs the Key fitted. A hopeful but uneasy ending: are they really them?
   - **Sever:** shut down the lattice. Every remaining echo rests and the station dies. Wren, a copy, goes too, unless Ossie was
     released (he flies Wren out).
   - **Stay:** become the new Tender and look after the echoes, kindly this time. Needs three or more Releases.
   - **Chorus:** with five or more Keeps, Wren is no longer one person. The kept crew walk off the station in Wren's body.
   - **Hide and seek** (secret): with Mei and Imre both released and every Wren note found, Mei "finds" the first Wren, and the loop
     breaks. The best ending.

## Gameplay

### Controls (four-way aiming, as now)

| Button | Does |
| --- | --- |
| D-pad | Run; Up aims up; Down crouches or aims down in the air |
| B | Jump (hold for higher), wall jump, Drift (second jump) |
| Y | Shoot; hold to charge (after Halley) |
| X | Missile (after Tob) |
| A | Dash (after Ossie); Down + A: Slip (after Mei) |
| **L** | **Lens: flip between Now and Then.** Just before a hit lands: phase dodge |
| **R** | Talk and interact (Up is still fine at doors); later **Listen**: a short pulse that shows what is in the other layer nearby (costs Static) |
| Start / Select | Pause menu (map, crew, notes, settings) / quick map |

### The Lens, in practice

- Each room has a **Now** and a **Then** tile layer (both solid) plus a background for each. Flipping swaps which one is solid and
  shown. It is cheap on the handheld: it only changes which grid `lib/tiles.lua` reads.
- **Flipping into a wall is refused**, with a buzz and a flicker of the other layer, so you can see why.
- **Enemies have a layer:** *Now* (machines, rot), *Then* (echoes, which only Then shots hurt) or *both* (the dangerous ones).
- **Phase dodge:** flipping within about 6 frames of being hit makes you dodge, briefly slows time and refills a little dash.
- **Puzzles:** a door open in Then but sealed in Now; a bridge that only existed then; a fire burning now that was not burning then;
  carrying an object through time (a key card dropped then is still lying there now, forty years on, covered in dust).

### Static

- A bar under the health. It rises while you are in Then and falls in Now; it falls fast at rest points and with Halley.
- **25 to 50:** whispers in the corners of text boxes, faint crew silhouettes.
- **50 to 99:** hallucinations: false doors, fake enemies that cannot hurt you (but look the same), the map shows rooms wrongly,
  the health number lies. Some secret rooms only exist at this level.
- **100, Overload:** you are thrown back to Now, take damage and are stunned for a moment.
- The Lens battery upgrades raise how much Static you can take.

### Growing stronger

- **Six abilities** from the crew (table above), plus the **Lens** itself from Tender in the opening.
- **Six Traits** if you keep the crew.
- **Hull plates** (+1 health), **missile racks** (+3 missiles), **Lens batteries** (more Static): about 12, 8 and 6 hidden across the map.
- **Salvage** from enemies and crates, spent with Tob (if released) or at workbenches: blaster upgrades (wider shot, faster fire,
  shots that pass through Then and Now), more dash, quicker charge.
- **Wren notes** (seven, one per biome) and **crew logs** (short diary entries, about 40) for the story.

### Health and saving

- Wren has 4 hearts to start. Contact and shots do 1. Death returns you to the last terminal, keeping what you picked up (no punishing
  runbacks on a handheld).
- **Terminals** save and refill missiles; their Then side shows a crew member using them.
- **Lifts** link the biomes; after Ossie's release they are also fast travel.

## The biomes

Seven areas plus the hub, each with its own tileset, mood, enemies, music, and a different look in Now and Then. On Dot's fixed
palette each biome gets one colour family as its key colour.

| # | Biome | Now / Then | Key colour | Crew | Boss | Main traversal gate |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | **Docking Bay** (hub) | Wren's ship, a rest point; the bay rusted / busy with crew | grey and blue | (released allies gather here) | none | none |
| 1 | **Hangar Ring** | dark hangars with drifting debris / lit launch bays and shuttles | blue | Ossie | **Last Launch**: a burning shuttle chase that shifts between layers | Dash gaps |
| 2 | **The Overgrowth** (hydroponics) | the jungle has eaten the station / tidy rows of greenhouses | green | Imre | **The Mother Tree**, which grows new roots in one layer while you cut them in the other | Wall climb |
| 3 | **The Ward** (medbay) | quarantine, flickering, rooms that rearrange at high Static / a calm white clinic | teal | Halley | **The Night Shift**: rows of beds; only the right one holds her | Charge shot to break glass |
| 4 | **The Furnace** (reactor) | molten, venting, heat pipes / the reactor running cool and clean | orange and red | Tob | **The Engine**: a reactor golem whose armour only cracks to missiles fired in Then | Missile doors |
| 5 | **The Stacks** (archive and quarters) | dust and fallen shelves, dark rooms / warm quarters, a school corner | yellow and brown | Mei | **Hide and Seek**: a non-violent puzzle boss, finding Mei across both layers. **The twist happens here.** | Slip vents |
| 6 | **The Spine** (observatory, low gravity) | broken glass, open to space / stars through intact windows | purple | Captain Ruiz | **The Bridge**: the Captain's guilt as a shifting starship duel | Drift |
| 7 | **The Core** (the lattice) | a mind-space built from every memory, Wren's own included | all colours, inverted | Tender | **Tender**, in three phases shaped by your choices; you can talk it down if you released three or more | everything |

**Order.** The Hangar teaches the basics. After it the **Overgrowth and the Ward** are both open, in the order you choose. The Furnace
needs one of them; the Stacks need the Furnace; the Spine needs the Stacks; the Core needs the Spine. Backtracking with new abilities
reaches every older biome's secrets.

**Size.** About 15 to 20 rooms a biome (a room is one to four screens), roughly 120 rooms in all. Time budget: Hangar 30 min,
Overgrowth 40, Ward 40, Furnace 45, Stacks 40, Spine 40, Core 30, plus 30 to 60 min of secrets and backtracking: **about 5 hours**,
6 or more for everything.

## Enemies

Each biome has 4 to 6 kinds, each kind clearly different in shape and colour, plus a few that roam across biomes. The 24-32 pixel size
from the size guide is kept: no tiny sprites.

- **Hangar:** *Loader drones* (patrol, ram), *Rivet turrets* (fixed, shoot in four directions), *Debris swarms* (drifting), *Pilot
  echoes* (Then: re-enact the launch, run into you).
- **Overgrowth:** *Spore pods* (burst when shot), *Creepers* (crawl on walls and ceilings), *Pollinator bots* (fly in figure eights),
  *Graft hounds* (both layers: half animal, half plant).
- **Ward:** *Med-arms* (drop from the ceiling), *Sheeted figures* (Then: still until you look away; they move only while you face
  the other way), *Gurney runners*, *Fever lights* (stand in their light and Static rises).
- **Furnace:** *Slag crawlers*, *Steam valves* (timed hazards), *Welders* (shields that missiles break), *Angry echoes* (Then: charge at you).
- **Stacks:** *Paper moths* (swarms), *Shelf mimics*, *Toy robots* (Mei's toys, harmless until high Static).
- **Spine:** *Void jellies* (drift in low gravity), *Hull lancers*, *Glass shards* (spin and break).
- **Hollows**, everywhere at high Static: dark copies of Wren, the failed earlier Wrens. Fought only in Then; they drop notes.

## Sprites and look (rethink)

- **Wren stays** (32x32 scavenger, goggles, scarf), now with story meaning: the goggles *are* the Lens. They glow teal in Then.
  New frames: hurt, phase dodge (a split, two-tone afterimage), Slip, Drift, climb, talk.
- **Portraits** (48x48) for the text boxes: Wren (with eyes that change colour as you Keep), Tender (an abstract face of lights),
  and each crew member, with three expressions each.
- **Echoes** in Then are the crew drawn in one light colour with a scanline flicker, so they read as memories at a glance.
- **Now and Then tilesets** for each biome: Now darker and broken, Then brighter and tidy, from the same shapes, so the two layers
  line up.
- **Bosses** 48x48 to 64x64, built from several sprites when they need to be bigger.

## Dialogue and story delivery

- The engine's `gs.say` / `gs.ask` text box (in `engine/gs/talk.lua`), styled by a layout with a portrait slot. Lines stay short
  (handheld screen); every crew arc is about 3 to 6 short scenes.
- Story arrives through talking to echoes, crew logs at terminals, Wren notes, and what you see when you flip the Lens.
- Choices are always two or three plain options ("Keep him" / "Let him go").
- High Static changes some lines on the fly (a word swapped, a name replaced), which is cheap to do and unsettling to read.

## Sound

- One song per biome. The runtime cannot start a song part-way through, so flipping the Lens does not swap songs (restarting on every
  flip would be jarring); the flip has its own sound and a strong visual change instead. Then-only rooms and scenes may have their own songs. Boss songs, Tender's theme, a hub song that gains instruments as allies join.
- 4 music tracks and 4 sound effect channels (Dot's limits), with the `game-music` skill's guidelines.

## How it is built (technically)

- **Rooms:** each room is a scene layout (`scenes/rooms/<biome>_<nn>.layout.lua`) with `code = "room"`, so one room scene runs
  them all. Layers `now`, `then`, `back_now`, `back_then`. Doors are entities naming a target room and door. Screen-edge exits scroll
  into the next room like Metroid.
- **World data:** `lib/world.lua` lists rooms, biomes and links (for the map, fast travel and checks). A test makes sure every door has
  a partner and every room can be reached.
- **State:** `lib/state.lua` grows into the save: abilities, traits, choices, flags, items, map seen. One `gs.save` table.
- **Story:** `lib/story/<crew>.lua` holds each arc as plain data plus small coroutine scenes (`gs.go`).
- **Bots:** like Void Swarm and Panel Pop, a self-test (`GS_SELFTEST=1`) walks key routes, and `GS_ROOM=` jumps straight to any room
  for screenshots, so the agent can check every room without playing up to it.
- **Budget:** well under Dot's limits: ~50 entities in a room, two tile layers, 16 MB of art and sound.

## Order of work

1. **Core systems** (a playable grey-box): rooms and doors, the two-layer Lens and phase dodge, Static, health and damage, an
   enemy base with three sample enemies, terminals and saving, text boxes with portraits, the map, and the pause menu.
2. **Vertical slice: the Hangar Ring** from start to Ossie's choice, with final art, music and dialogue (about 30 minutes). This is the
   point to try it on the handheld and decide whether the hook is fun before building the rest.
3. **Overgrowth and Ward**, with the free order and the first big choice in the Ward.
4. **Furnace and Stacks**, with the twist, the Key choice and the hub's allies.
5. **Spine and Core**, the endings and Tender.
6. **Polish:** Static hallucinations, secrets and notes, balance, music, speed on the handheld, a title screen and credits.

## Decided

- The name is **Then & Now** (the cart is `carts/then-and-now`).
- Psychological and sad, **never gory**: no blood, no remains. Earlier Wrens are found as empty, slumped scavenger jackets beside
  their notes.
- **Mei cannot be kept.**
- The hub is **Wren's ship** in the Docking Bay.
- The first build goes as far as the **Hangar Ring slice**, then stops for a playtest on the handheld.
