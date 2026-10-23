#!/usr/bin/env node
// The GameStudio MCP server: lets an agent (Claude Code and the like) look things up, check, run, draw and compose for GameStudio games
// with short answers and pictures instead of reading whole files. Speaks MCP over stdio. The work is in tools.mjs.
//   node tools/mcp/server.mjs          (the repo's .mcp.json starts it for Claude Code)
// GS_WORKSPACE points it at another workspace (a folder with carts/, build/gs and engine/); default: this repository.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as T from "./tools.mjs";

const server = new McpServer({ name: "gamestudio", version: "1.0.0" }, {
  instructions: "GameStudio makes small 2D Lua games for a handheld (games are folders in carts/; the engine API is gs.*). Prefer these tools over reading big files: " +
    "api and help for the engine, overview to see a game, check after editing Lua, run to see it (a screenshot), inspect to look inside, sprite_view/sprite_write for art, room_view/room_write for levels, " +
    "song_check/song_write and sound_check/sound_write for sound (the checks read the notes with music theory and measure the rendered audio), push to send a game to the handheld. " +
    "Before drawing, designing levels or composing, read the craft guide with help: help('art') (with help('sizes')), help('levels'), help('music').",
});

// every tool answers with text, plus pictures when there are any; mistakes come back as readable errors, not crashes
function tool(name, title, description, shape, fn) {
  server.registerTool(name, { title, description, inputSchema: shape }, async (args) => {
    try {
      const r = await fn(args || {});
      return { content: [{ type: "text", text: r.text }, ...(r.images || []).map((data) => ({ type: "image", data, mimeType: "image/png" }))] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: String(e && e.message ? e.message : e) }] };
    }
  });
}

const game = z.string().describe("A game: a folder name in carts/ (see games)");

tool("api", "Look up the gs API", "Find gs.* functions, Entity methods and fields by name or by words in their description (e.g. 'spawn', 'collide', 'camera', 'burst', 'follow_path'). Empty query lists the groups.",
  { query: z.string().default("") }, T.api);
tool("help", "Read a Help page", "The studio's Help pages (tutorials and guides). No topic lists them; a topic (like 'survivors', 'limits', 'sizes', 'rooms') returns that page as text with its example files.",
  { topic: z.string().default("") }, T.help);
tool("games", "List the games", "Every game in the workspace with its title and console.", {}, T.games);
tool("overview", "Overview of a game", "One compact page about a game: console, entities (sprite, tags, methods), scenes, rooms, code files, sprites with sizes and animations, sounds, songs with their instruments, Lua size. Read this before reading files.",
  { game }, T.overview);
tool("check", "Check a game", "After editing: the editor's own warnings for every Lua file (unknown names with suggestions, missing returns, tables made every step), files whose indentation is off, then a headless run reporting errors, warnings and the numbers at the end.",
  { game, seconds: z.number().min(0.5).max(60).default(4).describe("How long to run it") }, T.check);
tool("run", "Run a game and look", "Runs the game without a window for some seconds (optionally pressing buttons, or with a random bot) and returns what it printed, its stats and a screenshot of the last frame.",
  {
    game, seconds: z.number().min(0.1).max(120).default(3),
    keys: z.string().optional().describe("Button script, comma separated: 'a' (press), 'right*30' (hold 30 steps), 'wait*60'. Buttons: up down left right a b x y l r l2 r2 start select"),
    bot: z.boolean().default(false).describe("Play with the random bot instead"),
    scale: z.number().int().min(1).max(4).optional().describe("Enlarge the screenshot"),
  }, T.run);
tool("inspect", "Look inside a running game", "Runs the game for some seconds and reports every kind of entity with its count and cost (update/draw/collision ms a step); a kind's entities with positions; one entity's values; and Lua watch expressions (e is the chosen entity).",
  { game, seconds: z.number().min(1).max(120).default(3), kind: z.string().optional().describe("e.g. 'entities.enemy'"), entity: z.number().int().optional(), watch: z.array(z.string()).default([]) }, T.inspect);
tool("sprite_view", "See a sprite", "Shows a sprite (all frames) as a picture. as_text also returns it as rows of palette letters ('.' see-through) that sprite_write takes back exactly.",
  { game, name: z.string(), scale: z.number().int().min(1).max(16).optional(), as_text: z.boolean().default(false) }, T.sprite_view);
