# assets/

`soundfonts/TimGM6mb.sf2` (about 6 MB, **GPL-2.0**, Tim Brechbill and David Bolton): the General MIDI SoundFont used by `gm_*` instruments. It stays beside the runtime and is **never packed into a cart**
(carts have a 16 MB budget). The runtime finds it through `ensure_soundfont` in `runtime/main.c`; `scripts/push.sh` and the studio's "Send to device" copy it to the device once. Keep the licence note in
`../README.md` ("Licences") accurate if the file is replaced; a different `.sf2` can be used by setting `GS_SOUNDFONT`. Binary file: never read it.

`console-art/`: the carousel panel per console (see its README), made by `scripts/make-console-art.mjs`.
`console-logos/`: one white SVG per console id (`dot.svg`, `dash.svg`), copied to the device for the EmulationStation theme by `scripts/push.sh` (see its README).
