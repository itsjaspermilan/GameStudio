# The Dead Letter Office: the plan for a 3-4 hour story RPG

A design for a quiet, story-first RPG about delivering letters that never arrived, in a city rebuilding after a war, for the Dot
handheld (320x240, D-pad, A B X Y, L R, Start, Select). It covers the hook, the story, the letters, how finding a recipient works,
the light battles, the city, the look, the sound, how it is built and the order to build it in. Nothing here is built yet. The cart
will be `carts/dead-letter`.

## The pitch in one line

**Every letter is a quest, and half of them are from the same person.** You are the new clerk at the Dead Letter Office of
Corvel, a city two years after a war. Each week you get a bundle of letters that could not be delivered: smudged, addressed to
streets that were renamed or no longer exist, to people who moved or changed their names. You find them. Each delivery is a short
story. Together the letters signed only **"R."** tell what really happened on the night the lower city flooded.

What makes it its own game:

1. **Detective work, not fetch quests.** A letter gives clues (a part of a name, an old street name, a smell of fish, a stamp from
   the north). The city gives the rest: the **Directory** (old and new street names), people's memories, shop signs, the
   **Then map** (the city before the war) laid over the **Now map**. You make the match yourself; the game checks it.
2. **Delivering is a choice.** Some letters should not be delivered as they are: a soldier's last letter to a woman who has since
   remarried, a confession, a forgery. You can deliver, hold, return to sender, or read it first (reading is a choice the
   game remembers).
3. **The war is never fought on screen.** The only battles are small, short ones in the ruined districts (stray dogs, looters,
   salvage gangs, broken machines), and most can be talked out of.
4. **A small, finished game.** About 20 letters across four weeks. The easiest of the RPG plans to build: mostly talking, maps and
   one good menu, which makes it a good test of how far `gs.say` / `gs.ask` can carry a story game.

## Story

**Setting.** Corvel, a river city. Two years ago the war's last advance reached the river. To stop it, someone opened the old
Weir (the river gate), flooding the lower city: the advance was stopped, the city was saved, and the Low Quarter drowned. It has
been drained since, but is half ruin. No one was ever named as the one who opened the Weir. The new government calls it "the Act of
the Weir" and does not talk about it.

**You.** **Ines Marr**, 24, from the farms upriver, takes the only job she could find: clerk at the Dead Letter Office, a dusty room
under the Central Post. She is practical, kind, a little nosy.

**The Office.** **Mrs. Halloran**, the postmistress, strict and fair. **Bram**, the office porter, a big quiet ex-soldier with a
bad leg who comes along on deliveries to the Low Quarter. **Pip**, a pigeon who lives in the office (comic; carries notes).

**The R. letters.** Each week brings one or two letters signed "R." with no return address, to families of people lost in the
flood. They are apologies and explanations: R. was the one who opened the Weir. Delivering them, Ines meets the families, hears
their side, and pieces together the night: the order that came, the order that did not come, the choice R. made alone.

**The twist.** R. is **Ruth Halloran**: Mrs. Halloran, the postmistress. She has been writing them at night and slipping them into
the dead letter bags herself, because she could not bear to send them openly, or to never send them.

**The last letter.** Week four ends with an R. letter addressed to the city newspaper: a full confession with names, including the
officers who refused to give the order and let her carry it. Ines chooses:

- **Deliver it**: the truth comes out; Halloran is put on trial; the families get their answer; the city starts to talk.
- **Give it back to her**: she thanks you; she will decide herself; the epilogue shows what she does depending on what Ines told
  her about the families.
- **Burn it**: possible, quiet, and the families never know. The game does not judge it but the epilogue is lonely.

The epilogue changes with how many letters you delivered well, whom you helped, and what you said to Halloran.

Tone: gentle, bittersweet, hopeful. Grief and guilt without anything graphic: no bodies, no wounds; the flood is told through
empty rooms, water marks on walls and what people say.

## The letters

Four weeks, five letters a week (one or two of them from R.). Each letter has: what the envelope says, clues inside (if you read
it), the true recipient, a story, and outcomes. A sample of the full set:

