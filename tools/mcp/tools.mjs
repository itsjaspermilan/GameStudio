// What the GameStudio MCP server can do, as plain functions (server.mjs exposes them; test/ calls them directly). Each returns
// { text, images? }: short text an agent can read without spending its context on whole files, and PNG pictures to look at.
// It reuses the studio's own logic (studio/src/*-core.js), the shared generators (scripts/lib/) and the real runtime (build/gs).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { parseApi, buildIndex, diagnose } from "../../studio/src/lua-intel-core.js";
import { scanProject, consoleIdOf, buttonsOfGame, LAYOUT_COMMENT } from "../../studio/src/project-core.js";
import { normalizePalette } from "../../studio/src/palette-core.js";
import { parseSong, serializeSong, normalizeSfx, renderSongDesc, renderSfxWith, setBuiltinInstruments, builtinInstruments, songSeconds } from "../../studio/src/audio-core.js";
import { analyzeSong, describeAnalysis } from "../../studio/src/music-core.js";
import { parseRoom, normalizeRoom, serializeRoom, fitLayer, glyphOf, builtinWidth, isBuiltinFont, shadowOf, lookDefaults, entityPose, splitButtons, buttonSize, buttonPixels } from "../../studio/src/room-core.js";
import { FONTS } from "../../studio/src/fonts.js";
import { parsePage } from "../../studio/src/help-core.js";
import { reindent } from "../../studio/src/search-core.js";
import { brickSpeed, ramUse } from "../../studio/src/brick-core.js";
import { Canvas, strip } from "../../scripts/lib/canvas.mjs";
import { Song } from "../../scripts/lib/music.mjs";
import { png, decodeBmp } from "../../scripts/png.mjs";

export const ROOT = process.env.GS_WORKSPACE ? resolve(process.env.GS_WORKSPACE) : resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GS = join(ROOT, "build", process.platform === "win32" ? "gs.exe" : "gs");
const read = (p) => readFileSync(p, "utf8");
const readJson = (p) => JSON.parse(read(p));
setBuiltinInstruments(readJson(join(ROOT, "engine/instruments.json")));
let apiCache = null;
const theApi = () => (apiCache ||= parseApi(read(join(ROOT, "engine/api/gs.d.lua"))));

// ---------- games and their files ----------
const VALID = /^[A-Za-z0-9_-]+$/, VALID_REL = /^[A-Za-z0-9_\-/]+$/;
// A game is a folder name in carts/ (the examples) or the full path of a game's folder anywhere (games the studio opened; see games).
function gameDir(game) {
  const g = String(game || "");
  if (isAbsolute(g)) {
    if (!existsSync(join(g, "game.lua"))) throw new Error(`no game called '${game}' (that folder has no game.lua; see games)`);
    return g;
  }
  if (!VALID.test(g)) throw new Error(`'${game}' is not a game name (letters, digits, - and _) or a game folder's full path`);
  const d = join(ROOT, "carts", g);
  if (!existsSync(join(d, "game.lua"))) throw new Error(`no game called '${game}' (games are the folders in carts/ with a game.lua, or a game folder's full path; see games)`);
  return d;
}

// The game folders the studio opened lately (it keeps them in its settings folder as projects.json, newest first).
function studioProjects() {
  const id = "com.gamestudio.studio", h = homedir();
  const dir = process.env.GS_STUDIO_CONFIG || (process.platform === "darwin" ? join(h, "Library/Application Support", id)
    : process.platform === "win32" ? join(process.env.APPDATA || join(h, "AppData/Roaming"), id) : join(process.env.XDG_CONFIG_HOME || join(h, ".config"), id));
  try { return readJson(join(dir, "projects.json")).filter((p) => typeof p === "string" && existsSync(p)); } catch { return []; }
}
function resName(name) {
  if (!VALID_REL.test(String(name || "")) || name.includes("..")) throw new Error(`'${name}' is not a usable name (letters, digits, -, _ and / for folders)`);
  return name;
}
function filesOf(dir) {
  const out = [];
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else out.push(relative(dir, p).split("\\").join("/")); } };
  walk(dir);
  return out.sort();
}
function consoleOf(dir) {
  let id = "glow43";
  try { id = consoleIdOf(readJson(join(dir, "meta/info.json"))); } catch { /* Glow43 */ }
  id = { dot: "glow43", dash: "glow169" }[id] || id; // their names before Glow43 and Glow169
  for (const p of [join(ROOT, "engine/consoles", `${id}.json`), join(dir, "consoles", `${id}.json`)]) if (existsSync(p)) return readJson(p);
  return readJson(join(ROOT, "engine/consoles/glow43.json"));
}
const palOf = (con) => (con.palette && con.palette.colors) || [];
// A game with colour banks (a console with palette.mode "banks" and a palette.json): its banks, else null (the classic palette is used).
function banksOf(dir) {
  const con = consoleOf(dir);
  if (!con.palette || con.palette.mode !== "banks" || !existsSync(join(dir, "palette.json"))) return null;
  return normalizePalette(readJson(join(dir, "palette.json")));
}
// A bank as a palette for Canvas: place 0 see-through (null), places 1 to 15 its colours. Places are written as one hex digit, 1 to f.
function bankPal(banks, kind, name) {
  const list = banks[kind], b = name ? list.find((x) => x.name === name) : list[0];
  if (!b) throw new Error(name ? `the game has no ${kind === "sprites" ? "sprite" : "tile"} bank called ${name} (it has: ${list.map((x) => x.name).join(", ") || "none"})` : `the game has no ${kind === "sprites" ? "sprite" : "tile"} banks yet (palette.json)`);
  return { name: b.name, pal: [null, ...b.colors] };
}

// ---------- pictures ----------
// PNG reader for the pictures the studio writes (8-bit RGB, RGBA or palette, not interlaced)
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let p = 8, w = 0, h = 0, type = 0, depth = 8, plte = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), id = buf.toString("ascii", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (id === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; if (d[12]) throw new Error("interlaced PNGs are not read"); }
    else if (id === "PLTE") plte = d; else if (id === "tRNS") trns = d; else if (id === "IDAT") idat.push(d); else if (id === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error(`only 8-bit PNGs are read (this one is ${depth}-bit)`);
  const bpp = { 2: 3, 6: 4, 3: 1, 0: 1, 4: 2 }[type];
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = up ? up[x] : 0, c = up && x >= bpp ? up[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = v & 255;
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (type === 6) { out.set(px.subarray(i * 4, i * 4 + 4), i * 4); }
    else if (type === 2) { out.set(px.subarray(i * 3, i * 3 + 3), i * 4); out[i * 4 + 3] = 255; }
    else if (type === 3) { const k = px[i]; out[i * 4] = plte[k * 3]; out[i * 4 + 1] = plte[k * 3 + 1]; out[i * 4 + 2] = plte[k * 3 + 2]; out[i * 4 + 3] = trns && k < trns.length ? trns[k] : 255; }
    else if (type === 0) { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = px[i]; out[i * 4 + 3] = 255; }
    else { out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = px[i * 2]; out[i * 4 + 3] = px[i * 2 + 1]; }
  }
  return { width: w, height: h, data: out };
}
// RGBA enlarged by a whole number on a background, as a PNG in base64 (what an MCP image needs)
function picture(w, h, rgba, k = 1, bg = [27, 29, 39]) {
  const W = w * k, H = h * k, out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = (Math.floor(y / k) * w + Math.floor(x / k)) * 4, d = (y * W + x) * 4, a = rgba[s + 3] / 255;
    for (let c = 0; c < 3; c++) out[d + c] = Math.round(rgba[s + c] * a + bg[c] * (1 - a));
    out[d + 3] = 255;
  }
  return png(W, H, out).toString("base64");
}
const fit = (w, h, max = 640) => Math.max(1, Math.min(12, Math.floor(max / Math.max(w, h))));

