# GameStudio

A cheap Linux handheld (an Anbernic RG35XX Pro) becomes a small console for 2D games. This repository has the runtime (C + SDL2 + Lua 5.4), a Lua game framework (`gs`: entities, scenes with layouts, conversations, sound), the **Studio** (a desktop app with a Lua code editor, a layout editor, sprite, tileset and sound editors, the game running beside the code with live reload, and in-app tutorials) and scripts to build everything, pack games into cartridges and push them to a device.

## Quick start (desktop)

```sh
brew install cmake pkgconf     # once
./scripts/build.sh             # -> build/gs
./build/gs carts/panel-pop     # run a cartridge directory
./build/gs pack carts/panel-pop build/panel-pop.cart && ./build/gs build/panel-pop.cart
```

Controls (keyboard): arrows, Z/X/A/S = A/B/X/Y, Q/W = L/R, Enter = Start, Right Shift = Select, E/R = L2/R2, D/F = L3/R3. Esc quits; on a handheld, HOTKEY + Start (the Menu / function button), or holding Start + Select for three seconds. While HOTKEY is held the game sees no buttons (HOTKEY combinations belong to the handheld). Gamepads map by physical position; the left stick acts as the d-pad.

## Games

A game is a folder (or a packed `.cart`). The folder is the whole project: the studio shows exactly the files in it.

```
my-game/
  game.lua          the title, the console (dot or dash) and the first scene
  entities/         things in the game, one Lua file each (the player, an enemy, a bullet)
  scenes/           screens and levels: each is its code (title.lua) and its layout (title.layout.lua: tiles, things,
                    texts, pictures, panels, placed in the studio's layout editor), or just one of the two
  rooms/            the older form of level data, built from code with gs.load_room
  lib/              shared code and state, loaded with require
  sprites/ tilesets/ sfx/ music/ instruments/ sounds/    art and sound, made in the studio's editors
  meta/info.json    title, description, console and box art for the device's game list (not packed into the cart)
```

Every folder can have folders of its own, and the folder is part of the name: `sprites/ui/logo.json` is the sprite `"ui/logo"`, `entities/enemies/grub.lua` is `"enemies.grub"`. Moving something to another folder in the studio renames it and updates the code, layouts and sound files that name it.

```lua
-- game.lua
return gs.game{ title = "My Game", console = "glow43", start = "scenes.main" }

-- entities/player.lua
local Player = gs.entity{ tags = { "player" }, hitbox = { r = 6 }, speed = 90 }
function Player:update(dt)
  local dx, dy = gs.input.dir()
  self.x = self.x + dx * self.speed * dt
  self.y = self.y + dy * self.speed * dt
end
function Player:on_collide_enemy(enemy) enemy:destroy() end    -- on_collide_<tag> runs when it touches something with that tag
return Player

-- scenes/main.lua
local Main = gs.scene{}
function Main:enter() gs.spawn("player", 160, 120) end
return Main
```

Entities are classes (a Lua file that returns `gs.entity{ ... }`, optionally building on another entity), scenes are screens, and `gs.spawn("player")` finds `entities/player.lua`. The engine moves entities by `vx` and `vy`, draws their
sprites, finds collisions by tags with a spatial grid and calls `update`, `draw`, `on_collide_<tag>` and the other hooks. Timers, tweens and coroutines belong to the entity or scene that made them.
Run a game from the studio (Run): it plays in the **Play panel** beside the code (or in a window of its own, in Settings), drawn by the runtime the handheld uses. Saving a Lua file or an asset updates the running game without a restart (`GS_DEV=1`, which the studio sets); saving a scene's layout starts that scene again with it.