tool("sprite_write", "Draw a sprite", "Writes sprites/<name>.png and .json and returns a picture. Each frame is rows of palette letters (as sprite_view shows; '.' see-through) and/or drawing ops: " +
  "['rect',x,y,w,h,c] ['frame',x,y,w,h,c] ['px',x,y,c] ['line',x0,y0,x1,y1,c] ['disc',cx,cy,r,c] ['ellipse',cx,cy,rx,ry,c] ['ring',cx,cy,r,thick,c] ['poly',[[x,y],...],c] " +
  "['sphere',cx,cy,r,[dark,mid,light,highlight]] ['dither',x,y,w,h,c] ['outline',c] ['mirror'] (copies the left half to the right) ['erase',x,y,w,h]. Colours are the console's palette places (numbers, or letters as sprite_view lists them). " +
  "In a game with colour banks (palette.json) a sprite draws with one sprite bank (bank, default the first) and colours are its places 1-15 (numbers or hex digits 1-f, 0 or '.' see-through); a tileset lists tile banks (banks) and each tile may name its own (frame.bank), like the GBA. " +
  "Sizes for a 320x240 screen: hero 24-32, common enemy 16-24, boss 48-64, bullet/pickup 8-12, multiples of 8 up to 64. Origin defaults to the centre.",
  {
    game, name: z.string(), w: z.number().int(), h: z.number().int(),
    frames: z.array(z.object({ rows: z.array(z.string()).optional(), ops: z.array(z.array(z.any())).optional(), bank: z.string().optional().describe("A tileset with banks: this tile's bank (default the first of banks)") })),
    bank: z.string().optional().describe("A game with colour banks: the sprite bank this sprite draws with (default the first)"),
    banks: z.array(z.string()).optional().describe("A game with colour banks, writing a tileset: the tile banks it uses (default the first tile bank)"),
    origin: z.array(z.number()).length(2).optional(), fps: z.number().optional(),
    animations: z.record(z.string(), z.object({ from: z.number().int(), to: z.number().int(), fps: z.number(), loop: z.boolean() })).optional().describe("Named clips, frames counted from 0: { walk: { from: 2, to: 7, fps: 12, loop: true } }"),
    outline: z.union([z.number(), z.string()]).optional().describe("Outline every frame in this colour"),
    tileset: z.object({ cols: z.number().int().min(1).max(32).optional() }).optional().describe("Write a tileset instead: each frame is one tile, laid out in rows of cols (tilesets/<name>.png, at most 256x256)"),
  }, T.sprite_write);
tool("instruments", "List instruments", "The built-in instruments (chip wavetables, and the General MIDI SoundFont: pianos, guitars, strings, brass, pads, drum kit...), optionally filtered by a word.",
  { filter: z.string().default("") }, T.instruments);
tool("song_check", "Listen to a song", "Reads a song like a musician (key, chords by bar, whether the melody sits on the chords, semitone clashes, shrill or muddy registers, melody shape and repetition, how busy each part is) and renders it to measure loudness, clipping and brightness.",
  { game, name: z.string() }, T.song_check);
tool("song_write", "Write a song", "Writes music/<name>.json and checks it. spec is either a finished tracker song ({ format: 'tracker', ... }) or options for the generator: " +
  "{ seed, root (0=C..11=B), scale ('major'|'minor'|'dorian'|'phrygian'|'lydian'|'harm'), tempo, oct (melody octave, 4 = middle; 5+ gets shrill), inst: [melody, harmony, bass, drums] (instrument names; 'gm_drum_kit' for drums), " +
  "harmony ('pad'|'arp8'|'arp16'), bass ('half'|'eighth'|'pump'|'gallop'|'groove'), drums ('none'|'soft'|'four'|'drive'|'break'|'boss'), rhythms: [0-5 melody rhythm ids], rest (0-1), calm (true = notes ring), " +
  "reverb (0-100), vol: [4 track volumes -3..3], level (whole-song steps), sections: [{ prog: [scale degrees, one a bar, 0 = home chord; 4 bars a section], oct?, drums?, bass?, reg? }], order: [section indexes], loop (default true) }. " +
  "In a tracker song the gm_drum_kit notes are C3 kick, D3 snare, F#3 closed hat, A#3 open hat, C#4 crash, A3 and D4 toms. Read help('music') first.",
  { game, name: z.string(), spec: z.record(z.string(), z.any()) }, T.song_write);
