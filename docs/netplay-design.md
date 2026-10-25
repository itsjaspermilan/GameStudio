# Netplay: two to four Bricks playing one game

Status: **planned, nothing built**. Decided with Jasper on 2026-10-25 (an interview, answers below), for games he makes to play with
Arya, each on a TrimUI Brick, in the same room. Build order is in section 9.

## The idea in one paragraph

Every Brick runs the **same game**, and each step they swap only their **button presses**, then all of them take that step. Nothing else
travels: no positions, no entities, a few bytes a step. This is lockstep, and it fits GameStudio because the engine already steps at a fixed
60 a second and replays to the identical frame (the save-state and resume tests check it). A game stays ordinary single-machine Lua that
knows there are several players; there is no sync layer in the game and nothing extra in a frame, as `AGENTS.md` asks.

## 1. What was decided

| Question | Answer |
| --- | --- |
| Where | Same room, same Wi-Fi. No internet play, so no NAT traversal and no rollback |
| Kinds of game | All of them: real-time co-op, real-time versus, turn-based, and a shared world where each Brick follows its own player |
| Players | Up to four |
| Starting a session | **The game makes its own menu** with `gs.net` calls (no built-in lobby screen) |
| Names | Asked each time a session starts; the game remembers the last name and offers it, and the player can change it |
| Private view | Yes: a Brick knows which player holds it (`gs.net.me`) and may draw things only that player sees |
| A Brick opens the NextUI menu, or Wi-Fi drops | Everyone pauses and waits ("waiting for Arya"); play carries on when all are back |
| Saves in a session | The host's save is the game's progress; each Brick keeps its own saves for playing alone |
| Joining | Fixed at the start: who plays is settled before the game starts; nobody drops in mid-game |
| Testing | Two Play panels on the Mac, and the Mac's Play panel together with a Brick over Wi-Fi |
| First game | A small versus arena for two to four players, shipped as the second example |
| When | This plan first; building starts after Jasper has tried the step-by-step tutorial |

## 2. How a step works

- Each Brick reads its own buttons for step *n* and sends them for step *n + D*, where *D* is the **input delay** (2 steps, 33 ms, to start;
  raised to 3 or 4 automatically when the measured round trip needs it). A press takes effect D steps later on every Brick at once, so
  versus play is fair: everyone has the same delay.
- A step runs only when every player's buttons for it have arrived. If they haven't, the Brick waits (section 6).
- **Transport:** UDP on the local network. Every packet carries the sender's last 8 steps of buttons, so a lost packet almost never
  stalls anything (the next one has the same steps). Buttons are 16 bits a player a step (the 16 names in `engine/gs/input.lua`).
- In the engine, network buttons come in the way the bot hook's already do: `input.lua` reads `sim_held` instead of the device while a bot
  plays, and a session reads each player's buttons for the step from the network the same way.
- **Four players:** the host relays: each Brick sends to the host, the host sends everyone's buttons to everyone. On one Wi-Fi network this
  adds a few milliseconds, well inside the delay, and keeps the code to one connection each.
- Sound plays on every Brick (everyone hears everything), drawing happens on every Brick, both from the same state.

## 3. Staying in step (determinism)

Lockstep only works if every Brick computes exactly the same step from the same buttons. Brick to Brick is the same program on the same
processor, so the work is about the few things that differ between runs:

1. **Lua's string hashing.** Lua 5.4 seeds it from the clock and memory addresses (`luai_makeseed` in `third_party/lua/src/lstate.c`), so
   `pairs()` walks the same table in a different order on each Brick. Fix: build Lua with a fixed seed (`-Dluai_makeseed=...`, no change to
   the vendored file). Costs nothing; a single-player game cannot tell.
2. **Random numbers.** `gs.random`, `gs.choose`, particles and camera shake use `math.random`, which Lua seeds at random. Fix: the host picks
   a session seed and every Brick calls `math.randomseed(seed)` when the session starts. `gs.rng(seed)` already repeats.
3. **Draw code must not change the game.** With private views, draw code differs per Brick. So during drawing, `math.random` is switched to a
   generator of the Brick's own (draw-time sparkle cannot pull numbers from the shared stream), and the rule "draw and draw_ui only draw" goes
   in the guide. The engine's own drawing already only reads.
4. **The camera is per Brick.** In a shared world each Brick follows its own player (`gs.camera:follow(self.players[gs.net.me])`). The camera
   lives in the step but nothing in the game may depend on where it is; the guide says so, and `to_world` / `to_screen` are for drawing and input
   only.
5. **Clock time.** `os.time`, `os.clock` and real-time timers must not decide anything. The engine uses `os.clock` only to profile.
6. **The Mac with a Brick** (testing): different processors, compilers and maths libraries. `sin`, `cos`, `atan`, `exp`, `log` and `pow` from
   macOS and from the Brick's C library can differ in the last bit, and the compilers may fuse multiply-adds differently. Fix: build both
   with `-ffp-contract=off`, and give `math.sin` and friends one bundled implementation compiled into `gs` (a small permissive libm source
   in `third_party/`). Brick-to-Brick play does not need this; Mac-with-Brick does. Measure first: if the bundled maths is slower on the
   Brick, use it only during a session.
7. **A drift detector.** Every 60 steps each Brick hashes the game's state (every entity's class, id, x, y, vx, vy and the scene's own numbers)
   and sends the hash with its buttons. If two differ, the session stops with a plain message ("the games went out of step at 12.4 s") instead
   of carrying on as two different games. In the studio the Output also names the first entity that differs, from a fuller dump of both.

## 4. The game's side: the API

