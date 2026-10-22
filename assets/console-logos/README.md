# Console logos

One SVG per console id (`dot.svg`, `dash.svg`; a custom console `my-console` would use `my-console.svg`), white shapes on a transparent 400x200 canvas
(the theme tints them). `scripts/push.sh` copies the one that matches a cart's console to the device's theme customisation folder
(`/userdata/theme-customizations/art-book-next/logos/<id>.svg`). The Knulli theme only uses them when its "System logos" setting is **Custom**;
without a logo it shows the console's name as text.

`dot.svg` is written by `scripts/make-console-logos.mjs`: plain white "DOT", a D and a T drawn as smooth shapes (the theme's SVG renderer has no text fonts) and the O a plain filled circle, in one flat white like
the theme's own logos (all `rgb(255, 255, 255)`), no shading, no pixels. `--pixel` is the pixel-font version (white, the O shaded with one gap), `--shaded` adds greys and a drop shadow, `--colour` also makes
the O red. Edit the script and run it again rather than the SVG. `dash.svg` is still the plain white bar. The theme multiplies a logo by white (`systemLogoColor`), so a coloured logo would keep its colours.
