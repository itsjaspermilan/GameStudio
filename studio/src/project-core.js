// The project is its folder. There is no index file: what the tree shows is found by scanning the file list, so a file added outside the studio
// (or by git) appears at once. This module knows the folders, how names map to files and Lua module names, and the starter text of new files.

import { paletteText, starterPalette } from "./palette-core.js";

// kind: how the studio opens it ("code" = the Lua editor, otherwise the named editor). nested: names may contain folders (entities/enemies/grub,
// sprites/ui/logo is the sprite "ui/logo"): a folder is part of the name, and moving something to another folder renames it.
// layout: a scene is its code (scenes/title.lua), its layout (scenes/title.layout.lua, edited in the layout editor), or both.
export const GROUPS = [
  { key: "entities", title: "Entities", dir: "entities", ext: "lua", kind: "code", nested: true, single: "entity", tip: "Things in your game: the player, enemies, bullets. One Lua file each." },
  { key: "scenes", title: "Scenes", dir: "scenes", ext: "lua", layout: "layout.lua", kind: "code", nested: true, single: "scene", tip: "Screens and levels of your game: title, play, game over. Each has a layout (what is placed where) and code." },
  // rooms/ is the older home of levels (a scene's layout holds the same data); kept so older games open, with no way to make a new one
  { key: "rooms", title: "Rooms", dir: "rooms", ext: "lua", kind: "code", nested: true, single: "room", legacy: true, tip: "Levels made before scenes had layouts. Open one and press Make it a scene layout to move it to Scenes, where new levels go." },
  { key: "lib", title: "Code", dir: "lib", ext: "lua", kind: "code", nested: true, single: "code file", tip: "Shared code and game state you load with require." },
  { key: "sprites", title: "Sprites", dir: "sprites", ext: "json", pair: "png", kind: "sprite", nested: true, single: "sprite" },
  { key: "tilesets", title: "Tilesets", dir: "tilesets", ext: "json", pair: "png", kind: "tileset", nested: true, single: "tileset" },
  { key: "sfx", title: "Sound effects", dir: "sfx", ext: "json", kind: "sfx", nested: true, single: "sound effect" },
  { key: "music", title: "Music", dir: "music", ext: "json", kind: "music", nested: true, single: "song" },
  { key: "instruments", title: "Instruments", dir: "instruments", ext: "json", kind: "instrument", nested: true, single: "instrument" },
  { key: "sounds", title: "Samples", dir: "sounds", ext: "wav", kind: "sample", nested: true, single: "sample", importFile: true, tip: "Recorded sounds (WAV). A game plays one through an instrument: make an instrument, set its kind to Sample, then use it in a sound effect or a song." },
];
export const group = (key) => GROUPS.find((g) => g.key === key);

const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
// Names are letters, digits, - and _. Code groups may put files in folders: "enemies/grub".
export function validName(name, nested = false) {
  if (typeof name !== "string" || !name) return false;
  const parts = name.split("/");
  if (parts.length > 1 && !nested) return false;
  return parts.length <= 4 && parts.every((p) => SEGMENT.test(p) && !p.startsWith("."));
}

// The files that make up one resource (a sprite is a JSON and a PNG, a scene its code and its layout). The first is the one that opens.
export function resourceFiles(g, name) {
  const files = [`${g.dir}/${name}.${g.ext}`];
  if (g.pair) files.push(`${g.dir}/${name}.${g.pair}`);
  if (g.layout) files.push(layoutFile(name));
  return files;
}
export const layoutFile = (scene) => `scenes/${scene}.layout.lua`;
// "scenes/menus/title.layout.lua" -> "menus/title", or null
export const sceneOfLayout = (rel) => { const m = /^scenes\/(.+)\.layout\.lua$/.exec(rel || ""); return m && validName(m[1], true) ? m[1] : null; };