tool("sound_check", "Listen to a sound effect", "Renders a sound effect and reports its notes, length, loudness and brightness.",
  { game, name: z.string() }, T.sound_check);
tool("sound_write", "Write a sound effect", "Writes sfx/<name>.json and checks it. sound: { speed (ticks a step, 1-8), tracks: [{ instrument, steps: [[pitch, volume 0-7, effect], ...] }] } where pitch 48 = C5 and effects are 0 none, 1 slide, 2 vibrato, 3 drop, 4 fade in, 5 fade out, 6 arpeggio, 7 hold.",
  { game, name: z.string(), sound: z.record(z.string(), z.any()) }, T.sound_write);
tool("room_view", "See a room", "Draws a room (rooms/<name>.lua) at its real size: tile layers, things as their sprites, paths in yellow, a dashed box one screen big. Plus its size in screens, layers and how many things of each kind.",
  { game, name: z.string(), scale: z.number().int().min(1).max(4).optional() }, T.room_view);
tool("room_write", "Build or change a room", "Creates or edits rooms/<name>.lua and returns its picture. All parts optional: size { width, height, background }; " +
  "layers [{ name, tileset (new layers), depth (bigger = further back), solid, visible, map: { legend: { '#': 3, '.': -1 }, rows: ['....###', ...], at: [col, row] }, paint: [['fill', tile], ['rect', col, row, w, h, tile], ['clear']], remove }] " +
  "(maps and paint are in tiles; -1 is empty); entities { clear, remove: [names], add: [[name, x, y, { values }], ...] } in pixels; paths { name: { points: [[x, y], ...], loop } or null to delete }.",
  {
    game, name: z.string(),
    size: z.object({ width: z.number().optional(), height: z.number().optional(), background: z.string().optional() }).optional(),
    layers: z.array(z.record(z.string(), z.any())).optional(),
    entities: z.object({ clear: z.boolean().optional(), remove: z.array(z.string()).optional(), add: z.array(z.array(z.any())).optional() }).optional(),
    paths: z.record(z.string(), z.any()).optional(),
  }, T.room_write);
tool("push", "Send to the handheld", "Packs a game and sends it to the handheld with scripts/push.sh (needs scripts/device.env and an open device connection).",
  { game }, T.push);

// Prompts: a task to start from, with the matching guide included, for any MCP client (Claude Code's skills point to the same guides).
function prompt(name, title, description, args, guides, task) {
  server.registerPrompt(name, { title, description, argsSchema: args }, (a) => {
    const text = guides.map((g) => T.help({ topic: g }).text).join("\n\n");
    return { messages: [{ role: "user", content: { type: "text", text: `${task(a)}\n\nWork with the gamestudio tools and follow this guide:\n\n${text}` } }] };
  });
}
prompt("draw-art", "Draw sprites or tiles", "Draw art for a game, readable on the handheld, fitted to the kind of game.",
  { game, what: z.string().describe("What to draw, e.g. 'a hero with idle and walk', 'a cave tileset', 'three enemies for a shooter'") },
  ["art", "sizes"], (a) => `Draw ${a.what} for the game ${a.game}. First call overview to see its console, sizes and style; draw with sprite_write and look at each result; finish by running the game.`);
prompt("design-level", "Design a level", "Design or improve a room, fitted to the kind of game and to the hero's abilities.",
  { game, room: z.string().describe("The room's name"), idea: z.string().optional().describe("What the level should be, e.g. 'a first platformer level teaching the double jump'") },
  ["levels"], (a) => `Design the room ${a.room} for the game ${a.game}${a.idea ? `: ${a.idea}` : ""}. Read the hero's entity file for its numbers first; build with room_write, look with room_view, play the route with run.`);
prompt("compose-music", "Compose music", "Write a song or sound effects that fit a mood and stay pleasant to hear.",
  { game, what: z.string().describe("e.g. 'a calm first level song', 'the boss theme', 'jump and coin sounds'") },
  ["music"], (a) => `Write ${a.what} for the game ${a.game}. Call overview to hear what the game already has; write with song_write or sound_write and act on what the check reports.`);

await server.connect(new StdioServerTransport());
