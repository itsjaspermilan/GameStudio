// Development only: an in-memory stand-in for the Rust commands, so the UI can be developed and tested in a
// plain browser (npm run dev, then open http://localhost:1420). Never bundled into the Tauri app build.
import { createSprite, createTileset, setPixel, addFrame, toJSON } from "./sprite-core.js";
import { encodeSpritePng } from "./sprite-io.js";

const carts = {};
let nextCb = 1;

const LUA = "-- an old plain Lua game (no game.lua): the studio lists it but cannot run it\nfunction draw()\n  gs.clear(20, 24, 40)\nend\n";

async function seed() {
  const s = createSprite("spr_demo", 16, 16);
  addFrame(s);
  for (let f = 0; f < 2; f++)
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = (x - 7.5) ** 2 + (y - 7.5) ** 2;
        if (d <= 49) setPixel(s, f, x, y, [250, 210, 60, 255]);
        if (f === 0 && d <= 49 && ((x === 5 || x === 10) && (y === 5 || y === 6))) setPixel(s, f, x, y, [30, 30, 30, 255]);
        if (f === 1 && d <= 49 && ((x === 5 || x === 10) && y === 6)) setPixel(s, f, x, y, [30, 30, 30, 255]);
      }
  s.origin = [8, 8]; s.fps = 2;
  const ts = createTileset("ts_demo", 16, 16, 4, 2); // 4x2 coloured tiles
  const cols = [[200, 80, 80], [80, 200, 120], [90, 140, 255], [250, 210, 60], [170, 100, 230], [240, 150, 60], [120, 120, 130], [230, 230, 240]];
  for (let t = 0; t < 8; t++)
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const edge = x === 0 || y === 0 ? 40 : 0;
        setPixel(ts, 0, (t % 4) * 16 + x, Math.floor(t / 4) * 16 + y, [Math.min(255, cols[t][0] + edge), Math.min(255, cols[t][1] + edge), Math.min(255, cols[t][2] + edge), 255]);
      }
  // two panel styles for the layout editor: 8x8 tiles, 3x3 blocks side by side (a teal edge, a gold edge), dark see-through middles
  const ui = createTileset("ts_ui", 8, 8, 6, 3);
  for (let b = 0; b < 2; b++)
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        const edge = x === 0 || y === 0 || x === 23 || y === 23;
        setPixel(ui, 0, b * 24 + x, y, edge ? (b ? [245, 217, 74, 255] : [69, 209, 197, 255]) : [10, 12, 20, 200]);
      }
  carts.demo = { files: {
    "game.lua": { text: 'return gs.game{ title = "Demo", console = "glow43", start = "scenes.main" }\n' },
    "scenes/main.lua": { text: 'local Main = gs.scene{}\nfunction Main:enter()\n  gs.spawn("player", 128, 96)\n  gs.spawn("enemies.grub", 40, 40)\nend\nreturn Main\n' },
    "scenes/title.lua": { text: 'local Title = gs.scene{}\n\nfunction Title:update(dt)\n  self.prompt.visible = gs.time() % 1 < 0.5\n  if gs.input.pressed("a") then gs.goto_scene("main") end\nend\n\nreturn Title\n' },
    "scenes/title.layout.lua": { text: '-- The scene\'s layout, built when it starts.\nreturn {\n  width = 320, height = 240,\n  background = "#101220",\n  entities = {\n  },\n  texts = {\n    { "DEMO", 160, 60, name = "title", color = 3, size = 4, align = "center" },\n    { "PRESS A", 160, 180, name = "prompt", color = 15, size = 1, align = "center" },\n  },\n  pictures = {\n    { "spr_demo", 160, 120, name = "demo", scale = 3 },\n  },\n}\n' },
    "entities/enemies/grub.lua": { text: 'local Grub = gs.entity{ sprite = "spr_demo", tags = { "enemy" } }\n\nreturn Grub\n' },
    "entities/player.lua": { text: 'local Player = gs.entity{ sprite = "spr_demo", tags = { "player" } }\n\nfunction Player:update(dt)\n  local dx, dy = gs.input.dir()\n  self.x = self.x + dx * 90 * dt\n  self.y = self.y + dy * 90 * dt\nend\n\nreturn Player\n' },
    "meta/info.json": { text: JSON.stringify({ title: "Demo", console: "glow43" }, null, 2) },
    "sprites/spr_demo.json": { text: JSON.stringify(toJSON(s), null, 2) },
    "tilesets/ts_demo.json": { text: JSON.stringify({ image: "tilesets/ts_demo.png", tile_w: 16, tile_h: 16 }) },
    "tilesets/ts_demo.png": { b64: await encodeSpritePng(ts) },
    "tilesets/ts_ui.json": { text: JSON.stringify({ image: "tilesets/ts_ui.png", tile_w: 8, tile_h: 8 }) },
    "tilesets/ts_ui.png": { b64: await encodeSpritePng(ui) },
    "sprites/spr_demo.png": { b64: await encodeSpritePng(s) },
  } };
  carts.hello = { files: { "main.lua": { text: LUA } } };
  // the folders you have open are paths, as in the app; "demo" is also offered as an example to copy
  carts[HOME + "/demo"] = carts.demo;
  carts[HOME + "/hello"] = carts.hello;
  projects.push(HOME + "/demo", HOME + "/hello");
}
const HOME = "/Users/you/Documents/GameStudio";
const projects = [];
const projectState = {};
const remember = (path) => { const i = projects.indexOf(path); if (i >= 0) projects.splice(i, 1); projects.unshift(path); return path; };