A game says how many it allows in `game.lua`: `players = 4` (1 when left out). Reading buttons:

```lua
gs.input.held("a", 2)        -- player 2's A; no number means player 1, so single-player code is unchanged
gs.input.pressed("start", p)
local dx, dy = gs.input.dir(p)
```

The game draws its own menus with `gs.net`:

```lua
gs.net.name()                 -- the name this game remembered last time ("" the first time); the menu offers it to change
gs.net.host(name)             -- start a session and wait for others; this Brick is player 1
gs.net.find()                 -- sessions of this game on the network: { { id, name, players, max }, ... }  (call it every step to refresh)
gs.net.join(id, name)         -- ask to join one
gs.net.peers()                -- who is in the session: { { player = 1, name = "Jasper" }, ... }
gs.net.start("scenes.arena")  -- the host starts the game: every Brick enters that scene on the same step, with the same seed and the host's save
gs.net.leave()
gs.net.state                  -- "off", "hosting", "joining", "lobby", "playing", "waiting"
gs.net.me                     -- the player holding this Brick (1 when not in a session)
gs.net.count                  -- players in the session (1 when not in one)
```

- Before `gs.net.start` the menus run on each Brick alone (not in lockstep): typing a name, choosing who hosts. After it, everything is in
  lockstep until the session ends.
- **Names** are stored in the game's own save, so each game remembers what you called yourself in it (`gs.net.name()`), and the menu lets you
  change it each time.
- **The host's save:** at `gs.net.start` the host sends its save to the others. In the session every Brick reads that save, so all read the
  same values; writes go to the host's save file only (the others keep them in memory for the session). Playing alone uses each Brick's own
  save, untouched by sessions.
- A game that only ever has one player never touches `gs.net` and pays nothing for it.

## 5. Private views

`gs.net.me` is the one value that differs per Brick. Draw code uses it to show a player's own hand of cards, their own map or their own
camera; update code must not branch on it (that would be two different games). The lint in the studio's code editor warns when
`gs.net.me` appears inside `update` or a collision handler.

## 6. Pauses, drops and the end of a session

- When a Brick's buttons for the next step have not arrived for half a second, every other Brick freezes the game and the engine draws a
  small box over it: "Waiting for Arya". Opening the NextUI menu on one Brick does this for the others, and so does a Wi-Fi drop. Play carries
  on, on the same step, when the buttons arrive again.
- After 30 seconds of waiting the box offers to end the session. Ending it (or `gs.net.leave()`, or a drift) calls the scene's
  `on_net_end(reason)` if it has one, otherwise goes back to the scene the game started from.
- NextUI's save states, Resume and rewind would put one Brick on a different step: during a session the core refuses them (minarch is told
  the core cannot save state). Playing alone, they work as before.

## 7. The studio

- **Play with two:** a choice on the Play panel runs the game twice, side by side, each a runtime of its own joined over this Mac, each
  taking the keys while it has focus. Up to four can be added. The panels show `gs.net.state` and the measured delay.
- **Mac with a Brick:** the Play panel can host or join over Wi-Fi like a Brick; the protocol is the same.
- **Live reload in a session:** saving a file reloads it on every studio instance on the same step (the host chooses the step). A Brick in the
  session cannot reload, so saving while a Brick plays ends the session with a clear message.
- The **Inspector** follows one instance at a time; pausing it pauses the session (everyone waits).
- The Handheld tab gains a line for the delay and how often a step had to wait.

## 8. The runtime and the core

- UDP sockets in C (`runtime/net.c`), non-blocking, polled once a step: send, receive, and answer discovery. Discovery is a UDP broadcast on
  the local network ("who is hosting `<game id>`?") answered by hosts. The game id is the game's title and console, so different games never
  find each other.
- The libretro core uses the same code; a core may open sockets. NextUI's own Wi-Fi setting must be on; if it is off, `gs.net.find()` finds
  nothing and `gs.net.host` returns an error the game can show ("Turn on Wi-Fi in NextUI's settings").
- Cost per step: one small packet out, a few in, a hash every 60 steps. Nothing measurable next to a frame.

## 9. Build order

1. **Determinism**, testable on one Mac: fixed string-hash seed, session seed for `math.random`, a draw-time generator of its own, the state
   hash. A test runs a game twice in separate processes with the same recorded buttons and compares the hashes every 60 steps.
2. **Players:** `players =` in `game.lua`, `gs.input.*(name, player)`, `gs.net.me` and `gs.net.count`, the lint rule.
3. **Transport and `gs.net`:** `runtime/net.c`, discovery, host/join/peers/start/leave, the input delay, the relay for four.
4. **Waiting and ending:** the waiting box, the 30-second offer, `on_net_end`, save states refused in a session.
5. **The studio:** Play with two (and four), Mac with a Brick, live reload across instances.
6. **The example:** a versus arena for two to four players (short rounds, one screen, each player a colour), with a Help page that builds a
   smaller one step by step. Then the cross-machine maths (section 3, item 6) when Mac-with-Brick testing needs it.
7. **On two Bricks:** discovery on the home Wi-Fi, the delay that feels right, the NextUI menu pause, a Wi-Fi drop, a long session with
   the drift detector quiet.

## 10. Open questions

- Does NextUI's minarch have netplay of its own? As far as known it does not (RetroArch does); if it does, see whether it fits before
  building section 8.
- The Brick's Wi-Fi power saving may add tens of milliseconds now and then; measure the round trip between two Bricks before fixing the
  delay at 2.
- Whether the bundled maths (section 3, item 6) is needed at all if Mac-with-Brick testing turns out to be rare.