// ---------- the runtime ----------
function needRuntime() { if (!existsSync(GS)) throw new Error("build/gs is missing: run scripts/build.sh in the workspace first"); }
// Runs a game without a window; returns stderr lines, the stats line, and the last frame.
function runGame(dir, { seconds = 3, keys, bot = false, env = {} } = {}) {
  needRuntime();
  const work = mkdtempSync(join(tmpdir(), "gs-mcp-"));
  const bmp = join(work, "frame.bmp");
  const e = { ...process.env, SDL_VIDEODRIVER: "dummy", SDL_AUDIODRIVER: "dummy", GS_SAVE_DIR: join(work, "saves"), GS_MAX_FRAMES: String(Math.round(Math.min(120, Math.max(0.1, seconds)) * 60)), GS_DUMP_FRAME: bmp, GS_STATS: "1", GS_DEV: "1", GS_RAM: "1", ...env };
  if (keys) { e.GS_BOT_LUA = join(ROOT, "tests/keys-bot.lua"); e.GS_KEYS = keys; }
  else if (bot) e.GS_BOT_LUA = join(ROOT, "tests/random-bot.lua");
  const r = spawnSync(GS, [dir], { encoding: "utf8", env: e, timeout: 180000 });
  const lines = `${r.stdout || ""}${r.stderr || ""}`.split("\n").filter(Boolean);
  let frame = null;
  try { frame = decodeBmp(readFileSync(bmp)); } catch { /* the game stopped before a frame */ }
  rmSync(work, { recursive: true, force: true });
  return { lines, frame, status: r.status };
}
const statsOf = (lines) => { const s = lines.filter((l) => l.startsWith("@@gs ")).pop(); try { return s ? JSON.parse(s.slice(5)) : null; } catch { return null; } };
const problemsOf = (lines) => lines.filter((l) => /error|warning|traceback|stack/i.test(l) && !l.startsWith("@@"));
function renderWav(desc, cwd) {
  needRuntime();
  const work = mkdtempSync(join(tmpdir(), "gs-mcp-a-")), d = join(work, "d.txt"), o = join(work, "o.wav");
  writeFileSync(d, desc);
  const r = spawnSync(GS, ["render-audio", d, o], { encoding: "utf8", cwd: cwd || work, timeout: 120000 });
  if (r.status !== 0 || !existsSync(o)) { rmSync(work, { recursive: true, force: true }); throw new Error(`could not render: ${(r.stderr || "").trim()}`); }
  const buf = readFileSync(o); rmSync(work, { recursive: true, force: true });
  let p = 12, data = null, ch = 2, rate = 44100;
  while (p + 8 <= buf.length) {
    const id = buf.toString("ascii", p, p + 4), len = buf.readUInt32LE(p + 4);
    if (id === "fmt ") { ch = buf.readUInt16LE(p + 10); rate = buf.readUInt32LE(p + 12); }
    if (id === "data") data = new Int16Array(buf.buffer.slice(buf.byteOffset + p + 8, buf.byteOffset + p + 8 + len));
    p += 8 + len + (len & 1);
  }
  // loudness, peaks, clipping and silence, plus where the sound's energy sits: the change from one sample to the next measures it
  // (a pure tone of f Hz reads f; white noise reads about 10 kHz), a rough "harsh or muffled" meter
  let sum = 0, peak = 0, clip = 0, hiE = 0, prev = 0, n = data.length / ch;
  const win = Math.round(rate * 0.25), loud = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const v = data[i * ch] / 32768, a = Math.abs(v);
    sum += v * v; acc += v * v; peak = Math.max(peak, a); if (a > 0.99) clip++;
    const d1 = v - prev; hiE += d1 * d1; prev = v;
    if ((i + 1) % win === 0) { loud.push(Math.sqrt(acc / win)); acc = 0; }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  return { seconds: n / rate, rms, peak, clipped: clip, brightHz: sum ? (rate / (2 * Math.PI)) * Math.sqrt(hiE / sum) : 0, silentShare: loud.filter((x) => x < 0.003).length / Math.max(1, loud.length) };
}
// songs above about 1200 Hz sounded whistly and harsh in Void Swarm (its old chip songs read 1400-1500 Hz, the General MIDI ones 600-900);
// a sound effect may be brighter (a laser is meant to be)
const describeSound = (m, bright = 1200) => `rendered ${m.seconds.toFixed(1)} s: loudness ${m.rms.toFixed(3)} (Void Swarm's 8-track songs sit at 0.10-0.13), peak ${m.peak.toFixed(2)}${m.clipped ? `, ${m.clipped} clipped samples (too loud)` : ", no clipping"}, energy around ${Math.round(m.brightHz)} Hz${m.brightHz > bright ? " (bright: may sound harsh, hissy or chirpy)" : m.brightHz < 180 ? " (dark: may sound muffled on small speakers)" : ""}${m.silentShare > 0.3 ? `, ${Math.round(m.silentShare * 100)}% silent` : ""}`;
function customInstruments(dir) {
  const m = new Map();
  const d = join(dir, "instruments");
  if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith(".json")) { try { m.set(f.slice(0, -5), readJson(join(d, f))); } catch { /* skipped */ } }
  return { instrument: (n) => m.get(n) };
}

// ================= the tools =================

export function api({ query = "" }) {
  const { symbols } = theApi();
  const q = String(query).toLowerCase().trim();
  const all = [...symbols.values()];
  const hits = q ? all.filter((s) => s.path.toLowerCase().includes(q)).concat(all.filter((s) => !s.path.toLowerCase().includes(q) && (s.doc || "").toLowerCase().includes(q))) : [];
  if (!q) {
    const owners = [...new Set(all.map((s) => s.owner))];
    return { text: `The gs API has ${all.length} names in ${owners.length} groups: ${owners.join(", ")}. Ask with a word (spawn, collide, camera, burst, path, sfx...) for the details.` };
  }
  if (!hits.length) return { text: `Nothing in the API matches '${query}'.` };
  return { text: hits.slice(0, 12).map((s) => {
    const params = (s.params || []).map((p) => `    ${p.name}${p.optional ? "?" : ""}: ${p.type}${p.desc ? "  " + p.desc : ""}`).join("\n");
    return `${s.sig || s.path}${s.type && s.kind === "field" ? ": " + s.type : ""}\n  ${s.doc || ""}${params ? "\n" + params : ""}${s.returns && s.returns.length ? "\n    returns " + s.returns.join(", ") : ""}`;
  }).join("\n") + (hits.length > 12 ? `\n(${hits.length - 12} more; ask more precisely)` : "") };
}

export function help({ topic = "" }) {
  const dir = join(ROOT, "docs/help");
  const pages = readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => parsePage(read(join(dir, f)), f.replace(/^\d+-|\.html$/g, "")));
  if (!topic) return { text: "Help pages:\n" + pages.map((p) => `  ${p.id}: ${p.title} (${p.summary})`).join("\n") };
  const page = pages.find((p) => p.id === topic) || pages.find((p) => p.title.toLowerCase().includes(String(topic).toLowerCase()));
  if (!page) return { text: `No help page '${topic}'. Pages: ${pages.map((p) => p.id).join(", ")}` };
  const text = page.body.replace(/<pre[^>]*data-path="([^"]+)"[^>]*><code>/g, "\n--- file $1\n").replace(/<\/code><\/pre>/g, "\n---\n").replace(/<h[12][^>]*>/g, "\n## ").replace(/<li>/g, "\n- ")
    .replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&times;/g, "x").replace(/\n{3,}/g, "\n\n");
  return { text: `# ${page.title}\n${text.trim()}` };
}