const handlers = {
  get_settings: () => ({ workspace: "/mock/workspace", device_host: "", device_user: "root", device_dir: "" }),
  save_settings: () => null,
  runtime_status: () => ({ desktop: true, device: false }),
  list_carts: () => Object.keys(carts).sort(),
  list_games: () => Object.keys(carts).sort().map((name) => ({ name, kind: carts[name].files['game.lua'] ? 'game' : 'lua' })),
  list_files: ({ cart }) => Object.keys(carts[cart].files).sort(),
  read_file: ({ cart, rel }) => {
    const f = carts[cart].files[rel];
    if (!f || f.text === undefined) throw `${rel}: not found`;
    return f.text;
  },
  write_file: ({ cart, rel, content }) => { carts[cart].files[rel] = { text: content }; return null; },
  read_binary: ({ cart, rel }) => {
    const f = carts[cart].files[rel];
    if (!f || f.b64 === undefined) throw `${rel}: not found`;
    return f.b64;
  },
  write_binary: ({ cart, rel, data }) => { carts[cart].files[rel] = { b64: data }; return null; },
  delete_file: ({ cart, rel }) => { delete carts[cart].files[rel]; return null; },
  list_projects: () => projects.filter((p) => carts[p]).map((path) => ({ path, name: path.split("/").pop(), kind: carts[path].files["game.lua"] ? "game" : "lua" })),
  forget_project: ({ path }) => { const i = projects.indexOf(path); if (i >= 0) projects.splice(i, 1); return null; },
  // the real commands show a folder picker; the mock always picks Documents/GameStudio
  open_folder: () => remember(HOME + "/demo"),
  new_project: ({ name }) => {
    const path = `${HOME}/${name}`;
    if (carts[path]) throw `there is already a '${name}' in ${HOME}`;
    carts[path] = { files: {} };
    return remember(path);
  },
  list_examples: () => ["demo"],
  copy_example: ({ name }) => {
    const path = `${HOME}/${name}-copy`;
    if (!carts[path]) carts[path] = { files: JSON.parse(JSON.stringify(carts[name].files)) };
    return remember(path);
  },
  read_project_state: ({ cart }) => projectState[cart] || "",
  write_project_state: ({ cart, content }) => { projectState[cart] = content; return null; },
  reveal_project: () => null,
  new_cart: ({ name }) => {
    if (carts[name]) throw `'${name}' already exists`;
    carts[name] = { files: {} };
    return null;
  },
  rename_file: ({ cart, from, to }) => {
    const f = carts[cart].files;
    if (!f[from]) throw `${from} doesn't exist`;
    if (f[to]) throw `${to} already exists`;
    f[to] = f[from]; delete f[from]; return null;
  },
  new_file: ({ cart, rel }) => { carts[cart].files[rel] = { text: "" }; return null; },
  // The real command renders with the runtime's synth; the browser mock just returns a short tone so the UI can be tried.
  render_audio: () => {
    const n = 8820, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 20) * 6000 * (1 - i / n), true);
    let b = ""; new Uint8Array(buf).forEach((x) => { b += String.fromCharCode(x); });
    return btoa(b);
  },
  list_consoles: () => Object.values(window.__mockConsoles),
  save_console: ({ id, content }) => { window.__mockConsoles[id] = content; return null; },
  delete_console: ({ id }) => { delete window.__mockConsoles[id]; return null; },
  cart_size: ({ cart }) => Object.values(carts[cart].files).reduce((n, f) => n + (f.text ? f.text.length : Math.floor((f.b64 || "").length * 0.75)), 0),
  // a pretend game: the stats line and the inspector's answers once a second, so the Handheld and Inspector tabs can be tried
  run_preview: ({ embed, onFrame }) => {
    stopFake();
    emit("preview-state", true);
    if (embed && onFrame) fakeScreen(embed, onFrame);
    let step = 0, paused = false;
    fake = setInterval(() => {
      const cmd = (() => { try { return JSON.parse(inspectText || "{}"); } catch { return {}; } })();
      paused = !!cmd.paused; if (!paused) step += 60 * (cmd.speed || 1);
      emit("log", { stream: "stderr", line: `@@gs {"entities":14,"peak":20,"limit":512,"update_ms":0.2,"draw_ms":0.3,"fps":60,"mem_kb":700,"checks":40,"screens":1.3}` });
      if (cmd.open) {
        const list = cmd.class ? Array.from({ length: 5 }, (_, i) => ({ id: 10 + i, x: 40 * i, y: 100 })) : [];
        const entity = cmd.entity ? { hp: String(3 + (step % 3)), x: "40.00", y: "100.00", sprite: '"spr_demo"' } : undefined;
        emit("log", { stream: "stderr", line: "@@gsi " + JSON.stringify({ paused, speed: cmd.speed || 1, step, alive: 14, particles: 0, scene: "scenes.main",
          classes: [{ name: "entities.player", count: 1, update_ms: 0.05, draw_ms: 0.02, collide_ms: 0 }, { name: "entities.enemy", count: 13, update_ms: 0.3, draw_ms: 0.2, collide_ms: 0.1 }],
          list, entity, watch: (cmd.watch || []).map((w) => (w === "e.hp" && entity ? entity.hp : "nil")) }) });
      }
    }, 1000);
    return null;
  },
  stop_preview: () => { stopFake(); emit("preview-state", false); return null; },
  preview_buttons: ({ mask }) => { fakeButtons = mask; fakeTapped |= mask; return null; },
  cancel_push: () => false,
  lsp_start: () => { throw 'mock: no language server in the browser'; },
  lsp_stop: () => null,
  pack_cart: ({ cart, ext }) => `/mock/${cart}.${ext || "cart"}`,
  inspect_send: ({ text }) => { inspectText = text; return null; },
  // a 64x48 BMP with a gradient, standing in for the game's frame
  take_screenshot: () => {
    const w = 64, h = 48, b = new Uint8Array(54 + w * h * 3), v = new DataView(b.buffer);
    b[0] = 0x42; b[1] = 0x4d; v.setUint32(10, 54, true); v.setInt32(18, w, true); v.setInt32(22, -h, true); v.setUint16(28, 24, true);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.set([y * 5, 40, x * 4], 54 + (y * w + x) * 3);
    return btoa(String.fromCharCode(...b));
  },
  push_cart: () => null,
};