**Layouts.** A scene's layout is plain data the layout editor writes: tile layers, entities, texts, pictures, panels (a 3×3 block of tiles stretched to a size) and paths. It is built when the scene starts, and anything given a name is a field of the scene's code: a text named `prompt` is `self.prompt` (renaming it in the layout renames it in the code). Texts use a built-in font (round, square or bold letters, small or tall, with an optional drop shadow) or a sprite font (a frame a letter). `gs.say(name, text)` and `gs.ask(question, answers)` show a text box and wait for the player, styled by the layout's `dialogue_box`, `dialogue_text`, `dialogue_name` and `dialogue_cursor`. The Help window's "Layouts" and "Talking" pages walk through both.

- The **full reference** is `engine/api/gs.d.lua` (typed notes the studio's editor, its Help window and the language server all read); the Help window turns it into the API page.
- The **tutorials** are in `docs/help/` (Your first game, scenes and saving, collisions and tags, timers and tweens, a platformer, a survivors-style game, big levels and tile layers, sprites and sound, the handheld's limits,
  sprite sizes, best practices). Every tutorial game is played by a bot in the tests.
- **Samples:** `carts/panel-pop` (a puzzler built from scene layouts) and `carts/void-swarm` (a large one: 90 files, 24 enemies, 10 bosses, upgrades, a director scene).
- `engine/AGENTS.md` describes how the framework itself is built.

Every game has a `game.lua`. (Plain `main.lua` games with `init`/`update`/`draw` are no longer run: move the code into a scene, which can still call the low-level functions below.)

## For AI agents (MCP)

`tools/mcp/` is an MCP server, so an agent such as Claude Code can work on GameStudio games with short answers instead of reading whole files:
look up the `gs` API and the Help, get a one-page overview of a game, check it (lint plus a headless run), run it and see a screenshot, look inside
with the inspector, view and draw sprites, and write and check sound effects and songs. A song check reads the notes like a musician (key, chords,
whether the melody sits on the chords, clashes, shrill or muddy registers, melody shape) and measures the rendered sound (loudness, clipping,
brightness). Rooms can be built as text maps and seen as pictures. The repository's `.mcp.json` starts it; run `npm install` in `tools/mcp`
once. The craft for the kind of game being made (art, levels, music) is in three Help guides that people read in the studio and agents read
through the server (`help`, and the prompts `draw-art`, `design-level`, `compose-music`); Claude Code's skills in `.claude/skills/` point to them. See `tools/mcp/AGENTS.md`.

## Console limits

A console (`engine/consoles/glow43.json`, `glow169.json`) says what a game made for it may use: screen size, palette, sprite and tile sizes, room size, limits and budgets. Built in: **Glow43** (4:3, 320x240) and **Glow169** (16:9, 320x180).
Both have GBA-style **colour banks**: a game's `palette.json` holds up to 16 sprite banks and 16 tile banks of 15 colours (place 0 is see-through), each from 15-bit colour, so up to 512 colours show at once.
A sprite names its bank (`"bank": "hero"` in its JSON), a tileset the banks its tiles use (`"banks": ["forest", "water"]`, each tile keeps to one), an entity can draw its sprite with another bank (`bank = "red_soldier"`, a palette swap) and code can name a bank colour as `"sky:3"`. A game without `palette.json` keeps the console's 32 classic colours (`palette.colors`).
A game names its console in `game.lua`; one of your own consoles (made in the studio) travels with the game as `consoles/<id>.json`. At most 512 entities are alive at once on both (more are ignored with one warning). The studio's **Handheld** tab shows size, art and sound against the console, and while the game runs how many
entities are alive and how long a frame takes. See `engine/consoles/README.md` for every field and the measured numbers, and the Help page "Working inside the handheld's limits".

## Low-level runtime calls

The framework is built on these calls. A game with `game.lua` normally uses the framework (`gs.draw`, `gs.input`, `gs.sfx` ...); the originals stay available as `gs.raw.*` (and `gs.tile`, `gs.image`, `gs.load` and `gs.list` are never replaced). A scene can call them directly too (the button test and pad setup carts do). Colors are 0-255; `a` (alpha) defaults to 255.

| Call | Description |
| --- | --- |
| `gs.clear(r,g,b)` | fill the screen |
| `gs.rect(x,y,w,h,r,g,b[,a])` | filled rectangle |
| `gs.line(x1,y1,x2,y2,r,g,b[,a])` | line |
| `gs.circle(cx,cy,radius,r,g,b[,a])` | filled circle |
| `gs.print(text,x,y[,r,g,b,a,scale,font,sr,sg,sb,sa])` | a built-in font (0 = round_small, see `gs.raw.font`), with a shadow in the colour `sr,sg,sb,sa` if given; integer scale looks best |
| `gs.raw.text_width(text[,font])`, `gs.raw.font(name)` | width at scale 1; a built-in font's number, height and line height (nil if there is none) |
| `gs.image(name)` | load a PNG, returns `{id,w,h}` (cached) |
| `gs.sprite(img,x,y[,scale,flipx])` | draw a whole image |
| `gs.clock()` | seconds since start with nanosecond steps (`gs.time()` has millisecond steps): for timing |
| `gs.mark(text)` | writes a line into the `GS_PERF=1` log, in order with its per-second lines (a scripted run says which scenario each line belongs to); does nothing otherwise |
| `gs.stats()` | `pixels, draw_calls, screen_pixels` of the last finished frame |
| `gs.blend(mode)` | how what is drawn next mixes in: `"normal"` (alpha), `"add"` (adds light) or `"darken"` (multiplies), like the GBA's blend register; returns the mode before. Every frame starts at `"normal"` |
| `gs.recolor(img,from,to[,old])` | a copy of a picture with colour `from[i]` replaced by `to[i]` (lists of `0xRRGGBB`), for palette swaps; the framework uses it for an entity's `bank`. Pass the picture it returned as `old` to reuse its slot |
| `gs.compose(sheet,tw,th,sheet_cols,count,cw,ch,grid_cols,grid_rows,rows[,old])` | one picture of a whole tile grid (cell `c,r` shows tile `rows[r][c]` of `sheet`), so a layer that does not change is one `gs.tile` call a frame instead of hundreds. The framework uses it for tile layers; tiles must be the size of the cells. Pass the picture it returned as `old` to reuse its slot |
| `gs.tile(img,sx,sy,sw,sh,x,y[,scale,flipx,angle,yscale,alpha,pivotx,pivoty])` | draw a sub-rectangle of a sheet; `angle` (degrees, clockwise), the scales and `alpha` (0-255) act around the pivot, a point in the sprite (default top-left) that stays where it is |
| `gs.btn(name)` / `gs.btnp(name)` | held / pressed this frame: `up down left right a b x y l r start select l2 r2 l3 r3` (L2/R2 are the triggers, L3/R3 the stick clicks, on devices that have them) |
| `gs.sound(name)` | load a WAV, returns a handle (cached) |
| `gs.play(snd[,volume,loop])` | play; returns a voice id, or nil if audio is unavailable or all 16 voices are busy |
| `gs.stop([voice])` | stop one voice, or all |
| `gs.save(key,string)` / `gs.loadsave(key)` | per-cart persistent storage (keys: letters, digits, `_ - .`) |
| `gs.load(name)` | read a cartridge file as a string |
| `gs.time()` / `gs.quit()` | seconds since start / exit |
| `gs.pad_last()` | the number of the raw joystick button pressed most recently (then forgotten), or `nil`; used by the `padsetup` cart |
| `gs.pad_set(name,n)` / `gs.pad_reset()` | use raw button `n` for a button name and save it in `padmap.txt` beside the program (true if saved) / forget the map. The d-pad keeps the gamepad mapping |
| `gs.screen()` | the logical screen size, `w, h` |
| `gs.set_resolution(w,h)` | choose the logical screen size (64 to 2048); shown at the largest whole-number scale that fits the display |
| `gs.camera(x,y)` | shift everything drawn afterwards by `-(x,y)` so a world bigger than the screen can scroll; `gs.camera()` resets it (it also resets every frame) |
| `gs.zoom(z)` / `gs.zoom()` | draw everything afterwards `z` times bigger (after the camera shift), 0.125 to 16; with no argument, the current zoom. Resets to 1 every frame (the framework sets it from `gs.camera.zoom`) |
| `gs.sfx_load(speed,n,steps,loop_start,loop_end)` | load a chiptune sound effect, returns a handle (`steps` is a flat list of pitch, wave, volume, effect) |
| `gs.sfx_play(h[,volume])` / `gs.sfx_stop()` | play / stop sound effects (`h` can be a table of handles: the tracks of one effect, played together) |
| `gs.music_load(patterns,slots,loop_from,loop_to)` | load music made of patterns of sound effects, returns a handle |
| `gs.music_play(h)` / `gs.music_stop([fade_ms])` | play / stop music |
| `gs.synth_config(music_tracks,sfx_channels,lofi)` | set the number of music tracks and sound effect channels, and whether the GBA-style output stage is on |
| `gs.sample_load(name)` / `gs.inst_load(spec)` | load a WAV as a sample / define an instrument (pulse, wave, noise or sample, with envelope, pan, vibrato) |
| `gs.song_load(spec)` / `gs.song_play(h)` | load and play a tracker song (the framework does this for you from `music/*.json`) |

Saves go to the OS per-user data folder under `gs/<cart name>/` (override with the `GS_SAVE_DIR` environment variable).

## Device (aarch64 Linux)

```sh
./scripts/build-aarch64.sh     # -> build-aarch64/gs (zig cc; uses the handheld's own libSDL2, for its GPU and overlays)
cp scripts/device.env.example scripts/device.env   # then edit host/user/dir
./scripts/push.sh carts/panel-pop # pack + scp the runtime and cartridge
./scripts/run.sh carts/panel-pop  # push, then launch over SSH
```

`build-aarch64.sh` needs zig, cmake and pkgconf, and downloads a small Debian header/library sysroot on first use (`scripts/fetch-sysroot.sh`, checksum-verified). The binary targets glibc 2.31; change it in `scripts/zig-cc-aarch64` if the firmware is older.

On handhelds with no KMS/DRM (Knulli on the RG35XX Pro has only `/dev/fb0`) `gs` falls back to software rendering into the framebuffer. If a device's buttons come out wrong, run the `padsetup` cart once: it records raw button numbers in `padmap.txt` beside `gs`, and `gs.btn("a")` and friends follow it (`GS_DEBUG_INPUT=1` prints raw presses).

**Knulli.** With `DEVICE_ROMS_DIR` set in `scripts/device.env`, `push.sh` makes each console (Glow43, Glow169, custom ones) its own EmulationStation system with its own launcher folder, and writes a `gamelist.xml` entry from the game's `meta/info.json` (title, description, developer, genre, players, box art). The studio's "Send to device" runs the same script. EmulationStation reads new systems at start-up, so restart it after the first push of a console. Confirmed by testing on one RG35XX Pro: framebuffer drawing, the d-pad and shoulder buttons, Breakout running from the Glow43 system. Not yet confirmed there: box art and descriptions in the list, and Glow169.

## Sound (GBA style)

Sound is built like a small band, and like the GBA it mixes a handful of voices in software:

- **Channels.** A song has eight tracks (each can sound up to four notes at once; Glow43 and Glow169 play all eight) and a sound effect has two lanes; sound effects have their own channels (default 4).
  They are separate pools, so a sound effect never cuts into the music. That is about 12 voices at once: a few
  multiplications per voice per sample, a tiny cost next to drawing, and in the same range as what GBA games mixed in software
  (the hardware itself has 4 tone channels plus 2 sample channels; most games mixed 8 to 12 sampled voices themselves).
- **Reverb.** Like the GBA's sound driver, the mixer has a reverb, and it gives music much of its warmth. A song picks its space,
  `reverb_type` `"room"` (short, warm; the default and what older songs get), `"hall"` (long, bright) or `"cave"` (very long, dark), and
  how much of the music goes into it (`reverb`, 0 to 100). Sound effects are dry unless they set their own `reverb` amount: they then
  ring in the space of the song that is playing (a room when none is).
- **Samples.** Imported WAV files are made mono at the console's `sample_rate` (32 kHz on Glow43 and Glow169, the rate of a GBA game's best
  samples) and may be up to `sample_max_seconds` long (8).
