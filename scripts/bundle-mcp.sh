#!/bin/sh
# Stage the self-contained MCP server using the shared bundler.
set -eu
cd "$(dirname "$0")/.."
dest=${1:?usage: sh scripts/bundle-mcp.sh destination}
node tools/mcp/bundle.mjs "$dest"
