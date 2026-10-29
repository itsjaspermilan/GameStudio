# Shared by push.sh, run.sh and knulli-theme.sh, from the workspace root.
ENVFILE="${DEVICE_ENV:-scripts/device${GS_DEVICE:+-$GS_DEVICE}.env}"
[ -f "$ENVFILE" ] || { echo "Create $ENVFILE from a scripts/device*.env.example template." >&2; exit 1; }
case "$ENVFILE" in /*) . "$ENVFILE" ;; *) . "./$ENVFILE" ;; esac
if [ -n "$DEVICE_HOST$DEVICE_USER$SSH_OPTS" ]; then
  echo "This device file uses retired SSH settings. Replace it with the ADB template; choose DEVICE_SERIAL and review the firmware and folders. No SSH settings were migrated." >&2
  exit 1
fi
command -v node >/dev/null 2>&1 || { echo "Sending needs Node.js. Install it from nodejs.org (or brew install node)." >&2; exit 1; }
GS_ADB_HELPER="$PWD/scripts/adb.mjs"
export ADB
DEVICE_SERIAL="$(node "$GS_ADB_HELPER" select "${GS_ADB_SERIAL:-${DEVICE_SERIAL:-$ANDROID_SERIAL}}")" || exit 1
export GS_ADB_SERIAL="$DEVICE_SERIAL" ADB
device_shell() { node "$GS_ADB_HELPER" shell "$DEVICE_SERIAL" "$@"; }
device_push() { node "$GS_ADB_HELPER" push "$DEVICE_SERIAL" "$1" "$2"; }
q() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
DEVICE_OS="${DEVICE_OS:-knulli}"
case "$DEVICE_OS" in
  nextui) DEVICE_DIR="${DEVICE_DIR:-/mnt/SDCARD/GameStudio}" ;;
  knulli) DEVICE_DIR="${DEVICE_DIR:-/userdata/gs}" ;;
  muos) DEVICE_DIR="${DEVICE_DIR:-/mnt/mmc/gs}" ;;
  *) echo "Unsupported DEVICE_OS: choose nextui, knulli or muos." >&2; exit 1 ;;
esac
for p in "$DEVICE_DIR" "$DEVICE_PORTS_DIR" "$DEVICE_ROMS_DIR" "$DEVICE_SDCARD" "$DEVICE_THEME_CUSTOM_DIR"; do
  [ -z "$p" ] && continue
  case "$p" in /*) ;; *) echo "Device folders must be absolute paths." >&2; exit 1 ;; esac
  case "$p" in *[!A-Za-z0-9/._\ -]*|*/../*|*/..|/) echo "Invalid device folder: use letters, digits, spaces, / . _ - (no ..)." >&2; exit 1 ;; esac
done
case "$DEVICE_PLATFORM" in *[!A-Za-z0-9_-]*) echo "Invalid DEVICE_PLATFORM." >&2; exit 1 ;; esac
