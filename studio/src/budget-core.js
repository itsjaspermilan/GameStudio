// The Handheld panel's numbers: what the game uses against what the console allows. Pure: the studio gathers the facts, this makes the rows.
//
// facts: { cartBytes, sprites: {name: {w, h, frames, offPalette}}, tilesets: {name: {w, h, tile_w, tile_h, offPalette}},
//          songs: {name: {tracks}}, sfx: n, samples: n, lua: {files, lines} }
// live (while the game runs, from the "@@gs" line the framework prints): { entities, peak, limit, update_ms, draw_ms, fps, mem_kb, checks,
//   screens, calls, ram_kb, ram_peak_kb, ram_size_kb } or null
// Each row: { group, label, text, ratio (0..1+ or null), level: "ok" | "warn" | "over" | "info", tip }
import { budgetStatus, formatKB, screenText, TYPICAL } from "./consoles.js";
import { BRICK, brickSpeed, ramUse } from "./brick-core.js";

export function parseStatsLine(line) {
  if (typeof line !== "string" || !line.startsWith("@@gs ")) return null;
  try {
    const d = JSON.parse(line.slice(5));
    return Number.isFinite(d.entities) ? d : null;
  } catch { return null; }
}

export function consoleSummary(c) {
  const pal = c.palette || {};
  const colors = pal.mode === "banks" ? `colour banks: ${pal.sprite_banks || 16} sprite, ${pal.tile_banks || 16} tile` : pal.mode === "fixed" ? `${pal.colors.length} colours` : pal.mode === "limited" ? `up to ${pal.size} colours` : "any colour";
  const audio = c.audio || {};
  return [`${c.name} ${screenText(c)}`, colors, `${audio.music_tracks || 4} music tracks`, `${audio.sfx_channels || 4} sound effect channels`];
}

