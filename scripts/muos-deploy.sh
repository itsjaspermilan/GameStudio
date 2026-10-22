#!/bin/sh
# Put the runtime and carts on a muOS SD card that is mounted on this Mac, one launcher per cart in muOS's Ports list.
#   scripts/muos-deploy.sh carts/breakout [carts/other ...]      (card at /Volumes/GAMES, or set SD2=/Volumes/NAME)
# Writes <card>/MUOS/application/GameStudio/{gs,TimGM6mb.sf2,carts/*.cart} and <card>/ROMS/Ports/GS <name>.sh.
# Unverified on real hardware: how muOS lists and launches files in ROMS/Ports comes from reading its forum, not from a test.
set -e
cd "$(dirname "$0")/.."
[ $# -ge 1 ] || { echo "usage: $0 <cart-dir> [<cart-dir> ...]" >&2; exit 2; }
SD="${SD2:-/Volumes/GAMES}"
[ -d "$SD/MUOS" ] || { echo "$SD does not look like a muOS card (no MUOS folder); set SD2=/Volumes/<name>" >&2; exit 1; }
[ -x build/gs ] || ./scripts/build.sh
[ -x build-aarch64/gs ] || ./scripts/build-aarch64.sh

APP="$SD/MUOS/application/GameStudio"
mkdir -p "$APP/carts" "$SD/ROMS/Ports"
cp build-aarch64/gs "$APP/gs"
[ -f "$APP/TimGM6mb.sf2" ] || cp assets/soundfonts/TimGM6mb.sf2 "$APP/TimGM6mb.sf2"

# GS_DEBUG=1 scripts/muos-deploy.sh ...  makes the launchers log every controller press to last-run.log and leave after 60 seconds (GS_DEBUG_SECONDS=N), for mapping problems
DEBUG_LINE=""; [ -n "$GS_DEBUG" ] && DEBUG_LINE="GS_DEBUG_INPUT=1 GS_MAX_SECONDS=${GS_DEBUG_SECONDS:-60} "

for SRC in "$@"; do
  NAME="$(basename "${SRC%/}")"
  ./build/gs pack "$SRC" "$APP/carts/$NAME.cart"
  # The card is /mnt/sdcard when it is in the second slot and /mnt/mmc when it is the first; use whichever has the runtime.
  cat > "$SD/ROMS/Ports/GS $NAME.sh" <<EOF
#!/bin/sh
# GameStudio: $NAME
. /opt/muos/script/var/func.sh

APP_BIN="gs"
SETUP_APP "\$APP_BIN" ""

for d in /mnt/sdcard /mnt/mmc; do
  [ -x "\$d/MUOS/application/GameStudio/gs" ] && APP_DIR="\$d/MUOS/application/GameStudio" && break
done
[ -n "\$APP_DIR" ] || exit 1
cd "\$APP_DIR" || exit 1
${DEBUG_LINE}./gs carts/$NAME.cart > "\$APP_DIR/last-run.log" 2>&1
EOF
  chmod +x "$SD/ROMS/Ports/GS $NAME.sh"
  echo "added: GS $NAME"
done
sync
echo "done. Eject the card before removing it: diskutil eject $SD"
