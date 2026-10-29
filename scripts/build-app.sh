#!/bin/sh
# Builds GameStudio.app for this Mac with everything it needs inside it, so it runs without this repository:
#   scripts/build-app.sh        -> studio/src-tauri/target/release/bundle/macos/GameStudio.app (and a .dmg beside it)
# The app carries a read-only copy of the parts of this folder it uses (studio/src-tauri/bundled/gamestudio, made here, gitignored):
# the desktop runtime, the Brick's runtime and libretro core, the SoundFont, the console specs and logos, the API notes the editor's
# language server reads, push.sh for Send to device and the examples, plus the stdio MCP server and its own Node.js.
# Unsigned: for this Mac only.
set -e
cd "$(dirname "$0")/.."
./scripts/build.sh
./scripts/build-aarch64.sh
R=studio/src-tauri/bundled/gamestudio
rm -rf "$R"
mkdir -p "$R/build" "$R/build-aarch64" "$R/assets/soundfonts" "$R/assets/console-logos" "$R/engine" "$R/scripts" "$R/carts"
cp build/gs "$R/build/"
cp build-aarch64/gs build-aarch64/gs_libretro.so "$R/build-aarch64/"
cp assets/soundfonts/FluidR3Mono_GM.sf3 assets/soundfonts/FluidR3Mono_GM-LICENSE.md "$R/assets/soundfonts/"
cp assets/console-logos/*.png "$R/assets/console-logos/"
cp -R engine/consoles engine/api "$R/engine/"
cp scripts/push.sh scripts/setup-key.sh scripts/gamelist.mjs "$R/scripts/"
cp LICENSE "$R/"
node tools/mcp/bundle.mjs "$R"
# the examples as they are in git: no notes the studio left in them (.gamestudio/), no stray files
for c in breakout buttontest padsetup; do
  git ls-files "carts/$c" | grep -v '/\.gamestudio/' | while read -r f; do mkdir -p "$R/$(dirname "$f")"; cp "$f" "$R/$f"; done
done
cd studio
npm run tauri build -- --config src-tauri/tauri.bundle.json
echo "built: $(pwd)/src-tauri/target/release/bundle/macos/GameStudio.app"
