// The studio as a stand-in for the TrimUI Brick: how much of the Brick's RAM a running game uses, and what one of its frames would cost
// there. Pure: the numbers come from the "@@gs" line the framework prints (budget-core.js parseStatsLine).
//
// RAM: in the studio Lua gets the same fixed block as on the Brick (runtime/ram.c, GS_RAM=1), so a game runs out of memory at the same point.
//
// Frame cost: measured on the Brick 2026-10-24 (the libretro core drawing on its GPU, tests/heavy and Breakout, 8 runs) against the same
// runs on the studio's computer (an Apple M4). Two things explain the Brick's time to within about 0.3 ms:
//   - drawing: about 0.34 ms for each screen's worth of pixels drawn ("screens", the same on any computer), and
//   - the game's Lua: about 10.6 times this computer's update time (update_ms; the Lua of drawing follows it closely enough).
// The studio's own drawing time is not used: here a software renderer fills the pixels, on the Brick the GPU does.
// On a slower computer than the M4 the Lua part comes out high, which errs on the safe side.
export const BRICK = {
  ram_kb: 8192,          // RAM_BYTES in runtime/ram.c (a test checks they agree)
  frame_ms: 1000 / 60,   // one frame at 60 a second
  screen_ms: 0.34,       // Brick ms per screen of pixels drawn
  update_ratio: 10.6,    // Brick ms per ms of update on the studio's computer
};

// The estimate for one frame on the Brick, in ms, or null when the runtime sent too little to tell.
export function brickFrameMs(live) {
  if (!live || !Number.isFinite(live.update_ms) || !Number.isFinite(live.screens)) return null;
  return live.screens * BRICK.screen_ms + live.update_ms * BRICK.update_ratio;
}

const pct = (r) => `${Math.round(r * 100)}%`;
const mb = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`);

// { ms, ratio (of a frame), level, text, words } or null. Past a whole frame the Brick drops frames; near it, any busier moment will.
export function brickSpeed(live) {
  const ms = brickFrameMs(live);
  if (ms == null) return null;
  const ratio = ms / BRICK.frame_ms;
  const level = ratio > 1 ? "over" : ratio > 0.7 ? "warn" : "ok";
  const words = level === "over" ? "too slow: the Brick will skip frames" : level === "warn" ? "close to the limit" : ratio > 0.4 ? "room to spare" : "plenty of room";
  return { ms, ratio, level, text: `about ${ms.toFixed(1)} ms of ${BRICK.frame_ms.toFixed(1)} (${pct(ratio)})`, words };
}

// { used_kb, peak_kb, size_kb, ratio (peak of size), level, text } or null when the game runs without the console's RAM (older runtimes).
export function ramUse(live) {
  if (!live || !Number.isFinite(live.ram_kb) || !(live.ram_size_kb > 0)) return null;
  const size = live.ram_size_kb, peak = Math.max(live.ram_peak_kb || 0, live.ram_kb);
  const ratio = peak / size;
  const level = ratio >= 0.95 ? "over" : ratio >= 0.75 ? "warn" : "ok";
  return { used_kb: live.ram_kb, peak_kb: peak, size_kb: size, ratio, level, text: `${mb(live.ram_kb)} now, ${mb(peak)} at most, of ${mb(size)}` };
}

// One short line for the Play panel's head: "RAM 0.8 of 8 MB · Brick frame ≈ 2.1 ms (13%)", with the worse of the two levels.
export function playStatus(live) {
  const ram = ramUse(live), speed = brickSpeed(live);
  const parts = [];
  if (ram) parts.push(`RAM ${(ram.used_kb / 1024).toFixed(1)} of ${Math.round(ram.size_kb / 1024)} MB`);
  if (speed) parts.push(`Brick frame ≈ ${speed.ms.toFixed(1)} ms (${pct(speed.ratio)})`);
  const order = ["ok", "warn", "over"];
  const level = [ram, speed].filter(Boolean).reduce((l, x) => (order.indexOf(x.level) > order.indexOf(l) ? x.level : l), "ok");
  return { text: parts.join(" · "), level };
}