await seed();
window.__mockCarts = carts;
window.__mockConsoles = {}; // id -> the console file text // handy for inspecting saved files from the console
// events: the studio's listen() registers a callback; emit() calls the ones for an event
const callbacks = {}, listeners = {};
let fake = null, inspectText = "";
let fakeFrames = null, fakeButtons = 0, fakeTapped = 0;
const stopFake = () => { if (fake) clearInterval(fake); if (fakeFrames) clearInterval(fakeFrames); fake = fakeFrames = null; };
// The Play panel's stand-in game: a dark screen with a square the arrow keys move (bits 0-3) and A recolours (bit 4), sent as the runtime
// sends frames (play-core.js decodeFrame), 30 times a second.
function fakeScreen({ width: w, height: h }, ch) {
  let x = w / 2, y = h / 2;
  fakeFrames = setInterval(() => {
    const b = fakeButtons | fakeTapped; fakeTapped = 0;
    x = Math.max(0, Math.min(w - 16, x + ((b >> 3) & 1) * 3 - ((b >> 2) & 1) * 3)); y = Math.max(0, Math.min(h - 16, y + ((b >> 1) & 1) * 3 - (b & 1) * 3));
    const col = b & 16 ? [234, 90, 75] : [79, 155, 240], out = [0x46, w & 255, w >> 8, h & 255, h >> 8, 0, 0, 0, 0];
    const run = (n, c) => { while (n > 0) { const k = Math.min(256, n); out.push(k - 1, c[0], c[1], c[2], 255); n -= k; } };
    for (let r = 0; r < h; r++) {
      const inRow = r >= y && r < y + 16, bg = [20, 24, 40];
      if (!inRow) { run(w, bg); continue; }
      const sx = Math.round(x); run(sx, bg); run(16, col); run(w - sx - 16, bg);
    }
    const len = out.length - 9; out[5] = len & 255; out[6] = (len >> 8) & 255; out[7] = (len >> 16) & 255; out[8] = len >>> 24;
    ch.onmessage(new Uint8Array(out).buffer);
  }, 33);
}
function emit(event, payload) { for (const id of listeners[event] || []) callbacks[id] && callbacks[id]({ event, payload, id }); }
window.__mockEmit = emit;
window.__TAURI_INTERNALS__ = {
  transformCallback: (fn) => { const id = nextCb++; callbacks[id] = fn; return id; },
  unregisterCallback: (id) => { delete callbacks[id]; },
  invoke: async (cmd, args) => {
    if (cmd === "plugin:event|listen") { (listeners[args.event] ||= []).push(args.handler); return args.handler; }
    if (cmd.startsWith("plugin:event|")) return 0;
    const h = handlers[cmd];
    if (!h) throw `mock: unknown command ${cmd}`;
    return h(args || {});
  },
};
window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
