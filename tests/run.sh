#!/bin/sh
# Headless tests: tests/run.sh   (needs build/gs)
cd "$(dirname "$0")/.."
run() { GS_SAVE_DIR="${TMPDIR:-/tmp}/gs-test-saves" SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy GS_MAX_FRAMES="${FRAMES:-600}" "$@" 2>&1; }
status=0

# The Lua framework (engine/gs): entities, inheritance, collisions, timers, tweens, animation clips, camera, saves, sound errors, limits,
# live reload and scenes. The fixture checks itself and prints FRAMEWORK TEST PASS. GS_DEV=1 switches live reload on.
out="$(GS_DEV=1 FRAMES=1500 run ./build/gs tests/framework)"; echo "$out"
echo "$out" | grep -q 'FRAMEWORK TEST PASS' || { echo "FAIL: framework test"; status=1; }
echo "$out" | grep -q '^FAIL' && { echo "FAIL: framework check failed"; status=1; }

# Sound effects and music load into the synth and play without errors; unknown names are reported.
out="$(run ./build/gs tests/audiotest)"; echo "$out"
echo "$out" | grep -q 'AUDIO TEST PASS' || { echo "FAIL: audio test"; status=1; }
echo "$out" | grep -q 'UNKNOWN SFX REJECTED / UNKNOWN MUSIC REJECTED' || { echo "FAIL: unknown sounds not rejected"; status=1; }

# Instruments (pulse, wavetable, noise, sample), a tracker song and a sound effect that names an instrument all load and play;
# an unknown instrument name is reported.
out="$(run ./build/gs tests/songtest)"; echo "$out"
echo "$out" | grep -q 'SONG TEST LOADED' || { echo "FAIL: song test"; status=1; }
out="$(run ./build/gs tests/song-bad)"; echo "$out" | grep -q 'unknown instrument: nope' || { echo "FAIL: unknown instrument not reported"; status=1; }

# Ready-made instruments, sound effects with several tracks (and the older one-row form) and songs with an instrument per track.
out="$(run ./build/gs tests/bandtest)"; echo "$out"
echo "$out" | grep -q 'BAND TEST LOADED' || { echo "FAIL: band test"; status=1; }
echo "$out" | grep -qi 'error' && { echo "FAIL: band test reported an error"; status=1; }
out="$(run ./build/gs tests/band-bad)"; echo "$out" | grep -q 'unknown instrument: nopiano' || { echo "FAIL: unknown track instrument not reported"; status=1; }

# The sample games must load and run without errors or warnings (GS_SAVE_DIR keeps the test away from real saves).
for game in carts/breakout carts/void-swarm carts/panel-pop carts/kitchen-rush carts/then-and-now carts/buttontest carts/padsetup; do
  out="$(run ./build/gs "$game")"
  echo "$out" | grep -qiE 'error|^warning:' && { echo "$out"; echo "FAIL: $game printed an error or warning"; status=1; }
done

# The studio's inspector (GS_INSPECT): a paused game stays on one step, answers with kinds and their costs, and evaluates watches.
insp="$(mktemp)"; printf '{"open":true,"paused":true,"step_seq":3,"watch":["gs.count(\\"player\\")","1 +"]}' > "$insp"
out="$(GS_INSPECT="$insp" FRAMES=120 run ./build/gs carts/breakout)"; rm -f "$insp"
last="$(echo "$out" | grep '^@@gsi ' | tail -1)"
echo "$last" | grep -q '"paused":true' && echo "$last" | grep -q '"classes":\[' && echo "$last" | grep -q '"error: ' \
  && [ "$(echo "$out" | grep '^@@gsi ' | sed -E 's/.*"step":([0-9]+).*/\1/' | sort -u | wc -l | tr -d ' ')" = 1 ] \
  || { echo "$out" | tail -3; echo "FAIL: the inspector did not pause, report or watch"; status=1; }

# A game can carry its own console (consoles/tiny.json, 240x160).
out="$(run ./build/gs tests/customconsole)"
echo "$out" | grep -q 'CUSTOM CONSOLE Tiny 240x160' || { echo "$out"; echo "FAIL: a game's own console was not used"; status=1; }

# Colour banks (palette.json): bank lookups, "bank:place" colours, and a palette swap that must look exactly like rectangles in the new colours.
out="$(FRAMES=60 run ./build/gs tests/banks)"
echo "$out" | grep -q 'BANKS TEST PASS' || { echo "$out"; echo "FAIL: colour banks"; status=1; }
tmp="$(mktemp -d)"
GS_DUMP_FRAME="$tmp/swap.bmp" FRAMES=60 run ./build/gs tests/banks >/dev/null
GS_BANKS_PLAIN=1 GS_DUMP_FRAME="$tmp/plain.bmp" FRAMES=60 run ./build/gs tests/banks >/dev/null
[ -s "$tmp/swap.bmp" ] && cmp -s "$tmp/swap.bmp" "$tmp/plain.bmp" || { echo "FAIL: a palette-swapped sprite does not show the other bank's colours"; status=1; }
rm -rf "$tmp"

