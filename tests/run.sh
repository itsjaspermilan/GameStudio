#!/bin/sh
# Headless tests: tests/run.sh   (needs build/gs)
cd "$(dirname "$0")/.."
run() { GS_SAVE_DIR="${TMPDIR:-/tmp}/gs-test-saves" SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy GS_MAX_FRAMES="${FRAMES:-600}" "$@" 2>&1; }
status=0

# The Lua framework (engine/gs): entities, inheritance, collisions, timers, tweens, animation clips, camera, saves, sound errors, limits,
# live reload and scenes. The fixture checks itself and prints FRAMEWORK TEST PASS. GS_DEV=1 switches live reload on.
out="$(GS_DEV=1 GS_TEST_HOST=1 FRAMES=1500 run ./build/gs tests/framework)"; echo "$out"
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
for game in carts/breakout carts/buttontest carts/padsetup; do
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

# Blend modes (gs.draw.blend; blend = "add" / "darken" and alpha on entities, tile layers, sprites, particles): the frame must have the colours
# that plain rectangles draw (within 2 levels of rounding).
out="$(FRAMES=60 run ./build/gs tests/blend)"
echo "$out" | grep -q 'BLEND TEST PASS' || { echo "$out"; echo "FAIL: blend modes"; status=1; }
tmp="$(mktemp -d)"
GS_DUMP_FRAME="$tmp/blend.bmp" FRAMES=60 run ./build/gs tests/blend >/dev/null
GS_BLEND_PLAIN=1 GS_DUMP_FRAME="$tmp/plain.bmp" FRAMES=60 run ./build/gs tests/blend >/dev/null
node tests/same-frames.mjs "$tmp/blend.bmp" "$tmp/plain.bmp" 2 || { echo "FAIL: blending does not make the colours it should"; status=1; }
# The mosaic: every block takes the colour of its middle pixel (on the GPU path, as on the handheld's GPU).
GS_DUMP_FRAME="$tmp/mosaic.bmp" FRAMES=60 run ./build/gs tests/mosaic >/dev/null
GS_MOSAIC_PLAIN=1 GS_DUMP_FRAME="$tmp/mosaic-plain.bmp" FRAMES=60 run ./build/gs tests/mosaic >/dev/null
node tests/same-frames.mjs "$tmp/mosaic.bmp" "$tmp/mosaic-plain.bmp" || { echo "FAIL: the mosaic does not fill each block with its middle pixel"; status=1; }
rm -rf "$tmp"

# The libretro core (build/gs_libretro, what NextUI's minarch runs), loaded by tests/retro-run as an emulator would: it draws the same frame
# as the program, hands over 735 samples a frame at 44.1 kHz, passes gs.quit() on, and plays Breakout with the emulator's buttons (Start,
# then A to launch), with sound, saving the best score in the emulator's save folder.
core="$(ls build/gs_libretro.so build/gs_libretro.dylib 2>/dev/null | head -1)"
if [ -x build/retro-run ] && [ -n "$core" ]; then
  tmp="$(mktemp -d)"
  out="$(./build/retro-run "$core" tests/mosaic 60 "$tmp/core.bmp" 2>&1)"
  GS_DUMP_FRAME="$tmp/gs.bmp" FRAMES=60 run ./build/gs tests/mosaic >/dev/null
  echo "$out" | grep -q 'shutdown=1' || { echo "$out"; echo "FAIL: the core did not pass gs.quit() on"; status=1; }
  node tests/same-frames.mjs "$tmp/core.bmp" "$tmp/gs.bmp" || { echo "FAIL: the core draws a different frame from the program"; status=1; }
  out="$(RETRO_SAVE_DIR="$tmp/saves" RETRO_HOLD="start@60-64,a@120-124,left@130-400" ./build/retro-run "$core" carts/breakout 900 2>&1)"
  echo "$out" | grep -q 'RETRO frames=900 size=256x192 base=256x192 fps=60 rate=44100 samples=661500 ' || { echo "$out"; echo "FAIL: the core's picture or sound timing"; status=1; }
  echo "$out" | grep -q 'peak=0 ' && { echo "$out"; echo "FAIL: the core made no sound"; status=1; }
  echo "$out" | grep -qi 'error' && { echo "$out"; echo "FAIL: Breakout in the core printed an error"; status=1; }
  # A packed cart carries its own General MIDI instruments (gs pack cuts the SoundFont down): it plays them with no bank beside the
  # runtime, the same as the game's folder does with the whole one.
  pk="$(./build/gs pack carts/breakout "$tmp/breakout.g43")"
  kb="$(echo "$pk" | sed -n 's/^General MIDI instruments: \([0-9]*\) KB$/\1/p')"
  { [ -n "$kb" ] && [ "$kb" -gt 20 ] && [ "$kb" -lt 1024 ]; } || { echo "$pk"; echo "FAIL: Breakout's cart should carry a small General MIDI bank"; status=1; }
  a="$(./build/retro-run "$core" carts/breakout 300 2>&1 | grep -o 'peak=[0-9]*')"
  b="$(GS_SOUNDFONT=/nonexistent ./build/retro-run "$core" "$tmp/breakout.g43" 300 2>&1 | grep -o 'peak=[0-9]*')"
  { [ -n "$a" ] && [ "$a" = "$b" ] && [ "$a" != "peak=0" ]; } || { echo "folder $a, cart $b"; echo "FAIL: the packed cart's General MIDI instruments do not sound like the folder's"; status=1; }
  [ -n "$(ls "$tmp/saves/breakout" 2>/dev/null)" ] || { echo "FAIL: the core saved nothing in the emulator's save folder"; status=1; }
  # Save states: a state saved at frame 200 and loaded later in the same run, and one loaded by a new run (NextUI's Resume: pictures, sounds
  # and instruments made again, pointers into the core moved), both replay the same buttons to the very frame the first pass drew.
  hold="start@30-34,a@60-62,left@70-200,right@260-330,a@340"
  out="$(RETRO_SAVE_DIR="$tmp/saves" RETRO_HOLD="$hold" RETRO_SAVE=200:"$tmp/s200" RETRO_LOAD=401:"$tmp/s200" RETRO_DUMP=400:"$tmp/f.bmp" ./build/retro-run "$core" carts/breakout 600 2>&1)"
  echo "$out" | grep -q 'RETRO load ok' || { echo "$out"; echo "FAIL: the core could not load its own save state"; status=1; }
  node tests/same-frames.mjs "$tmp/f.bmp" "$tmp/f.bmp.again.bmp" || { echo "FAIL: a game loaded from a save state played differently"; status=1; }
  out="$(RETRO_SAVE_DIR="$tmp/saves" RETRO_HOLD="$hold" RETRO_LOAD=0:"$tmp/s200" RETRO_DUMP=400:"$tmp/resumed.bmp" ./build/retro-run "$core" carts/breakout 200 2>&1)"
  echo "$out" | grep -q 'RETRO load ok' || { echo "$out"; echo "FAIL: a new run could not resume from a save state"; status=1; }
  node tests/same-frames.mjs "$tmp/f.bmp" "$tmp/resumed.bmp" || { echo "FAIL: a game resumed in a new run played differently"; status=1; }
  # The console's RAM: the program with GS_RAM=1 (the studio's Play panel) runs out of memory at the very step the core does, near 8 MB.
  core_last="$(./build/retro-run "$core" tests/ramhog 300 2>&1 | grep '^ramhog' | tail -1)"
  prog_out="$(GS_RAM=1 FRAMES=300 run ./build/gs tests/ramhog)"
  prog_last="$(echo "$prog_out" | grep '^ramhog' | tail -1)"
  echo "$prog_out" | grep -q 'not enough memory' || { echo "FAIL: the program with GS_RAM=1 did not run out of memory"; status=1; }
  # The same step, or one apart: the two keep about a kilobyte of different bookkeeping, so a run that ends near a step's edge can tip
  # either way (a step is one 32 KB string, 0.4% of the 8 MB).
  core_step="$(echo "$core_last" | awk '{print $2}')"; prog_step="$(echo "$prog_last" | awk '{print $2}')"
  [ -n "$core_step" ] && [ -n "$prog_step" ] && [ $(( core_step - prog_step )) -ge -1 ] && [ $(( core_step - prog_step )) -le 1 ] \
    || { echo "core: $core_last"; echo "program: $prog_last"; echo "FAIL: the program and the core run out of memory at different points"; status=1; }
  case "$prog_last" in *"/8192 KB"*) ;; *) echo "$prog_last"; echo "FAIL: gs.raw.ram() does not report the 8 MB RAM"; status=1 ;; esac
  rm -rf "$tmp"
