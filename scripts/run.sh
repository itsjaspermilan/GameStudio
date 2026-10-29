#!/bin/sh
# Push a cartridge and launch the standalone runtime over ADB. scripts/run.sh carts/breakout
set -e
cd "$(dirname "$0")/.."
GS_RUN_AFTER_PUSH=1 exec ./scripts/push.sh "$1"