# A plain main.lua game (the format before game.lua) is refused with a message that says what to do, not run or crashed.
plain="$(mktemp -d)"; printf 'function draw() end\n' > "$plain/main.lua"
out="$(run ./build/gs "$plain")"; rm -rf "$plain"
echo "$out" | grep -q 'needs a game.lua' || { echo "$out"; echo "FAIL: a plain main.lua game was not refused clearly"; status=1; }
# Panel Pop's menus lead into a game on one board and a Vs game (seen in the stats line the play scene prints with GS_STATS), and every other
# screen opens and closes without an error.
out="$(GS_STATS=1 GS_BOT_LUA=tests/keys-bot.lua GS_KEYS='start,wait*30,a,wait*30,a,a,wait*30' FRAMES=700 run ./build/gs carts/panel-pop)"
echo "$out" | grep -q 'stats play/endless' || { echo "$out" | tail -3; echo "FAIL: panel-pop menus did not start Endless"; status=1; }
out="$(GS_STATS=1 GS_BOT_LUA=tests/keys-bot.lua GS_KEYS='start,wait*30,down,down,a,wait*30,right,a,a,wait*30' FRAMES=700 run ./build/gs carts/panel-pop)"
echo "$out" | grep -q 'stats play/vs' || { echo "$out" | tail -3; echo "FAIL: panel-pop menus did not start Vs CPU"; status=1; }
out="$(GS_BOT_LUA=tests/keys-bot.lua GS_KEYS='start,wait*30,up,up,a,wait*30,a,a,b,wait*30,up,a,wait*30,b,wait*30,up,a,wait*30,right,down,b,wait*30,up,a,wait*30,down,down,a,a,wait*300,start,down,a,wait*20,down,a,wait*30' FRAMES=1200 run ./build/gs carts/panel-pop)"
echo "$out" | grep -qi 'error' && { echo "$out"; echo "FAIL: panel-pop menus printed an error"; status=1; }

# Void Swarm (written with entities and scenes, a good stress test of the framework) plays itself (GS_BOT) through a sector, fast-forwarded,
# and prints one result line; any Lua error fails it. Then a different pilot and sector with the boss close, and the text audit of all its screens.
out="$(GS_BOT=1 GS_FF=30 GS_STAGE=3 GS_UPG=5 GS_T0=560 GS_BOT_SECS=60 FRAMES=1500 run ./build/gs carts/void-swarm)"
echo "$out" | grep -q '^BOT pilot=' || { echo "$out"; echo "FAIL: void-swarm bot did not finish a run"; status=1; }
echo "$out" | grep -qi 'error' && { echo "$out"; echo "FAIL: void-swarm bot run printed an error"; status=1; }
out="$(GS_BOT=1 GS_FF=30 GS_STAGE=8 GS_PILOT=5 GS_UPG=3 GS_T0=560 FRAMES=3000 run ./build/gs carts/void-swarm)"
echo "$out" | grep -q '^BOT pilot=gravis stage=8' || { echo "$out"; echo "FAIL: void-swarm boss run did not finish"; status=1; }
echo "$out" | grep -qi 'error' && { echo "$out"; echo "FAIL: void-swarm boss run printed an error"; status=1; }
out="$(GS_TEXTAUDIT=1 FRAMES=600 run ./build/gs carts/void-swarm)"
echo "$out" | grep -q 'TEXT AUDIT DONE, overflows: 0' || { echo "$out" | tail -5; echo "FAIL: void-swarm text overflows"; status=1; }
# the menus, scripted with button presses (the credits let it buy things): no errors
out="$(GS_CREDITS=5000 GS_BOT_LUA=tests/keys-bot.lua GS_KEYS='a,wait*30,down,a,wait*30,down,a,a,left,a,b,wait*30,down,a,wait*30,a,a,down,a,b,wait*30,up,up,up,a,wait*30,a,wait*60,start,wait*5,down,a,wait*30,a' GS_FF=4 FRAMES=900 run ./build/gs carts/void-swarm)"
echo "$out" | grep -qi 'error' && { echo "$out"; echo "FAIL: void-swarm menus printed an error"; status=1; }

# Panel Pop tests itself (lib/tests.lua): board rules, chains, garbage, the CPU player, every puzzle and stage.
out="$(GS_SELFTEST=1 run ./build/gs carts/panel-pop)"; echo "$out" | tail -3
echo "$out" | grep -q 'PANEL POP TEST PASS' || { echo "$out"; echo "FAIL: panel-pop self-test"; status=1; }

