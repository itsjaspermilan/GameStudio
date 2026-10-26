# Console logos

One logo per console id, in two versions (a custom console `my-console` would use `my-console.svg`):
- `glow43.svg` / `.png`, `glow169.svg` / `.png`: full colour. "GLOW" in chrome and the number in the console's own colour (Glow43 amber,
  Glow169 cyan), smooth bold letters leaning forward in the style of the GBA era, with a dark outline and a drop shadow.
- `glow43-white.svg` / `.png`, `glow169-white.svg` / `.png`: the same letters in flat white with nothing else, for themes that colour
  their system logos themselves.

Written by `scripts/make-console-logos.mjs` (edit the drawing there and run it again, not the files).

`scripts/push.sh` copies them to the device:
- **Knulli, Art Book Next:** the white SVG to the theme's customisation folder (`/userdata/theme-customizations/art-book-next/logos/<id>.svg`),
  used when its "System logos" setting is **Custom** (`scripts/knulli-theme.sh on`).
- **Knulli, es-theme-knulli** (Knulli's default theme): reads logos only from its own folder under `/usr/share`, which Knulli rebuilds at
  every boot; push.sh does not put a logo there.
- **NextUI:** the full-colour PNG as the console folder's picture (`Roms/.media/<console name> (<TAG>).png`).
- **muOS:** the full-colour PNG as the console folder's picture in the content list (`MUOS/info/catalogue/Folder/box/<console name>.png`).