export function games() {
  const d = join(ROOT, "carts");
  const rows = readdirSync(d).filter((f) => statSync(join(d, f)).isDirectory()).map((g) => {
    const has = existsSync(join(d, g, "game.lua"));
    let title = "", con = "";
    try { const i = readJson(join(d, g, "meta/info.json")); title = i.title || ""; con = i.console || ""; } catch { /* none */ }
    return `  ${g}${has ? "" : " (old format, no game.lua)"}${title ? `: ${title}` : ""}${con ? ` [${con}]` : ""}`;
  });
  const row = (name, dir) => {
    let title = "", con = "";
    try { const i = readJson(join(dir, "meta/info.json")); title = i.title || ""; con = i.console || ""; } catch { /* none */ }
    return `  ${name}${existsSync(join(dir, "game.lua")) ? "" : " (no game.lua)"}${title ? `: ${title}` : ""}${con ? ` [${con}]` : ""}`;
  };
  const open = studioProjects();
  const mine = open.length ? `\n\nGames open in the studio lately (pass the whole path as game):\n${open.map((p) => row(p, p)).join("\n")}` : "";
  return { text: `Examples in ${relative(process.cwd(), d) || d}:\n${rows.join("\n")}${mine}` };
}

export function overview({ game }) {
  const dir = gameDir(game), files = filesOf(dir), scan = scanProject(files), con = consoleOf(dir), G = scan.groups;
  const L = [`${game}: console ${con.name} (${con.screen.width}x${con.screen.height}, ${palOf(con).length || "any"} colours, ${(con.limits || {}).instances_alive || "?"} entities at most)`];
  const ent = G.entities.map((n) => {
    const t = read(join(dir, `entities/${n}.lua`));
    const sprite = (t.match(/\bsprite\s*=\s*["']([^"']+)["']/) || [])[1], tags = (t.match(/\btags\s*=\s*\{([^}]*)\}/) || [])[1];
    const methods = [...t.matchAll(/^function\s+\w+[:.](\w+)/gm)].map((m) => m[1]);
    return `    ${n}${sprite ? ` sprite=${sprite}` : ""}${tags ? ` tags={${tags.trim()}}` : ""}${methods.length ? ` : ${methods.join(", ")}` : ""}`;
  });
  L.push(`entities (${G.entities.length}):`, ...ent);
  L.push(`scenes (${G.scenes.length}): ${G.scenes.join(", ")}`);
  if (G.rooms.length) L.push(`rooms: ${G.rooms.map((n) => { const r = parseRoom(read(join(dir, `rooms/${n}.lua`))); return r.room ? `${n} ${r.room.width}x${r.room.height} (${r.room.entities.length} things, ${r.room.layers.length} layers, ${Object.keys(r.room.paths).length} paths)` : `${n} (code)`; }).join("; ")}`);
  if (G.lib.length) L.push(`code: ${G.lib.join(", ")}`);
  const spr = G.sprites.map((n) => { try { const m = readJson(join(dir, `sprites/${n}.json`)); const b = readFileSync(join(dir, m.image || `sprites/${n}.png`)); const w = b.readUInt32BE(16), h = b.readUInt32BE(20), f = m.frames || 1; return `${n} ${w / f}x${h}${f > 1 ? `x${f}` : ""}${m.animations ? ` [${Object.keys(m.animations).join(",")}]` : ""}`; } catch { return n; } });
  if (spr.length) L.push(`sprites (${spr.length}): ${spr.join("; ")}`);
  if (G.tilesets.length) L.push(`tilesets: ${G.tilesets.join(", ")}`);
  if (G.sfx.length) L.push(`sound effects (${G.sfx.length}): ${G.sfx.join(", ")}`);
  const mus = G.music.map((n) => { try { const s = parseSong(readJson(join(dir, `music/${n}.json`))); return `${n} ${Math.round(songSeconds(s))}s [${s.track_inst.filter(Boolean).join(", ")}]`; } catch { return n; } });
  if (mus.length) L.push(`songs (${mus.length}): ${mus.join("; ")}`);
  if (G.instruments.length) L.push(`own instruments: ${G.instruments.join(", ")}`);
  const lua = files.filter((f) => f.endsWith(".lua"));
  L.push(`Lua: ${lua.length} files, ${lua.reduce((n, f) => n + read(join(dir, f)).split("\n").length, 0)} lines. Read a file with your own file tools: carts/${game}/<path>.`);
  return { text: L.join("\n") };
}

export function check({ game, seconds = 4 }) {
  const dir = gameDir(game), files = filesOf(dir), scan = scanProject(files);
  const texts = Object.fromEntries(files.filter((f) => f.endsWith(".lua")).map((f) => [f, read(join(dir, f))]));
  const index = buildIndex(scan.groups, texts);
  const lint = [];
  for (const [f, t] of Object.entries(texts)) for (const d of diagnose(t, f, index)) {
    const line = t.slice(0, d.from).split("\n").length;
    lint.push(`  ${f}:${line} ${d.severity}: ${d.message}`);
  }
  const untidy = Object.entries(texts).filter(([, t]) => reindent(t) !== t).map(([f]) => f);
  const r = runGame(dir, { seconds });
  const probs = problemsOf(r.lines), st = statsOf(r.lines);
  const L = [lint.length ? `editor warnings (${lint.length}):\n${lint.slice(0, 40).join("\n")}` : "editor warnings: none"];
  if (untidy.length) L.push(`indentation is off in: ${untidy.join(", ")} (the studio's Tidy would fix it)`);
  L.push(probs.length ? `running ${seconds} s printed:\n${probs.slice(0, 30).map((l) => "  " + l).join("\n")}` : `ran ${seconds} s with no errors or warnings`);
  if (st) {
    const speed = brickSpeed(st), ram = ramUse(st);
    L.push(`at the end: ${st.entities} entities alive (peak ${st.peak}), ${st.checks ?? "?"} collision checks in the busiest step, ${st.screens ?? "?"} screens of drawing, ${st.update_ms.toFixed(2)} + ${st.draw_ms.toFixed(2)} ms a frame on this computer`);
    if (speed) L.push(`on the Brick a frame would take ${speed.text}: ${speed.words}`);
    if (ram) L.push(`RAM (the Brick's, as on the device): ${ram.text}`);
  }
  return { text: L.join("\n") };
}

export function run({ game, seconds = 3, keys, bot = false, scale }) {
  const dir = gameDir(game);
  const r = runGame(dir, { seconds, keys, bot });
  const probs = problemsOf(r.lines), st = statsOf(r.lines), printed = r.lines.filter((l) => !l.startsWith("@@") && !probs.includes(l));
  const L = [`ran ${game} for ${seconds} s${keys ? ` pressing ${keys}` : bot ? " with the random bot" : ""}`];
  if (probs.length) L.push("problems:\n" + probs.slice(0, 30).map((l) => "  " + l).join("\n"));
  if (printed.length) L.push("printed:\n" + printed.slice(-15).map((l) => "  " + l).join("\n"));
  if (st) L.push(`stats: ${JSON.stringify(st)}`);
  const images = r.frame ? [picture(r.frame.width, r.frame.height, r.frame.data, scale || 1)] : [];
  if (!images.length) L.push("no frame was drawn (the game stopped first)");
  return { text: L.join("\n"), images };
}