# Kitchen Rush tests itself (lib/tests.lua): the kitchen's rules, then the bot cooks every day and must earn a star. Then its menus
# lead into Monday, every food button, L, R and the pause menu's How to play are pressed, and nothing prints an error.
out="$(GS_SELFTEST=1 run ./build/gs carts/kitchen-rush)"; echo "$out" | tail -3
echo "$out" | grep -q 'KITCHEN RUSH TEST PASS' || { echo "$out"; echo "FAIL: kitchen-rush self-test"; status=1; }
out="$(GS_BOT_LUA=tests/keys-bot.lua GS_KEYS='a,wait*30,a,wait*160,x,a,b,y,up,right,down,left,r,l,r,start,wait*10,down,a,wait*40,a,wait*10,up,a,wait*30,start,down,down,down,a,wait*30' FRAMES=800 run ./build/gs carts/kitchen-rush)"
echo "$out" | grep -qi 'error' && { echo "$out"; echo "FAIL: kitchen-rush menus printed an error"; status=1; }

# Then & Now checks every room (lib/debug.lua): Wren never arrives at a door inside a wall, in either era.
out="$(GS_SELFTEST=1 FRAMES=300 run ./build/gs carts/then-and-now)"; echo "$out" | tail -2
echo "$out" | grep -q 'THEN AND NOW TEST PASS' || { echo "$out"; echo "FAIL: then-and-now self-test"; status=1; }

# The adaptive CPU floor (raised while frames are late, put back afterwards, recovered after a killed game) on made-up files.
dir="$(mktemp -d)"
echo 480000 > "$dir/scaling_min_freq"; echo 1512000 > "$dir/scaling_max_freq"
echo "480000 792000 1008000 1200000 1320000 1416000 1512000 1600000 1704000" > "$dir/scaling_available_frequencies"
out="$(./build/gs boost-selftest "$dir" 2>&1)"
echo "$out" | grep -q 'BOOST SELFTEST PASS' || { echo "$out"; echo "FAIL: CPU floor controller"; status=1; }
rm -rf "$dir"

# meta/ at the top of a project (box art for game lists) stays out of the cartridge; a folder called meta deeper down is packed like any other.
tmp="$(mktemp -d)"; cp -R tests/songtest "$tmp/g"
base="$(./build/gs pack "$tmp/g" "$tmp/a.cart" | grep -o 'packed [0-9]*')"
mkdir -p "$tmp/g/meta" "$tmp/g/sub/meta"; echo x > "$tmp/g/meta/box_art.png"; echo y > "$tmp/g/sub/meta/keep.txt"
with="$(./build/gs pack "$tmp/g" "$tmp/b.cart" | grep -o 'packed [0-9]*')"
[ "$with" = "packed $(( ${base#packed } + 1 ))" ] || { echo "FAIL: meta/ packing ($base, then $with)"; status=1; }
rm -rf "$tmp"

# Tile layers are drawn from one composed picture each; the frame must look exactly like drawing them tile by tile (GS_NO_LAYER_PICTURES=1).
tmp="$(mktemp -d)"
(export GS_NO_LAYER_PICTURES=1; GS_DUMP_FRAME="$tmp/tiles.bmp" FRAMES=120 run ./build/gs carts/breakout >/dev/null)
GS_DUMP_FRAME="$tmp/pic.bmp" FRAMES=120 run ./build/gs carts/breakout >/dev/null
[ -s "$tmp/pic.bmp" ] && cmp -s "$tmp/tiles.bmp" "$tmp/pic.bmp" || { echo "FAIL: breakout looks different when its tile layers are drawn from pictures"; status=1; }
rm -rf "$tmp"

# Starting a sound is posted to a queue the audio thread empties (the game never waits for the mixer); breakout's title scene starts its music.
out="$(GS_PERF=1 run ./build/gs carts/breakout)"
echo "$out" | grep -qE 'sound commands carried out: [1-9]' || { echo "FAIL: starting music did not reach the audio thread"; status=1; }

# The studio's Handheld panel reads a line of numbers a second from the running game (GS_STATS=1): entities, time per step and frame, fps, memory.
out="$(GS_STATS=1 FRAMES=150 run ./build/gs carts/breakout)"
echo "$out" | grep -qE '^@@gs \{"entities":[0-9]+,"peak":[0-9]+,"limit":[0-9]+,"update_ms":[0-9.]+,"draw_ms":[0-9.]+,"fps":[0-9]+,"mem_kb":[0-9]+,"checks":[0-9]+,"screens":[0-9.]+\}$' || { echo "FAIL: no stats line from GS_STATS=1"; status=1; }

[ $status -eq 0 ] && echo "ALL TESTS PASS"
exit $status