- **One instrument per channel.** Every track of a song, and every channel of a sound effect, plays one instrument. In the studio
  you drag an instrument from the palette onto the channel. Change the instrument and every note on it changes.
- **General MIDI.** Besides the chip sounds there are real instruments: all 128 General MIDI sounds and a drum kit, played from a
  SoundFont by [TinySoundFont](https://github.com/schellingb/TinySoundFont) (`third_party/tsf/tsf.h`, MIT licence). The SoundFont
  is `assets/soundfonts/TimGM6mb.sf2` (about 6 MB). It stays beside the runtime and is not packed into your games, so a cart keeps
  well inside the 16 MB budget. `scripts/push.sh` copies it to the device once; `GS_SOUNDFONT=/path/to/file.sf2` points the
  runtime at a different one. A game that uses General MIDI instruments needs that file next to the runtime.
- **Instruments.** There are 17 ready-made chip ones (`engine/instruments.json`: piano, electric piano, organ, bell, strings, flute,
  brass, chip lead, pluck, bass, pad, kick, snare, hi-hat, open hi-hat, tom, clap) plus the six basic waves, and the game's
  own (`instruments/<name>.json`): a pulse wave (12.5 to 75% duty), a drawn 32-step 4-bit wavetable, noise (hiss or metallic) or a
  sample pitched across the keyboard (WAV files in `sounds/`), with attack/decay/sustain/release, volume, pan and vibrato. Drum
  instruments can have a fixed pitch and a pitch sweep. Names of ready-made instruments are reserved.
- **Notes and ranges.** Every instrument has a range it sounds good in (at most three octaves, `range` in its JSON; the studio's
  instrument editor sets it for your own). The SFX and music lanes show just that range, so nobody has to hunt for the right octave.
  Basses sit low, flutes and bells high.
- **Three octaves, one key.** A lane shows its instrument's base octave and one above and below (a bass sits lower than a flute), so every
  sound has its place. New songs and sound effects start locked to C major; each lane can follow that key, have a key of its own (a lane's
  *Key* picker), or allow any note. A track's own key is saved as `track_keys` in a song (`false` = any note) and as `key` on a sound
  effect's track.
- **Click and drag.** There are no note-size buttons: a click makes a one-step note, and dragging along the lane (or the right edge of a
  note) stretches it, one step at a time. Drag a note itself to move it to another step, pitch or lane. Click empty space around the lanes
  (or press Escape) to let go of the selected note. The note names sit in a gutter beside each lane, so they never cover the first column.
- **Notes that overlap.** A lane can sound up to four notes at once (a chord, or a bass note under a melody). Clicking where a note already
  sounds puts the new note on the lane's next free *voice*, so nothing is replaced and each note keeps its own length. A song stores the extra
  voices as `layers` (24 strings after a pattern's eight `tracks`, voice `8 * layer + track`; a song saved with four tracks steps by 4, and
  is read that way), a sound effect track as `layers` (more steps
  lists on the same instrument); both play on the track's own instrument. In a sound effect the layers use extra sound channels (after the
  tracks, so if the console has too few they are dropped first).
