"""Rebuild the smooth font drawings: Python 3 + Pillow 11.3.0, then node scripts/make-fonts.mjs."""
import io
import math
from pathlib import Path
from urllib.request import urlopen

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
REVISION = "6157dfaa640ca5738b4d1a7070fe389c3036d7fc"
SOURCES = {
    "sans": ("arimo", "Arimo[wght].ttf"),
    "serif": ("tinos", "Tinos-Regular.ttf"),
    "mono": ("cousine", "Cousine-Regular.ttf"),
}


def fetch(folder, filename):
    url = f"https://raw.githubusercontent.com/google/fonts/{REVISION}/ofl/{folder}/{filename}"
    if folder == "tinos" and filename == "OFL.txt":
        url = "https://raw.githubusercontent.com/googlefonts/tinos/3b4482a99b80ea5fc75f187b1be3120a3f5905b3/OFL.txt"
    url = url.replace("[", "%5B").replace("]", "%5D")
    with urlopen(url, timeout=30) as response:
        return response.read()


for name, (folder, filename) in SOURCES.items():
    font = ImageFont.truetype(io.BytesIO(fetch(folder, filename)), 14)
    chars = [chr(code) for code in range(32, 127)] + ["\u25a1"]
    cell = max(max(1, math.ceil(font.getlength(char)) - 1, font.getbbox(char, anchor="ls")[2] + max(0, -font.getbbox(char, anchor="ls")[0])) for char in chars)
    lines = [
        f"# {name}: {filename}, Google Fonts {REVISION}; see {name}-OFL.txt.",
        "# Made by scripts/rasterize-fonts.py with Pillow 11.3.0. Hex digits are coverage, 0 transparent to f solid.",
        "height 16",
        "coverage",
    ]
    for code in range(32, 128):
        char = chr(code) if code < 127 else "\u25a1"
        left, top, right, bottom = font.getbbox(char, anchor="ls")
        # Keep the bearings and a whole-pixel advance; the engine supplies the final one-pixel letter gap.
        origin = max(0, -left)
        width = max(1, math.ceil(font.getlength(char)) - 1, right + origin)
        if name == "mono":
            width = cell
        if top < -12 or bottom > 4:
            raise ValueError(f"{name}: {char!r} does not fit the baseline")
        image = Image.new("L", (width, 16))
        ImageDraw.Draw(image).text((origin, 12), char, font=font, fill=255, anchor="ls")
        lines.append("= " + ("space" if code == 32 else "unknown" if code == 127 else char))
        pixels = list(image.getdata())
        lines.extend("".join(format(round(v / 17), "x") for v in pixels[y * width:(y + 1) * width]) for y in range(16))
        lines.append("")
    (ROOT / f"engine/fonts/{name}.txt").write_text("\n".join(lines), encoding="utf-8")
    (ROOT / f"engine/fonts/{name}-OFL.txt").write_bytes(fetch(folder, "OFL.txt"))