// What a Lua file calls this resource: "entities/enemies/grub" is required as entities.enemies.grub and spawned as "enemies.grub".
export const moduleName = (g, name) => `${g.dir}.${name.replace(/\//g, ".")}`;
export const refName = (g, name) => (g.key === "entities" || g.key === "rooms" ? name.replace(/\//g, ".") : moduleName(g, name));

// The folders of a group with names in folders ("enemies/grub"), for the tree: { folders: [{ name, path, ...node }], items: [names] } at
// every level, folders first, both in name order. `extra` are folders that have no file yet (made in the tree, kept until the game closes).
export function folderTree(names, extra = []) {
  const root = { folders: new Map(), items: [] };
  const dirOf = (path) => {
    let node = root, at = "";
    for (const part of path.split("/")) {
      at = at ? at + "/" + part : part;
      if (!node.folders.has(part)) node.folders.set(part, { name: part, path: at, folders: new Map(), items: [] });
      node = node.folders.get(part);
    }
    return node;
  };
  for (const f of extra) if (f) dirOf(f);
  for (const n of names) {
    const i = n.lastIndexOf("/");
    (i < 0 ? root : dirOf(n.slice(0, i))).items.push(n);
  }
  const done = (node) => ({ ...node, folders: [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name)).map(done), items: node.items.sort() });
  return done(root);
}

// The name a resource gets when it is dragged into a folder ("" is the top of the group): "enemies/grub" into "bosses" is "bosses/grub".
export function movedName(name, folder) {
  const base = name.split("/").pop();
  return folder ? `${folder}/${base}` : base;
}

// Sort the file list into the tree: { hasGame, groups: {key: [names]}, layouts: [scenes with a layout], code: [scenes with code],
// other: [files that belong to no group] }.
export function scanProject(files) {
  const groups = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
  const claimed = new Set(), layouts = [], code = [];
  for (const g of GROUPS) {
    const prefix = g.dir + "/", suffix = "." + g.ext;
    const names = new Set();
    for (const f of files) {
      if (!f.startsWith(prefix) || !f.endsWith(suffix)) continue;
      const scene = g.layout && sceneOfLayout(f);
      if (scene) { names.add(scene); layouts.push(scene); claimed.add(f); continue; }
      const name = f.slice(prefix.length, f.length - suffix.length);
      if (!validName(name, !!g.nested)) continue;
      names.add(name); claimed.add(f);
      if (g.layout) code.push(name);
      if (g.pair) claimed.add(`${g.dir}/${name}.${g.pair}`);
    }
    groups[g.key] = [...names].sort();
  }
  const other = files.filter((f) => !claimed.has(f) && !f.startsWith("meta/") && f !== "game.lua" && f !== "palette.json").sort();
  return { hasGame: files.includes("game.lua"), hasPalette: files.includes("palette.json"), groups, layouts: layouts.sort(), code: code.sort(), other };
}

// The console named in a game's meta/info.json (new games write it there; game.lua says the same in code). Defaults to Glow43.
export function consoleIdOf(infoJson) {
  const id = infoJson && typeof infoJson === "object" ? infoJson.console : null;
  return typeof id === "string" && /^[a-z0-9_-]{1,40}$/.test(id) ? id : "glow43";
}

// Change the console in game.lua's `console = "glow43"`. Returns the new text, or null when the file doesn't say it in the plain way (the user edits it).
export function setConsoleInGame(text, id) {
  const re = /(\bconsole\s*=\s*)(["'])[A-Za-z0-9_-]*\2/;
  return re.test(text) ? text.replace(re, `$1"${id}"`) : null;
}

// game.lua is where a game's title and console live. meta/info.json carries a copy of both for the tools that don't run Lua (push.sh, the
// MCP server, the game-list scripts); infoFromGame refreshes that copy whenever the studio sees game.lua.
const TITLE_RE = /(\btitle\s*=\s*)(["'])((?:(?!\2)[^\\\n])*)\2/;
const CONSOLE_RE = /\bconsole\s*=\s*["']([A-Za-z0-9_-]{1,40})["']/;
export const titleOfGame = (text) => { const m = TITLE_RE.exec(text || ""); return m ? m[3] : null; };
export const consoleOfGame = (text) => { const m = CONSOLE_RE.exec(text || ""); return m ? m[1] : null; };
// game.lua with its title changed, or null when it doesn't say it the plain way (then the studio asks you to change it yourself)
export function setTitleInGame(text, title) {
  const safe = String(title).replace(/[\\"\n\r]/g, "").trim();
  return TITLE_RE.test(text) ? text.replace(TITLE_RE, (_, head) => `${head}"${safe}"`) : null;
}
// meta/info.json's fields with game.lua's title and console copied in, or null when they already agree
export function infoFromGame(info, gameText) {
  const now = info && typeof info === "object" ? info : {};
  const title = titleOfGame(gameText), con = consoleOfGame(gameText);
  const next = { ...now };
  if (title !== null) next.title = title;
  if (con !== null) next.console = con;
  return next.title === now.title && next.console === now.console ? null : next;
}

// The style of the button icons a game's texts show ({a}, {start}), named in game.lua (buttons = "snes"); "gba" when it names none.
export function buttonsOfGame(text) {
  const m = /\bbuttons\s*=\s*["']([A-Za-z0-9_-]+)["']/.exec(text || "");
  return m ? m[1] : "gba";
}
// game.lua with its button style set: the buttons line changed, or a new one under the console line; null when neither is written
// the plain way (then the studio asks you to change it yourself)
export function setButtonsInGame(text, style) {
  const re = /(\bbuttons\s*=\s*)(["'])[A-Za-z0-9_-]*\2/;
  if (re.test(text)) return text.replace(re, `$1"${style}"`);
  const con = /^([ \t]*)console\s*=\s*(["'])[A-Za-z0-9_-]*\2\s*,[^\n]*\n/m.exec(text);
  if (con) {
    const at = con.index + con[0].length, line = `${con[1]}buttons = "${style}",`;
    return text.slice(0, at) + `${line}${" ".repeat(Math.max(1, 33 - line.length))}-- the look of {a}, {start} ... in texts\n` + text.slice(at);
  }
  const inline = /(\bconsole\s*=\s*(["'])[A-Za-z0-9_-]*\2\s*,)/;
  return inline.test(text) ? text.replace(inline, `$1 buttons = "${style}",`) : null;
}

const pascal = (name) => name.split(/[\/_-]/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join("") || "Thing";

export const TEMPLATES = {
  entities: (name) => `local ${pascal(name.split("/").pop())} = gs.entity{
  -- sprite = "name of a file in sprites/",
  tags = {},
}

function ${pascal(name.split("/").pop())}:create()
end

function ${pascal(name.split("/").pop())}:update(dt)
end

return ${pascal(name.split("/").pop())}
`,
  // an entity that looks like a sprite (the sprite editor's "Make an entity with it")
  spriteEntity: (name, sprite) => `local ${pascal(name.split("/").pop())} = gs.entity{
  sprite = "${sprite}",
  tags = {},
}

function ${pascal(name.split("/").pop())}:update(dt)
end

return ${pascal(name.split("/").pop())}
`,
  scenes: () => `local Scene = gs.scene{}

function Scene:enter()
end

function Scene:update(dt)
end

function Scene:draw_ui()
end

return Scene
`,
  // a scene's layout (scenes/<name>.layout.lua): see LAYOUT_TEMPLATE below
  rooms: (name, screen) => `-- A room (the older home of a level) is plain data: gs.load_layout("${name.replace(/\//g, ".")}") builds it.
return {
  width = ${screen.width}, height = ${screen.height},
  background = "#101220",
  layers = {},
  entities = {
    -- { "player", 128, 96 },
  },
}
`,
  lib: () => "local M = {}\n\nreturn M\n",
};

export const LAYOUT_COMMENT = "The scene's layout, built when it starts. Named things are fields of its code: self.<name>.";
export const LAYOUT_TEMPLATE = (screen, entities = "") => `-- ${LAYOUT_COMMENT}
return {
  width = ${screen.width}, height = ${screen.height},
  background = "#101220",
  entities = {
${entities}  },
}
`;

// Starter files of a new game. On a console with colour banks it starts with the ready-made banks (palette.json). The first scene has
// both halves, as every scene made in the studio does: the player is placed in its layout (what you can point at goes in the layout, the
// way the step-by-step tutorial teaches) and its code is where the rules go.
export function newGameFiles(title, consoleId, { banks = false, screen = { width: 256, height: 192 } } = {}) {
  const safe = String(title).replace(/[\\"]/g, "");
  return {
    "game.lua": `-- ${safe}\nreturn gs.game{\n  title = "${safe}",\n  console = "${consoleId}",\n  start = "scenes.main",\n}\n`,
    "scenes/main.layout.lua": LAYOUT_TEMPLATE(screen, `    { "player", ${Math.round(screen.width / 2)}, ${Math.round(screen.height / 2)}, {}, name = "player" },\n`),
    "scenes/main.lua": `-- The rules of this scene. Its layout places the player, so self.player is that player here.\nlocal Main = gs.scene{}\n\nfunction Main:enter()\nend\n\nfunction Main:update(dt)\nend\n\nreturn Main\n`,
    "entities/player.lua": `-- The player moves with the D-pad. Save the file while the game runs and the change shows at once.\nlocal Player = gs.entity{\n  tags = { "player" },\n  speed = 90,                     -- pixels a second\n}\n\nfunction Player:update(dt)\n  local dx, dy = gs.input.dir()\n  self.x = self.x + dx * self.speed * dt\n  self.y = self.y + dy * self.speed * dt\nend\n\nfunction Player:draw()\n  gs.draw.rect(self.x - 8, self.y - 8, 16, 16, "#ea5a4b")\nend\n\nreturn Player\n`,
    "meta/info.json": JSON.stringify({ title, console: consoleId }, null, 2) + "\n",
    ...(banks ? { "palette.json": paletteText(starterPalette()) } : {}),
  };
}

// Why a rename can't happen, or null if it can.
export function renameProblem(names, g, from, to) {
  if (!validName(to, !!g.nested)) return g.nested ? "Use letters, digits, - and _ (and / for folders)." : "Use letters, digits, - and _ for names.";
  if (to === from) return "That is already its name.";
  if ((names || []).includes(to)) return `There is already a ${g.single} called '${to}'.`;
  return null;
}
