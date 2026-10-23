#!/bin/sh
# Switches the Knulli theme (art-book-next) between its own logos and artwork and ours.
#   scripts/knulli-theme.sh on     "Distribution" = Batocera/Knulli, "System logos" and "System view artwork" = Custom: Glow43 and Glow169 get assets/console-logos and assets/console-art
#   scripts/knulli-theme.sh off    back to the theme's own (a console without a logo shows its name, one without a panel the generic one)
# Other systems keep their usual logos and panels: the theme looks for a custom file named after the console and falls back to its own.
# NOTE: in a test on the RG35XX Pro, EmulationStation did NOT pick these lines up at start-up (its menu kept saying Default); choosing Custom in the menu
# (UI settings > theme configuration) did work, and then stayed after restarts. Use the menu; this script is here for `off` and as a record of what the settings files look like.
set -e
cd "$(dirname "$0")/.."
[ -f scripts/device.env ] || { echo "create scripts/device.env (see device.env.example)" >&2; exit 1; }
. scripts/device.env
case "$1" in on|off) ;; *) echo "usage: $0 on|off" >&2; exit 2;; esac
T="$DEVICE_USER@$DEVICE_HOST"
SSH_OPTS="$SSH_OPTS -o BatchMode=yes -o ConnectTimeout=8"
ssh $SSH_OPTS "$T" sh -s -- "$1" <<'REMOTE'
cfg=/userdata/system/configs/emulationstation/themesettings/es-theme-art-book-next.cfg
mkdir -p "$(dirname "$cfg")"; touch "$cfg"
{ grep -v -e '^subset.distribution=' -e '^subset.system-logos=' -e '^subset.system-view-artwork=' "$cfg" || true; } > "$cfg.tmp"
# "Distribution" decides which folder the custom files are read from (the theme's README: set it to Batocera/Knulli); without it the folder path comes out empty
if [ "$1" = on ]; then printf 'subset.distribution=batocera\nsubset.system-logos=custom\nsubset.system-view-artwork=custom\n' >> "$cfg.tmp"; fi
mv "$cfg.tmp" "$cfg"
echo "theme settings now:"; cat "$cfg"
REMOTE
echo "Restart EmulationStation to see the change."
