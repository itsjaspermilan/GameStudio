// The server end to end, as an agent sees it: start it over stdio, list the tools, call a few. The music analysis has its own tests
// (studio/test/music-core.test.mjs); here the point is that every tool answers and pictures arrive as PNGs.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "../../..");
const skip = !existsSync(join(root, "build/gs"));

test("the GameStudio MCP server answers", { skip, timeout: 120000 }, async () => {
  const client = new Client({ name: "test", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(here, "../server.mjs")] }));
  try {
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["api", "check", "games", "help", "inspect", "instruments", "overview", "push", "room_view", "room_write", "run", "song_check", "song_write", "sound_check", "sound_write", "sprite_view", "sprite_write"]);
    const call = async (name, args) => { const r = await client.callTool({ name, arguments: args }); assert.ok(!r.isError, `${name}: ${r.content[0].text}`); return r; };
    assert.match((await call("api", { query: "spawn" })).content[0].text, /gs\.spawn/);
    assert.match((await call("overview", { game: "breakout" })).content[0].text, /entities \(3\)/);
    const run = await call("run", { game: "breakout", seconds: 1 });
    assert.equal(run.content[1].type, "image");
    assert.equal(Buffer.from(run.content[1].data, "base64").readUInt32BE(0), 0x89504e47, "a PNG");
    assert.match((await call("song_check", { game: "void-swarm", name: "msc_s1" })).content[0].text, /key E dorian[\s\S]*loudness/);
    const bad = await client.callTool({ name: "overview", arguments: { game: "no-such-game" } });
    assert.ok(bad.isError && /no game called/.test(bad.content[0].text));
  } finally { await client.close(); }
});

test("writing: a sprite, a sound and a song land in a game and come back checked", { skip, timeout: 120000 }, async () => {
  // a copy of Breakout in a throwaway workspace, so the real games are never touched
  const ws = mkdtempSync(join(tmpdir(), "gs-mcp-ws-"));
  for (const d of ["carts/breakout", "engine", "build/gs", "docs/help", "tests", "assets/soundfonts"]) cpSync(join(root, d), join(ws, d), { recursive: true });
  const client = new Client({ name: "test", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(here, "../server.mjs")], env: { ...process.env, GS_WORKSPACE: ws } }));
  try {
    const call = async (name, args) => { const r = await client.callTool({ name, arguments: args }); assert.ok(!r.isError, `${name}: ${r.content[0].text}`); return r; };
    const spr = await call("sprite_write", { game: "breakout", name: "spr_gem", w: 8, h: 8, frames: [{ ops: [["disc", 4, 4, 3, 22], ["px", 3, 3, 3], ["outline", 20]] }] });
    assert.match(spr.content[0].text, /8x8, 1 frame/);
    assert.ok(existsSync(join(ws, "carts/breakout/sprites/spr_gem.png")));
    const view = await call("sprite_view", { game: "breakout", name: "spr_gem", as_text: true });
    assert.match(view.content[0].text, /frame 1:\n {2}\.\.[a-z0-9.]+/);
    const snd = await call("sound_write", { game: "breakout", name: "sfx_ping", sound: { speed: 2, tracks: [{ instrument: "bell", steps: [[60, 6, 0], [67, 5, 5]] }] } });
    assert.match(snd.content[0].text, /loudness/);
    const song = await call("song_write", { game: "breakout", name: "msc_test", spec: { root: 0, scale: "major", tempo: 100, oct: 4, inst: ["gm_vibraphone", "gm_warm_pad", "gm_finger_bass", "gm_drum_kit"], harmony: "pad", bass: "half", drums: "soft", rhythms: [3, 1], sections: [{ prog: [0, 3, 4, 0] }], order: [0, 0] } });
    assert.match(song.content[0].text, /key C major[\s\S]*chords by bar: C/);
    assert.ok(JSON.parse(readFileSync(join(ws, "carts/breakout/music/msc_test.json"), "utf8")).format === "tracker");
    // a level written as a text map, with things and a path, comes back as a picture and as plain room data
    const room = await call("room_write", { game: "breakout", name: "level1", size: { width: 640, height: 240, background: "#14234f" },
      layers: [{ name: "ground", tileset: "ts_bg", depth: 50, solid: true, map: { legend: { "#": 1, ".": -1 }, at: [0, 12], rows: ["########....########################", "######################################", "######################################"] } }],
      entities: { add: [["paddle", 40, 180], ["ball", 300, 120], ["ghost", 9999, 0]] }, paths: { patrol: { points: [[100, 60], [500, 60]], loop: true } } });
    assert.match(room.content[0].text, /640x240 \(2\.0 x 1\.0 screens\)/);
    assert.match(room.content[0].text, /layer ground: tileset ts_bg, depth 50, solid, \d+ of \d+ cells filled/);
    assert.match(room.content[0].text, /no entities\/ghost\.lua[\s\S]*outside the room/);
    assert.equal(room.content[1].type, "image");
    const lua = readFileSync(join(ws, "carts/breakout/rooms/level1.lua"), "utf8");
    assert.match(lua, /patrol = \{ \{ 100, 60 \}, \{ 500, 60 \}, loop = true \}/);
    const ts = await call("sprite_write", { game: "breakout", name: "ts_cave", w: 16, h: 16, tileset: { cols: 2 }, frames: [{ ops: [["rect", 0, 0, 16, 16, 9]] }, { ops: [["rect", 0, 0, 16, 16, 17]] }, { ops: [["rect", 0, 4, 16, 12, 1]] }] });
    assert.match(ts.content[0].text, /3 tiles of 16x16 in rows of 2/);
    assert.deepEqual(JSON.parse(readFileSync(join(ws, "carts/breakout/tilesets/ts_cave.json"), "utf8")), { image: "tilesets/ts_cave.png", tile_w: 16, tile_h: 16 });
    const changed = await call("room_write", { game: "breakout", name: "level1", entities: { remove: ["ghost"] }, layers: [{ name: "ground", paint: [["rect", 8, 12, 4, 1, 1]] }] });
    assert.match(changed.content[0].text, /paddle x1, ball x1 \(/);
  } finally { await client.close(); rmSync(ws, { recursive: true, force: true }); }
});
