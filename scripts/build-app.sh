#!/bin/sh
# Builds GameStudio.app for this Mac with everything it needs inside it, so it runs without this repository:
#   scripts/build-app.sh        -> studio/src-tauri/target/release/bundle/macos/GameStudio.app (and a .dmg beside it)
# The app carries a read-only copy of the parts of this folder it uses (studio/src-tauri/bundled/gamestudio, made here, gitignored):
# the desktop runtime, the Brick's runtime and libretro core, the SoundFont, the console specs and logos, the API notes the editor's
# language server reads, push.sh for Send to device (it needs Node.js on this Mac) and the examples. Unsigned: for this Mac only.
set -e
cd "$(dirname "$0")/.."
./scripts/build.sh
./scripts/build-aarch64.sh
R=studio/src-tauri/bundled/gamestudio
rm -rf "$R"
mkdir -p "$R/build" "$R/build-aarch64" "$R/assets/soundfonts" "$R/assets/console-logos" "$R/assets/console-art" "$R/engine" "$R/scripts" "$R/carts"
mkdir -p "$R/studio/src"
cp build/gs "$R/build/"
cp build-aarch64/gs build-aarch64/gs_libretro.so "$R/build-aarch64/"
cp assets/soundfonts/FluidR3Mono_GM.sf3 assets/soundfonts/FluidR3Mono_GM-LICENSE.md "$R/assets/soundfonts/"
cp assets/console-logos/*.png assets/console-logos/*.svg "$R/assets/console-logos/"
cp assets/console-art/*.png "$R/assets/console-art/"
cp -R engine/consoles engine/api "$R/engine/"
cp scripts/push.sh scripts/device.sh scripts/adb.mjs scripts/gamelist.mjs "$R/scripts/"
cp studio/src/info-core.js "$R/studio/src/"
cp studio/package.json "$R/studio/"
cp LICENSE "$R/"
# the examples as they are in git: no notes the studio left in them (.gamestudio/), no stray files
for c in breakout buttontest padsetup; do
  git ls-files "carts/$c" | grep -v '/\.gamestudio/' | while read -r f; do mkdir -p "$R/$(dirname "$f")"; cp "$f" "$R/$f"; done
done
cd studio
npm run tauri build -- --config src-tauri/tauri.bundle.json
echo "built: $(pwd)/src-tauri/target/release/bundle/macos/GameStudio.app"
