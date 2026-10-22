#!/bin/sh
# Cross-compile for aarch64 Linux handhelds: scripts/build-aarch64.sh  ->  build-aarch64/gs
# Needs: zig, cmake, pkgconf (brew install cmake pkgconf), and scripts/fetch-sysroot.sh run once.
set -e
cd "$(dirname "$0")/.."
SYSROOT="$PWD/third_party/sysroot-aarch64"
[ -d "$SYSROOT" ] || ./scripts/fetch-sysroot.sh
export PKG_CONFIG_SYSROOT_DIR="$SYSROOT"
export PKG_CONFIG_LIBDIR="$SYSROOT/usr/lib/aarch64-linux-gnu/pkgconfig:$SYSROOT/usr/lib/pkgconfig:$SYSROOT/usr/share/pkgconfig"
cmake -S . -B build-aarch64 -DCMAKE_TOOLCHAIN_FILE="$PWD/scripts/toolchain-aarch64.cmake" -DCMAKE_BUILD_TYPE=Release -DSDL_UNIX_CONSOLE_BUILD=ON
cmake --build build-aarch64 -j
file build-aarch64/gs