export function budgetRows(c, facts, live) {
  const rows = [];
  const bud = c.budgets || {}, lim = c.limits || {}, g = c.graphics || {}, audio = c.audio || {};
  const row = (group, label, text, level, ratio, tip) => rows.push({ group, label, text, level, ratio: ratio ?? null, tip: tip || "" });
  const meter = (group, label, used, budget, fmt, tip, hard) => {
    const st = budgetStatus(used, budget);
    row(group, label, `${fmt(used)}${budget ? ` of ${fmt(budget)}` : ""}${st.level === "over" ? (hard ? "  (over the limit)" : "  (over budget)") : ""}`, budget ? st.level : "info", budget ? st.ratio : null, tip);
  };
  const num = (n) => String(Math.round(n));

  // ---- size
  meter("Size", "Game size", (facts.cartBytes || 0) / 1024, bud.cart_kb, (kb) => formatKB(kb * 1024), "Everything in the game except the meta folder (box art for the game list). A GBA cartridge held 16 MB.");

  // ---- art
  const sprites = Object.entries(facts.sprites || {});
  const tilesets = Object.entries(facts.tilesets || {});
  const ss = g.sprite_size || {};
  if (sprites.length) {
    let big = sprites[0];
    for (const s of sprites) if (s[1].w * s[1].h > big[1].w * big[1].h) big = s;
    const [bn, b] = big;
    const tooBig = ss.max_width && (b.w > ss.max_width || b.h > ss.max_height);
    const odd = ss.multiple_of > 1 && sprites.find(([, s]) => s.w % ss.multiple_of || s.h % ss.multiple_of);
    row("Art", "Biggest sprite", `${bn}: ${b.w}×${b.h}${ss.max_width ? ` (up to ${ss.max_width}×${ss.max_height})` : ""}${odd && !tooBig ? `  • ${odd[0]} is not a multiple of ${ss.multiple_of}` : ""}`,
      tooBig ? "over" : odd ? "warn" : "ok", ss.max_width ? Math.max(b.w / ss.max_width, b.h / ss.max_height) : null, "Hero 32-48, common enemy 24-32, boss 64-128, bullets 8. See Help > Sprite sizes.");
    const frames = sprites.reduce((m, s) => (s[1].frames > m[1].frames ? s : m), sprites[0]);
    if (bud.frames_per_sprite) meter("Art", "Most frames in a sprite", frames[1].frames, bud.frames_per_sprite, num, `${frames[0]} has the most frames.`);
  } else row("Art", "Sprites", "none yet", "info", null);
  if (tilesets.length && g.tileset_max) {
    const [tn, t] = tilesets.reduce((m, s) => (s[1].w * s[1].h > m[1].w * m[1].h ? s : m), tilesets[0]);
    const bad = t.w > g.tileset_max.width || t.h > g.tileset_max.height || (g.tile_sizes && !(t.tile_w === t.tile_h && g.tile_sizes.includes(t.tile_w)));
    row("Art", "Biggest tileset", `${tn}: ${t.w}×${t.h}, ${t.tile_w}×${t.tile_h} tiles`, bad ? "over" : "ok", Math.max(t.w / g.tileset_max.width, t.h / g.tileset_max.height), `Up to ${g.tileset_max.width}×${g.tileset_max.height}; tiles ${(g.tile_sizes || []).map((n) => `${n}×${n}`).join(" or ")}.`);
  }
  const off = [...sprites, ...tilesets].reduce((n, [, a]) => n + (a.offPalette || 0), 0);
  const pm = (c.palette || {}).mode;
  if (pm === "banks" && facts.palette) {
    const p = c.palette, fp = facts.palette;
    const full = fp.sprites > (p.sprite_banks || 16) || fp.tiles > (p.tile_banks || 16);
    row("Art", "Colour banks", `${fp.sprites} sprite, ${fp.tiles} tile`, full ? "over" : "ok", Math.max(fp.sprites / (p.sprite_banks || 16), fp.tiles / (p.tile_banks || 16)), `Up to ${p.sprite_banks || 16} sprite banks and ${p.tile_banks || 16} tile banks of ${(p.bank_colors || 16) - 1} colours: at most ${((p.sprite_banks || 16) + (p.tile_banks || 16)) * ((p.bank_colors || 16) - 1)} on screen.`);
    const bad = [...sprites, ...tilesets].filter(([, a]) => a.noBank || a.offBank > 0 || a.tilesOff > 0).map(([n]) => n);
    row("Art", "Art outside its banks", bad.length ? `${bad.length}: ${bad.slice(0, 3).join(", ")}${bad.length > 3 ? "…" : ""}` : "none", bad.length ? "over" : "ok", null, "Open each one: choose its bank, or use Snap to bank.");
  } else if (pm === "fixed" || pm === "banks") row("Art", "Colours outside the palette", off ? `${off} pixels` : "none", off ? "over" : "ok", null, "Open the sprite and use Snap to palette.");

  // ---- sound
  const songs = Object.entries(facts.songs || {});
  const mt = audio.music_tracks || 4;
  const most = songs.reduce((m, s) => (s[1].tracks > m[1].tracks ? s : m), songs[0] || ["", { tracks: 0 }]);
  row("Sound", "Songs and effects", `${songs.length} song${songs.length === 1 ? "" : "s"}, ${facts.sfx || 0} sound effect${facts.sfx === 1 ? "" : "s"}${facts.samples ? `, ${facts.samples} sample${facts.samples === 1 ? "" : "s"}` : ""}`, "info", null);
  if (songs.length) meter("Sound", "Most tracks in a song", most[1].tracks, mt, num, `${most[0]}. The console plays up to ${mt} music tracks at once; sound effects have their own ${audio.sfx_channels || 4} channels.`);

  // ---- code
  const lua = facts.lua || { files: 0, lines: 0 };
  row("Code", "Lua code", `${lua.files} file${lua.files === 1 ? "" : "s"}, ${lua.lines} lines`, "info", null, "Code counts toward the game size.");

  // ---- running
  if (live) {
    const cap = live.limit || lim.instances_alive;
    row("While it runs", "Entities alive at once", `${live.entities} now, ${live.peak} at most${cap ? ` (limit ${cap})` : ""}`, cap ? budgetStatus(live.peak, cap).level : "info", cap ? live.peak / cap : null,
      "Entities alive. Past the limit new ones are ignored. A GBA-style game usually has 20 to 100.");
    const here = `On this computer: ${live.update_ms.toFixed(2)} ms update + ${live.draw_ms.toFixed(2)} ms drawing.`;
    const speed = brickSpeed(live);
    if (speed) row("While it runs", "Frame time on the Brick", `${speed.text}: ${speed.words}`, speed.level, speed.ratio,
      `An estimate from what the game draws and how long its update takes here, measured against real Bricks. The Brick has ${BRICK.frame_ms.toFixed(1)} ms for each frame; past that it skips frames. ${here}`);
    else row("While it runs", "Time per frame (this computer)", `${live.update_ms.toFixed(2)} ms update + ${live.draw_ms.toFixed(2)} ms drawing`, "info", null, "Rebuild the runtime to see the estimate for the Brick.");
    if (Number.isFinite(live.checks)) meter("While it runs", "Collision checks (busiest step)", live.checks, bud.collision_tests, num,
      "Hitbox comparisons in one step: every entity with an on_collide method against the entities near it with that tag, plus touching() calls. Exact on any computer. " + TYPICAL.collisions);
    if (Number.isFinite(live.screens)) meter("While it runs", "Drawing (busiest frame)", live.screens, bud.draw_screens, (v) => `${v.toFixed(1)} screens`,
      "Everything drawn in one frame, in full screens, overlaps counted: big pictures, fades and see-through layers on top of each other add up. Exact on any computer. " + TYPICAL.drawing);
    row("While it runs", "Frames a second", `${live.fps}`, live.fps >= 58 ? "ok" : "warn", null, "On this computer. The runtime also warns in the Output if the game slows down.");
    const ram = ramUse(live);
    const leak = "Steady is good; a number that keeps climbing means something is made every step and never let go.";
    if (ram) row("While it runs", "RAM", ram.text, ram.level, ram.ratio,
      `The Brick gives a game's code ${Math.round(ram.size_kb / 1024)} MB, and so does the studio: when it is full the game stops with "not enough memory", here as there. Pictures and sounds do not count. ${leak}`);
    else row("While it runs", "Lua memory", formatKB(live.mem_kb * 1024), "info", null, `Memory the game's code is using. ${leak}`);
  }
  return rows;
}
