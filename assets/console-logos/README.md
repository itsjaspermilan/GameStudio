# Console logos

One logo per console id: `glow43.svg` / `.png` and `glow169.svg` / `.png` (a custom console `my-console` would use `my-console.svg`).
Written by `scripts/make-console-logos.mjs` (edit the drawing there and run it again, not the files): "GLOW" in a bold pixel font in
warm white, the number in the console's own colour (Glow43 amber, Glow169 cyan), and a pixel glow round the letters that fades out in
three dithered rings. Every pixel is a square, so the SVG stays sharp at any size.

`scripts/push.sh` copies them to the device:
- **Knulli:** the SVG to the theme's customisation folder (`/userdata/theme-customizations/art-book-next/logos/<id>.svg`). The theme uses
  it when its "System logos" setting is **Custom** (`scripts/knulli-theme.sh on`); it multiplies a logo by white (`systemLogoColor`), so the
  colours stay.
- **muOS:** the PNG as the console folder's picture in the content list (`MUOS/info/catalogue/Folder/box/<console name>.png`).
