#!/bin/sh
# Downloads the Lua language server (LuaLS) the studio's code editor talks to, for the machine you are on (macOS arm64 or x64).
# Output: third_party/luals/   (gitignored; re-run to replace). The studio runs without it, with its own smaller set of hints.
#   scripts/fetch-luals.sh --if-missing     only when third_party/luals is not there yet, or is for another processor (the app build uses this)
#   LUALS_ARCH=x86_64 scripts/fetch-luals.sh    for another processor than this Mac's (aarch64 / arm64 or x86_64); a Tauri build passes TAURI_ENV_ARCH
set -e
cd "$(dirname "$0")/.."
VERSION=3.19.2
ARCH="${LUALS_ARCH:-${TAURI_ENV_ARCH:-$(uname -m)}}"
case "$(uname -s)-$ARCH" in
  Darwin-arm64|Darwin-aarch64) PLAT=darwin-arm64; SHA=79149584320a23bd5fcd5bc31f47a1975acd8a4560a0e89036bb1016fa61687f ;;
  Darwin-x86_64) PLAT=darwin-x64; SHA=6f2174ece5ec63bcd9d5b22b2c902445c1cd9045fafe48c62602448ebf4c09cc ;;
  *) echo "LuaLS: no download listed for $(uname -s)-$ARCH; see https://github.com/LuaLS/lua-language-server/releases" >&2; exit 1 ;;
esac
if [ "$1" = "--if-missing" ] && [ -x third_party/luals/bin/lua-language-server ] && [ "$(cat third_party/luals/.platform 2>/dev/null)" = "$PLAT" ]; then exit 0; fi
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
curl -sSL "https://github.com/LuaLS/lua-language-server/releases/download/$VERSION/lua-language-server-$VERSION-$PLAT.tar.gz" -o "$WORK/luals.tgz"
echo "$SHA  $WORK/luals.tgz" | shasum -a 256 -c - >/dev/null || { echo "LuaLS: checksum mismatch" >&2; exit 1; }
rm -rf third_party/luals; mkdir -p third_party/luals
tar xzf "$WORK/luals.tgz" -C third_party/luals
echo "$PLAT" > third_party/luals/.platform
echo "LuaLS $VERSION ($PLAT) installed in third_party/luals"
