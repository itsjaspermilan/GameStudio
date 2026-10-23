// Game info: the title, description and box art a game carries to a device's game list (EmulationStation reads them from gamelist.xml).
// It lives in project.json as `info`; every field is optional, so older projects simply have none. The box art is a PNG in the project
// at meta/box_art.png (`meta/` is not packed into the cart: the device never needs the picture, only its game list does).

export const GENRES = ["Action", "Adventure", "Arcade", "Platformer", "Puzzle", "Racing", "Role-playing", "Shooter", "Sports", "Strategy", "Other"];
export const LIMITS = { title: 60, description: 600, developer: 60 };
export const BOX_ART_PATH = "meta/box_art.png";
// The pictures a game list can show, all optional, all in meta/ (scripts/push.sh sends whichever exist; make-cart-art.mjs can draw them).
export const PICTURES = [
  { key: "box_art", path: BOX_ART_PATH, label: "Box art", tip: "The cover the game list shows beside the names: about 240 x 300 fits the handheld's list." },
  { key: "screenshot", path: "meta/screenshot.png", label: "Screenshot", tip: "The game itself, as the list's preview." },
  { key: "logo", path: "meta/logo.png", label: "Logo", tip: "The title as a banner (wide and short), for themes that show one." },
];

// A frame the runtime saved (GS_DUMP_FRAME writes an uncompressed 24 or 32 bit BMP) -> { width, height, data: RGBA }. The screen has no
// see-through pixels, so alpha is always solid.
export function decodeBmp(bytes) {
  if (!bytes || bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) throw new Error("not a BMP picture");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = v.getUint32(10, true), width = v.getInt32(18, true), rawHeight = v.getInt32(22, true), bits = v.getUint16(28, true), height = Math.abs(rawHeight);
  if (bits !== 24 && bits !== 32) throw new Error("only 24 or 32 bit BMP pictures");
  const bpp = bits / 8, stride = Math.ceil((width * bpp) / 4) * 4, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = offset + (rawHeight > 0 ? height - 1 - y : y) * stride;
    for (let x = 0; x < width; x++) {
      const s = row + x * bpp, d = (y * width + x) * 4;
      data[d] = bytes[s + 2]; data[d + 1] = bytes[s + 1]; data[d + 2] = bytes[s]; data[d + 3] = 255;
    }
  }
  return { width, height, data };
}

const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);

// "my_game" -> "My game": what the game is called when nobody has typed a title.
export function defaultTitle(cartName) {
  const s = String(cartName || "").replace(/[-_]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "Untitled";
}

// Whatever is stored (or typed) turned into a tidy info object. Unknown fields are dropped; bad values fall back to "none".
export function normalizeInfo(info) {
  const i = info && typeof info === "object" ? info : {};
  const players = Math.round(Number(i.players));
  return {
    title: clean(i.title, LIMITS.title),
    description: clean(i.description, LIMITS.description),
    developer: clean(i.developer, LIMITS.developer),
    genre: GENRES.includes(i.genre) ? i.genre : "",
    players: players >= 1 && players <= 4 ? players : 1,
    box_art: i.box_art === BOX_ART_PATH ? BOX_ART_PATH : "",
  };
}

// How many characters are left in the description, for the counter under the box.
export const charsLeft = (text) => LIMITS.description - String(text || "").length;

// Is this file a PNG? (The first eight bytes are fixed.) Box art is stored exactly as imported, so refuse anything else.
export function isPng(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes && bytes.length > 24 && sig.every((b, k) => bytes[k] === b);
}

// Width and height from a PNG header (IHDR comes straight after the signature).
export function pngSize(bytes) {
  if (!isPng(bytes)) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

// The largest whole-number zoom that keeps the first frame of a sprite under `target` pixels tall, at least 1. Pixel art stays crisp that way.
// 300 because muOS draws box art at its own size over the right of its game list: taller covers the names and the bars (scripts/lib/cover.mjs).
export function boxArtScale(frameHeight, target = 300) {
  return Math.max(1, Math.floor(target / Math.max(1, frameHeight)));
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// EmulationStation writes dates as YYYYMMDDTHHMMSS.
export function esDate(d) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getFullYear(), 4)}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Pictures a game list can show, as files in the project: meta/box_art.png (the cover), meta/screenshot.png (the game as it looks) and meta/logo.png
// (the title as a banner). Each is optional; `scripts/make-cart-art.mjs` can render all three from the game itself.
export const ART_FILES = { boxart: "meta/box_art.png", screenshot: "meta/screenshot.png", logo: "meta/logo.png" };

// One <game> element for gamelist.xml. `launcher` is the file name EmulationStation runs. `images` holds the picture files relative to the list
// ({ boxart, screenshot, logo }, each "" or missing for none); `image` alone (the old form) means the box art. The theme shows the screenshot as
// <image>, the box art as <thumbnail> and the logo as <marquee>; a missing screenshot or box art stands in for the other. Empty fields are left out
// so EmulationStation shows nothing rather than an empty line.
export function gamelistEntry(info, { cartName, launcher, image = "", images = {}, date = new Date() }) {
  const boxart = images.boxart || image || "", screenshot = images.screenshot || "", logo = images.logo || "";
  const i = normalizeInfo(info);
  const line = (tag, value) => (value === "" || value == null ? "" : `\t\t<${tag}>${esc(value)}</${tag}>\n`);
  return `\t<game>\n` +
    line("path", `./${launcher}`) +
    line("name", i.title || defaultTitle(cartName)) +
    line("desc", i.description) +
    line("image", screenshot || boxart ? `./${screenshot || boxart}` : "") +
    line("thumbnail", boxart || screenshot ? `./${boxart || screenshot}` : "") +
    line("marquee", logo ? `./${logo}` : "") +
    line("developer", i.developer) +
    line("genre", i.genre) +
    line("players", i.players) +
    line("releasedate", esDate(date)) +
    `\t</game>\n`;
}
