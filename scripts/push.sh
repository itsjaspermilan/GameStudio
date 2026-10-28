#!/bin/sh
# Pack a cartridge directory and copy it (and the aarch64 runtime) to the device.
#   scripts/push.sh carts/breakout                  the device in scripts/device.env
#   GS_DEVICE=muos scripts/push.sh carts/breakout   another one, in scripts/device-muos.env (a second SD card, another handheld)
# DEVICE_OS in the file says which system the card runs: knulli (the default; EmulationStation), muos (MustardOS) or nextui (the TrimUI
# Brick's NextUI).
set -e
cd "$(dirname "$0")/.."
[ -n "$1" ] || { echo "usage: $0 <cart-dir>" >&2; exit 2; }
# DEVICE_ENV=<file> reads that device file instead (the studio app writes one from its Settings); GS_BUILD_DIR=<folder> is where the packed
# game and the launcher are made before they are copied (default build/; the app's own copy of this folder cannot be written to).
ENVFILE="${DEVICE_ENV:-scripts/device${GS_DEVICE:+-$GS_DEVICE}.env}"
[ -f "$ENVFILE" ] || { echo "create $ENVFILE (see $ENVFILE.example, or scripts/device.env.example)" >&2; exit 1; }
case "$ENVFILE" in /*) . "$ENVFILE" ;; *) . "./$ENVFILE" ;; esac
B="${GS_BUILD_DIR:-build}"
mkdir -p "$B"
DEVICE_OS="${DEVICE_OS:-knulli}"
command -v node >/dev/null 2>&1 || { echo "Sending needs Node.js (the 'node' program) for the game list entry. Install it (nodejs.org, or 'brew install node'), then send again." >&2; exit 1; }
SRC="${1%/}"; NAME="$(basename "$SRC")"
HOSTCART="$B/$NAME.cart"

# The cart's console (named in meta/info.json) as "id|Display name" ("glow43|Glow43", "glow169|Glow169", a custom one), or nothing for a plain Lua cart. Projects saved when
console_info() {
  [ -f "$1/meta/info.json" ] || return 0
  node -e '
    const fs = require("fs"), path = require("path");
    let raw = String(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).console || "");
    raw = { dot: "glow43", dash: "glow169" }[raw] || raw; // their names before Glow43 and Glow169
    const id = /^[a-z0-9_-]{1,40}$/.test(raw) ? raw : "";
    const clean = (s) => String(s || "").replace(/[^A-Za-z0-9 _.-]/g, "").trim();
    // a custom console is named by the copy the game carries (consoles/<id>.json)
    let names = { glow43: "Glow43", glow169: "Glow169" };
    try { const c = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[1]), "..", "consoles", id + ".json"), "utf8")); if (c.name) names[id] = c.name; } catch {}
    if (clean(id)) process.stdout.write(clean(id).toLowerCase().replace(/ +/g, "-") + "|" + clean(names[id] || id));
  ' "$1/meta/info.json"
}

# console_has <cart-dir> <console id> <button>: prints "yes" when the console's spec lists the button among its inputs (the game's own copy
# in consoles/<id>.json first, then the built-in one)
console_has() {
  node -e '
    const fs = require("fs"), path = require("path");
    for (const f of [path.join(process.argv[1], "consoles", process.argv[2] + ".json"), path.join("engine/consoles", process.argv[2] + ".json")]) {
      try { const c = JSON.parse(fs.readFileSync(f, "utf8")); if ((c.input || []).includes(process.argv[3])) process.stdout.write("yes"); break; } catch {}
    }
  ' "$1" "$2" "$3"
}

# console_screen <cart-dir> <console id>: the console's screen as "width height" (the game's own copy of the spec first), or nothing
console_screen() {
  node -e '
    const fs = require("fs"), path = require("path");
    for (const f of [path.join(process.argv[1], "consoles", process.argv[2] + ".json"), path.join("engine/consoles", process.argv[2] + ".json")]) {
      try { const s = JSON.parse(fs.readFileSync(f, "utf8")).screen; if (s && s.width && s.height) { process.stdout.write(s.width + " " + s.height); break; } } catch {}
    }
  ' "$1" "$2"
}
# console_ext <cart-dir> <console id>: the end of the console's game files (cart_extension in its spec: g43, g169), or "cart"
# RetroArch's picture shape for a console's screen: its aspect_ratio_index for 4:3 (0) or 16:9 (1), else "core provided" (22), which
# follows the core's own geometry
console_aspect_index() {
  node -e '
    const fs = require("fs"), path = require("path");
    let idx = 22;
    for (const f of [path.join(process.argv[1], "consoles", process.argv[2] + ".json"), path.join("engine/consoles", process.argv[2] + ".json")]) {
      try { const s = JSON.parse(fs.readFileSync(f, "utf8")).screen; const r = s.width / s.height; idx = Math.abs(r - 4 / 3) < 0.01 ? 0 : Math.abs(r - 16 / 9) < 0.01 ? 1 : 22; break; } catch {}
    }
    process.stdout.write(String(idx));
  ' "$1" "$2"
}

console_ext() {
  node -e '
    const fs = require("fs"), path = require("path");
    let ext = "cart";
    for (const f of [path.join(process.argv[1], "consoles", process.argv[2] + ".json"), path.join("engine/consoles", process.argv[2] + ".json")]) {
      try { const c = JSON.parse(fs.readFileSync(f, "utf8")); if (/^[a-z0-9]{1,8}$/.test(c.cart_extension || "")) ext = c.cart_extension; break; } catch {}
    }
    process.stdout.write(ext);
  ' "$1" "$2"
}

# Always build: both are incremental (about a second when nothing changed), and a handheld left on an older engine than the studio
# runs the game differently or not at all.
./scripts/build.sh >/dev/null 2>&1 || { echo "the desktop build failed: run scripts/build.sh to see why" >&2; exit 1; }
./scripts/build-aarch64.sh >/dev/null 2>&1 || { echo "the handheld build failed: run scripts/build-aarch64.sh to see why" >&2; exit 1; }
./build/gs pack "$SRC" "$HOSTCART"
T="$DEVICE_USER@$DEVICE_HOST"
# GameStudio's own key (scripts/setup-key.sh puts it on the handheld) logs in without a password; the first ssh then opens the shared
# connection by itself and the copies after it reuse it. A shared connection someone opened by hand works too.
KEY="$HOME/.ssh/gamestudio_ed25519"
[ -f "$KEY" ] && SSH_OPTS="$SSH_OPTS -i $KEY"
case "$SSH_OPTS" in *ControlPath=*) SSH_OPTS="$SSH_OPTS -o ControlMaster=auto -o ControlPersist=60" ;; esac
# Never wait for a password (a studio window cannot answer one): when it cannot log in, stop at once with exit code 3 (the studio then offers
# to set the key up in Terminal) and say how to fix it.
SSH_OPTS="$SSH_OPTS -o BatchMode=yes -o ConnectTimeout=8"
if ! ssh $SSH_OPTS "$T" true 2>/dev/null; then
  if ! ssh -o BatchMode=yes -o ConnectTimeout=8 -o ControlPath=none -o PreferredAuthentications=none "$T" true 2>&1 | grep -qi "permission denied"; then
    echo "Cannot reach $T: is the handheld on, awake, on the same Wi-Fi, with SSH on (NextUI: Tools > Native SSH)?" >&2
    exit 1
  fi
  echo "Cannot log in to $T without a password. Set it up once (it asks the handheld's password one time), then send again:" >&2
  echo "  scripts/setup-key.sh $T" >&2
  exit 3
fi
INFO="$(console_info "$SRC")"
# NextUI: a game with a console is a "rom" in that console's folder, run by one launcher for the whole console, as NextUI's emulators are.
# Everything else is the runtime's: the cart's path is the launcher's argument, not fixed in it.
NEXTUI_ROM=""; [ "$DEVICE_OS" = nextui ] && [ -n "$INFO" ] && NEXTUI_ROM=1
# Knulli: a game with a console runs in Knulli's RetroArch with gs as its libretro core (RetroArch's menu, save states and hotkeys, the
# controls Knulli set up). GS_KNULLI_PROGRAM=1 sends the old launcher that runs the gs program itself.
KNULLI_CORE=""; [ "$DEVICE_OS" = knulli ] && [ -n "$INFO" ] && [ -z "$GS_KNULLI_PROGRAM" ] && KNULLI_CORE=1
ssh $SSH_OPTS "$T" "mkdir -p '$DEVICE_DIR/carts'"
scp -q $SSH_OPTS build-aarch64/gs "$T:$DEVICE_DIR/gs"
# no SoundFont goes beside the runtime: a packed cart carries its own General MIDI instruments (gs pack, runtime/sfbank.c)
[ -n "$NEXTUI_ROM" ] || scp -q $SSH_OPTS "$HOSTCART" "$T:$DEVICE_DIR/carts/$NAME.cart"
if [ -n "$DEVICE_PORTS_DIR" ] || [ "$DEVICE_OS" = muos ] || [ "$DEVICE_OS" = nextui ]; then
  # GS_DEBUG=1 scripts/push.sh ...  logs controller presses to <DEVICE_DIR>/last-run.log and leaves after 60 seconds (GS_DEBUG_SECONDS=N),
  # so a test on a device whose buttons are not mapped yet can never trap you in the game.
  # GS_PERF=1 scripts/push.sh ...  prints a frame timing line a second to <DEVICE_DIR>/last-run-<cart>.log and leaves after GS_PERF_SECONDS (default 40).
  # GS_GOVERNOR=performance scripts/push.sh ...  holds the CPU at full speed while the game runs and puts the old setting back afterwards (the
  # setting is lost at the next reboot anyway). Meant for finding out whether the CPU slowing down is what makes a game stutter.
  GS_ENV=""; GS_LOG=""
  if [ -n "$GS_PERF" ]; then GS_ENV="GS_PERF=1 GS_MAX_SECONDS=${GS_PERF_SECONDS:-40}"; GS_LOG="last-run-$NAME.log"
  elif [ -n "$GS_DEBUG" ]; then GS_ENV="GS_DEBUG_INPUT=1 GS_MAX_SECONDS=${GS_DEBUG_SECONDS:-60}"; GS_LOG="last-run.log"; fi
  {
    echo '#!/bin/sh'
    if [ "$DEVICE_OS" = muos ]; then
      # muOS draws its volume, brightness and battery notices over a game with libmustage, preloaded into it to hook SDL2's present. Its
      # ports launcher (ext-general.sh) leaves that out for the "external" core our folders use, so the launcher asks for it with muOS's own
      # function: that keeps up with muOS updates and respects its settings (the overlays can be switched off there). The controller mapping
      # is already set up by ext-general.sh.
      cat <<'MUOS'
if [ -f /opt/muos/script/var/func.sh ]; then
  . /opt/muos/script/var/func.sh
  command -v SETUP_STAGE_OVERLAY >/dev/null 2>&1 && SETUP_STAGE_OVERLAY
fi
MUOS
    fi
    echo "cd \"$DEVICE_DIR\""
    # The runtime raises the CPU's lowest clock while frames are late and puts it back when it exits (GS_NO_BOOST=1 turns that off). This puts it
    # back as well when the game is killed: the runtime keeps the original value in /tmp/gs-cpu-min while it has the clock raised.
    cat <<'FLOOR'
MIN=/sys/devices/system/cpu/cpu0/cpufreq/scaling_min_freq
STATE=/tmp/gs-cpu-min
[ -f $STATE ] && { cat $STATE > $MIN; rm -f $STATE; }
OLDMIN="$(cat $MIN 2>/dev/null)"
restore_floor() { if [ -f $STATE ]; then cat $STATE > $MIN; rm -f $STATE; elif [ -n "$OLDMIN" ]; then echo "$OLDMIN" > $MIN; fi; }
FLOOR
    if [ -n "$GS_GOVERNOR" ]; then
      echo 'G=/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor'
      echo 'OLD="$(cat $G)"'
      echo "echo $GS_GOVERNOR > \$G"
      echo "trap 'restore_floor; echo \"\$OLD\" > \$G' EXIT INT TERM"
      [ -n "$GS_LOG" ] && echo "echo \"governor \$(cat \$G) (was \$OLD)\" > \"$GS_LOG\""
    else
      echo "trap restore_floor EXIT INT TERM"
    fi
    CART="\"carts/$NAME.cart\""
    if [ "$DEVICE_OS" = nextui ]; then
      # NextUI hands games no controller mapping, and the Brick's SDL2 takes its pad for an Xbox 360 controller, naming the buttons by
      # position: the bottom one (B on the Brick) came out as A. This is SDL's own mapping for it (GS_DEBUG_INPUT prints it) with the face
      # buttons following their labels, as Knulli's and muOS's mappings do.
      echo 'export SDL_GAMECONTROLLERCONFIG="0300a3845e0400008e02000014010000,TRIMUI Brick,a:b1,b:b0,x:b3,y:b2,back:b6,dpdown:h0.4,dpleft:h0.8,dpright:h0.2,dpup:h0.1,guide:b8,leftshoulder:b4,leftstick:b9,lefttrigger:a2,leftx:a0,lefty:a1,rightshoulder:b5,rightstick:b10,righttrigger:a5,rightx:a3,righty:a4,start:b7,platform:Linux,"'
      # A console without L3 and R3 (Glow43, Glow169) gets the Brick's L3 and R4 as a second Select and Start.
      [ -n "$INFO" ] && [ -z "$(console_has "$SRC" "${INFO%%|*}" l3)" ] && echo 'export GS_BUTTON_ALIAS="l3=select,r3=start"'
    fi
    if [ -n "$NEXTUI_ROM" ]; then
      # saves go where NextUI keeps every system's: Saves/<console tag>/<game>
      CART='"$1"'
      echo 'GAME=$(basename "$1"); GS_SAVE_DIR="${SAVES_PATH:-/mnt/SDCARD/Saves}/$(basename "$(dirname "$0")" .pak)/${GAME%.*}"'
      echo 'mkdir -p "$GS_SAVE_DIR"; export GS_SAVE_DIR'
    fi
    # the shell stays alive (no exec) so that the trap can run when the game ends
    RUN="./gs $CART"
    if [ -n "$KNULLI_CORE" ]; then
      # Knulli's own RetroArch settings (controls, hotkeys, menu: written by Knulli whenever a libretro game starts) plus this console's
      # (saves in a folder of its own, whole-number scaling); the log says why when a game does not start
      echo 'CFG=/userdata/system/configs/retroarch/retroarchcustom.cfg'
      echo 'set --'; echo '[ -f "$CFG" ] && set -- --config "$CFG"'
      [ -n "$GS_PERF" ] && echo 'export GS_PERF=1'
      [ -n "$GS_DEBUG" ] && echo 'export GS_DEBUG_INPUT=1'
      RUN="retroarch -L \"$DEVICE_DIR/gs_libretro.so\" \"\$@\" --appendconfig \"$DEVICE_DIR/retroarch-$NAME.cfg\" --log-file \"$DEVICE_DIR/last-retroarch.log\" --verbose $CART"
    fi
    [ -n "$GS_ENV" ] && RUN="$GS_ENV $RUN"
    if [ -n "$GS_LOG" ]; then
      if [ -n "$GS_GOVERNOR" ]; then RUN="$RUN >> \"$GS_LOG\" 2>&1"; else RUN="$RUN > \"$GS_LOG\" 2>&1"; fi
    fi
    echo "$RUN"
  } > "$B/$NAME.sh"
  # ssh joins its arguments into one command for the remote shell, so each one is quoted ("Glow43 (G43)", "Then & Now")
  q() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
  TITLE="$(node -e 'try { const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(String(d.title || "").replace(/[\r\n"\\\t]/g, " ").trim()); } catch {}' "$SRC/meta/info.json" 2>/dev/null)"
  if [ "$DEVICE_OS" = nextui ]; then
    # NextUI (a MinUI): a system is a folder Roms/<Name> (<TAG>) whose files are run by Emus/<platform>/<TAG>.pak/launch.sh with the file as
    # its argument; the menu shows the name without the tag. The cart itself is the file, map.txt beside it gives it the game's title, and
    # .media/<file name>.png is the box art beside the list. A cart with no console (the pad tools) is a pak of its own under Tools.
    PLAT="${DEVICE_PLATFORM:-tg5040}"; SD="${DEVICE_SDCARD:-/mnt/SDCARD}"
    if [ -n "$INFO" ]; then
      CID="${INFO%%|*}"; CNAME="${INFO#*|}"
      case "$CID" in glow43) TAG=G43 ;; glow169) TAG=G169 ;; *) TAG="$(printf '%s' "$CID" | tr 'a-z' 'A-Z' | tr -cd 'A-Z0-9')" ;; esac
      FOLDER="$SD/Roms/$CNAME ($TAG)"; PAK="$SD/Emus/$PLAT/$TAG.pak"
      EXT="$(console_ext "$SRC" "$CID")"; ROM="$NAME.$EXT" # breakout.g43, as a GBA game is breakout.gba
      ssh $SSH_OPTS "$T" "mkdir -p $(q "$FOLDER/.media") $(q "$PAK")"
      scp -q $SSH_OPTS "$HOSTCART" "$T:$FOLDER/$ROM"
      # pushed before carts were named by console: the old breakout.cart goes, with its line in map.txt
      [ "$EXT" != cart ] && ssh $SSH_OPTS "$T" "rm -f $(q "$FOLDER/$NAME.cart"); m=$(q "$FOLDER/map.txt"); [ -f \"\$m\" ] && { grep -v $(q "^$NAME.cart	") \"\$m\" > \"\$m.tmp\"; mv \"\$m.tmp\" \"\$m\"; }; true"
      if [ -z "$GS_NEXTUI_PROGRAM" ]; then
        # The console runs in NextUI's own emulator (minarch) with gs as its libretro core, like any other system: its menu on MENU,
        # its button settings, sleep, saves under Saves/<TAG>. The core sits beside the SoundFont, where it looks for it.
        # GS_NEXTUI_PROGRAM=1 sends the plain program and its launcher instead (build/<cart>.sh, written above).
        scp -q $SSH_OPTS build-aarch64/gs_libretro.so "$T:$DEVICE_DIR/gs_libretro.so"
        {
          echo '#!/bin/sh'
          echo '# written by GameStudio (scripts/push.sh): a Glow console run by NextUI'"'"'s minarch with the gs core'
          echo 'EMU_TAG=$(basename "$(dirname "$0")" .pak)'
          echo 'mkdir -p "$SAVES_PATH/$EMU_TAG" "$BIOS_PATH/$EMU_TAG"'
          echo 'HOME="$USERDATA_PATH"'
          echo 'cd "$HOME"'
          # A console without L3 and R3 (Glow43, Glow169) gets the Brick's L3 and R4 as a second Select and Start.
          [ -z "$(console_has "$SRC" "$CID" l3)" ] && echo 'export GS_BUTTON_ALIAS="l3=select,r3=start"'
          [ -n "$GS_DEBUG" ] && echo 'export GS_DEBUG_INPUT=1'
          [ -n "$GS_PERF" ] && echo 'export GS_PERF=1'
          echo "minarch.elf \"$DEVICE_DIR/gs_libretro.so\" \"\$1\" &> \"\$LOGS_PATH/\$EMU_TAG.txt\""
        } > "$B/$NAME.sh"
      fi
      scp -q $SSH_OPTS "$B/$NAME.sh" "$T:$PAK/launch.sh"
      ssh $SSH_OPTS "$T" "chmod +x $(q "$PAK/launch.sh") '$DEVICE_DIR/gs'"
      if [ -f "$SRC/meta/box_art.png" ]; then scp -q $SSH_OPTS "$SRC/meta/box_art.png" "$T:$FOLDER/.media/$NAME.png"
      else ssh $SSH_OPTS "$T" "rm -f $(q "$FOLDER/.media/$NAME.png")"; fi
      # the console's logo as the folder's picture in the list of systems
      [ -f "assets/console-logos/$CID.png" ] && { ssh $SSH_OPTS "$T" "mkdir -p '$SD/Roms/.media'"; scp -q $SSH_OPTS "assets/console-logos/$CID.png" "$T:$SD/Roms/.media/$CNAME ($TAG).png"; }
      # map.txt: one "file<TAB>title" per line; this game's line is replaced (no python on the device, so grep does it)
      ssh $SSH_OPTS "$T" "sh -s -- $(q "$FOLDER/map.txt") $(q "$ROM") $(q "${TITLE:-$NAME}")" <<'REMOTE'
map="$1"; file="$2"; title="$3"
touch "$map"
{ grep -v "^$file	" "$map" || true; printf '%s\t%s\n' "$file" "$title"; } > "$map.tmp" && mv "$map.tmp" "$map"
REMOTE
      echo "launcher: $PAK/launch.sh (one for every $CNAME game)"
      echo "game: $FOLDER/$ROM ($CNAME in the NextUI menu)"
    else
      PAK="$SD/Tools/$PLAT/${TITLE:-$NAME}.pak"
      ssh $SSH_OPTS "$T" "mkdir -p $(q "$PAK")"
      scp -q $SSH_OPTS "$B/$NAME.sh" "$T:$PAK/launch.sh"
      ssh $SSH_OPTS "$T" "chmod +x $(q "$PAK/launch.sh") '$DEVICE_DIR/gs'"
      echo "launcher: $PAK (Tools in the NextUI menu)"
    fi
    echo "pushed $NAME to $T:$DEVICE_DIR"
    exit 0
  fi
  if [ "$DEVICE_OS" = muos ]; then
    # muOS: each console is a folder of launchers under ROMS named after it ("Glow43"; carts with no console, like the button test, go in
    # "Tools"), assigned to muOS's own External - Ports system (which
    # runs .sh files with its SDL set-up, as for PortMaster games). muOS picks a folder's system by its name, lower case without spaces,
    # in assign.json; adding ours there means nobody has to assign it by hand. The game's title replaces the file name in the list
    # (info/name/global.json), and its box art, screenshot and description go into the External - Ports catalogue.
    CNAME="${INFO#*|}"; [ -n "$INFO" ] || CNAME="Tools"
    FOLDER="$CNAME"
    DEST="$DEVICE_ROMS_DIR/$FOLDER/$NAME.sh"
    node -e 'try { const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.stdout.write(String(d.description || "")); } catch {}' "$SRC/meta/info.json" > "$B/$NAME.txt"
    CAT="/mnt/mmc/MUOS/info/catalogue/External - Ports"
    ssh $SSH_OPTS "$T" "sh -s -- $(q "$DEVICE_ROMS_DIR") $(q "$FOLDER") $(q "$NAME") $(q "${TITLE:-$NAME}") $(q "$CAT")" <<'REMOTE'
roms="$1"; folder="$2"; cart="$3"; title="$4"; cat="$5"
mkdir -p "$roms/$folder" "$cat/box" "$cat/preview" "$cat/text"
assign=/opt/muos/share/info/assign/assign.json
key="$(printf '%s' "$folder" | tr 'A-Z' 'a-z' | tr -d '[:space:]')"
if [ -f "$assign" ] && ! jq -e --arg k "$key" 'has($k)' "$assign" >/dev/null; then
  jq -S --arg k "$key" '. + {($k): "External - Ports"}' "$assign" > "$assign.tmp" && mv "$assign.tmp" "$assign"
  echo "folder assigned: $folder -> External - Ports"
fi
names=/mnt/mmc/MUOS/info/name/global.json
[ -f "$names" ] || echo '{}' > "$names"
jq --arg k "$cart" --arg v "$title" '.[$k] = $v' "$names" > "$names.tmp" && mv "$names.tmp" "$names"
REMOTE
    # the console's logo is the folder's picture in the content list
    CID="${INFO%%|*}"
    if [ -n "$INFO" ] && [ -f "assets/console-logos/$CID.png" ]; then
      ssh $SSH_OPTS "$T" "mkdir -p '/mnt/mmc/MUOS/info/catalogue/Folder/box'"
      scp -q $SSH_OPTS "assets/console-logos/$CID.png" "$T:/mnt/mmc/MUOS/info/catalogue/Folder/box/$FOLDER.png"
    fi
    for pic in box_art:box screenshot:preview; do
      f="${pic%%:*}"; d="${pic#*:}"
      if [ -f "$SRC/meta/$f.png" ]; then scp -q $SSH_OPTS "$SRC/meta/$f.png" "$T:$CAT/$d/$NAME.png"; else ssh $SSH_OPTS "$T" "rm -f '$CAT/$d/$NAME.png'"; fi
    done
    scp -q $SSH_OPTS "$B/$NAME.txt" "$T:$CAT/text/$NAME.txt"
    scp -q $SSH_OPTS "$B/$NAME.sh" "$T:$DEST"
    ssh $SSH_OPTS "$T" "chmod +x '$DEST' '$DEVICE_DIR/gs'"
    # the first muOS version put each console in "GameStudio <name>": move this game out of there (and drop the folder once empty)
    ssh $SSH_OPTS "$T" "rm -f $(q "$DEVICE_ROMS_DIR/GameStudio $CNAME/$NAME.sh"); rmdir $(q "$DEVICE_ROMS_DIR/GameStudio $CNAME") 2>/dev/null; true"
    echo "launcher: $DEST ($FOLDER in the muOS menu)"
    echo "pushed $NAME to $T:$DEVICE_DIR"
    exit 0
  fi
  if [ -n "$INFO" ] && [ -n "$DEVICE_ROMS_DIR" ]; then
    # Each console is its own EmulationStation system (Glow43, Glow169, ...): a folder under the roms dir of launchers, and a system entry in
    # es_systems_gamestudio.cfg that runs them with the same "sh" launcher the Ports system uses. EmulationStation reads that file at
    # start-up, so a new console shows up after the frontend restarts.
    CID="${INFO%%|*}"; CNAME="${INFO#*|}"
    DEST="$DEVICE_ROMS_DIR/$CID/$NAME.sh"
    # The console's logo for Art Book Next (used when the theme's "System logos" setting is Custom; otherwise it shows the name as text):
    # the flat white one, since that theme colours its system logos itself (a custom console without one gets its full-colour logo).
    LOGO="assets/console-logos/$CID-white.svg"; [ -f "$LOGO" ] || LOGO="assets/console-logos/$CID.svg"
    if [ -f "$LOGO" ]; then
      LOGODIR="${DEVICE_THEME_CUSTOM_DIR:-/userdata/theme-customizations/art-book-next}/logos"
      ssh $SSH_OPTS "$T" "mkdir -p '$LOGODIR'"
      scp -q $SSH_OPTS "$LOGO" "$T:$LOGODIR/$CID.svg"
    fi
    # and its panel for the home carousel (used when the theme's "System view artwork" is Custom: scripts/knulli-theme.sh on)
    if [ -f "assets/console-art/$CID.png" ]; then
      ARTDIR="${DEVICE_THEME_CUSTOM_DIR:-/userdata/theme-customizations/art-book-next}/artwork"
      ssh $SSH_OPTS "$T" "mkdir -p '$ARTDIR'"
      scp -q $SSH_OPTS "assets/console-art/$CID.png" "$T:$ARTDIR/$CID.png"
    fi
    ssh $SSH_OPTS "$T" sh -s -- "$DEVICE_ROMS_DIR" "$CID" "$CNAME" "$DEVICE_PORTS_DIR" "$NAME" <<'REMOTE'
roms="$1"; id="$2"; name="$3"; ports="$4"; cart="$5"
cfgdir=/userdata/system/configs/emulationstation
cfg="$cfgdir/es_systems_gamestudio.cfg"
mkdir -p "$roms/$id" "$cfgdir"
[ -f "$cfg" ] || printf '<?xml version="1.0"?>\n<systemList>\n</systemList>\n' > "$cfg"
if ! grep -q "<name>$id</name>" "$cfg"; then
  {
    sed '/<\/systemList>/,$d' "$cfg"
    cat <<XML
  <system>
        <fullname>$name</fullname>
        <name>$id</name>
        <manufacturer>GameStudio</manufacturer>
        <release>None</release>
        <hardware>portable</hardware>
        <path>$roms/$id</path>
        <extension>.sh</extension>
        <command>emulatorlauncher %CONTROLLERSCONFIG% -system %SYSTEM% -rom %ROM% -gameinfoxml %GAMEINFOXML% -systemname %SYSTEMNAME%</command>
        <platform>pc</platform>
        <theme>$id</theme>
        <emulators>
            <emulator name="sh">
                <cores>
                    <core default="true">sh</core>
                </cores>
            </emulator>
        </emulators>
  </system>
</systemList>
XML
  } > "$cfg.tmp" && mv "$cfg.tmp" "$cfg"
  echo "system added: $name (restart EmulationStation to see it)"
fi
# A system with a name of its own also needs its default emulator and core in the main settings file, or the launcher cannot pick one
# ("emulator: None") and the game just returns to the list.
conf=/userdata/system/knulli.conf
if ! grep -q "^$id.emulator=" "$conf" 2>/dev/null; then
  [ -f "$conf" ] && [ -n "$(tail -c1 "$conf")" ] && echo >> "$conf"
  printf '%s.emulator=sh\n%s.core=sh\n' "$id" "$id" >> "$conf"
fi
# Every console needs a theme name of its own: while Dot (now Glow43) shared the Ports theme name, EmulationStation listed it as a system and
# showed it in All Games, but left it off the home screen carousel.
sed -i "/<name>$id<\\/name>/,/<\\/system>/ s|<theme>[^<]*</theme>|<theme>$id</theme>|" "$cfg"
# an earlier version used a hardware type EmulationStation does not know (it needs one of its own: console, portable, computer, ...)
sed -i 's|<hardware>fantasy console</hardware>|<hardware>portable</hardware>|' "$cfg"
# earlier versions put the launcher in Ports and in a collection: clean those up
rm -f "$ports/GS-$cart.sh"
for f in "$cfgdir"/collections/custom-*.cfg; do
  [ -f "$f" ] && grep -q "/GS-$cart.sh\$" "$f" && { (grep -v "/GS-$cart.sh\$" "$f" || true) > "$f.tmp" && mv "$f.tmp" "$f"; }
done
true
REMOTE
  else
    DEST="$DEVICE_PORTS_DIR/GS-$NAME.sh"
  fi
  scp -q $SSH_OPTS "$B/$NAME.sh" "$T:$DEST"
  ssh $SSH_OPTS "$T" "chmod +x '$DEST' '$DEVICE_DIR/gs'"
  if [ -n "$KNULLI_CORE" ]; then
    # the core beside the SoundFont (where it looks for it), and this game's RetroArch settings over Knulli's. Knulli writes its file for
    # whichever libretro system ran last, so it can hold that system's bezel overlay, picture shape (a GBA game left a 3:2 custom viewport)
    # and shader: the console's own shape, named outright (a custom shape left by Knulli wins over "use the core's"), at a sharp
    # whole-number scale replaces them, saves go to the console's own folder, and Knulli's file is left as Knulli wrote it.
    scp -q $SSH_OPTS build-aarch64/gs_libretro.so "$T:$DEVICE_DIR/gs_libretro.so"
    # The picture goes in the middle of the handheld's screen at the largest whole-number scale (Glow43's 256x192 at 2x on 640x480). RetroArch's
    # own integer scaling put it in the top-left corner on Knulli, whose file keeps a custom viewport at 0,0 that it then used; so the
    # viewport is given outright. The screen size is Knulli's own setting (640x480 when it has none).
    SCREEN="$(ssh $SSH_OPTS "$T" "sed -n 's/^video_fullscreen_\([xy]\) *= *\"*\([0-9]*\).*/\2/p' /userdata/system/configs/retroarch/retroarchcustom.cfg 2>/dev/null | tr '\n' ' '")"
    set -- $SCREEN; SW="${1:-640}"; SH="${2:-480}"; set --
    # The screen's real refresh rate: the Anbernic RG35XX Pro's panel runs at 59.033 Hz. RetroArch on Knulli is not told and takes 60,
    # so the game, held to the screen, made 1.6% less sound than the speaker played; its own correction covers about 0.5%, the sound ran
    # dry and crackled. Told the true rate, RetroArch resamples the sound to fit.
    HZ="$(ssh $SSH_OPTS "$T" "fbset 2>/dev/null | sed -n 's/.*V: *\([0-9.]*\) *Hz.*/\1/p'")"
    set -- $(console_screen "$SRC" "$CID"); GW="${1:-256}"; GH="${2:-192}"; set --
    K=$(( SW / GW < SH / GH ? SW / GW : SH / GH )); [ "$K" -ge 1 ] || K=1
    {
      printf 'savefile_directory = "/userdata/saves/%s"\nsavestate_directory = "/userdata/saves/%s"\n' "$CID" "$CID"
      printf 'input_overlay_enable = "false"\ninput_overlay = ""\nvideo_shader_enable = "false"\n'
      printf 'video_aspect_ratio_auto = "false"\naspect_ratio_index = "23"\nvideo_scale_integer = "false"\n'
      printf 'custom_viewport_width = "%s"\ncustom_viewport_height = "%s"\ncustom_viewport_x = "%s"\ncustom_viewport_y = "%s"\n' \
        $((GW * K)) $((GH * K)) $(((SW - GW * K) / 2)) $(((SH - GH * K) / 2))
      [ -n "$HZ" ] && printf 'video_refresh_rate = "%s"\naudio_rate_control = "true"\n' "$HZ"
      printf 'video_smooth = "false"\nconfig_save_on_exit = "false"\n'
    } > "$B/retroarch-$NAME.cfg"
    scp -q $SSH_OPTS "$B/retroarch-$NAME.cfg" "$T:$DEVICE_DIR/retroarch-$NAME.cfg"
    ssh $SSH_OPTS "$T" "mkdir -p '/userdata/saves/$CID'; rm -f '$DEST.keys'"
  fi
  # HOTKEY + START leaves the game the way it leaves every other app: Knulli/Batocera's launcher starts its button watcher (evmapy) with a
  # <launcher>.keys file found beside the launcher. Stopping gs with TERM lets it save and close like a normal quit. The runtime watches
  # for HOTKEY + START itself too, for when the watcher is not running.
  if [ -z "$KNULLI_CORE" ]; then # RetroArch leaves on HOTKEY + START by itself
  printf '{\n  "actions_player1": [\n    { "trigger": ["hotkey", "start"], "type": "exec", "target": "killall -TERM gs" }\n  ]\n}\n' > "$B/$NAME.sh.keys"
  scp -q $SSH_OPTS "$B/$NAME.sh.keys" "$T:$DEST.keys"
  fi
  echo "launcher: $DEST"
  # The game list entry: name, description, box art and details from the project's Game info (studio: "Game info..."), merged into the
  # gamelist.xml next to the launcher. An entry for the same launcher is replaced; what EmulationStation recorded itself (play count,
  # favourite, ...) is kept.
  GLDIR="$(dirname "$DEST")"; LAUNCH="$(basename "$DEST")"
  # pictures: meta/box_art.png, meta/screenshot.png, meta/logo.png (each optional) go to images/<cart>.png, <cart>-screenshot.png, <cart>-logo.png
  IMG_BOX=""; IMG_SHOT=""; IMG_LOGO=""
  [ -f "$SRC/meta/box_art.png" ] && IMG_BOX="images/$NAME.png"
  [ -f "$SRC/meta/screenshot.png" ] && IMG_SHOT="images/$NAME-screenshot.png"
  [ -f "$SRC/meta/logo.png" ] && IMG_LOGO="images/$NAME-logo.png"
  node scripts/gamelist.mjs "$SRC" "$LAUNCH" "$IMG_BOX" "$IMG_SHOT" "$IMG_LOGO" > "$B/$NAME.gamelist-entry.xml"
  scp -q $SSH_OPTS "$B/$NAME.gamelist-entry.xml" "$T:/tmp/gs-$NAME.entry.xml"
  ssh $SSH_OPTS "$T" "mkdir -p '$GLDIR/images'"
  if [ -n "$IMG_BOX" ]; then scp -q $SSH_OPTS "$SRC/meta/box_art.png" "$T:$GLDIR/$IMG_BOX"; else ssh $SSH_OPTS "$T" "rm -f '$GLDIR/images/$NAME.png'"; fi
  if [ -n "$IMG_SHOT" ]; then scp -q $SSH_OPTS "$SRC/meta/screenshot.png" "$T:$GLDIR/$IMG_SHOT"; else ssh $SSH_OPTS "$T" "rm -f '$GLDIR/images/$NAME-screenshot.png'"; fi
  if [ -n "$IMG_LOGO" ]; then scp -q $SSH_OPTS "$SRC/meta/logo.png" "$T:$GLDIR/$IMG_LOGO"; else ssh $SSH_OPTS "$T" "rm -f '$GLDIR/images/$NAME-logo.png'"; fi
  ssh $SSH_OPTS "$T" python3 - "$GLDIR/gamelist.xml" "/tmp/gs-$NAME.entry.xml" "$LAUNCH" <<'PY'
import sys, xml.etree.ElementTree as ET
gamelist, entry_file, launcher = sys.argv[1:4]
entry = ET.fromstring(open(entry_file, encoding="utf-8").read())
try:
    tree = ET.parse(gamelist); root = tree.getroot()
except Exception:
    root = ET.Element("gameList"); tree = ET.ElementTree(root)
for g in list(root.findall("game")):
    if g.findtext("path") == "./" + launcher:
        for tag in ("playcount", "lastplayed", "favorite", "hidden", "gametime"):
            if g.find(tag) is not None and entry.find(tag) is None:
                entry.append(g.find(tag))
        root.remove(g)
root.append(entry)
ET.indent(tree)
tree.write(gamelist, encoding="utf-8", xml_declaration=True)
PY
  ssh $SSH_OPTS "$T" "rm -f '/tmp/gs-$NAME.entry.xml'; curl -s -m 3 http://127.0.0.1:1234/reloadgames >/dev/null 2>&1 || true"
  echo "game list updated"
else
  ssh $SSH_OPTS "$T" "chmod +x '$DEVICE_DIR/gs'"
fi
echo "pushed $NAME to $T:$DEVICE_DIR"