| Week | Envelope | Who it is really for | The story |
| --- | --- | --- | --- |
| 1 | "To Mama, the blue door, Tanners Row" | Tanners Row is now Liberty Street; three blue doors. The one with the cat | A boy's school letter from before the war; his mother keeps it with his others |
| 1 | "Mr. A. Vos, Clockmaker" (no street) | Vos changed his name to Voss to sound less foreign; he repairs the Post's clock | His sister, abroad, is alive |
| 1 | R. letter to "the family of Sela Brin" | The Brins moved to the hill; the daughter runs a fish stall | The first R. letter. The daughter is angry, then reads it twice |
| 2 | A parcel with a toy horse, "to Lio, Low Quarter" | Lio is grown, works on the drain crews | Ines must go into the Low Quarter with Bram (the first battles) |
| 2 | Water-stained, only "...dear Hen..." readable | Henrike, the florist, or Hendrik, the tram driver? Clues in the letter's smell (lilies) | A love letter; the wrong delivery is possible and causes trouble |
| 2 | A government letter, "Private Otto Hale" | Otto is listed dead. He is alive, a beggar under the bridge, ashamed | Deliver, or not: it is his discharge pay |
| 3 | Unaddressed, a drawing of a lighthouse | The Weir keeper's old cottage (there is no lighthouse; a child drew the Weir tower) | Leads to the Weir and a key R. clue |
| 3 | R. letter to "Captain D. Marek" | Marek is the city's new hero, a councillor; he refused the order | He wants the letter destroyed and offers Ines money |
| 4 | Ines's own name, from her village | Her brother, who she thought ran away to the war | A personal letter, delivered by Pip to her |
| 4 | R. letter to the Corvel Courier | The newspaper | The last letter (see the story) |

