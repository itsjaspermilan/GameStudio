#!/bin/sh
# Desktop build: scripts/build.sh  ->  build/gs
set -e
cd "$(dirname "$0")/.."
cmake -S . -B build
cmake --build build -j