- **Tracks and volume.** A song always has eight tracks and a sound effect two lanes, all shown; a lane plays only if it has an instrument.
  Each lane has a volume from -3 to +3 steps (0 is the baseline, each step is 1.25x), saved as `track_vol` in a song and `vol` on a sound
  effect's track. Songs saved with more tracks keep only the first eight (older songs with four get four empty lanes), and sound effects only the first two lanes.
The grid lines show bars and beats. Pattern length is counted in bars.
- **Quick starts.** *Start from* loads a ready-made song (happy adventure, chill evening, boss fight: each in its key, with a lead, a chord
  or bass part and a drum kit beat). *Random* on a melody lane writes a phrase in the key and plays it; a drum kit lane has *Drum beat*
  (simple, rock, dance, hip-hop, march, and a fill). Lanes can be folded away to a thin strip, and the playhead scrolls long patterns along.
- **Key lock.** A song or sound effect can be locked to a key (a root note and a scale: major, minor, two pentatonics or blues). Notes
  outside it are dimmed, clicks land on the nearest note that fits, and the note list only offers notes that fit, so nothing clashes.
  New songs start in C major, new sound effects start free, and "Off" turns it off. It is saved as `key: {root, scale}` in the file.
- **Drum kit.** The General MIDI drum kit is one instrument: each row of its lane is a piece (kick, snare, hi-hats, toms, cymbals...)
  and a step can hit several at once (`C3+F#3` in a music cell is a kick and a closed hi-hat). The chip drums are single-sound
  instruments.