export function inspect({ game, seconds = 3, kind, entity, watch = [] }) {
  const dir = gameDir(game), work = mkdtempSync(join(tmpdir(), "gs-mcp-i-")), f = join(work, "cmd.json");
  writeFileSync(f, JSON.stringify({ open: true, class: kind || null, entity: Number.isInteger(entity) ? entity : null, watch }));
  const r = runGame(dir, { seconds: Math.max(1, seconds), env: { GS_INSPECT: f } });
  rmSync(work, { recursive: true, force: true });
  const last = r.lines.filter((l) => l.startsWith("@@gsi ")).pop();
  if (!last) return { text: "The game sent no inspector report (it may have stopped early):\n" + problemsOf(r.lines).slice(0, 10).join("\n") };
  const d = JSON.parse(last.slice(6));
  const L = [`step ${d.step}, scene ${d.scene}, ${d.alive} alive, ${d.particles} particles`, "kinds (count, ms a step: update/draw/collisions):"];
  for (const c of [...d.classes].sort((a, b) => (b.update_ms + b.draw_ms + b.collide_ms) - (a.update_ms + a.draw_ms + a.collide_ms))) L.push(`  ${c.name.replace(/^entities\./, "")} ${c.count}  ${c.update_ms.toFixed(3)}/${c.draw_ms.toFixed(3)}/${c.collide_ms.toFixed(3)}`);
  if (d.list && d.list.length) L.push(`${kind}: ` + d.list.map((e) => `#${e.id}@${e.x},${e.y}`).join(" "));
  if (d.entity) L.push(`#${entity}: ` + Object.entries(d.entity).map(([k, v]) => `${k}=${v}`).join(", "));
  if (watch.length) L.push("watch: " + watch.map((w, i) => `${w} = ${d.watch[i]}`).join("; "));
  return { text: L.join("\n") };
}

// ---------- sprites ----------
export function sprite_view({ game, name, scale, as_text = false }) {
  const dir = gameDir(game), n = resName(name), meta = readJson(join(dir, `sprites/${n}.json`));
  const img = decodePng(readFileSync(join(dir, meta.image || `sprites/${n}.png`))), frames = meta.frames || 1, fw = img.width / frames;
  const L = [`${n}: ${fw}x${img.height}, ${frames} frame${frames === 1 ? "" : "s"}, origin ${JSON.stringify(meta.origin || [0, 0])}${meta.animations ? `, animations ${JSON.stringify(meta.animations)}` : ""}`];
  if (as_text && fw * img.height <= 48 * 48) {
    // colours as letters, so the picture can be read and rewritten exactly with sprite_write
    const banks = banksOf(dir), bank = banks && meta.bank ? banks.sprites.find((b) => b.name === meta.bank) : null;
    const pal = bank ? [null, ...bank.colors] : palOf(consoleOf(dir)), letters = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", used = new Map();
    for (let f = 0; f < frames; f++) {
      L.push(`frame ${f + 1}:`);
      for (let y = 0; y < img.height; y++) {
        let row = "";
        for (let x = 0; x < fw; x++) {
          const i = (y * img.width + f * fw + x) * 4;
          if (img.data[i + 3] < 128) { row += "."; continue; }
          const hex = "#" + [0, 1, 2].map((c) => img.data[i + c].toString(16).padStart(2, "0")).join("");
          const k = pal.indexOf(hex);
          let ch = k >= 0 && k < letters.length ? letters[k] : null;
          if (!ch) { if (!used.has(hex)) used.set(hex, "!"); ch = "!"; }
          row += ch;
        }
        L.push("  " + row);
      }
    }
    if (bank) L.push(`letters are places in bank ${bank.name}: ${bank.colors.map((c, i) => `${letters[i + 1]}=${c}`).join(" ")}${used.size ? `; ! is a colour outside the bank (${[...used.keys()].join(", ")})` : ""}; . is see-through`);
    else L.push(`letters are the console's palette: ${pal.map((c, i) => `${letters[i]}=${c}`).join(" ")}${used.size ? `; ! is a colour outside the palette (${[...used.keys()].join(", ")})` : ""}; . is see-through`);
  }
  return { text: L.join("\n"), images: [picture(img.width, img.height, img.data, scale || fit(img.width, img.height))] };
}

