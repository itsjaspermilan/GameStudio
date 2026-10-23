#!/bin/sh
# Push a cartridge and launch it on the device over SSH.  scripts/run.sh carts/panel-pop
set -e
cd "$(dirname "$0")/.."
./scripts/push.sh "$1"
. scripts/device.env
NAME="$(basename "${1%/}")"
[ -n "$DEVICE_STOP_FRONTEND" ] && ssh $SSH_OPTS "$DEVICE_USER@$DEVICE_HOST" "$DEVICE_STOP_FRONTEND" || true
exec ssh $SSH_OPTS -t "$DEVICE_USER@$DEVICE_HOST" "'$DEVICE_DIR/gs' '$DEVICE_DIR/carts/$NAME.cart'"
