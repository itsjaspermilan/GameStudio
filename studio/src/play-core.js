// The game inside the studio (the Play panel): what the runtime sends and what the panel sends back. No DOM.
// A frame (runtime/main.c, "embedded preview"): 'F', u16 width, u16 height, u32 length, then runs of one colour: u8 count-1, R, G, B, A.
// Buttons go back as a mask, bit i = the runtime's button i.

export const BUTTONS = ["up", "down", "left", "right", "a", "b", "x", "y", "l", "r", "start", "select", "l2", "r2", "l3", "r3"];

// The keyboard keys the runtime's own window uses (runtime/main.c key_map), by KeyboardEvent.code, so a game plays the same in both.
export const KEYS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  KeyZ: "a", KeyX: "b", KeyA: "x", KeyS: "y", KeyQ: "l", KeyW: "r",
  Enter: "start", ShiftRight: "select", KeyE: "l2", KeyR: "r2", KeyD: "l3", KeyF: "r3",
};

// The bit of a key, or 0 when the game has no use for it.
export const keyBit = (code) => (code in KEYS ? 1 << BUTTONS.indexOf(KEYS[code]) : 0);

// Reads one frame message into `into` (an RGBA byte array, grown when the screen is bigger). Returns { width, height, pixels } or null
// when the message is not a whole frame.
export function decodeFrame(buffer, into = null) {
  const b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (b.length < 9 || b[0] !== 0x46) return null;
  const width = b[1] | (b[2] << 8), height = b[3] | (b[4] << 8);
  const len = (b[5] | (b[6] << 8) | (b[7] << 16)) + b[8] * 0x1000000;
  if (b.length < 9 + len) return null;
  const n = width * height * 4;
  const pixels = into && into.length === n ? into : new Uint8ClampedArray(n);
  let o = 0;
  for (let i = 9, end = 9 + len; i + 4 < end && o < n; i += 5) {
    const count = b[i] + 1, r = b[i + 1], g = b[i + 2], bl = b[i + 3]; // a screen is opaque: its alpha byte is not used
    for (let k = 0; k < count && o < n; k++) { pixels[o++] = r; pixels[o++] = g; pixels[o++] = bl; pixels[o++] = 255; }
  }
  return o === n ? { width, height, pixels } : null;
}

// The biggest whole-number enlargement of a w x h screen that fits a box (at least 1, so a small panel still shows the game, cut).
export const fitScale = (w, h, boxW, boxH) => Math.max(1, Math.min(Math.floor(boxW / w), Math.floor(boxH / h)));