// frames: each { rows: ["..aa..", ...] } (letters = palette places, as sprite_view shows them) or { ops: [["rect", x, y, w, h, c], ...] }
// With tileset = { cols }, the frames are tiles: written to tilesets/<name>.png in rows of `cols` with a .json giving the tile size.
// In a game with colour banks a sprite draws with one sprite bank (`bank`, default the first) and its colours are places 1 to 15 of it
// (hex digits 1-f, or numbers); a tileset lists its tile banks (`banks`) and each tile (frame) may name its own (`bank`), the first by default.
export function sprite_write({ game, name, w, h, frames, origin, fps, animations, outline, tileset, bank, banks: tileBanks }) {
  const dir = gameDir(game), n = resName(name), banks = banksOf(dir);
  let pal = palOf(consoleOf(dir)), own = null;
  if (banks && !tileset) { own = bankPal(banks, "sprites", bank); pal = own.pal; }
  const tsBanks = banks && tileset ? (tileBanks && tileBanks.length ? tileBanks : [banks.tiles[0] && banks.tiles[0].name]).map((b) => bankPal(banks, "tiles", b)) : null;
  if (!(w >= 1 && w <= 256 && h >= 1 && h <= 256)) throw new Error("w and h must be 1 to 256");
  if (!Array.isArray(frames) || !frames.length || frames.length > 64) throw new Error("frames is a list of 1 to 64 frames");
  const letters = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const colour = (c) => {
    if (typeof c === "number") return c;
    if (typeof c === "string" && c.length === 1 && letters.includes(c)) return letters.indexOf(c);
    if (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)) { const k = pal.indexOf(c.toLowerCase()); if (k >= 0) return k; throw new Error(`${c} is not in ${banks ? "the bank" : "the console's palette"}`); }
    throw new Error(`colour ${JSON.stringify(c)}: use a ${banks ? "bank place (1 to 15, or a hex digit 1-f)" : "palette place (number or letter as sprite_view shows)"} or one of its colours as hex`);
  };
  const tilePal = []; // a tileset with banks: the palette each tile was drawn with
  const canvases = frames.map((fr, i) => {
    const c = new Canvas(w, h);
    if (tsBanks) { const b = fr.bank ? tsBanks.find((x) => x.name === fr.bank) : tsBanks[0]; if (!b) throw new Error(`tile ${i}: bank ${fr.bank} is not in this tileset's banks (${tsBanks.map((x) => x.name).join(", ")})`); pal = b.pal; tilePal.push(pal); }
    if (fr.rows) fr.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== "." && ch !== " ") c.px(x, y, colour(ch)); }));
    for (const op of fr.ops || []) {
      const [kind, ...a] = op;
      if (kind === "rect") c.rect(a[0], a[1], a[2], a[3], colour(a[4]));
      else if (kind === "frame") c.frame(a[0], a[1], a[2], a[3], colour(a[4]));
      else if (kind === "px") c.px(a[0], a[1], colour(a[2]));
      else if (kind === "line") c.line(a[0], a[1], a[2], a[3], colour(a[4]));
      else if (kind === "disc") c.disc(a[0], a[1], a[2], colour(a[3]));
      else if (kind === "ellipse") c.ellipse(a[0], a[1], a[2], a[3], colour(a[4]));
      else if (kind === "ring") c.ring(a[0], a[1], a[2], a[3], colour(a[4]));
      else if (kind === "poly") c.poly(a[0], colour(a[1]));
      else if (kind === "sphere") c.sphere(a[0], a[1], a[2], a[3].map(colour));
      else if (kind === "dither") c.dither(a[0], a[1], a[2], a[3], colour(a[4]), a[5] || 0);
      else if (kind === "outline") c.outline(colour(a[0]), !!a[1]);
      else if (kind === "mirror") c.mirror();
      else if (kind === "erase") c.rect(a[0], a[1], a[2], a[3], -1);
      else throw new Error(`frame ${i + 1}: unknown op '${kind}' (rect frame px line disc ellipse ring poly sphere dither outline mirror erase)`);
    }
    if (outline !== undefined) c.outline(colour(outline));
    return c;
  });
  if (tileset) {
    const cols = Math.max(1, Math.min(canvases.length, tileset.cols || 8)), rows = Math.ceil(canvases.length / cols);
    const max = (consoleOf(dir).graphics || {}).tileset_max || { width: 256, height: 256 };
    if (cols * w > max.width || rows * h > max.height) throw new Error(`a tileset sheet is at most ${max.width}x${max.height} on this console (this would be ${cols * w}x${rows * h})`);
    const sheet = new Canvas(cols * w, rows * h);
    let rgba;
    if (tsBanks) { // each tile in its own bank's colours
      rgba = new Uint8ClampedArray(sheet.w * sheet.h * 4);
      canvases.forEach((c, i) => {
        const t = c.rgba(tilePal[i]), x0 = (i % cols) * w, y0 = Math.floor(i / cols) * h;
        for (let y = 0; y < h; y++) rgba.set(t.subarray(y * w * 4, (y + 1) * w * 4), ((y0 + y) * sheet.w + x0) * 4);
      });
    } else {
      canvases.forEach((c, i) => sheet.stamp(c, (i % cols) * w, Math.floor(i / cols) * h));
      rgba = sheet.rgba(pal);
    }
    mkdirSync(join(dir, "tilesets", dirname(n)), { recursive: true });
    writeFileSync(join(dir, "tilesets", `${n}.png`), png(sheet.w, sheet.h, rgba));
    writeFileSync(join(dir, "tilesets", `${n}.json`), JSON.stringify({ image: `tilesets/${n}.png`, tile_w: w, tile_h: h, ...(tsBanks ? { banks: tsBanks.map((b) => b.name) } : {}) }, null, 2) + "\n");
    return { text: `wrote tilesets/${n}.png and .json: ${canvases.length} tiles of ${w}x${h} in rows of ${cols} (tile numbers count from 0, left to right then down)`, images: [picture(sheet.w, sheet.h, rgba, fit(sheet.w, sheet.h))] };
  }
  const s = strip(canvases), rgba = s.rgba(pal);
  mkdirSync(join(dir, "sprites", dirname(n)), { recursive: true });
  writeFileSync(join(dir, "sprites", `${n}.png`), png(s.w, s.h, rgba));
  const meta = { image: `sprites/${n}.png`, frames: frames.length, origin: origin || [w >> 1, h >> 1], mask: null, fps: fps ?? (frames.length > 1 ? 8 : 0), ...(own ? { bank: own.name } : {}) };
  if (animations) meta.animations = animations;
  writeFileSync(join(dir, "sprites", `${n}.json`), JSON.stringify(meta, null, 1) + "\n");
  return { text: `wrote sprites/${n}.png and .json: ${w}x${h}, ${frames.length} frame${frames.length === 1 ? "" : "s"}, origin ${JSON.stringify(meta.origin)}${own ? `, bank ${own.name}` : ""}`, images: [picture(s.w, s.h, rgba, fit(s.w, s.h))] };
}

// ---------- sound ----------
export function instruments({ filter = "" }) {
  const q = String(filter).toLowerCase();
  const list = builtinInstruments().filter((d) => !q || d.name.includes(q) || (d.group || "").toLowerCase().includes(q));
  const groups = new Map();
  for (const d of list) { const g = `${d.set === "gm" ? "General MIDI" : "chip"}: ${d.group || "other"}`; groups.set(g, [...(groups.get(g) || []), d.name]); }
  return { text: [...groups].map(([g, n]) => `${g}: ${n.join(", ")}`).join("\n") + "\nChip sounds are tiny wavetables (retro, can be harsh as a lead); General MIDI ones come from the SoundFont (real instruments)." };
}

function songText(dir, name) {
  const s = parseSong(readJson(join(dir, `music/${name}.json`)));
  const a = analyzeSong(s), m = renderWav(renderSongDesc(s, customInstruments(dir), { seconds: Math.min(90, Math.ceil(songSeconds(s))) }).text, dir);
  return `${describeAnalysis(a)}\n${describeSound(m)}`;
}
export function song_check({ game, name }) { const dir = gameDir(game); return { text: `${resName(name)}: ${songText(dir, name)}` }; }

// spec: the song generator's options (scripts/lib/music.mjs Song), or a finished tracker song ({ format: "tracker", ... })
// The consoles play eight tracks, so a generated song with a band of four gets the other four from it: a counter-melody on the lead's
// instrument, a second harmony on the harmony's, hand percussion and a quiet echo of the melody. tracks: 4 keeps it at four.
function bandOfEight(spec) {
  if (!spec || spec.tracks === 4 || !Array.isArray(spec.inst) || spec.inst.length !== 4) return spec;
  const [lead, harmony] = spec.inst;
  return { ...spec, inst: [...spec.inst, lead, harmony, "gm_drum_kit", lead], ...(Array.isArray(spec.vol) && spec.vol.length === 4 ? { vol: [...spec.vol, -3, -3, -3, -4] } : {}) };
}
export function song_write({ game, name, spec }) {
  const dir = gameDir(game), n = resName(name);
  const song = spec && spec.format === "tracker" ? serializeSong(parseSong(spec)) : new Song({ seed: 1, ...bandOfEight(spec) }).build();
  mkdirSync(join(dir, "music", dirname(n)), { recursive: true });
  writeFileSync(join(dir, "music", `${n}.json`), JSON.stringify(song, null, 1) + "\n");
  return { text: `wrote music/${n}.json\n${songText(dir, n)}` };
}

export function sound_check({ game, name }) {
  const dir = gameDir(game), n = resName(name), d = normalizeSfx(readJson(join(dir, `sfx/${n}.json`)));
  const r = renderSfxWith(d, customInstruments(dir), {});
  if (r.silent) return { text: `${n}: no notes to play` };
  const m = renderWav(r.text, dir);
  const notes = d.tracks.map((t, i) => `track ${i + 1} ${t.instrument || "(none)"}: ${t.steps.filter((s) => s[1] > 0).length} notes`).join("; ");
  return { text: `${n}: speed ${d.speed}, ${notes}${r.problems.length ? `; problems: ${r.problems.join("; ")}` : ""}\n${describeSound(m, 4000)}` };
}
export function sound_write({ game, name, sound }) {
  const dir = gameDir(game), n = resName(name), d = normalizeSfx(sound);
  mkdirSync(join(dir, "sfx", dirname(n)), { recursive: true });
  writeFileSync(join(dir, "sfx", `${n}.json`), JSON.stringify(d, null, 1) + "\n");
  return { text: `wrote sfx/${n}.json\n${sound_check({ game, name: n }).text}` };
}