else
  echo "SKIP: libretro core (build/gs_libretro or build/retro-run missing)"
fi

# A packed game is named for its console (breakout.g43); the runtime reads it whatever its name, and keeps its saves under "breakout".
tmp="$(mktemp -d)"
./build/gs pack carts/breakout "$tmp/breakout.g43" >/dev/null
out="$(FRAMES=60 run ./build/gs "$tmp/breakout.g43")"
echo "$out" | grep -qiE 'error|not a valid' && { echo "$out"; echo "FAIL: a .g43 game file did not run"; status=1; }
rm -rf "$tmp"

# A plain main.lua game (the format before game.lua) is refused with a message that says what to do, not run or crashed.
plain="$(mktemp -d)"; printf 'function draw() end\n' > "$plain/main.lua"
out="$(run ./build/gs "$plain")"; rm -rf "$plain"
echo "$out" | grep -q 'needs a game.lua' || { echo "$out"; echo "FAIL: a plain main.lua game was not refused clearly"; status=1; }
# Breakout, the example, plays through its screens: the title, a game the random bot plays, and back (no errors).
out="$(GS_BOT_LUA=tests/random-bot.lua GS_SEED=3 FRAMES=2400 run ./build/gs carts/breakout)"
echo "$out" | grep -qi 'error' && { echo "$out"; echo "FAIL: breakout played by the bot printed an error"; status=1; }

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

# The studio's Handheld panel reads a line of numbers a second from the running game (GS_STATS=1): entities, time per step and frame, fps, memory,
# collision checks, screens and calls drawn.
out="$(GS_STATS=1 FRAMES=150 run ./build/gs carts/breakout)"
echo "$out" | grep -qE '^@@gs \{"entities":[0-9]+,"peak":[0-9]+,"limit":[0-9]+,"update_ms":[0-9.]+,"draw_ms":[0-9.]+,"fps":[0-9]+,"mem_kb":[0-9]+,"checks":[0-9]+,"screens":[0-9.]+,"calls":[0-9]+\}$' || { echo "FAIL: no stats line from GS_STATS=1"; status=1; }
# ... and, with the console's RAM (GS_RAM=1, as the studio runs games), how much of it is in use
out="$(GS_RAM=1 GS_STATS=1 FRAMES=150 run ./build/gs carts/breakout)"
echo "$out" | grep -qE '^@@gs \{.*,"calls":[0-9]+,"ram_kb":[0-9]+,"ram_peak_kb":[0-9]+,"ram_size_kb":8192\}$' || { echo "FAIL: no RAM in the stats line with GS_RAM=1"; status=1; }

[ $status -eq 0 ] && echo "ALL TESTS PASS"
exit $status
