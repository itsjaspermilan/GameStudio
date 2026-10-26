#!/bin/sh
# Let GameStudio send to a handheld without a password: makes GameStudio's own SSH key (~/.ssh/gamestudio_ed25519, used for handhelds
# only, so your other keys are not touched) if there is none yet, and puts it on the handheld. It asks for the handheld's password once.
#   scripts/setup-key.sh root@192.168.2.78
# On the TrimUI Brick with NextUI the key lands in /root/.ssh/authorized_keys, on the Brick's own storage: it lasts until a firmware update
# resets the system, and running this again puts it back. The studio's Send to device offers to run this in Terminal when it cannot log in.
set -e
[ -n "$1" ] || { echo "usage: $0 <user>@<handheld address>" >&2; exit 2; }
KEY="$HOME/.ssh/gamestudio_ed25519"
if [ ! -f "$KEY" ]; then
  mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
  ssh-keygen -q -t ed25519 -N "" -C "gamestudio" -f "$KEY"
  echo "Made GameStudio's key: $KEY"
fi
echo "Putting the key on $1. Type the handheld's password when it asks (once; nothing shows while you type)."
# Not ssh-copy-id: the Brick's firmware is OpenWrt underneath, so ssh-copy-id writes /etc/dropbear/authorized_keys, but the Brick runs
# OpenSSH, which reads ~/.ssh/authorized_keys. Written by hand, the key lands where OpenSSH looks (and only once).
ssh -o ControlPath=none -o StrictHostKeyChecking=accept-new "$1" \
  'mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && k="$(cat)" && { grep -qxF "$k" ~/.ssh/authorized_keys || echo "$k" >> ~/.ssh/authorized_keys; }' < "$KEY.pub"
if ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ControlPath=none -o ConnectTimeout=8 "$1" true; then
  echo "Done: GameStudio can send to $1 without a password now. You can close this window and press Send to device again."
else
  echo "The key is not accepted yet: check the address and the password, and run this again." >&2
  exit 1
fi