// ---------- rooms ----------
function tilesetOf(dir, name) {
  const meta = readJson(join(dir, `tilesets/${resName(name)}.json`));
  const img = decodePng(readFileSync(join(dir, meta.image || `tilesets/${name}.png`)));
  const tw = meta.tile_w || 16, th = meta.tile_h || 16, cols = Math.max(1, Math.floor(img.width / tw));
  return { img, tw, th, cols, count: cols * Math.max(1, Math.floor(img.height / th)) };
}
// a sprite's picture, frame size and origin, or null
function spriteOf(dir, name) {
  try {
    const meta = readJson(join(dir, `sprites/${name}.json`)), img = decodePng(readFileSync(join(dir, meta.image || `sprites/${name}.png`)));
    const f = meta.frames || 1, o = meta.origin || [0, 0];
    return { img, frames: f, fw: Math.floor(img.width / f), fh: img.height, ox: o[0], oy: o[1] };
  } catch { return null; }
}
// what an entity looks like: the sprite its file names, or null
function lookOf(dir, name) {
  try {
    const src = read(join(dir, `entities/${name}.lua`)), m = src.match(/\bsprite\s*=\s*["']([\w/-]+)["']/), look = m ? spriteOf(dir, m[1]) : null;
    return look && { ...look, defaults: lookDefaults(src) };
  } catch { return null; }
}
// A level is a scene's layout: "level1" and "scenes/level1" are scenes/level1.layout.lua. An older game's rooms/level1.lua is used when it
// has one (rooms are the older home of the same data).
function levelFile(dir, n) {
  const m = n.match(/^scenes\/(.+)$/);
  if (m) return `scenes/${m[1]}.layout.lua`;
  return existsSync(join(dir, `rooms/${n}.lua`)) ? `rooms/${n}.lua` : `scenes/${n}.layout.lua`;
}
// A colour as the game reads it: "#rrggbb", "bank:place" (1-15 in palette.json) or a place in the console's fixed palette.
function colorReader(dir, con) {
  const banks = banksOf(dir), byName = {}, pal = palOf(con);
  if (banks) for (const b of [...banks.sprites, ...banks.tiles]) byName[b.name] = b.colors;
  return (c) => {
    if (typeof c === "number") return hexRgb(pal[c] || "#ffffff");
    const m = /^([\w/-]+):(\d+)$/.exec(c || "");
    if (m) return hexRgb((byName[m[1]] || [])[Number(m[2]) - 1] || "#ffffff");
    return /^#[0-9a-fA-F]{6}/.test(c || "") ? hexRgb(c.slice(0, 7)) : [255, 255, 255];
  };
}
const hexRgb = (h) => (/^#[0-9a-fA-F]{6}$/.test(h || "") ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : [0, 0, 0]);

// The whole room as one picture at its real size: tiles (back to front by depth), entities as their sprites (or a marked dot), paths as
// yellow lines, and a dashed box the size of one screen at the top left.
function drawRoom(dir, room, con) {
  const W = room.width, H = room.height, px = new Uint8ClampedArray(W * H * 4), bg = hexRgb(room.background || "#000000");
  for (let i = 0; i < W * H; i++) { px[i * 4] = bg[0]; px[i * 4 + 1] = bg[1]; px[i * 4 + 2] = bg[2]; px[i * 4 + 3] = 255; }
  const blend = (x, y, r, g, b, a) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 4, k = a / 255;
    px[i] = r * k + px[i] * (1 - k); px[i + 1] = g * k + px[i + 1] * (1 - k); px[i + 2] = b * k + px[i + 2] * (1 - k);
  };
  const blit = (img, sx, sy, sw, sh, dx, dy) => { for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const s = ((sy + y) * img.width + sx + x) * 4; blend(dx + x, dy + y, img.data[s], img.data[s + 1], img.data[s + 2], img.data[s + 3]); } };
  const line = (x0, y0, x1, y1, c) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let i = 0; i <= n; i++) blend(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, ...c, 255); };
  const tiles = {};
  for (const l of [...room.layers].sort((a, b) => (b.depth ?? 100) - (a.depth ?? 100))) {
    if (l.visible === false) continue;
    let t = tiles[l.tileset];
    if (t === undefined) { try { t = tilesetOf(dir, l.tileset); } catch { t = null; } tiles[l.tileset] = t; }
    if (!t) continue;
    l.data.forEach((row, r) => row.forEach((v, c) => { if (v >= 0 && v < t.count) blit(t.img, (v % t.cols) * t.tw, Math.floor(v / t.cols) * t.th, t.tw, t.th, c * t.tw, r * t.th); }));
  }
  const tileset = (n) => { if (tiles[n] === undefined) { try { tiles[n] = tilesetOf(dir, n); } catch { tiles[n] = null; } } return tiles[n]; };
  const sprites = {}, sprite = (n) => (n in sprites ? sprites[n] : (sprites[n] = spriteOf(dir, n)));
  // panels as the engine draws them: the 3x3 block's tiles repeated, with the right column and bottom row at the far side of the size
  for (const b of room.panels || []) {
    const t = tileset(b.tileset);
    if (!t) continue;
    const w = Math.max(1, Math.floor(b.w)), h = Math.max(1, Math.floor(b.h));
    let cols = Math.max(1, Math.ceil(w / t.tw)), rows = Math.max(1, Math.ceil(h / t.th));
    if (w > t.tw && cols < 2) cols = 2;
    if (h > t.th && rows < 2) rows = 2;
    const part = (i, n) => (n === 1 || i === 0 ? 0 : i === n - 1 ? 2 : 1);
    const lw = cols > 1 ? w - t.tw : w, lh = rows > 1 ? h - t.th : h;
    const piece = (c, r, sx, sy, sw, sh, dx, dy) => {
      const v = (b.tile || 0) + part(r, rows) * t.cols + part(c, cols);
      if (v < t.count) blit(t.img, (v % t.cols) * t.tw + sx, Math.floor(v / t.cols) * t.th + sy, sw, sh, dx, dy);
    };
    const region = (x0, y0, rw, rh, dx, dy) => {
      for (let r = Math.floor(y0 / t.th); r * t.th < y0 + rh; r++) for (let c = Math.floor(x0 / t.tw); c * t.tw < x0 + rw; c++) {
        const sx = Math.max(0, x0 - c * t.tw), sy = Math.max(0, y0 - r * t.th);
        const sw = Math.min(t.tw, x0 + rw - c * t.tw) - sx, sh = Math.min(t.th, y0 + rh - r * t.th) - sy;
        piece(c, r, sx, sy, sw, sh, dx + c * t.tw + sx - x0, dy + r * t.th + sy - y0);
      }
    };
    const x = Math.floor(b.x), y = Math.floor(b.y);
    region(0, 0, lw, lh, x, y);
    if (cols > 1) region((cols - 1) * t.tw, 0, t.tw, lh, x + w - t.tw, y);
    if (rows > 1) region(0, (rows - 1) * t.th, lw, t.th, x, y + h - t.th);
    if (cols > 1 && rows > 1) region((cols - 1) * t.tw, (rows - 1) * t.th, t.tw, t.th, x + w - t.tw, y + h - t.th);
  }
  const scaled = (sp, f, x, y, k) => {
    const fx = (f % sp.frames) * sp.fw;
    for (let yy = 0; yy < sp.fh * k; yy++) for (let xx = 0; xx < sp.fw * k; xx++) {
      const s = ((Math.floor(yy / k)) * sp.img.width + fx + Math.floor(xx / k)) * 4;
      blend(x + xx, y + yy, sp.img.data[s], sp.img.data[s + 1], sp.img.data[s + 2], sp.img.data[s + 3]);
    }
  };
  for (const p of room.pictures || []) {
    const sp = sprite(p.sprite), k = Math.max(1, Math.round(Number(p.scale) || 1));
    if (sp) scaled(sp, Number(p.frame) || 0, p.x - sp.ox * k, p.y - sp.oy * k, k);
  }
  const looks = {};
  for (const [n, x, y, props] of room.entities) {
    const lk = n in looks ? looks[n] : (looks[n] = lookOf(dir, n));
    if (lk) {
      // its frame, scaled and mirrored around the sprite's origin, as the game draws it: each pixel of the box looks back into the frame
      const p = entityPose(lk, props), kx = p.sx * (p.flip ? -1 : 1), ky = p.sy;
      if (kx && ky) {
        const xs = [x - lk.ox * kx, x + (lk.fw - lk.ox) * kx], ys = [y - lk.oy * ky, y + (lk.fh - lk.oy) * ky];
        for (let dy = Math.floor(Math.min(...ys)); dy < Math.max(...ys); dy++) for (let dx = Math.floor(Math.min(...xs)); dx < Math.max(...xs); dx++) {
          const sx = Math.floor((dx + 0.5 - x) / kx + lk.ox), sy = Math.floor((dy + 0.5 - y) / ky + lk.oy);
          if (sx < 0 || sy < 0 || sx >= lk.fw || sy >= lk.fh) continue;
          const s = (sy * lk.img.width + p.frame * lk.fw + sx) * 4;
          blend(dx, dy, lk.img.data[s], lk.img.data[s + 1], lk.img.data[s + 2], lk.img.data[s + 3] * p.alpha);
        }
      }
    }
    else { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) blend(x + dx, y + dy, 255, 120, 200, 255); }
  }
  // texts in the game's own letters: a built-in font (shadow first, one pixel down and right) or a sprite font, a frame a letter from " "
  const colorOf = colorReader(dir, con);
  let buttonStyle = "gba";
  try { buttonStyle = buttonsOfGame(read(join(dir, "game.lua"))); } catch { /* the default */ }
  for (const t of room.texts || []) {
    const s = String(t.text ?? ""), k = Math.max(1, Math.round(Number(t.size) || 1)), sp = !isBuiltinFont(t.font) && sprite(t.font);
    const w = (sp ? s.length * sp.fw : builtinWidth(s, t.font)) * k;
    const x0 = Math.round(t.align === "center" ? t.x - w / 2 : t.align === "right" ? t.x - w : t.x), y0 = Math.round(t.y);
    if (sp) { [...s].forEach((ch, i) => { const f = ch.charCodeAt(0) - 32; if (f >= 0 && f < sp.frames) scaled(sp, f, x0 + i * sp.fw * k, y0, k); }); continue; }
    if (!isBuiltinFont(t.font)) continue;
    const f = FONTS[t.font || "round_small"], rgb = colorOf(t.color ?? "#ffffff");
    const shadow = t.shadow === true ? shadowOf(rgb) : t.shadow != null && t.shadow !== false ? colorOf(t.shadow) : null;
    const dot = (x, y, c, a = 255) => { for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) blend(x + xx, y + yy, ...c, a); };
    for (const [c, off] of shadow ? [[shadow, 1], [rgb, 0]] : [[rgb, 0]]) {
      let x = x0;
      for (const p of splitButtons(s) || [s]) {
        if (typeof p !== "string") { // a button icon ({a}) in the game's style; "mono" takes the text's colour and shadow
          const ic = buttonPixels(buttonStyle, buttonSize(f.h), p.icon, c);
          if (!off || ic.tint) for (let y = 0; y < ic.h; y++) for (let xx = 0; xx < ic.w; xx++) { const v = ic.at(xx, y); if (v) dot(x + (xx + off) * k, y0 + (y + ic.dy + off) * k, v.slice(0, 3), v[3]); }
          x += (ic.w + 1) * k;
          continue;
        }
        for (const ch of p) {
          const g = glyphOf(t.font, ch.codePointAt(0));
          for (let r = 0; r < f.h; r++) for (let b = 0; b < g[0]; b++) if ((g[r + 1] >> b) & 1) dot(x + (b + off) * k, y0 + (r + off) * k, c);
          x += (g[0] + 1) * k;
        }
      }
    }
  }
  for (const p of Object.values(room.paths)) {
    const pts = p.points;
    for (let i = 1; i < pts.length; i++) line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], [245, 217, 74]);
    if (p.loop && pts.length > 2) line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], [245, 217, 74]);
    for (const [x, y] of pts) for (let d = -1; d <= 1; d++) { blend(x + d, y, 255, 255, 255, 255); blend(x, y + d, 255, 255, 255, 255); }
  }
  const sw = Math.min(W, con.screen.width), sh = Math.min(H, con.screen.height);
  for (let x = 0; x < sw; x++) if ((x >> 2) % 2 === 0) { blend(x, 0, 255, 255, 255, 140); blend(x, sh - 1, 255, 255, 255, 140); }
  for (let y = 0; y < sh; y++) if ((y >> 2) % 2 === 0) { blend(0, y, 255, 255, 255, 140); blend(sw - 1, y, 255, 255, 255, 140); }
  return px;
}
function roomText(name, room, con) {
  const counts = {};
  for (const [n] of room.entities) counts[n] = (counts[n] || 0) + 1;
  const screens = (room.width / con.screen.width) * (room.height / con.screen.height);
  const L = [`${name}: ${room.width}x${room.height} (${(room.width / con.screen.width).toFixed(1)} x ${(room.height / con.screen.height).toFixed(1)} screens), background ${room.background || "#000000"}`];
  for (const l of room.layers) {
    const filled = l.data.reduce((n, row) => n + row.filter((v) => v >= 0).length, 0), cells = l.data.reduce((n, row) => n + row.length, 0);
    L.push(`  layer ${l.name || "?"}: tileset ${l.tileset}, depth ${l.depth ?? 100}${l.solid ? ", solid" : ""}${l.visible === false ? ", hidden" : ""}, ${filled} of ${cells} cells filled`);
  }
  L.push(`  things: ${room.entities.length ? Object.entries(counts).map(([n, c]) => `${n} x${c}`).join(", ") : "none"} (${(room.entities.length / Math.max(1, screens)).toFixed(1)} a screen; this console allows ${(con.limits || {}).instances_alive || "?"} alive at once)`);
  const named = (list) => list.filter((x) => x.name).map((x) => x.name);
  for (const [k, list, what] of [["texts", room.texts || [], (t) => JSON.stringify(t.text)], ["pictures", room.pictures || [], (p) => p.sprite], ["panels", room.panels || [], (b) => `${b.w}x${b.h} of ${b.tileset}`]]) {
    if (list.length) L.push(`  ${k}: ${list.map((x) => `${what(x)} at ${x.x},${x.y}${x.name ? ` (self.${x.name})` : ""}`).join("; ")}`);
  }
  const ps = Object.entries(room.paths);
  if (ps.length) L.push(`  paths: ${ps.map(([k, p]) => `${k} (${p.points.length} points${p.loop ? ", loops" : ""})`).join(", ")}`);
  return L.join("\n");
}
export function room_view({ game, name, scale }) {
  const dir = gameDir(game), n = resName(name), f = levelFile(dir, n);
  if (!existsSync(join(dir, f))) throw new Error(`${f} does not exist (a level is a scene's layout: name "level1" is scenes/level1.layout.lua)`);
  const r = parseRoom(read(join(dir, f)));
  if (r.error) return { text: `${f} has code in it, so it is not drawn (${r.error}); read it as text.` };
  const con = consoleOf(dir), px = drawRoom(dir, r.room, con);
  return { text: roomText(n, r.room, con), images: [picture(r.room.width, r.room.height, px, scale || Math.max(1, Math.min(4, Math.floor(1280 / Math.max(r.room.width, r.room.height)))), [0, 0, 0])] };
}