- **Long notes.** A music note lasts until the next note or note-off. A sound effect note is a step followed by "Hold" steps
  (effect 7), which keep the note going instead of starting a new one.
- **Sound effects** (`sfx/<name>.json`): `{speed, loop, tracks: [{instrument, steps: [[pitch, volume, effect], ...]}]}`, up to 32
  steps, all tracks the same length, played together. The older single-row form is converted when the studio opens it, and
  the game still plays it.
- **Music** (`music/<name>.json`) is a tracker song: patterns of rows by tracks, played in an order, with tempo, a loop point and an
  echo amount. `track_instruments` names each track's instrument. Each cell is `NOTE[,VOL[,FX[,FXP]]]` (for example `C4,12`);
  `OFF` stops a note and `--` is empty. Effects: slide up, slide down, vibrato, arpeggio, volume slide, pan and note cut. Songs in
  the previous form (an instrument per cell) and the oldest "patterns of sound effects" form still play, and the studio converts them
  when you open them.
- A console's `audio.style` is `"clean"` or `"gba"`; `gba` adds the lo-fi output stage (low-pass filter, 32 kHz hold, 8-bit steps).
  `audio.music_tracks` and `audio.sfx_channels` set the channel counts. A console's `budgets.cart_kb` is a warning level for a cart's size
  (the built-in consoles use 16 MB, a typical GBA cartridge).

