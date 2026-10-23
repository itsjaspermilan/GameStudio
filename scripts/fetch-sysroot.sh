#!/bin/sh
# Builds a headers+libs sysroot for cross-compiling to aarch64 Linux, from Debian bookworm arm64 packages.
# Used only so SDL2's configure step can find KMSDRM/GBM/EGL/ALSA/udev headers and sonames;
# SDL dlopens these at runtime, so nothing from here is linked into the binary.
# Output: third_party/sysroot-aarch64/   (re-run to rebuild)
set -e
cd "$(dirname "$0")/.."
OUT="$PWD/third_party/sysroot-aarch64"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
MIRROR=https://deb.debian.org/debian
PKGS="libdrm-dev libdrm2 libdrm-common libgbm-dev libgbm1 libegl-dev libegl1 libgles-dev libgles2 libglvnd-dev libopengl-dev libgl-dev libasound2-dev libasound2 libudev-dev libudev1"

curl -sSL "$MIRROR/dists/bookworm/main/binary-arm64/Packages.xz" | xz -d > "$WORK/Packages"
rm -rf "$OUT"; mkdir -p "$OUT"
for p in $PKGS; do
  # first stanza for this package: pull Filename and SHA256
  stanza="$(awk -v p="$p" 'BEGIN{RS="";FS="\n"} $1=="Package: " p {print; exit}' "$WORK/Packages")"
  file="$(echo "$stanza" | sed -n 's/^Filename: //p')"
  sha="$(echo "$stanza" | sed -n 's/^SHA256: //p')"
  [ -n "$file" ] || { echo "package not found: $p" >&2; exit 1; }
  d="$WORK/$p"; mkdir -p "$d"
  curl -sSL "$MIRROR/$file" -o "$d/pkg.deb"
  echo "$sha  $d/pkg.deb" | shasum -a 256 -c - >/dev/null || { echo "checksum mismatch: $p" >&2; exit 1; }
  (cd "$d" && ar x pkg.deb && tar xf data.tar.* -C "$OUT")
  echo "ok $p"
done
# Debian puts multiarch files under usr/lib/aarch64-linux-gnu; flatten pkgconfig/libs lookup via the toolchain file.
