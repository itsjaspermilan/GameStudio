#!/bin/sh
# Stage the MCP server beside the app's other engine resources. Dependencies are installed by build-app.sh.
set -eu
cd "$(dirname "$0")/.."
dest=${1:?usage: sh scripts/bundle-mcp.sh destination}
mkdir -p "$dest/tools/mcp" "$dest/studio/src" "$dest/scripts/lib" "$dest/engine" "$dest/docs" "$dest/tests"
cp tools/mcp/server.mjs tools/mcp/tools.mjs tools/mcp/package.json tools/mcp/package-lock.json "$dest/tools/mcp/"
cp studio/package.json "$dest/studio/"
for file in lua-intel-core project-core palette-core sprite-core audio-core music-core room-core help-core search-core brick-core fonts buttons; do
  cp "studio/src/$file.js" "$dest/studio/src/"
done
cp scripts/lib/canvas.mjs scripts/lib/music.mjs "$dest/scripts/lib/"
cp scripts/png.mjs "$dest/scripts/"
cp engine/instruments.json "$dest/engine/"
cp -R docs/help "$dest/docs/"
cp tests/keys-bot.lua tests/random-bot.lua "$dest/tests/"