## Tests

```sh
./tests/run.sh          # the framework, audio and the sample games (Void Swarm plays itself), run headless
cd studio && npm test   # the studio's logic, every Help tutorial game played by a bot, and the synth rendered through the real runtime
```

`gs render-audio <description.txt> <out.wav>` renders a sound effect, instrument preview or song to a WAV file with the runtime's
own synth (the studio uses it for previews, and the audio tests check the waveforms). The description format is documented at the
top of `render_audio` in `runtime/main.c`; samples resolve relative to the current directory.

## Licences

- The runtime, studio and framework are this project's own code.
- Lua is MIT, SDL2 is zlib, the built-in fonts (`engine/fonts/`, drawn for GameStudio) are the project's own, and TinySoundFont (`third_party/tsf/tsf.h`) is MIT. The studio's optional Lua language server (LuaLS, downloaded by `scripts/fetch-luals.sh`, never part of a game) is MIT.
- **`assets/soundfonts/TimGM6mb.sf2` is licensed GPL-2.0** (Tim Brechbill and David Bolton, as shipped with MuseScore and packaged by
  Debian as `timgm6mb-soundfont`). It is a separate data file that is distributed beside the runtime, not linked into it. If you
  distribute the SoundFont (for example inside a release), the GPL-2 applies to that file: keep its licence with it, and note that
  games using only the chip instruments do not need it. To avoid GPL material entirely, point `GS_SOUNDFONT` at a SoundFont with a
  licence you prefer.