The other ten are smaller (a pension, a recipe, a will, a ransom note that is a joke, a soldier's letter to a horse).

## Finding a recipient

- **The letter screen:** the envelope (front and back: stamps, postmarks, smudges) and, if opened, the letter. Highlighted words
  can be **pinned** as clues (A on a word).
- **The Directory:** a book in the office listing streets old and new, trades and some names. Search it by a pinned clue.
- **The map:** the city in Now, with the **Then** map from before the war one button away (L). Old street names show on Then.
- **Asking people:** talking with a pinned clue selected adds "Ask about ..." to the conversation (`gs.ask`). Shopkeepers, the
  tram driver, the drain crews, old women on benches know things.
- **Delivering:** at a door, choose the letter. If it is the right person, their story plays. A wrong delivery is possible (and
  sometimes funny, sometimes painful); the letter comes back next week with "not known here" stamped on it.
- **The ledger** in the office records every letter: delivered, held, returned, read or not. It is the save screen too.
- **Hints:** Mrs. Halloran gives one hint a week if asked; Pip pecks at the right district on the map once per letter.

## Battles

Only in the **Low Quarter** and the **Weir works** (and one in the old rail yard). About 15 in the whole game.

- **Two on the field:** Ines (a postbag swing, a whistle) and Bram (a cane, can take hits for Ines). Turn-based: **Act, Talk,
  Item, Run**.
- **Talk** is the special part: most enemies can be **calmed** instead of beaten. Each has a mood bar; Talk options (offer food,
  show the post badge, say a name you learned) move it. A calmed foe leaves and sometimes becomes a contact later (a looter gang's
  kid becomes a messenger).
- Health small (Ines 20, Bram 40), damage single digits. A loss sends you back to the office with a bruise and a talk with Bram;
  nothing is lost.
- Enemies: stray dog pack, river rats, looter, salvage gang boss, a broken pump machine, Marek's hired men (week 3).

## The city

- **Districts:** the **Central Post** (hub, the office), **Market Hill**, **Tanners** (now Liberty), **the Bridges**, the
  **Low Quarter** (ruins, opens in week 2), the **Weir** (opens in week 3), and **the Heights** (the rich, week 3).
- Each district is a map of about 40x30 16-pixel tiles with 3 to 6 interiors. The tram links them (a short ride scene).
- **Weeks pass** between chapters: the city changes a little each week (rebuilt houses, new shop signs, a market that moves),
  so returning to a district is never the same.

## Look

- Dot's fixed palette: soft greys and browns for the city, warm lamplight, river blues; the Low Quarter in water-stained greens.
- **Field sprites** 16x24, 4-way, 4-frame walk: Ines, Bram, about 30 townspeople (many from shared bodies with different heads
  and colours).
- **Portraits** 48x48 for Ines (four faces), Bram, Halloran, Pip, every letter's recipient (about 20, one or two faces each).
- **Envelopes and letters** are drawn screens (the heart of the game): paper texture from a tileset, handwriting from a sprite
  font made to look handwritten (`gs.draw.font_text`), stamps as 16x16 sprites.
- Battle sprites 32x32. Read `help('art')` and `help('sizes')` first.

## Dialogue

- `gs.say` / `gs.ask` with a portrait slot. Lines are short and plain; letters themselves are longer (a page of 6-8 short lines,
  scrolled with the D-pad).
- Each letter's story is a small file, `lib/letters/<id>.lua`: the envelope, the letter text, clues, recipient, the delivery
  scene (a `gs.go` script), and outcome flags.
- People's talk is a function of (week, flags, pinned clue) in `lib/people/<district>.lua`.

## Sound

- General MIDI, 4 music tracks, 4 sound channels. Read `help('music')` first.
- Songs: the office (a slow piano waltz; the theme of the game), each district (Market Hill: accordion; the Bridges: clarinet and
  bass; Heights: a string quartet; Low Quarter: almost nothing, a low pad and water drops), the tram, battle (short and light, not
  heroic), the Weir, Halloran's theme (the office waltz on cello), the last letter, the ending.
- Sound effects: paper unfolding, stamp thump, pen, pigeon, tram bell, door knock, the "delivered" chime.

## How it is built (technically)

- **Scenes:** `title`, `field` (maps are layouts with `code = "field"`: `scenes/maps/<district>.layout.lua` and interiors),
  `office` (the hub: ledger, Directory, desk), `letter` (reading an envelope and letter, pinning clues), `map` (Now and Then),
  `battle`, `tram`, `ending`.
- **Letters are data:** `lib/letters/<id>.lua` and an index `lib/letters.lua` with the week each one arrives.
- **Clues:** `lib/clues.lua`: a pinned clue is an id ("tanners_row", "lilies"); the Directory, people and doors match on ids.
- **Battle rules are pure:** `lib/battle.lua` (acts, moods, talk effects), no drawing; same seed, same fight.
- **State:** one `gs.save` table: week, ledger (each letter's state and whether it was read), pinned clues, flags, contacts, items;
  saved from the ledger in the office.
- **Tests and bots:** `GS_SELFTEST=1` checks every letter's recipient exists, has a door, and can be found from its clues (every
  clue id it needs is given by the envelope, the letter, the Directory or a person reachable in that week); every map door has a
  partner; a bot delivers every letter of every week correctly and reaches each of the three endings; it prints
  `DEAD LETTER TEST PASS`. Shortcuts in `lib/debug.lua`: `GS_WEEK`, `GS_MAP`, `GS_LETTER=<id>`, `GS_BATTLE=<encounter>`,
  `GS_SCREEN=office|letter|map|directory`.
- **Assets** from `scripts/make-dead-letter.mjs` (art in `scripts/dead-letter/*.mjs`, maps in `scripts/dead-letter/maps.mjs`);
  never touches code or `meta/info.json`.
- **Budget:** small; a district map has under 50 entities.

## Order of work

1. **The letter loop** in grey boxes: the office, one district, the letter screen with pinning, the Directory, the map (Now and
   Then), asking people about a clue, delivering, the ledger and saving.
2. **Week 1** in full, with final art for the office, Tanners and Market Hill, songs and dialogue (about 40 minutes). **Stop here**
   for a playtest on the handheld: is the letter screen readable at 320x240, does pinning feel good, are the clues fair.
3. The battle core and the Low Quarter; week 2.
4. Weeks 3 and 4: the Weir, the Heights, Marek, the twist and the last letter.
5. The endings and epilogue, the city changing between weeks, Pip's hints, balance, music, title and credits.

## Building it alongside the other games

Several sessions build different games at the same time, so keep to this game's own files:

- Everything lives in `carts/dead-letter/`, `scripts/make-dead-letter.mjs` and `scripts/dead-letter/`.
- **Do not change the engine** (`engine/`, `runtime/`) or the studio. If the game truly needs something the engine lacks, first look
  for a way in the cart's `lib/`; if there is none, make the engine change small, additive and tested, in a commit of its own, and
  say so in the commit message, since other sessions may need to merge it.
- Shared files get only one added line each, at the end of the work: a row in `carts/AGENTS.md`, the cart in `tests/run.sh`, an
  item in `TODO.md`.

## Open questions (decide in the first playtest)

- Does reading a letter before delivering it need a cost, or is the remembered choice enough?
- Should wrong deliveries be allowed at all? (Planned yes: they are some of the best stories. Keep them gentle.)
- A handwritten sprite font: is it readable at 8 pixels, or do letters need a 16-pixel-tall font?
