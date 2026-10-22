# Console art

`<id>.png`: the panel the Knulli theme (art-book-next) shows for a console on the home carousel, 454 x 1080, slanted like the theme's own panels, drawn in 6-pixel blocks from the console's palette.
Written by `scripts/make-console-art.mjs` (edit the drawing there and run it again). `scripts/push.sh` copies the one that matches a cart's console to
`/userdata/theme-customizations/art-book-next/artwork/<id>.png`, and `scripts/knulli-theme.sh on` turns the theme's "System logos" and "System view artwork" to Custom so it uses them
(with the logos in `../console-logos/`). A console without a file here keeps the theme's own panel.