// Build or change a room. Every part is optional:
//   size: { width, height, background }
//   layers: [{ name, tileset?, depth?, solid?, visible?, map?: { legend: { "#": 3, ".": -1 }, rows: ["....###", ...], at?: [col, row] },
//             paint?: [["fill", tile], ["rect", col, row, w, h, tile], ["clear"]], remove?: true }]   (tiles in tile units; -1 is empty)
//   entities: { clear?: true, remove?: [names], add?: [[name, x, y, { values }?], ...] }      (pixels)
//   paths: { name: { points: [[x, y], ...], loop } | null }
//   texts, pictures, panels: { clear?: true, remove?: [names], add?: [{ text | sprite | tileset, x, y, ... as the layout writes them }] }
// name "level1" or "scenes/level1" is that scene's layout (scenes/level1.layout.lua); an older game's rooms/level1.lua if it has one.
export function room_write({ game, name, size, layers = [], entities, texts, pictures, panels, paths }) {
  const dir = gameDir(game), f = levelFile(dir, resName(name)), n = name.replace(/^scenes\//, ""), file = join(dir, f), layout = f.startsWith("scenes/");
  let room;
  if (existsSync(file)) {
    const r = parseRoom(read(file));
    if (r.error) throw new Error(`${f} has code in it (${r.error}); edit it as text instead`);
    room = r.room;
  } else room = normalizeRoom({ width: consoleOf(dir).screen.width, height: consoleOf(dir).screen.height, background: "#101220" });
  const con = consoleOf(dir), notes = [];
  if (size) {
    if (size.width) room.width = Math.max(16, Math.min(8192, Math.round(size.width)));
    if (size.height) room.height = Math.max(16, Math.min(8192, Math.round(size.height)));
    if (size.background) room.background = size.background;
  }
  for (const spec of layers) {
    let l = room.layers.find((x) => x.name === spec.name);
    if (spec.remove) { room.layers = room.layers.filter((x) => x !== l); continue; }
    if (!l) {
      if (!spec.tileset) throw new Error(`layer '${spec.name}' is new: give its tileset`);
      l = { name: spec.name, tileset: spec.tileset, depth: spec.depth ?? 100, data: [] };
      room.layers.push(l);
    }
    for (const k of ["tileset", "depth", "solid", "visible"]) if (spec[k] !== undefined) l[k] = spec[k];
  }
  // every layer as big as the room in its own tiles, then painted
  room.layers = room.layers.map((l) => { try { const t = tilesetOf(dir, l.tileset); return Object.assign(fitLayer(l, room, t.tw, t.th), { _t: t }); } catch { notes.push(`tileset ${l.tileset} of layer ${l.name} could not be read`); return l; } });
  for (const spec of layers) {
    const l = room.layers.find((x) => x.name === spec.name);
    if (!l || !l.data.length) continue;
    const set = (c, r, v) => { if (l.data[r] && c >= 0 && c < l.data[r].length) l.data[r][c] = v; };
    for (const [op, ...a] of spec.paint || []) {
      if (op === "fill") l.data.forEach((row) => row.fill(a[0]));
      else if (op === "clear") l.data.forEach((row) => row.fill(-1));
      else if (op === "rect") for (let r = a[1]; r < a[1] + a[3]; r++) for (let c = a[0]; c < a[0] + a[2]; c++) set(c, r, a[4]);
      else throw new Error(`layer ${spec.name}: unknown paint '${op}' (fill, rect, clear)`);
    }
    if (spec.map) {
      const legend = spec.map.legend || {}, [c0, r0] = spec.map.at || [0, 0];
      spec.map.rows.forEach((row, r) => [...row].forEach((ch, c) => {
        if (!(ch in legend)) { if (ch !== " ") throw new Error(`layer ${spec.name}: '${ch}' is not in the legend`); return; }
        set(c0 + c, r0 + r, legend[ch]);
      }));
    }
    const t = l._t;
    if (t) for (const row of l.data) for (const v of row) if (v >= t.count) { notes.push(`layer ${l.name} uses tile ${v}, but ${l.tileset} has ${t.count} tiles`); break; }
  }
  room.layers.forEach((l) => { delete l._t; });
  if (entities) {
    if (entities.clear) room.entities = [];
    if (entities.remove) room.entities = room.entities.filter(([e]) => !entities.remove.includes(e));
    for (const e of entities.add || []) {
      if (!existsSync(join(dir, `entities/${e[0]}.lua`))) notes.push(`there is no entities/${e[0]}.lua yet`);
      room.entities.push([String(e[0]), Number(e[1]) || 0, Number(e[2]) || 0, e[3] && typeof e[3] === "object" ? e[3] : undefined]);
    }
    const out = room.entities.filter(([, x, y]) => x < 0 || y < 0 || x > room.width || y > room.height).length;
    if (out) notes.push(`${out} thing${out === 1 ? " is" : "s are"} outside the room`);
  }
  // texts, pictures and panels (a layout's screen furniture): { clear, remove: [names], add: [{ ... }] }, each item as the layout writes it
  for (const [k, spec, first] of [["texts", texts, "text"], ["pictures", pictures, "sprite"], ["panels", panels, null]]) {
    if (!spec) continue;
    room[k] = room[k] || [];
    if (spec.clear) room[k] = [];
    if (spec.remove) room[k] = room[k].filter((x) => !spec.remove.includes(x.name));
    for (const it of spec.add || []) {
      if (!it || typeof it !== "object") throw new Error(`${k}: each one to add is an object`);
      if (first && it[first] == null) throw new Error(`${k}: each one needs '${first}'`);
      if (k === "panels" && !it.tileset) throw new Error("panels: each one needs a tileset (and x, y, w, h, tile)");
      room[k].push({ ...it, x: Number(it.x) || 0, y: Number(it.y) || 0, ...(k === "panels" ? { w: Number(it.w) || 16, h: Number(it.h) || 16, tile: Number(it.tile) || 0 } : {}) });
    }
  }
  for (const [k, p] of Object.entries(paths || {})) {
    if (!/^[A-Za-z_]\w*$/.test(k)) throw new Error(`path name '${k}': letters, digits and _`);
    if (p === null) delete room.paths[k];
    else room.paths[k] = { points: (p.points || []).map(([x, y]) => [Number(x) || 0, Number(y) || 0]), loop: !!p.loop };
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, serializeRoom(room, layout ? LAYOUT_COMMENT : `A room (the older home of a level): gs.load_layout("${n.replace(/\//g, ".")}") builds it. Plain data; the studio's layout editor opens it.`));
  const view = room_view({ game, name: layout ? `scenes/${n}` : n });
  return { text: `wrote ${f}\n${view.text}${notes.length ? "\nnote: " + notes.join("; ") : ""}`, images: view.images };
}

// ---------- the handheld ----------
export function push({ game, serial, device }) {
  const dir = gameDir(game);
  if (device && !/^[a-zA-Z0-9_-]+$/.test(device)) throw new Error("Device profile names use letters, digits, _ or -.");
  const env = { ...process.env };
  if (serial) env.GS_ADB_SERIAL = serial;
  if (device) { env.GS_DEVICE = device; delete env.DEVICE_ENV; }
  const r = spawnSync("sh", [join(ROOT, "scripts/push.sh"), relative(ROOT, dir)], { cwd: ROOT, env, encoding: "utf8", timeout: 600000 });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim().split("\n").slice(-12).join("\n");
  return { text: (r.status === 0 ? `sent ${game} to the handheld over ADB\n` : `sending failed\n`) + (r.error ? `${r.error.message}\n` : "") + out };
}
