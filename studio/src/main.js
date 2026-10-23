import { invoke, Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { basicSetup, EditorView } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { luaLanguage, luaHighlight } from "./lua-highlight.js";
import { lookChoice, setLook, scheme, onLookChange } from "./theme.js";
import { setupWindowChrome } from "./window-chrome.js";
import { luaIntel } from "./lua-editor.js";
import { createLuaServer } from "./lua-server.js";
import { createHelp } from "./help.js";
import { forceLinting } from "@codemirror/lint";
import { parseApi, buildIndex } from "./lua-intel-core.js";
import apiText from "../../engine/api/gs.d.lua?raw";
import { createSpriteEditor } from "./sprite-editor.js";
import { createSfxEditor } from "./sfx-editor.js";
import { createMusicEditor } from "./music-editor.js";
import { createInstrumentEditor } from "./instrument-editor.js";
import { newSfx, INSTRUMENT_PRESETS, newSong, serializeSong, renderSfxWith, renderSongDesc, instrumentPreviewDesc, namedNotePreviewDesc, setBuiltinInstruments, builtinDef, isBuiltinName, normalizeInstrument } from "./audio-core.js";
import builtinInstrumentsDoc from "../../engine/instruments.json";
setBuiltinInstruments(builtinInstrumentsDoc);
import { encodeSpritePng, decodeSpritePng } from "./sprite-io.js";
import { BUILTIN_CONSOLES, allConsoles, budgetStatus, formatKB, consoleFor, duplicateConsole, paletteOf, parseCustomConsoles, screenText, uniqueId, consoleFileOf, consoleFileText, resolveConsole } from "./consoles.js";
import { createConsoleEditor } from "./console-editor.js";
import { parseWav, sampleName, fitWav } from "./wav.js";
import { renameReferences, countCodeMentions, renameInCode, renameSceneFields } from "./rename-core.js";
import { checkProject } from "./console-check.js";
import { budgetRows, consoleSummary, parseStatsLine } from "./budget-core.js";
import { GENRES, BOX_ART_PATH, normalizeInfo, defaultTitle, charsLeft, isPng, pngSize, boxArtScale, PICTURES, decodeBmp } from "./info-core.js";
import { createSprite, createTileset, normalizeAnimations, toJSON, tilesetToJSON, offPaletteCount, usedColors, SIZE_GUIDE } from "./sprite-core.js";
import { FIRST_STEPS, parseSteps, stringifySteps, showSteps } from "./steps-core.js";
import { parseRoom, serializeRoom } from "./room-core.js";
import { findInFiles, replaceInText, outline, tidyLua, applyEdits } from "./search-core.js";
import { SPEEDS, parseInspectLine, commandText, classRows, fmtMs } from "./inspector-core.js";
import { createRoomEditor, PLACE } from "./room-editor.js";
import { GROUPS, group, validName, folderTree, movedName, resourceFiles, layoutFile, scanProject, consoleIdOf, setConsoleInGame, TEMPLATES, LAYOUT_TEMPLATE, LAYOUT_COMMENT, newGameFiles, renameProblem } from "./project-core.js";
import { setupPanels } from "./panels.js";
import { createPaletteEditor } from "./palette-editor.js";
import { normalizePalette, paletteText, bankRgb, tilesOutsideBanks, bankLimits, checkPalette } from "./palette-core.js";
import { createPlayPanel } from "./play-panel.js";
import "./style.css";

const $ = (id) => document.getElementById(id);
const TEXT_EXT = /\.(lua|txt|md|json)$/i;
const VIEWS = ["code", "sprite", "tileset", "sfx", "music", "instrument"];

const state = {
  live: null, logTab: "log", tabs: [], games: [], customConsoles: [], cartBytes: 0, cart: null, files: [], scan: null, info: null, running: false, busy: false, pushing: false,
  view: "code",       // "code" | "sprite" | "tileset" | "sfx" | "music" | "instrument"
  file: null,         // the file open in the code editor
  name: null,         // the resource open in the editor of `view` (not for code)
  dirty: false,       // the code editor has unsaved changes
  collapsed: {},      // resource tree groups the user folded (true), and folders ("entities/enemies") the user opened (false)
  scenePart: {},      // which half of each scene ("layout" or "code") its tab opens on
  newFolders: {},     // folders made in the tree that have no file yet: { group key: [paths] }, forgotten when the game closes
};
const luaApi = parseApi(apiText);
let luaIndex = buildIndex({}, {});
let help = null; // the Help window
let luaServer = null; // the Lua language server (optional), created at boot
let play = null; // the Play panel (the game inside the studio), created at boot
const luaTexts = {}; // every Lua file of the open game, for completion and warnings
let consoleEditor;
let view, spriteEditor, tilesetEditor, sfxEditor, musicEditor, instrumentEditor, roomEditor, paletteEditor;

// ---------- output log ----------
function log(text, cls = "") {
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = text;
  $("log").appendChild(line);
  $("log").scrollTop = $("log").scrollHeight;
  if ($("app").classList.contains("log-hidden")) $("log-new").hidden = false; // something arrived while the output was tucked away
}
const info = (t) => log(t, "info");
const fail = (e) => log(String(e), "err");

// ---------- code editor ----------
let loadingDoc = false;
// ---------- look (theme.js: the system's colours and light or dark mode) ----------
// The code editor takes its colours from the same CSS variables as everything else; only the syntax colours differ by mode.
const editorTheme = new Compartment();
const codeLook = (s) => [
  EditorView.theme({
    "&": { backgroundColor: "var(--bg)", color: "var(--text)" },
    ".cm-content": { caretColor: "var(--accent)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
    ".cm-gutters": { backgroundColor: "var(--panel)", color: "var(--muted)", borderRight: "1px solid var(--border)" },
    ".cm-activeLine": { backgroundColor: "rgba(var(--ink), 0.05)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(var(--ink), 0.07)", color: "var(--text)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)" },
    ".cm-selectionMatch": { backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)" },
    "&.cm-focused .cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--ok) 25%, transparent)", outline: "none" },
    ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--warn) 30%, transparent)" },
    ".cm-tooltip": { backgroundColor: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "var(--radius)" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent)", color: "var(--accent-text)" },
    ".cm-panels": { backgroundColor: "var(--panel)", color: "var(--text)" },
  }, { dark: s === "dark" }),
  luaHighlight, // its colours follow the look by themselves (CSS variables)
];
// Canvas editors and both code panes follow a change of look at once.
onLookChange((s) => {
  if (view) view.dispatch({ effects: editorTheme.reconfigure(codeLook(s)) });
  if (split.view) split.view.dispatch({ effects: split.theme.reconfigure(codeLook(s)) });
  for (const e of [spriteEditor, tilesetEditor, roomEditor, sfxEditor, musicEditor, instrumentEditor]) if (e && e.redraw) e.redraw();
});

function makeEditor() {
  view = new EditorView({
    parent: $("editor"),
    state: EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
        EditorView.lineWrapping, // long lines wrap at the window's edge instead of scrolling sideways
        keymap.of([indentWithTab]),
        luaLanguage,
        editorTheme.of(codeLook(scheme())),
        ...luaIntel({
          getApi: () => luaApi, getIndex: () => luaIndex, getFile: () => (state.view === "code" ? state.file : null),
          get server() { return luaServer; },
          openLocation: (rel, line, character) => openFile(rel, false, { line, character }),
          openResource: (g, name) => openers[group(g).kind](group(g), name),
          openHelp: (page, anchor) => help.open(page, anchor),
          rename: (v, pos) => renameAt(v, pos),
          references: (v, pos) => referencesAt(v, pos),
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !loadingDoc) {
            state.dirty = true; renderTitle();
            if (luaServer && state.file && state.file.endsWith(".lua")) luaServer.change(state.file, u.state.doc.toString());
          }
        }),
      ],
    }),
  });
}
function setDoc(text) {
  loadingDoc = true;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  loadingDoc = false;
  state.dirty = false;
}

// The editors other than the code editor, by view. Each has the element that holds it and the folder its files live in.
const editors = () => ({ sprite: spriteEditor, tileset: tilesetEditor, sfx: sfxEditor, music: musicEditor, instrument: instrumentEditor, room: roomEditor, palette: paletteEditor });
const PANES = { sprite: "sprite-editor", tileset: "tileset-editor", sfx: "sfx-editor", music: "music-editor", instrument: "instrument-editor", room: "room-editor", palette: "palette-editor" };

function showView(which) {
  state.view = which;
  $("code-area").hidden = which !== "code";
  for (const [v, id] of Object.entries(PANES)) $(id).hidden = which !== v;
  if (which !== "sfx" && sfxEditor) sfxEditor.stop(); // sounds stop when you leave their editor
  if (which !== "music" && musicEditor) musicEditor.stop();
  if (which !== "instrument" && instrumentEditor) instrumentEditor.stop();
  if (which === "sprite") requestAnimationFrame(() => spriteEditor.refit());
  if (which === "tileset") requestAnimationFrame(() => tilesetEditor.refit());
  if (which === "room") requestAnimationFrame(() => roomEditor.refit());
}

// Forget what is open (after a rename, a delete or closing the game).
function clearOpen() {
  if (luaServer && state.file) luaServer.close(state.file);
  state.file = null; state.name = null; state.dirty = false;
  setDoc(""); showView("code");
}

// ---------- the project's console ----------
// A game names its console in game.lua (and meta/info.json, which the tools read). For one of your own consoles the game also carries a copy
// (consoles/<id>.json): that is what the runtime reads, and what the studio uses when the console is not among yours on this machine.
const activeConsole = () => resolveConsole(consoleIdOf(state.info), state.customConsoles, state.carriedConsole);
// Write the game's copy of its custom console when it is missing or out of date (before running, packing, sending, or after a change).
async function syncConsoleCopy() {
  const c = activeConsole(), rel = consoleFileOf(c.id);
  if (!rel || !(state.customConsoles || []).some((x) => x.id === c.id)) return;
  const text = consoleFileText(c);
  if (state.carriedConsole === text) return;
  await invoke("write_file", { cart: state.cart, rel, content: text });
  state.carriedConsole = text;
  if (!state.files.includes(rel)) await refreshFiles();
}
const projectLike = () => ({ console: activeConsole() });
const conInfo = () => consoleFor(projectLike());

// ---------- rendering ----------
const currentDirty = () => (state.view === "code" ? state.dirty : !!state.name && editors()[state.view].isDirty());
const isOpen = (g, name) => (g.key === "rooms" ? state.view === "room" && state.layoutKind === "room" && state.name === name
  : g.key === "scenes" ? (state.view === "room" && state.layoutKind === "layout" && state.name === name) || (state.view === "code" && state.file === resourceFiles(g, name)[0])
  : g.kind === "code" ? state.view === "code" && state.file === resourceFiles(g, name)[0] : state.view === g.kind && state.name === name);

function renderTitle() {
  let title = "No file open";
  if (state.view === "code" && state.file) title = `${state.cart} / ${state.file}`;
  else if (state.view === "room" && state.name) title = state.layoutKind === "layout" ? `${state.cart} / scenes / ${state.name}  ·  layout` : `${state.cart} / rooms / ${state.name}`;
  else if (state.view === "palette") title = `${state.cart} / Colours (palette.json)`;
  else if (state.view !== "code" && state.name) title = `${state.cart} / ${GROUPS.find((g) => g.kind === state.view).dir} / ${state.name}`;
  $("editor-title").textContent = title + (currentDirty() ? "  ●" : "");
  noteTab(); renderTabs(); renderCodeTools();
}

function listItem(text, { active, disabled, onclick } = {}) {
  const li = document.createElement("li");
  li.textContent = text;
  if (disabled) li.className = "disabled"; else if (active) li.className = "active";
  if (onclick && !disabled) li.onclick = onclick;
  return li;
}

function render() {
  const open = !!state.cart;
  $("app").classList.toggle("welcome-mode", !open);
  $("project-title").textContent = state.cart || "";
  const sizeBox = $("project-size");
  sizeBox.hidden = !(state.cart && state.scan && state.scan.hasGame);
  if (!sizeBox.hidden) {
    const budget = (conInfo().budgets || {}).cart_kb, st = budgetStatus(state.cartBytes / 1024, budget);
    sizeBox.querySelector(".size-text").textContent = `Size ${formatKB(state.cartBytes)}${budget ? ` of ${budget} KB` : ""}${st.level === "over" ? "  (over budget)" : ""}`;
    const fill = sizeBox.querySelector(".meter-fill");
    fill.style.width = `${Math.min(100, st.ratio * 100)}%`; fill.dataset.level = st.level;
    sizeBox.querySelector(".meter").hidden = !budget;
  }
  const isGame = !!(state.scan && state.scan.hasGame);
  $("project-kind").textContent = isGame ? `Game · ${conInfo().name} ${screenText(conInfo())}` : "Old format: no game.lua, so it cannot run";
  $("btn-console").hidden = $("btn-info").hidden = !isGame;
  if (!open) renderWelcome();

  renderTree();

  const files = $("files"); files.replaceChildren();
  for (const f of (state.scan ? state.scan.other : [])) {
    files.appendChild(listItem(f, { active: state.view === "code" && f === state.file, disabled: !TEXT_EXT.test(f), onclick: () => openFile(f) }));
  }
  const gameFile = $("game-file");
  gameFile.hidden = !isGame;
  gameFile.className = "tree-item game-file" + (state.view === "code" && state.file === "game.lua" ? " active" : "");
  const palFile = $("palette-file");
  palFile.hidden = !isGame || paletteOf(conInfo()).mode !== "banks";
  palFile.className = "tree-item game-file" + (state.view === "palette" ? " active" : "");
  palFile.querySelector(".name").textContent = state.palette ? "Colours" : "Colours (classic)";
  $("btn-run").disabled = !state.cart || state.busy;
  $("btn-run").textContent = state.running ? "↻ Restart" : "▶ Run";
  $("btn-stop").disabled = !state.running && !state.pushing;
  $("btn-pack").disabled = !state.cart || state.busy;
  $("btn-push").disabled = !state.cart || state.busy;
  $("btn-save").disabled = !(state.view === "code" ? state.file : state.name);
  $("btn-new-file").disabled = !state.cart;
  $("status").textContent = state.busy ? "working…" : state.running ? "preview running" : "";
  renderTitle();
}

// ---------- actions ----------
async function run(label, fn) {
  if (state.busy) return;
  state.busy = true; render();
  try { await fn(); } catch (e) { fail(e); }
  state.busy = false; render();
}

async function refreshGames() { state.games = await invoke("list_games"); }

const readJson = (rel) => invoke("read_file", { cart: state.cart, rel }).then(JSON.parse);
const writeJson = (rel, obj) => invoke("write_file", { cart: state.cart, rel, content: JSON.stringify(obj, null, 2) + "\n" });

// The file list is the project: scan it, read meta/info.json, and tell the editors that use the instrument list.
async function refreshFiles() {
  state.files = state.cart ? await invoke("list_files", { cart: state.cart }) : [];
  state.scan = state.cart ? scanProject(state.files) : null;
  state.info = null; state.carriedConsole = null;
  if (state.files.includes("meta/info.json")) {
    try { state.info = await readJson("meta/info.json"); } catch (e) { fail("meta/info.json: " + e); }
  }
  state.palette = null;
  if (state.files.includes("palette.json")) {
    try { state.palette = normalizePalette(await readJson("palette.json")); } catch (e) { fail("palette.json: " + e); }
  }
  if (spriteEditor) spriteEditor.refreshPalette();
  if (tilesetEditor) tilesetEditor.refreshPalette();
  const carried = consoleFileOf(consoleIdOf(state.info));
  if (carried && state.files.includes(carried)) {
    try { state.carriedConsole = await invoke("read_file", { cart: state.cart, rel: carried }); } catch { /* the console falls back to Dot */ }
  }
  refreshSize();
  await refreshLuaIndex();
  refreshHandheld();
  await loadInstrumentDefs();
  if (sfxEditor) sfxEditor.refreshInstruments(); // the instrument lists follow the project
  if (musicEditor) musicEditor.refresh();
  if (instrumentEditor) instrumentEditor.refresh();
}

// Completion and warnings know the game's files: reread the Lua ones (they are small) and rebuild the index.
async function refreshLuaIndex() {
  for (const k of Object.keys(luaTexts)) delete luaTexts[k];
  if (state.scan) for (const f of state.files) if (f.endsWith(".lua")) { try { luaTexts[f] = await invoke("read_file", { cart: state.cart, rel: f }); } catch { /* skip */ } }
  luaIndex = buildIndex(state.scan ? state.scan.groups : {}, luaTexts);
  if (luaServer) luaServer.files(Object.keys(luaTexts));
}

// Recently opened games, newest first (a per-viewer convenience, so storage failures are ignored).
// ---------- first steps (a checklist for someone new, on the welcome screen) ----------
function stepsProgress() { try { return parseSteps(localStorage.getItem("gs.steps")); } catch { return parseSteps(null); } }
function stepDone(id) {
  const p = stepsProgress();
  if (p.done.has(id)) return;
  p.done.add(id);
  try { localStorage.setItem("gs.steps", stringifySteps(p)); } catch { /* the checklist is only a nudge */ }
}
function renderFirstSteps() {
  const box = $("first-steps"), p = stepsProgress();
  box.hidden = !showSteps(p);
  if (box.hidden) return;
  box.replaceChildren();
  const head = document.createElement("div"); head.className = "fs-head";
  const h = document.createElement("h2"); h.textContent = `First steps  ${p.done.size} of ${FIRST_STEPS.length}`;
  const hide = document.createElement("button"); hide.className = "small"; hide.textContent = "Hide";
  hide.onclick = () => { p.hidden = true; try { localStorage.setItem("gs.steps", stringifySteps(p)); } catch { /* ignore */ } renderFirstSteps(); };
  head.append(h, hide); box.appendChild(head);
  for (const s of FIRST_STEPS) {
    const row = document.createElement("div"); row.className = "fs-step" + (p.done.has(s.id) ? " done" : ""); row.title = s.tip;
    row.textContent = (p.done.has(s.id) ? "✓ " : "○ ") + s.text;
    if (s.id === "tutorial") row.onclick = () => help.open("first-game");
    box.appendChild(row);
  }
}

function recents() {
  try { return JSON.parse(localStorage.getItem("gs.recent") || "[]"); } catch { return []; }
}
function noteRecent(name) {
  try { localStorage.setItem("gs.recent", JSON.stringify([name, ...recents().filter((n) => n !== name)].slice(0, 20))); } catch { /* ignore */ }
}

// Only one game is open at a time: opening another closes the current one first.
async function openGame(name) {
  if (state.cart === name) return;
  if (state.cart) await closeProject();
  state.cart = name; clearOpen();
  noteRecent(name);
  await refreshFiles();
  render();
  // not awaited: the editor works at once and gets smarter when the server is ready
  if (luaServer) luaServer.start(name).then((ready) => {
    if (!ready || state.cart !== name) return;
    luaServer.files(Object.keys(luaTexts));
    if (state.view === "code" && state.file && state.file.endsWith(".lua")) luaServer.open(state.file, view.state.doc.toString());
  });
  const first = state.scan.hasGame ? "game.lua" : state.files.includes("main.lua") ? "main.lua" : null;
  if (first) await openFile(first, true);
}

async function closeProject() {
  await confirmDiscard();
  if (state.running) await invoke("stop_preview").catch(fail);
  if (split.file) await closeSplit();
  state.cart = null; state.files = []; state.scan = null; state.info = null; state.tabs = []; state.newFolders = {};
  showPlay(false);
  if ($("find-dialog").open) $("find-dialog").close();
  if (luaServer) await luaServer.stop();
  clearOpen();
  await refreshGames();
  render();
}

function renderWelcome() {
  const ul = $("games"); ul.replaceChildren();
  const order = recents();
  const games = [...state.games].sort((a, b) => {
    const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.name.localeCompare(b.name);
  });
  if (!games.length) {
    const li = document.createElement("li"); li.className = "tree-empty"; li.textContent = "No games yet. Create one above.";
    ul.appendChild(li);
  }
  for (const g of games) {
    const li = document.createElement("li"); li.className = "game-item";
    const n = document.createElement("span"); n.textContent = g.name;
    const k = document.createElement("span"); k.className = "game-kind"; k.textContent = g.kind === "game" ? "Game" : "Old format";
    if (g.kind !== "game") k.title = "This folder has no game.lua, so it will not run. Move its code into a scene (see Help).";
    li.append(n, k);
    li.onclick = () => openGame(g.name);
    ul.appendChild(li);
  }
  renderConsoleList();
  renderFirstSteps();
}

// ---------- consoles ----------
async function refreshConsoles() {
  const r = parseCustomConsoles(await invoke("list_consoles"));
  state.customConsoles = r.consoles;
  r.problems.forEach((p) => info("Console skipped: " + p));
}
const takenConsoleIds = () => allConsoles(state.customConsoles).map((c) => c.id);

async function saveConsole(c) {
  await invoke("save_console", { id: c.id, content: JSON.stringify(c, null, 2) });
  await refreshConsoles();
  if (state.cart) await syncConsoleCopy(); // the open game keeps its copy of this console current
}

// Make a new custom console from `base`, then let the user shape it.
async function newConsoleFrom(base, name) {
  const draft = duplicateConsole(base, uniqueId(name, takenConsoleIds()), name);
  draft.description = `Based on ${base.name}.`;
  const result = await consoleEditor.edit(draft, { isNew: true });
  if (result) { await saveConsole(result); render(); }
}

function renderConsoleList() {
  const ul = $("consoles"); ul.replaceChildren();
  for (const c of allConsoles(state.customConsoles)) {
    const custom = state.customConsoles.includes(c);
    const li = document.createElement("li"); li.className = "game-item console-item";
    const box = document.createElement("div");
    const name = document.createElement("span"); name.textContent = `${c.name}  ${screenText(c)}`;
    const desc = document.createElement("div"); desc.className = "game-kind"; desc.textContent = (custom ? "Custom. " : "Built in. ") + (c.description || "");
    box.append(name, desc);
    const tools = document.createElement("span"); tools.className = "console-tools";
    const mk = (text, title, fn) => { const b = document.createElement("button"); b.className = "small"; b.textContent = text; b.title = title; b.onclick = (e) => { e.stopPropagation(); fn(); }; tools.appendChild(b); return b; };
    mk("Duplicate", "Make a copy you can change", () => newConsoleFrom(c, `${c.name} copy`));
    if (custom) {
      mk("Edit", "Change this console.", async () => {
        const result = await consoleEditor.edit(c, { isNew: false });
        if (result) { await saveConsole(result); render(); }
      });
      const del = mk("Delete", "Delete this console", () => {
        if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "Delete?"; setTimeout(() => { del.dataset.armed = ""; del.textContent = "Delete"; }, 2500); return; }
        run("delete console", async () => { await invoke("delete_console", { id: c.id }); await refreshConsoles(); });
      });
    }
    li.append(box, tools);
    ul.appendChild(li);
  }
}
$("btn-new-console").onclick = () => newConsoleFrom(BUILTIN_CONSOLES[0], "My console");

// ---------- changing a game's console ----------
// Gather what the game uses, so checkProject can say what no longer fits the target console (art sizes and palette; rooms are Lua now).
// With colour banks (and a palette.json), a sprite is measured against its own bank and a tileset tile by tile against its banks; a game on a
// banks console without palette.json is measured against the classic colours, like a fixed palette.
async function projectFacts(target) {
  const facts = { rooms: {}, sprites: {}, tilesets: {} };
  const tp = target.palette || {}, banks = tp.mode === "banks" && state.palette;
  const classic = tp.mode === "fixed" || (tp.mode === "banks" && !state.palette) ? (tp.colors || []) : null;
  const rgbList = classic ? classic.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))) : null;
  if (banks) facts.palette = { sprites: state.palette.sprites.length, tiles: state.palette.tiles.length, problems: checkPalette(state.palette, target) };
  const measure = async (rel, frames, m, tile) => {
    const img = await decodeSpritePng(await invoke("read_binary", { cart: state.cart, rel }), frames);
    const sp = { w: img.w, h: img.h, frames: img.frames };
    const out = { w: img.w, h: img.h, offPalette: rgbList ? offPaletteCount(sp, rgbList) : 0, colors: usedColors(sp).size };
    if (banks && !tile) {
      const b = m.bank && state.palette.sprites.find((x) => x.name === m.bank);
      if (!b) out.noBank = m.bank || true; else out.offBank = offPaletteCount(sp, bankRgb(b));
    }
    if (banks && tile) {
      const list = (m.banks || []).map((n) => state.palette.tiles.find((x) => x.name === n)).filter(Boolean);
      if (!list.length) out.noBank = true; else out.tilesOff = tilesOutsideBanks({ ...sp, tile }, list).length;
    }
    return out;
  };
  for (const n of state.scan.groups.sprites) {
    try { const m = await readJson(`sprites/${n}.json`); facts.sprites[n] = { ...(await measure(m.image || `sprites/${n}.png`, m.frames || 1, m)), frames: m.frames || 1 }; } catch { /* skip */ }
  }
  for (const n of state.scan.groups.tilesets) {
    try { const m = await readJson(`tilesets/${n}.json`), tile = [m.tile_w || 16, m.tile_h || 16]; facts.tilesets[n] = { ...(await measure(m.image || `tilesets/${n}.png`, 1, m, tile)), tile_w: tile[0], tile_h: tile[1] }; } catch { /* skip */ }
  }
  return facts;
}

let changeTarget = null;
async function showChangeReport() {
  const box = $("cc-report"), id = $("cc-select").value;
  changeTarget = allConsoles(state.customConsoles).find((c) => c.id === id);
  box.textContent = "Checking…";
  $("cc-apply").disabled = true;
  try {
    const items = checkProject(conInfo(), changeTarget, await projectFacts(changeTarget));
    box.replaceChildren();
    if (!items.length) box.textContent = "Everything in this game fits this console.";
    for (const it of items) {
      const d = document.createElement("div"); d.className = "cc-item " + it.level; d.textContent = (it.level === "problem" ? "⚠ " : "• ") + it.text;
      box.appendChild(d);
    }
    $("cc-apply").disabled = changeTarget.id === conInfo().id;
  } catch (e) { box.textContent = String(e); }
}
$("btn-console").onclick = () => {
  const sel = $("cc-select"), cur = conInfo();
  sel.replaceChildren();
  const choices = allConsoles(state.customConsoles);
  for (const c of choices) sel.appendChild(new Option(`${c.name}  ${screenText(c)}${c.id === cur.id ? "  (current)" : ""}`, c.id));
  sel.value = choices.some((c) => c.id === cur.id) ? cur.id : BUILTIN_CONSOLES[0].id;
  $("console-change").showModal();
  showChangeReport();
};
$("cc-select").onchange = showChangeReport;
$("cc-cancel").onclick = () => $("console-change").close();
$("cc-apply").onclick = () => run("change console", async () => {
  const target = changeTarget; if (!target) return;
  $("console-change").close();
  await confirmDiscard();
  const next = setConsoleInGame(await invoke("read_file", { cart: state.cart, rel: "game.lua" }), target.id);
  if (next === null) throw new Error(`game.lua does not say console = "${target.id}" in the plain way, so it was left alone. Change the console line there yourself.`);
  await invoke("write_file", { cart: state.cart, rel: "game.lua", content: next });
  await writeJson("meta/info.json", { ...(state.info || {}), console: target.id });
  await refreshFiles();
  await syncConsoleCopy();
  if (state.file === "game.lua") setDoc(next);
  info(`This game now uses the ${target.name} console.`);
  spriteEditor.getSprite() && spriteEditor.load(spriteEditor.getSprite());
});

// ---------- files ----------
async function openFile(rel, skipConfirm, at) {
  if (!skipConfirm && !(await confirmDiscard())) return;
  if (split.file === rel) await closeSplit(); // its edits reach the disk before this side reads the file
  try {
    if (state.file && state.file !== rel && luaServer) luaServer.close(state.file);
    const text = rel === state.file && state.view === "code" && at ? view.state.doc.toString() : await invoke("read_file", { cart: state.cart, rel });
    state.file = rel; state.name = null; if (text !== view.state.doc.toString() || state.view !== "code") setDoc(text);
    showView("code");
    if (luaServer && rel.endsWith(".lua")) luaServer.open(rel, text);
    if (at) {
      const line = view.state.doc.line(Math.min(view.state.doc.lines, at.line + 1));
      const head = Math.min(line.to, line.from + at.character);
      view.dispatch({ selection: { anchor: head }, effects: EditorView.scrollIntoView(head, { y: "center" }) });
      view.focus();
    }
  } catch (e) { fail(e); }
  render();
}

async function confirmDiscard() {
  // Simplest safe behaviour: never lose edits when switching, so save first.
  if (currentDirty()) await save();
  return true;
}

// The cartridge's size grows as you work, so it is measured again after every save and change to the file list.
async function refreshSize() {
  if (!state.cart) return;
  try { state.cartBytes = await invoke("cart_size", { cart: state.cart }); renderTitle(); render(); } catch { /* the meter just keeps its last value */ }
}
async function save() { await saveCurrent(); await saveSplit(); await refreshSize(); }

// sound effects, songs and instruments are plain JSON written straight from their editor
const JSON_VIEWS = { sfx: "sfx", music: "music", instrument: "instruments" };

async function saveCurrent() {
  if (state.view === "room") return saveRoom();
  if (state.view === "sprite") return saveSprite();
  if (state.view === "tileset") return saveTileset();
  if (state.view === "palette") return savePalette();
  if (JSON_VIEWS[state.view]) return saveJsonResource(state.view);
  if (!state.file) return;
  try {
    await invoke("write_file", { cart: state.cart, rel: state.file, content: view.state.doc.toString() });
    state.dirty = false; renderTitle();
    if (state.running && state.file.endsWith(".lua")) stepDone("live");
    if (state.file.endsWith(".lua")) {
      luaTexts[state.file] = view.state.doc.toString(); luaIndex = buildIndex(state.scan ? state.scan.groups : {}, luaTexts);
      if (luaServer) luaServer.saved(state.file);
    }
  } catch (e) { fail(e); }
}

// ---------- game info (title, description and pictures for the device's game list) ----------
// pending[key]: undefined = leave the stored picture alone, "" = remove it, otherwise the base64 PNG chosen in this dialog.
let pending = {}, picKey = "box_art";
const picOf = (key) => PICTURES.find((p) => p.key === key);

async function currentPicture(key) {
  if (pending[key] !== undefined) return pending[key];
  const p = picOf(key);
  if (key === "box_art" ? !normalizeInfo(state.info).box_art : !state.files.includes(p.path)) return "";
  try { return await invoke("read_binary", { cart: state.cart, rel: p.path }); } catch { return ""; }
}

async function showInfoArt() {
  const bar = $("info-pics"); bar.replaceChildren();
  for (const p of PICTURES) {
    const b = document.createElement("button"); b.className = "small" + (p.key === picKey ? " active" : ""); b.textContent = p.label; b.title = p.tip;
    b.onclick = () => { picKey = p.key; showInfoArt(); };
    bar.appendChild(b);
  }
  const b64 = await currentPicture(picKey), img = $("info-art");
  img.hidden = !b64; $("info-art-none").hidden = !!b64; img.alt = picOf(picKey).label;
  if (b64) {
    img.src = "data:image/png;base64," + b64;
    const size = pngSize(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    $("info-art-size").textContent = size ? `${size.width} × ${size.height} pixels` : "";
  } else $("info-art-size").textContent = picOf(picKey).tip;
  $("info-clear").disabled = !b64;
  $("info-shot-row").hidden = picKey !== "screenshot";
}

// The first frame of a sprite, enlarged by a whole number so the pixels stay sharp when the device scales it.
async function spriteAsBoxArt(name) {
  const meta = await readJson(`sprites/${name}.json`);
  const b64 = await invoke("read_binary", { cart: state.cart, rel: meta.image || `sprites/${name}.png` });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("could not read that sprite")); i.src = "data:image/png;base64," + b64; });
  const frames = Math.max(1, meta.frames || 1), fw = Math.floor(img.width / frames), k = boxArtScale(img.height);
  const c = document.createElement("canvas"); c.width = fw * k; c.height = img.height * k;
  const ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, fw, img.height, 0, 0, c.width, c.height);
  return c.toDataURL("image/png").split(",")[1];
}

// The game's frame (a BMP from the runtime) as a PNG, enlarged by a whole number to about 640 wide so the list shows sharp pixels.
function bmpToPng(b64) {
  const f = decodeBmp(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  const src = document.createElement("canvas"); src.width = f.width; src.height = f.height;
  src.getContext("2d").putImageData(new ImageData(f.data, f.width, f.height), 0, 0);
  const k = Math.max(1, Math.floor(640 / f.width));
  const c = document.createElement("canvas"); c.width = f.width * k; c.height = f.height * k;
  const ctx = c.getContext("2d"); ctx.imageSmoothingEnabled = false; ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/png").split(",")[1];
}

$("btn-info").onclick = async () => {
  if (!state.scan) return;
  const i = normalizeInfo(state.info);
  const sprites = state.scan.groups.sprites;
  pending = {}; picKey = "box_art";
  $("info-title").value = i.title; $("info-title").placeholder = defaultTitle(state.cart);
  $("info-desc").value = i.description; $("info-dev").value = i.developer;
  const g = $("info-genre"); g.replaceChildren(new Option("(none)", ""), ...GENRES.map((x) => new Option(x, x))); g.value = i.genre;
  const p = $("info-players"); p.replaceChildren(...[1, 2, 3, 4].map((n) => new Option(String(n), String(n)))); p.value = String(i.players);
  $("info-sprite").replaceChildren(...sprites.map((n) => new Option(n, n)));
  $("info-sprite").hidden = $("info-use-sprite").hidden = !sprites.length;
  const left = () => { $("info-left").textContent = `${charsLeft($("info-desc").value)} characters left`; };
  $("info-desc").oninput = left; left();
  await showInfoArt();
  $("info-dialog").showModal();
};
$("info-use-sprite").onclick = () => run("picture", async () => { pending[picKey] = await spriteAsBoxArt($("info-sprite").value); await showInfoArt(); });
$("info-shot").onclick = () => run("screenshot", async () => {
  await save();
  $("info-shot").disabled = true; $("info-shot").textContent = "Running the game…";
  try { pending.screenshot = bmpToPng(await invoke("take_screenshot", { cart: state.cart, seconds: Number($("info-shot-secs").value) || 2 })); }
  finally { $("info-shot").disabled = false; $("info-shot").textContent = "Take a screenshot"; }
  await showInfoArt();
});
$("info-import").onclick = () => $("info-png").click();
$("info-png").onchange = (e) => {
  const file = e.target.files && e.target.files[0]; e.target.value = "";
  if (!file) return;
  run("picture", async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isPng(bytes)) throw new Error("That file is not a PNG picture. Export it as PNG first.");
    if (bytes.length > 2 * 1024 * 1024) throw new Error("That picture is bigger than 2 MB. Shrink it first; the device only shows it small.");
    pending[picKey] = toBase64(bytes); await showInfoArt();
  });
};
$("info-clear").onclick = async () => { pending[picKey] = ""; await showInfoArt(); };
$("info-cancel").onclick = () => $("info-dialog").close();
$("info-save").onclick = () => run("game info", async () => {
  const fields = normalizeInfo({
    title: $("info-title").value, description: $("info-desc").value, developer: $("info-dev").value,
    genre: $("info-genre").value, players: $("info-players").value, box_art: BOX_ART_PATH,
  });
  const hadArt = !!normalizeInfo(state.info).box_art;
  for (const p of PICTURES) {
    const v = pending[p.key];
    if (v === "") { try { await invoke("delete_file", { cart: state.cart, rel: p.path }); } catch { /* it was not there */ } }
    else if (v) await invoke("write_binary", { cart: state.cart, rel: p.path, data: v });
  }
  if (pending.box_art === "" || (!pending.box_art && !hadArt)) fields.box_art = "";
  await writeJson("meta/info.json", { ...(state.info || {}), ...fields });
  $("info-dialog").close();
  await refreshFiles();
  info("Saved the game info. It goes to the device with the next “Send to device”.");
});

// ---------- project resources (the tree) ----------
// What each group does: how a new one starts and how it opens. Everything else about a group is in project-core.js.
const creators = {
  entities: (g, n) => createCode(g, n), scenes: (g, n) => createScene(g, n), rooms: (g, n) => createCode(g, n), lib: (g, n) => createCode(g, n),
  sprites: (g, n) => createNewSprite(n), tilesets: (g, n) => createNewTileset(n),
  sfx: (g, n) => createJson(g, n, newSfx()),
  instruments: (g, n) => isBuiltinName(n) ? Promise.reject(new Error(`'${n}' is the name of a built-in instrument: pick another.`)) : createJson(g, n, INSTRUMENT_PRESETS["Bright lead"]()),
  music: (g, n) => createJson(g, n, serializeSong(newSong({ tracks: conInfo().audio?.music_tracks || 4 }))),
};
const openers = {
  code: (g, n) => (g.key === "rooms" ? openRoom(n) : g.key === "scenes" ? openScene(n) : openFile(resourceFiles(g, n)[0])),
  sprite: (g, n) => openSprite(n), tileset: (g, n) => openTileset(n),
  sfx: (g, n) => openJsonResource(g, n), music: (g, n) => openJsonResource(g, n), instrument: (g, n) => openJsonResource(g, n),
  sample: (g, n) => previewSample(n),
};

function checkNew(g, name, taken) {
  if (!validName(name, !!g.nested)) throw new Error(g.nested ? "Use letters, digits, - and _ for names (and / for folders)." : "Use letters, digits, - and _ for names.");
  if (taken.includes(name)) throw new Error(`There is already a ${g.single} called '${name}'.`);
}

async function createCode(g, name) {
  checkNew(g, name, state.scan.groups[g.key]);
  await invoke("write_file", { cart: state.cart, rel: resourceFiles(g, name)[0], content: TEMPLATES[g.key](name, conInfo().screen) });
  await refreshFiles();
  if (g.key === "rooms") await openRoom(name, true); else await openFile(resourceFiles(g, name)[0], true);
}

// ---------- rooms and scene layouts ----------
// A scene is its layout (scenes/<name>.layout.lua, the layout editor) and its code (scenes/<name>.lua); either may be missing. Rooms are the
// older form of a layout (rooms/<name>.lua, gs.load_room). Both open in the layout editor when they are plain data, as text otherwise.
const dataRel = (kind, name) => (kind === "layout" ? layoutFile(name) : `rooms/${name}.lua`);
async function openData(kind, name, skipConfirm) {
  const rel = dataRel(kind, name);
  if (state.view === "room" && state.layoutKind === kind && state.name === name) return;
  if (!skipConfirm && !(await confirmDiscard())) return;
  const text = await invoke("read_file", { cart: state.cart, rel });
  const parsed = parseRoom(text);
  if (parsed.error) { info(`${rel} opens as text: ${parsed.error}.`); return openFile(rel, true); }
  state.file = null; state.name = name; state.layoutKind = kind;
  showView("room");
  await roomEditor.load(name, parsed.room, kind);
  render();
}
const openRoom = (name, skipConfirm) => openData("room", name, skipConfirm);
const openLayout = (name, skipConfirm) => openData("layout", name, skipConfirm);
// a scene opens on its layout when it has one
const openScene = (name) => { state.sceneLink = null; return openScenePart(name, state.scenePart[name] || (state.scan.layouts.includes(name) ? "layout" : "code")); };

async function saveRoom() {
  const name = roomEditor.getName(); if (!name) return;
  const kind = roomEditor.getKind(), def = roomEditor.getDef();
  const comment = kind === "layout" ? LAYOUT_COMMENT : `A room: gs.load_room("${name.replace(/\//g, ".")}") builds it. Made in the room editor; plain data you can also edit as text.`;
  await invoke("write_file", { cart: state.cart, rel: dataRel(kind, name), content: serializeRoom(def, comment) });
  const renames = roomEditor.getRenames();
  roomEditor.markClean(); renderTitle();
  if (kind === "layout" && Object.keys(renames).length) await carryRenames(name, def.code, renames);
}

// The scene that is open, by its layout or its code (code another layout runs counts as that layout's scene while you go back and forth).
const sceneOfCode = (rel) => { const m = /^scenes\/(.+)\.lua$/.exec(rel || ""); return m && !m[1].endsWith(".layout") ? m[1] : null; };
function currentScene() {
  if (state.view === "room") return state.layoutKind === "layout" ? state.name : null;
  const s = state.view === "code" ? sceneOfCode(state.file) : null;
  return s && state.sceneLink && state.sceneLink.code === s ? state.sceneLink.layout : s;
}
// the scene whose code a layout runs: its own, or the one its `code` names
function codeOf(scene) {
  if (state.view === "room" && state.layoutKind === "layout" && state.name === scene) return roomEditor.getDef().code || scene;
  const parsed = luaTexts[layoutFile(scene)] ? parseRoom(luaTexts[layoutFile(scene)]) : null;
  return (parsed && parsed.room && parsed.room.code) || scene;
}
// Open a scene's layout or its code (the scene's tab has both), making the half it does not have yet.
async function openScenePart(scene, part) {
  if (part === "layout") {
    if (!state.scan.layouts.includes(scene)) {
      await confirmDiscard();
      await invoke("write_file", { cart: state.cart, rel: layoutFile(scene), content: LAYOUT_TEMPLATE(conInfo().screen) });
      await refreshFiles();
      info(`Added a layout to ${scene}: drag things in, and give them names to use them in the code as self.<name>.`);
    }
    await openLayout(scene);
  } else {
    const code = codeOf(scene), rel = `scenes/${code}.lua`;
    if (!state.scan.code.includes(code)) {
      await confirmDiscard();
      await invoke("write_file", { cart: state.cart, rel, content: TEMPLATES.scenes(code) });
      await refreshFiles();
    }
    await openFile(rel);
    state.sceneLink = code !== scene ? { layout: scene, code } : null; // this code belongs to that scene's tab while it is open
    render();
  }
}

// A new scene has both halves, and opens on its layout.
async function createScene(g, name) {
  checkNew(g, name, state.scan.groups[g.key]);
  await invoke("write_file", { cart: state.cart, rel: `scenes/${name}.lua`, content: TEMPLATES.scenes(name, conInfo().screen) });
  await invoke("write_file", { cart: state.cart, rel: layoutFile(name), content: LAYOUT_TEMPLATE(conInfo().screen) });
  await refreshFiles();
  await openLayout(name, true);
}

// After things in a layout were renamed and it was saved: the scene's code says self.<new> where it said self.<old>, and so do other layouts
// that run the same code (the names are what that code expects of each of them).
async function carryRenames(scene, code, renames) {
  const codeScene = code || scene, codeRel = `scenes/${codeScene}.lua`;
  const done = [];
  // 1. other layouts that run this code
  for (const other of state.scan.layouts) {
    if (other === scene) continue;
    const rel = layoutFile(other), parsed = parseRoom(await invoke("read_file", { cart: state.cart, rel }).catch(() => ""));
    if (!parsed.room || (parsed.room.code || other) !== codeScene) continue;
    let changed = 0;
    const swap = (n) => (renames[n] ? (changed++, renames[n]) : n);
    for (const e of parsed.room.entities) if (e[4]) e[4] = swap(e[4]);
    for (const t of [...parsed.room.texts, ...parsed.room.pictures, ...parsed.room.panels]) if (t.name) t.name = swap(t.name);
    if (changed) { await invoke("write_file", { cart: state.cart, rel, content: serializeRoom(parsed.room, LAYOUT_COMMENT) }); done.push(`${changed} in ${rel}`); }
  }
  // 2. the code: in the split view if it is open there (its edits are kept), on disk otherwise
  if (state.scan.code.includes(codeScene)) {
    const inSplit = split.file === codeRel && split.view;
    const text = inSplit ? split.view.state.doc.toString() : await invoke("read_file", { cart: state.cart, rel: codeRel });
    const r = renameSceneFields(text, renames);
    if (r.count) {
      if (inSplit) split.view.dispatch({ changes: { from: 0, to: text.length, insert: r.text } });
      else await invoke("write_file", { cart: state.cart, rel: codeRel, content: r.text });
      done.push(`${r.count} in ${codeRel}${inSplit ? " (not saved yet)" : ""}`);
    }
  }
  const list = Object.entries(renames).map(([a, b]) => `self.${a} is now self.${b}`).join(", ");
  info(`${list}${done.length ? `: changed ${done.join(" and ")}.` : "; the code did not use it yet."}`);
  await refreshLuaIndex();
}
const imageFromB64 = (b64) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("could not read the picture")); i.src = "data:image/png;base64," + b64; });
async function loadRoomTileset(name) {
  const meta = await readJson(`tilesets/${name}.json`);
  const img = await imageFromB64(await invoke("read_binary", { cart: state.cart, rel: meta.image || `tilesets/${name}.png` }));
  const tw = meta.tile_w || 16, th = meta.tile_h || 16, cols = Math.max(1, Math.floor(img.width / tw));
  return { img, tw, th, cols, count: cols * Math.max(1, Math.floor(img.height / th)) };
}
// What an entity looks like in the room: the first frame of the sprite its file names (sprite = "..."), or nothing.
async function entityLook(name) {
  const text = await invoke("read_file", { cart: state.cart, rel: `entities/${name.replace(/\./g, "/")}.lua` });
  const m = text.match(/\bsprite\s*=\s*["']([\w\/-]+)["']/);
  return m ? spriteLook(m[1]) : null;
}
// A sprite's frames as the layout editor draws them (a picture in a layout, or what an entity looks like).
async function spriteLook(name) {
  if (!state.scan.groups.sprites.includes(name)) return null;
  const meta = await readJson(`sprites/${name}.json`);
  const img = await imageFromB64(await invoke("read_binary", { cart: state.cart, rel: meta.image || `sprites/${name}.png` }));
  const frames = Math.max(1, meta.frames || 1), o = meta.origin || [0, 0];
  return { img, fw: Math.floor(img.width / frames), fh: img.height, ox: o[0], oy: o[1] };
}
async function createJson(g, name, def) {
  checkNew(g, name, state.scan.groups[g.key]);
  await writeJson(resourceFiles(g, name)[0], def);
  await refreshFiles();
  await openJsonResource(g, name);
}

// Groups whose names may hold folders (the code groups) show them as folders you can fold, and their files can be dragged from one folder
// to another (or onto the group's title for the top). Moving a file is a rename: the files move on disk and the code that names them is
// updated (renameResource).
function renderTree() {
  $("tree-section").hidden = !state.scan;
  const tree = $("tree"); tree.replaceChildren();
  if (!state.scan) return;
  // a folder without game.lua (an old plain main.lua game) has no folders to show
  if (!state.scan.hasGame) return;
  for (const g of GROUPS) {
    const names = state.scan.groups[g.key];
    const wrap = document.createElement("div"); wrap.className = "tree-group";
    const head = document.createElement("div"); head.className = "tree-head";
    if (g.tip) head.title = g.tip;
    const open = !state.collapsed[g.key];
    const caret = document.createElement("span"); caret.className = "caret"; caret.textContent = open ? "▼" : "▶";
    const h = document.createElement("h2"); h.textContent = g.title;
    const count = document.createElement("span"); count.className = "count"; count.textContent = names.length;
    head.append(caret, h, count);
    head.onclick = () => { state.collapsed[g.key] = open; renderTree(); };
    if (g.nested) {
      head.appendChild(folderButton(g, ""));
      dropTarget(head, g, "");
    }
    const add = document.createElement("button"); add.className = "small"; add.textContent = "+";
    add.title = g.importFile ? "Import a WAV sound" : `New ${g.single}`;
    add.onclick = (e) => {
      e.stopPropagation();
      if (g.importFile) { $("wav-input").click(); return; } // samples are imported from a file
      state.collapsed[g.key] = false; renderTree(); promptInList(`tree-${g.key}`, "name", (n) => creators[g.key](g, n));
    };
    head.appendChild(add);
    wrap.appendChild(head);
    if (open) {
      const ul = document.createElement("ul"); ul.id = `tree-${g.key}`; ul.className = "tree-items";
      const node = g.nested ? folderTree(names, state.newFolders[g.key]) : { folders: [], items: names };
      if (!names.length && !node.folders.length) { const e = document.createElement("li"); e.className = "tree-empty"; e.textContent = "none yet"; ul.appendChild(e); }
      renderFolder(ul, g, node);
      wrap.appendChild(ul);
    }
    tree.appendChild(wrap);
  }
}

const folderListId = (g, path) => `tree-${g.key}` + (path ? "--" + path.replace(/\//g, "--") : "");

const holdsOpen = (g, node) => node.items.some((n) => isOpen(g, n)) || node.folders.some((f) => holdsOpen(g, f));

function renderFolder(ul, g, node) {
  for (const f of node.folders) {
    // folders start folded (false = opened by the user), except one holding what is open, until it is folded by hand
    const key = `${g.key}/${f.path}`, open = state.collapsed[key] === false || (state.collapsed[key] === undefined && holdsOpen(g, f));
    const li = document.createElement("li"); li.className = "tree-folder";
    const row = document.createElement("div"); row.className = "tree-item folder-row"; row.title = `${f.path}/: drag files here to move them into this folder`;
    const caret = document.createElement("span"); caret.className = "caret"; caret.textContent = open ? "▼" : "▶";
    const icon = document.createElement("span"); icon.className = "folder-ico";
    const label = document.createElement("span"); label.className = "name"; label.textContent = f.name;
    row.append(caret, icon, label);
    row.onclick = () => { state.collapsed[key] = open; renderTree(); };
    const add = document.createElement("button"); add.className = "x"; add.textContent = "+"; add.title = `New ${g.single} in ${f.path}/`;
    add.onclick = (e) => {
      e.stopPropagation(); state.collapsed[key] = false; renderTree();
      promptInList(folderListId(g, f.path), "name", (n) => creators[g.key](g, `${f.path}/${n}`));
    };
    row.append(folderButton(g, f.path));
    if (!g.importFile) row.append(add); // samples come in by importing a WAV; drag one into a folder afterwards
    dropTarget(row, g, f.path);
    li.appendChild(row);
    if (open) {
      const sub = document.createElement("ul"); sub.className = "tree-items"; sub.id = folderListId(g, f.path);
      if (!f.folders.length && !f.items.length) { const e = document.createElement("li"); e.className = "tree-empty"; e.textContent = "empty: drag files here"; sub.appendChild(e); }
      renderFolder(sub, g, f);
      li.appendChild(sub);
    }
    ul.appendChild(li);
  }
  for (const n of node.items) ul.appendChild(treeItem(g, n));
}

// A folder that has no file yet stays in the tree until the game closes (a real folder needs a file in it to be kept).
function folderButton(g, parent) {
  const b = document.createElement("button"); b.className = parent ? "x" : "small";
  const icon = document.createElement("span"); icon.className = "folder-ico plus"; b.appendChild(icon);
  b.title = parent ? `New folder in ${parent}/` : "New folder";
  b.onclick = (e) => {
    e.stopPropagation();
    if (parent) state.collapsed[`${g.key}/${parent}`] = false; else state.collapsed[g.key] = false;
    renderTree();
    promptInList(folderListId(g, parent), "folder name", (n) => {
      const path = parent ? `${parent}/${n}` : n;
      if (!validName(path, true)) throw new Error("Use letters, digits, - and _ for folder names (at most 3 folders deep).");
      (state.newFolders[g.key] ||= []).push(path);
    });
  };
  return b;
}

// What is being dragged in the tree: { g, name }. Files only move inside their own group (an entity stays an entity).
let dragging = null;
function dropTarget(el, g, folder) {
  const ok = () => dragging && dragging.g === g && movedName(dragging.name, folder) !== dragging.name;
  el.addEventListener("dragover", (e) => { if (!ok()) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; el.classList.add("drop"); });
  el.addEventListener("dragleave", () => el.classList.remove("drop"));
  el.addEventListener("drop", (e) => {
    el.classList.remove("drop");
    if (!ok()) return;
    e.preventDefault(); e.stopPropagation();
    const { name } = dragging, to = movedName(name, folder); dragging = null;
    if (folder) state.collapsed[`${g.key}/${folder}`] = false;
    run("move", async () => {
      await renameResource(g, name, to);
      if (state.newFolders[g.key]) state.newFolders[g.key] = state.newFolders[g.key].filter((p) => !(folder + "/").startsWith(p + "/")); // it has a file now
    });
  });
}

function treeItem(g, n) {
  const li = document.createElement("li"); li.className = "tree-item" + (isOpen(g, n) ? " active" : "");
  const label = document.createElement("span"); label.className = "name"; label.textContent = g.nested ? n.split("/").pop() : n;
  li.title = n;
  li.appendChild(label);
  li.onclick = () => openers[g.kind](g, n);
  // code files drag to another folder; entities and sprites also drag onto an open layout, which places them
  const placeable = g.key === "entities" ? "entity" : g.key === "sprites" ? "sprite" : null;
  if (g.nested || placeable) {
    li.draggable = true;
    li.addEventListener("dragstart", (e) => {
      if (g.nested) dragging = { g, name: n };
      e.dataTransfer.effectAllowed = g.nested ? "copyMove" : "copy";
      e.dataTransfer.setData("text/plain", n);
      if (placeable) e.dataTransfer.setData(PLACE, JSON.stringify({ what: placeable, name: n }));
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => { dragging = null; li.classList.remove("dragging"); });
  }
  // a drawn pencil: the ✎ glyph comes out heavier than × and in another font on each system
  const rn = document.createElement("button"); rn.className = "x"; rn.title = "Rename";
  rn.innerHTML = '<svg class="ico" viewBox="0 0 12 12" aria-hidden="true"><path d="M8.2 1.8l2 2L4 10H2v-2z M7 3l2 2" /></svg>';
  rn.onclick = (e) => {
    e.stopPropagation();
    const input = document.createElement("input"); input.value = n; input.spellcheck = false;
    label.replaceWith(input); li.onclick = null; li.draggable = false; input.focus(); input.select();
    let done = false;
    const finish = (commit) => {
      if (done) return; done = true;
      const v = input.value.trim();
      if (commit && v && v !== n) run("rename", () => renameResource(g, n, v)); else renderTree();
    };
    input.onkeydown = (ev) => { if (ev.key === "Enter") finish(true); if (ev.key === "Escape") finish(false); };
    input.onblur = () => finish(false);
    input.onclick = (ev) => ev.stopPropagation();
  };
  li.appendChild(rn);
  const x = document.createElement("button"); x.className = "x"; x.textContent = "×"; x.title = "Delete";
  let armed = false;
  x.onclick = (e) => {
    e.stopPropagation();
    if (!armed) {
      armed = true; x.textContent = "Delete?"; x.classList.add("armed");
      setTimeout(() => { armed = false; x.textContent = "×"; x.classList.remove("armed"); }, 2500);
      return;
    }
    run("delete", () => deleteResource(g, n));
  };
  li.appendChild(x);
  return li;
}

// Every saved Lua file of the game: { rel: text }
const readLuaFiles = async () => {
  const texts = {};
  for (const f of state.files) if (f.endsWith(".lua")) { try { texts[f] = await invoke("read_file", { cart: state.cart, rel: f }); } catch { /* skip */ } }
  return texts;
};

// Rename a resource (or move it to another folder): move its files, update the sound files and the plain places in Lua code that name it,
// and reopen what was open (from disk, so no editor is left holding the old name). Other mentions in code are counted and reported.
async function renameResource(g, from, to) {
  const problem = renameProblem(state.scan.groups[g.key], g, from, to) || (g.key === "instruments" && isBuiltinName(to) ? `'${to}' is the name of a built-in instrument.` : null);
  if (problem) throw new Error(problem);
  await confirmDiscard(); // saves whatever is being edited first

  const lua = await readLuaFiles();
  const code = renameInCode(lua, g.key, from, to);
  const mentions = countCodeMentions(Object.values({ ...lua, ...code.files }), g.key, from);
  const files = {};
  for (const k of ["music", "sfx", "instruments"]) for (const n of state.scan.groups[k]) { try { files[`${k}/${n}.json`] = await readJson(`${k}/${n}.json`); } catch { /* nothing to update */ } }
  const result = renameReferences(files, g.key, from, to);
  const open = { view: state.view, name: state.name, file: state.file };

  // 1. move the resource's own files
  const oldFiles = resourceFiles(g, from), newFiles = resourceFiles(g, to);
  for (let i = 0; i < oldFiles.length; i++) {
    if (state.files.includes(oldFiles[i])) await invoke("rename_file", { cart: state.cart, from: oldFiles[i], to: newFiles[i] });
  }
  // 2. a sprite or tileset's JSON points at its PNG by name
  if (g.pair) {
    try {
      const meta = await readJson(newFiles[0]);
      if (meta.image === oldFiles[1]) { meta.image = newFiles[1]; await writeJson(newFiles[0], meta); }
    } catch { /* nothing to fix */ }
  }
  // 3. every sound file and Lua file that referred to the old name (a file that was moved is written where it is now)
  for (const path of result.changed) await writeJson(path, result.files[path]);
  for (const [rel, text] of Object.entries(code.files)) {
    const i = oldFiles.indexOf(rel);
    await invoke("write_file", { cart: state.cart, rel: i >= 0 ? newFiles[i] : rel, content: text });
  }

  // 4. forget what was open and open it again, under its new name if it was the one renamed
  clearOpen();
  await refreshFiles();
  try {
    if (open.view === "code" && open.file) {
      const i = oldFiles.indexOf(open.file);
      await openFile(i >= 0 ? newFiles[i] : open.file, true);
    } else if (open.name) {
      const og = GROUPS.find((x) => x.kind === open.view);
      await openers[open.view](og, og === g && open.name === from ? to : open.name);
    }
  } catch (e) { fail(e); }
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const updated = [result.count && plural(result.count, "sound reference"), code.count && plural(code.count, "place") + " in your code"].filter(Boolean);
  info(`${from.includes("/") || to.includes("/") ? "Moved" : "Renamed"} '${from}' to '${to}'` + (updated.length ? `, and updated ${updated.join(" and ")}.` : "."));
  if (mentions) info(`${plural(mentions, "place")} in your Lua code still mention${mentions === 1 ? "s" : ""} '${from}' as text. Those were not changed: search your code for it.`);
}

async function deleteResource(g, name) {
  if (g.key === "instruments") { // sound effects and songs that used it fall back to the plain square wave
    const files = {};
    for (const k of ["sfx", "music"]) for (const n of state.scan.groups[k]) { try { files[`${k}/${n}.json`] = await readJson(`${k}/${n}.json`); } catch { /* skip */ } }
    const r = renameReferences(files, "instruments", name, "square");
    for (const path of r.changed) await writeJson(path, r.files[path]);
    if (r.changed.length) info(`Sound effects and music that used '${name}' now use the square instrument.`);
  }
  const wasOpen = isOpen(g, name);
  for (const rel of resourceFiles(g, name)) { if (state.files.includes(rel)) await invoke("delete_file", { cart: state.cart, rel }); }
  if (wasOpen) clearOpen();
  await refreshFiles();
}

// ---------- sprites ----------
async function saveSprite() {
  const sp = spriteEditor.getSprite();
  if (!sp) return;
  try {
    await invoke("write_binary", { cart: state.cart, rel: `sprites/${sp.name}.png`, data: await encodeSpritePng(sp) });
    await writeJson(`sprites/${sp.name}.json`, toJSON(sp));
    spriteEditor.markClean();
    stepDone("sprite");
    await refreshFiles();
    render();
  } catch (e) { fail(e); }
}

async function openSprite(name) {
  if (state.view === "sprite" && state.name === name) return;
  if (!(await confirmDiscard())) return;
  try {
    const meta = await readJson(`sprites/${name}.json`);
    const b64 = await invoke("read_binary", { cart: state.cart, rel: meta.image || `sprites/${name}.png` });
    const img = await decodeSpritePng(b64, meta.frames || 1);
    spriteEditor.load({
      name, w: img.w, h: img.h, frames: img.frames,
      origin: meta.origin || [0, 0], mask: meta.mask || null, fps: meta.fps ?? 6,
      animations: normalizeAnimations(meta.animations, img.frames.length, meta.fps ?? 6),
      ...(meta.bank ? { bank: meta.bank } : {}),
    });
    state.name = name;
    showView("sprite");
  } catch (e) { fail(e); }
  render();
}

// "What is it?": the size guide as buttons, plus any size. Resolves to { w, h }, or null when cancelled.
function askSpriteSize(name) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog"); d.className = "modal";
    const h = document.createElement("h2"); h.textContent = `New sprite: what is ${name}?`;
    const roles = document.createElement("div"); roles.className = "size-roles";
    const done = (v) => { d.close(); d.remove(); resolve(v); };
    for (const r of SIZE_GUIDE) {
      const b = document.createElement("button");
      const l = document.createElement("span"); l.textContent = `${r.label}  ${r.w}×${r.h}`;
      const n = document.createElement("span"); n.className = "sr-note"; n.textContent = r.note;
      b.append(l, n); b.onclick = () => done({ w: r.w, h: r.h });
      roles.appendChild(b);
    }
    const own = document.createElement("div"); own.className = "se-row se-fields";
    const num = (v) => { const i = document.createElement("input"); i.type = "number"; i.min = 1; i.max = 256; i.value = v; return i; };
    const w = num(32), hh = num(32);
    const ok = document.createElement("button"); ok.textContent = "Other size";
    ok.onclick = () => done({ w: Math.max(1, Math.min(256, Number(w.value) || 32)), h: Math.max(1, Math.min(256, Number(hh.value) || 32)) });
    const lab = (t, i) => { const l = document.createElement("label"); l.append(t, i); return l; };
    own.append(lab("W ", w), lab("H ", hh), ok);
    const cancel = document.createElement("button"); cancel.textContent = "Cancel"; cancel.onclick = () => done(null);
    const foot = document.createElement("div"); foot.className = "np-actions"; foot.appendChild(cancel);
    const tip = document.createElement("p"); tip.className = "se-hint"; tip.textContent = "Sizes for a 320×240 screen (Help > Sprite and tile sizes). You can resize later.";
    d.append(h, roles, own, tip, foot);
    d.addEventListener("cancel", () => done(null));
    document.body.appendChild(d); d.showModal();
  });
}

async function createNewSprite(name) {
  checkNew(group("sprites"), name, state.scan.groups.sprites);
  const size = await askSpriteSize(name);
  if (!size) return;
  const sp = createSprite(name, size.w, size.h);
  if (state.palette && state.palette.sprites.length) sp.bank = state.palette.sprites[0].name; // a new sprite starts in the first sprite bank
  spriteEditor.load(sp);
  state.name = name;
  showView("sprite");
  await saveSprite();
}

// ---------- tilesets ----------
async function saveTileset() {
  const sp = tilesetEditor.getSprite();
  if (!sp) return;
  try {
    await invoke("write_binary", { cart: state.cart, rel: `tilesets/${sp.name}.png`, data: await encodeSpritePng(sp) });
    await writeJson(`tilesets/${sp.name}.json`, tilesetToJSON(sp));
    tilesetEditor.markClean();
    await refreshFiles();
    render();
  } catch (e) { fail(e); }
}

async function openTileset(name) {
  if (state.view === "tileset" && state.name === name) return;
  if (!(await confirmDiscard())) return;
  try {
    const meta = await readJson(`tilesets/${name}.json`);
    const b64 = await invoke("read_binary", { cart: state.cart, rel: meta.image || `tilesets/${name}.png` });
    const img = await decodeSpritePng(b64, 1);
    tilesetEditor.load({ name, w: img.w, h: img.h, frames: img.frames, origin: [0, 0], mask: null, fps: 0, tile: [meta.tile_w || 16, meta.tile_h || 16], ...(Array.isArray(meta.banks) ? { banks: meta.banks } : {}) });
    state.name = name;
    showView("tileset");
  } catch (e) { fail(e); }
  render();
}

async function createNewTileset(name) {
  checkNew(group("tilesets"), name, state.scan.groups.tilesets);
  const ts = createTileset(name, 16, 16, 8, 4);
  if (state.palette && state.palette.tiles.length) ts.banks = [state.palette.tiles[0].name];
  tilesetEditor.load(ts);
  state.name = name;
  showView("tileset");
  await saveTileset();
}

// ---------- colours (palette.json: the game's colour banks) ----------
// What the sprite and tileset editors may draw with: the game's banks on a console with banks, the classic colours for a game that has none yet.
function artPalette() {
  const p = paletteOf(conInfo());
  if (p.mode !== "banks") return p;
  return state.palette ? { mode: "banks", sprites: state.palette.sprites, tiles: state.palette.tiles } : { mode: "fixed", colors: p.colors };
}
// The sprites and tilesets that use a bank (asked before one is deleted).
async function bankUsers(name) {
  const out = [];
  for (const n of state.scan.groups.sprites) { try { if ((await readJson(`sprites/${n}.json`)).bank === name) out.push("sprite " + n); } catch { /* skip */ } }
  for (const n of state.scan.groups.tilesets) { try { if (((await readJson(`tilesets/${n}.json`)).banks || []).includes(name)) out.push("tileset " + n); } catch { /* skip */ } }
  return out;
}
let bankUsersCache = {};
async function openPalette() {
  if (state.view === "palette") return;
  if (!(await confirmDiscard())) return;
  paletteEditor.load(state.palette);
  state.name = "palette";
  showView("palette");
  render();
  // the delete button asks synchronously, so who uses which bank is read once now
  bankUsersCache = {};
  if (state.palette) for (const b of [...state.palette.sprites, ...state.palette.tiles]) bankUsersCache[b.name] = await bankUsers(b.name);
}
async function savePalette() {
  const def = paletteEditor.getDef();
  if (!def) return; // still on the classic colours: nothing to write
  try {
    await invoke("write_file", { cart: state.cart, rel: "palette.json", content: paletteText(def) });
    // a renamed bank: the sprites and tilesets that named it follow
    for (const [from, to] of paletteEditor.getRenames()) {
      for (const n of state.scan.groups.sprites) {
        const rel = `sprites/${n}.json`, m = await readJson(rel);
        if (m.bank === from) await writeJson(rel, { ...m, bank: to });
      }
      for (const n of state.scan.groups.tilesets) {
        const rel = `tilesets/${n}.json`, m = await readJson(rel);
        if ((m.banks || []).includes(from)) await writeJson(rel, { ...m, banks: m.banks.map((b) => (b === from ? to : b)) });
      }
    }
    paletteEditor.markClean();
    await refreshFiles();
    render();
  } catch (e) { fail(e); }
}
$("palette-file").onclick = () => run("open", openPalette);

// ---------- samples (imported WAV sounds) ----------
let sampleAudio = null;
async function previewSample(name) {
  try {
    if (sampleAudio) sampleAudio.pause();
    sampleAudio = new Audio("data:audio/wav;base64," + await invoke("read_binary", { cart: state.cart, rel: `sounds/${name}.wav` }));
    await sampleAudio.play();
  } catch (e) { fail(e); }
}
const toBase64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

$("wav-input").onchange = (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = "";
  if (!file || !state.scan) return;
  run("import", async () => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const wav = parseWav(bytes);
    if (wav.error) throw new Error(wav.error);
    const max = conInfo().audio.sample_max_seconds;
    if (max && wav.seconds > max) throw new Error(`That sound is ${wav.seconds.toFixed(1)} s long; this console allows samples up to ${max} s. Trim it first, or make a sound effect in the SFX editor instead.`);
    const name = sampleName(file.name, state.scan.groups.sounds);
    // the console's sample rate (Dot: 32 kHz, like a GBA game's best samples), in mono: smaller files, and the sound the handheld plays
    const fit = fitWav(bytes, conInfo().audio.sample_rate || 32000);
    await invoke("write_binary", { cart: state.cart, rel: `sounds/${name}.wav`, data: toBase64(fit.bytes) });
    await refreshFiles();
    info(`Imported ${file.name} as '${name}' (${wav.seconds.toFixed(1)} s${fit.changed ? `, made mono at ${(fit.rate / 1000).toFixed(fit.rate % 1000 ? 2 : 0)} kHz to fit the console` : ""}).`);
  });
};

// ---------- sound effects, music and instruments ----------
async function openJsonResource(g, name) {
  if (state.view === g.kind && state.name === name) return;
  if (!(await confirmDiscard())) return;
  try {
    editors()[g.kind].load(name, await readJson(resourceFiles(g, name)[0]));
    state.name = name;
    showView(g.kind);
  } catch (e) { fail(e); }
  render();
}
async function saveJsonResource(kind) {
  if (!state.name) return;
  const g = GROUPS.find((x) => x.kind === kind), ed = editors()[kind];
  try {
    await writeJson(resourceFiles(g, state.name)[0], ed.getDef());
    ed.markClean(); renderTitle();
    if (kind === "instrument") {
      instrumentDefs.set(state.name, ed.getDef());
      if (sfxEditor) sfxEditor.refreshInstruments();
      if (musicEditor) musicEditor.refresh();
    }
  } catch (e) { fail(e); }
}

// What a preview needs to know about the game: its instruments and the console's sound settings.
async function audioContext() {
  const cache = new Map();
  for (const n of state.scan ? state.scan.groups.instruments : []) {
    try { cache.set(n, await readJson(`instruments/${n}.json`)); } catch { /* shown as missing */ }
  }
  const audio = conInfo().audio || {};
  return { lookups: { instrument: (n) => cache.get(n) }, style: audio.style === "gba" ? "gba" : "clean", channels: audio.music_tracks || 4, sfxChannels: audio.sfx_channels || 4 };
}
// The game's own instruments, kept in step with the files, so the editors know each one's range.
const instrumentDefs = new Map();
async function loadInstrumentDefs() {
  instrumentDefs.clear();
  for (const n of state.scan ? state.scan.groups.instruments : []) {
    try { instrumentDefs.set(n, await readJson(`instruments/${n}.json`)); } catch { /* shown as missing */ }
  }
}
const instrumentLookups = () => ({ instrument: (n) => instrumentDefs.get(n) });
const instrumentNames = () => (state.scan ? state.scan.groups.instruments : []);
// Hear an instrument from the palette (a middle C).
async function previewNamed(name, note = 48) {
  try {
    const c = await audioContext();
    const b64 = await renderChecked(namedNotePreviewDesc(name, note, c.lookups, { style: c.style, channels: c.channels, sfxChannels: c.sfxChannels, stereo: true }));
    new Audio("data:audio/wav;base64," + b64).play().catch(() => {});
  } catch (e) { fail(e); }
}
// An editable copy of a ready-made instrument in the game's own list.
async function copyBuiltin(name) {
  if (!state.scan) return;
  const base = `${name}_copy`; let n = base, i = 2;
  while (instrumentNames().includes(n) || isBuiltinName(n)) n = `${base}${i++}`;
  try {
    const d = builtinDef(name);
    await writeJson(`instruments/${n}.json`, normalizeInstrument(d));
    await refreshFiles(); render();
    info(`Made '${n}' in My instruments: a copy of ${d.label} you can change.`);
  } catch (e) { fail(e); }
}
async function renderChecked(built) {
  if (built.problems.length) info(`Preview: ${[...new Set(built.problems)].join("; ")}.`);
  return invoke("render_audio", { desc: built.text, cart: state.cart });
}

// ---------- the Handheld panel ----------
// What the game uses against what the console allows (budget-core.js makes the rows). The facts are read from the files when the panel is open
// and the files change; the live numbers come from the running game once a second.
let handheldFacts = null;
async function gatherFacts() {
  const facts = await projectFacts(conInfo());
  facts.cartBytes = state.cartBytes;
  facts.songs = {}; facts.sfx = state.scan.groups.sfx.length; facts.samples = state.scan.groups.sounds.length;
  for (const n of state.scan.groups.music) {
    // a song file always has eight tracks now: count the ones that play (have an instrument)
    try { const d = await readJson(`music/${n}.json`); facts.songs[n] = { tracks: d.format === "tracker" ? (Array.isArray(d.track_instruments) ? d.track_instruments.filter(Boolean).length : d.tracks || 0) : (d.instruments ? d.instruments.length : 0) }; } catch { /* skip */ }
  }
  const lines = Object.values(luaTexts).reduce((n, t) => n + t.split("\n").length, 0);
  facts.lua = { files: Object.keys(luaTexts).length, lines };
  return facts;
}
async function refreshHandheld() {
  if (!state.scan || !state.scan.hasGame || state.logTab !== "hh") return;
  try { handheldFacts = await gatherFacts(); } catch (e) { fail(e); }
  renderHandheld();
}
function renderHandheld() {
  const box = $("handheld"); box.replaceChildren();
  if (!state.scan || !state.scan.hasGame) { box.textContent = "Open a game to see how it fits the handheld."; box.className = "hh-empty"; return; }
  box.className = "";
  const chips = document.createElement("div"); chips.className = "hh-chips";
  for (const t of consoleSummary(conInfo())) { const c = document.createElement("span"); c.className = "hh-chip"; c.textContent = t; chips.appendChild(c); }
  box.appendChild(chips);
  const grid = document.createElement("div"); grid.className = "hh-grid";
  let group = null;
  const facts = handheldFacts || { cartBytes: state.cartBytes, lua: { files: 0, lines: 0 } };
  for (const r of budgetRows(conInfo(), facts, state.running ? state.live : null)) {
    if (r.group !== group) { group = r.group; const h = document.createElement("div"); h.className = "hh-group"; h.textContent = group; grid.appendChild(h); }
    const el = document.createElement("div"); el.className = "hh-row"; el.dataset.level = r.level; if (r.tip) el.title = r.tip;
    const label = document.createElement("div"); label.className = "hh-label";
    const a = document.createElement("span"); a.textContent = r.label; const b = document.createElement("span"); b.textContent = r.text;
    label.append(a, b); el.appendChild(label);
    if (r.ratio !== null) { const m = document.createElement("div"); m.className = "hh-meter"; const f = document.createElement("div"); f.style.width = `${Math.min(100, r.ratio * 100)}%`; m.appendChild(f); el.appendChild(m); }
    grid.appendChild(el);
  }
  if (!state.running) { const n = document.createElement("div"); n.className = "hh-empty"; n.style.gridColumn = "1 / -1"; n.textContent = "Run the game to see how many things are alive and how long a frame takes."; grid.appendChild(n); }
  box.appendChild(grid);
}

// ---------- toolbar ----------
$("btn-save").onclick = () => run("save", save);
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (split.view && split.view.hasFocus) saveSplit(); else save(); }
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); $("btn-run").click(); }
});
// Run shows the game in the Play panel beside the code (the runtime sends its frames: play-panel.js), or in a window of its own (Settings).
const runInStudio = () => { try { return localStorage.getItem("gs.runIn") !== "window"; } catch { return true; } };
function showPlay(on) { $("play").hidden = !on; $("app").classList.toggle("playing", on); window.dispatchEvent(new Event("resize")); }
$("btn-run").onclick = () => run("run", async () => {
  await save();
  await syncConsoleCopy();
  const embed = runInStudio(), screen = conInfo().screen, frames = new Channel();
  if (embed) { frames.onmessage = (m) => play.frame(m); showPlay(true); play.start(screen, conInfo().name); }
  await invoke("run_preview", { cart: state.cart, embed: embed ? { width: screen.width, height: screen.height } : null, onFrame: frames });
  stepDone("run");
});
$("btn-stop").onclick = () => (state.pushing ? invoke("cancel_push") : invoke("stop_preview")).catch(fail);
$("btn-pack").onclick = () => run("pack", async () => { await save(); await syncConsoleCopy(); const p = await invoke("pack_cart", { cart: state.cart }); info("Packed " + p); });
$("btn-push").onclick = () => run("push", async () => {
  await save();
  await syncConsoleCopy();
  state.pushing = true; render();
  try { await invoke("push_cart", { cart: state.cart }); info("Sent to device."); } finally { state.pushing = false; }
});
// Output, Handheld and Inspector share the bottom strip.
function showLogTab(which) {
  state.logTab = which;
  $("app").classList.toggle("hh-open", which !== "log"); // the panels are taller than the output
  $("log").hidden = which !== "log"; $("handheld").hidden = which !== "hh"; $("inspector").hidden = which !== "insp";
  $("tab-log").classList.toggle("on", which === "log"); $("tab-hh").classList.toggle("on", which === "hh"); $("tab-insp").classList.toggle("on", which === "insp");
  $("btn-clear-log").hidden = which !== "log";
  if (which === "log") $("log-new").hidden = true;
  if (which !== "log" && $("app").classList.contains("log-hidden")) setLogHidden(false);
  if (which === "hh") refreshHandheld();
  insp.open = which === "insp"; sendInspect(); renderInspector();
}
$("tab-log").onclick = () => showLogTab("log");
$("tab-hh").onclick = () => showLogTab("hh");
$("tab-insp").onclick = () => showLogTab("insp");

// ---------- inspector (the running game from the inside: engine/gs/inspect.lua) ----------
const insp = { open: false, paused: false, stepSeq: 0, speed: 1, cls: null, entity: null, watch: [], report: null };
let inspSent = "";
function sendInspect() {
  if (!state.running) return;
  const text = commandText(insp);
  if (text === inspSent) return;
  inspSent = text;
  invoke("inspect_send", { text }).catch(() => { /* the game reads it again next time */ });
}
function renderInspector() {
  const box = $("inspector");
  if (box.hidden) return;
  box.replaceChildren();
  const r = insp.report;
  if (!state.running) { const p = document.createElement("div"); p.className = "hh-empty"; p.textContent = "Run the game to look inside it: pause, step a frame at a time, slow it down, and see what each kind of thing costs."; box.appendChild(p); return; }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  // controls
  const bar = el("div", "in-bar");
  const pause = el("button", "small", insp.paused ? "▶ Resume" : "❚❚ Pause"); pause.title = "Freeze the game (drawing goes on)";
  pause.onclick = () => { insp.paused = !insp.paused; sendInspect(); renderInspector(); };
  const step = el("button", "small", "Step"); step.title = "Run one step (1/60 s) while paused"; step.disabled = !insp.paused;
  step.onclick = () => { insp.stepSeq++; sendInspect(); };
  const speed = el("select"); speed.title = "Slow motion (or faster)";
  for (const s of SPEEDS) speed.appendChild(new Option(s === 1 ? "normal speed" : `${s}× speed`, String(s)));
  speed.value = String(insp.speed); speed.onchange = () => { insp.speed = Number(speed.value); sendInspect(); };
  bar.append(pause, step, speed);
  if (r) bar.append(el("span", "in-facts", `step ${r.step} · ${r.scene || "no scene"} · ${r.alive} alive · ${r.particles || 0} particles`));
  box.appendChild(bar);
  if (!r) { box.appendChild(el("div", "hh-empty", "Waiting for the game…")); return; }
  const cols = el("div", "in-cols");
  // kinds, the most expensive first
  const kinds = el("div", "in-kinds");
  kinds.appendChild(el("div", "in-head", "Kinds of thing (time a step: update + draw + collisions)"));
  for (const c of classRows(r)) {
    const row = el("div", "in-kind" + (c.name === insp.cls ? " on" : ""));
    row.title = `update ${fmtMs(c.update)}, draw ${fmtMs(c.draw)}, collisions ${fmtMs(c.collide)}`;
    const bar2 = el("span", "in-share"); bar2.style.width = `${Math.round(c.share * 100)}%`;
    row.append(el("span", "in-name", c.short), el("span", "in-count", String(c.count)), el("span", "in-ms", fmtMs(c.ms)), bar2);
    row.onclick = () => { insp.cls = c.name === insp.cls ? null : c.name; insp.entity = null; sendInspect(); renderInspector(); };
    kinds.appendChild(row);
  }
  cols.appendChild(kinds);
  // the chosen kind's entities and one entity's values
  const detail = el("div", "in-detail");
  if (insp.cls) {
    detail.appendChild(el("div", "in-head", `${insp.cls.replace(/^entities\./, "")}: ${r.list.length}${r.list.length >= 60 ? "+" : ""}`));
    const ids = el("div", "in-ids");
    for (const e of r.list) {
      const b = el("button", "small" + (e.id === insp.entity ? " on" : ""), `#${e.id}`); b.title = `at ${e.x}, ${e.y}`;
      b.onclick = () => { insp.entity = e.id; sendInspect(); renderInspector(); };
      ids.appendChild(b);
    }
    detail.appendChild(ids);
    if (insp.entity !== null) {
      if (r.entity) {
        const t = el("div", "in-fields");
        for (const k of Object.keys(r.entity).sort()) t.append(el("span", "in-k", k), el("span", "in-v", r.entity[k]));
        detail.appendChild(t);
      } else detail.appendChild(el("div", "hh-empty", `#${insp.entity} is gone.`));
    }
  } else detail.appendChild(el("div", "hh-empty", "Click a kind to see each one and its values."));
  // watch expressions: any Lua expression; e is the chosen entity
  detail.appendChild(el("div", "in-head", "Watch (Lua; e is the chosen one)"));
  insp.watch.forEach((w, i) => {
    const row = el("div", "in-watch");
    const x = el("button", "small", "×"); x.onclick = () => { insp.watch.splice(i, 1); sendInspect(); renderInspector(); };
    row.append(el("code", "", w), el("span", "in-v", (r.watch || [])[i] ?? "…"), x);
    detail.appendChild(row);
  });
  const add = el("input", "in-add"); add.placeholder = "e.hp   or   gs.count(\"enemy\")"; add.spellcheck = false;
  add.onkeydown = (ev) => { if (ev.key === "Enter" && add.value.trim()) { insp.watch.push(add.value.trim()); sendInspect(); renderInspector(); } };
  detail.appendChild(add);
  cols.appendChild(detail);
  box.appendChild(cols);
}
$("btn-clear-log").onclick = () => { $("log").replaceChildren(); $("log-new").hidden = true; };
// The output can be tucked away to give the editors the room (a per-viewer convenience, so storage failures are ignored).
function setLogHidden(hide) {
  $("app").classList.toggle("log-hidden", hide);
  $("btn-toggle-log").textContent = hide ? "Show" : "Hide";
  if (!hide) $("log-new").hidden = true;
  try { localStorage.setItem("gs.logHidden", hide ? "1" : "0"); } catch { /* not remembered */ }
}
$("btn-toggle-log").onclick = () => setLogHidden(!$("app").classList.contains("log-hidden"));
try { setLogHidden(localStorage.getItem("gs.logHidden") === "1"); } catch { /* shown */ }
$("game-file").onclick = () => openFile("game.lua");

// inline "new item" input at the top of a list
function promptInList(listId, placeholder, onDone) {
  const ul = $(listId);
  const li = document.createElement("li");
  const input = document.createElement("input");
  input.placeholder = placeholder; input.spellcheck = false;
  li.appendChild(input); ul.prepend(li); input.focus();
  let done = false;
  const finish = async (commit) => {
    if (done) return; done = true;
    const v = input.value.trim(); li.remove();
    if (commit && v) { try { await onDone(v); } catch (e) { fail(e); } }
    render();
  };
  input.onkeydown = (e) => { if (e.key === "Enter") finish(true); if (e.key === "Escape") finish(false); };
  input.onblur = () => finish(true);
}

// New game: pick a name and the console it is made for.
let chosenConsole = BUILTIN_CONSOLES[0];
function renderConsoleChoices() {
  const box = $("np-consoles"); box.replaceChildren();
  for (const c of allConsoles(state.customConsoles)) {
    const card = document.createElement("div"); card.className = "np-card" + (c === chosenConsole ? " active" : "");
    const shape = document.createElement("div"); shape.className = "np-shape";
    shape.style.aspectRatio = `${c.screen.width} / ${c.screen.height}`;
    const box2 = document.createElement("div");
    const title = document.createElement("div"); title.className = "np-title"; title.textContent = `${c.name}  ${screenText(c)}`;
    const desc = document.createElement("div"); desc.className = "np-desc"; desc.textContent = c.description;
    box2.append(title, desc); card.append(shape, box2);
    card.onclick = () => { chosenConsole = c; renderConsoleChoices(); };
    box.appendChild(card);
  }
}
$("btn-new-project").onclick = () => {
  $("new-project").hidden = false; $("np-error").textContent = ""; $("np-name").value = "";
  renderConsoleChoices(); $("np-name").focus();
};
$("np-cancel").onclick = () => { $("new-project").hidden = true; };
const createProject = () => run("create", async () => {
  const name = $("np-name").value.trim();
  if (!validName(name)) { $("np-error").textContent = "Use letters, digits, - and _ for the name."; return; }
  try {
    await invoke("new_cart", { name });
    const banks = paletteOf(chosenConsole).mode === "banks";
    for (const [rel, content] of Object.entries(newGameFiles(defaultTitle(name), chosenConsole.id, { banks }))) await invoke("write_file", { cart: name, rel, content });
    const copy = consoleFileOf(chosenConsole.id);
    if (copy) await invoke("write_file", { cart: name, rel: copy, content: consoleFileText(chosenConsole) });
  } catch (e) { $("np-error").textContent = String(e); return; }
  $("new-project").hidden = true;
  stepDone("make");
  await refreshGames(); await openGame(name);
});
$("np-create").onclick = createProject;
$("np-name").onkeydown = (e) => { if (e.key === "Enter") createProject(); if (e.key === "Escape") $("np-cancel").click(); };
$("btn-close").onclick = () => run("close", closeProject);
$("btn-new-file").onclick = () => promptInList("files", "file.lua", async (rel) => {
  await invoke("new_file", { cart: state.cart, rel });
  await refreshFiles(); render(); if (TEXT_EXT.test(rel)) await openFile(rel);
});

// ---------- help ----------
$("btn-help").onclick = () => help.open();
window.addEventListener("keydown", (e) => { if (e.key === "F1") { e.preventDefault(); help.open(); } });

// "Add to my game": write a tutorial's file into the open game (never over a file that is there).
async function addHelpFile(rel, text) {
  if (!state.cart) throw new Error("Open a game first.");
  if (state.files.includes(rel)) throw new Error(`${rel} already exists`);
  await invoke("write_file", { cart: state.cart, rel, content: text });
  await refreshFiles(); render();
  await openFile(rel);
}
// "Open this example": a finished game from the workspace (the samples live in carts/ beside your own games).
async function openExample(name) {
  if (!state.games.some((g) => g.name === name)) throw new Error(`There is no game called ${name} in this workspace.`);
  await openGame(name);
}
// "Make this game": a new game made of a tutorial's files, for the console picked beside the button (Dot unless you choose another).
async function makeHelpGame(title, files, consoleId = "dot") {
  const base = "tutorial-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let name = base, n = 2;
  while (state.games.some((g) => g.name === name)) name = `${base}-${n++}`;
  await invoke("new_cart", { name });
  const target = allConsoles(state.customConsoles).find((c) => c.id === consoleId) || BUILTIN_CONSOLES[0];
  for (const [rel, content] of Object.entries(files)) {
    await invoke("write_file", { cart: name, rel, content: rel === "game.lua" ? setConsoleInGame(content, target.id) ?? content : content });
  }
  await invoke("write_file", { cart: name, rel: "meta/info.json", content: JSON.stringify({ title, console: target.id }, null, 2) + "\n" });
  const copy = consoleFileOf(target.id);
  if (copy) await invoke("write_file", { cart: name, rel: copy, content: consoleFileText(target) });
  await refreshGames();
  await openGame(name);
}

$("set-theme").onchange = () => setLook($("set-theme").value);

// ---------- tabs (what was open lately, to go back to with a click) ----------
// A scene is one tab with its two halves in it, Layout and Code; the tab remembers which was open last.
const openSceneNow = () => (state.scan && state.scan.hasGame ? currentScene() : null);
const tabKey = () => {
  const scene = openSceneNow();
  if (scene) return "scene:" + scene;
  return state.view === "code" ? (state.file ? "file:" + state.file : null) : state.name ? `${state.view === "room" ? state.layoutKind : state.view}:${state.name}` : null;
};
function noteTab() {
  const k = tabKey(); if (!k) return;
  const scene = openSceneNow();
  if (scene) state.scenePart[scene] = state.view === "room" ? "layout" : "code";
  if (!state.tabs.includes(k)) { state.tabs.push(k); if (state.tabs.length > 8) state.tabs.splice(state.tabs.findIndex((t) => t !== k), 1); }
}
async function openTab(k) {
  const [kind, ...rest] = k.split(":"), name = rest.join(":");
  if (kind === "file") return openFile(name);
  if (kind === "room") return openRoom(name);
  if (kind === "layout") return openLayout(name);
  if (kind === "scene") return openScene(name);
  if (kind === "palette") return openPalette();
  const g = GROUPS.find((x) => x.kind === kind);
  if (g) return openers[kind](g, name);
}
function renderTabs() {
  const box = $("tabs"); box.replaceChildren();
  // a tab whose file is gone (deleted, renamed) disappears
  state.tabs = state.tabs.filter((k) => {
    const [kind, ...rest] = k.split(":"), name = rest.join(":");
    if (kind === "file") return state.files.includes(name);
    if (kind === "layout") return !!state.scan && state.scan.layouts.includes(name);
    if (kind === "scene") return !!state.scan && state.scan.groups.scenes.includes(name);
    if (kind === "palette") return !!state.scan && state.scan.hasGame;
    const g = kind === "room" ? group("rooms") : GROUPS.find((x) => x.kind === kind);
    return g && state.scan && state.scan.groups[g.key].includes(name);
  });
  const cur = tabKey();
  // one tab alone is not worth the room, unless it is a scene: its tab is where Layout and Code are
  if (state.tabs.length < 2 && !(cur && cur.startsWith("scene:"))) return;
  for (const k of state.tabs) {
    const label = k === "palette:palette" ? "Colours" : k.split(":").slice(1).join(":").split("/").pop() + (k.startsWith("layout:") ? " · layout" : "");
    const t = document.createElement("div"); t.className = "tab-item" + (k === cur ? " on" : ""); t.title = k.replace(":", ": ");
    const x = document.createElement("button"); x.textContent = "\u00D7"; x.title = "Close this tab";
    x.onclick = (e) => { e.stopPropagation(); state.tabs = state.tabs.filter((y) => y !== k); renderTabs(); };
    t.append(label, x);
    if (k.startsWith("scene:")) t.appendChild(sceneParts(k.slice(6), k === cur));
    t.onclick = () => run("open", () => openTab(k));
    box.appendChild(t);
  }
}

// Layout and Code inside a scene's tab: the open half lit while the tab is open; a half the scene does not have yet says + and makes it.
function sceneParts(scene, open) {
  const box = document.createElement("span"); box.className = "tab-parts";
  const code = codeOf(scene), has = { layout: state.scan.layouts.includes(scene), code: state.scan.code.includes(code) };
  const now = open ? (state.view === "room" ? "layout" : "code") : null;
  for (const [part, label, tip] of [["layout", "Layout", "What is placed where: drag things in, name them to use them in the code"], ["code", code !== scene ? `Code (${code})` : "Code", "What the scene does: enter, update, draw"]]) {
    const b = document.createElement("button"); b.className = "tab-part" + (now === part ? " on" : "") + (has[part] ? "" : " missing");
    b.textContent = has[part] ? label : "+ " + label; b.title = has[part] ? tip : `This scene has no ${part} yet: click to add one`;
    b.onclick = (e) => { e.stopPropagation(); run("open", () => openScenePart(scene, part)); };
    box.appendChild(b);
  }
  return box;
}

// ---------- outline and tidy (the code editor's bar) ----------
function renderCodeTools() {
  const lua = state.view === "code" && state.file && state.file.endsWith(".lua");
  $("outline").hidden = $("btn-tidy").hidden = !lua;
  if (!$("outline").options.length) $("outline").appendChild(new Option("Go to…", "")); // filled when it is opened
  $("btn-split").hidden = state.view !== "code" || !state.file || !$("split").hidden;
  // the same file is never open on both sides
  if (split.file && split.file === state.file && state.view === "code") closeSplit();
}

// ---------- split view: a second file beside the first ----------
const split = { view: null, file: null, dirty: false, theme: new Compartment() };
function makeSplitEditor() {
  split.view = new EditorView({
    parent: $("split-editor"),
    state: EditorState.create({
      doc: "",
      extensions: [
        basicSetup, EditorView.lineWrapping, keymap.of([indentWithTab]), luaLanguage, split.theme.of(codeLook(scheme())),
        ...luaIntel({ getApi: () => luaApi, getIndex: () => luaIndex, getFile: () => split.file, get server() { return null; },
          openResource: (g, name) => openers[group(g).kind](group(g), name), openHelp: (page, anchor) => help.open(page, anchor) }),
        EditorView.updateListener.of((u) => { if (u.docChanged && !split.loading) { split.dirty = true; $("split-dirty").textContent = "●"; } }),
      ],
    }),
  });
}
function fillSplitChoices() {
  const sel = $("split-file"), files = state.files.filter((f) => f.endsWith(".lua") && f !== state.file);
  sel.replaceChildren(...files.map((f) => new Option(f, f)));
  sel.value = split.file || "";
}
async function openSplit(rel) {
  if (!split.view) makeSplitEditor();
  await saveSplit();
  const text = await invoke("read_file", { cart: state.cart, rel });
  split.file = rel; split.loading = true;
  split.view.dispatch({ changes: { from: 0, to: split.view.state.doc.length, insert: text } });
  split.loading = false; split.dirty = false; $("split-dirty").textContent = "";
  $("split").hidden = $("gut-split").hidden = false; fillSplitChoices(); renderCodeTools();
}
async function saveSplit() {
  if (!split.file || !split.dirty) return;
  const text = split.view.state.doc.toString();
  await invoke("write_file", { cart: state.cart, rel: split.file, content: text });
  luaTexts[split.file] = text; luaIndex = buildIndex(state.scan ? state.scan.groups : {}, luaTexts);
  if (luaServer) luaServer.saved(split.file);
  split.dirty = false; $("split-dirty").textContent = "";
}
async function closeSplit() {
  await saveSplit();
  split.file = null; $("split").hidden = $("gut-split").hidden = true; renderCodeTools();
}
$("btn-split").onclick = () => run("split", async () => {
  const other = state.files.filter((f) => f.endsWith(".lua") && f !== state.file);
  if (!other.length) { info("This game has no other Lua file to show beside it yet."); return; }
  await openSplit(other.includes("game.lua") && state.file !== "game.lua" ? other.find((f) => f !== "game.lua") || other[0] : other[0]);
});
$("split-file").onchange = () => run("split", () => openSplit($("split-file").value));
$("split-close").onclick = () => run("split", closeSplit);
function fillOutline() {
  const sel = $("outline"), items = outline(view.state.doc.toString());
  sel.replaceChildren(new Option(items.length ? "Go to…" : "No functions", ""), ...items.map((o) => new Option(o.name, String(o.line))));
}
$("outline").onmousedown = fillOutline; $("outline").onfocus = fillOutline;
$("outline").onchange = () => {
  const n = Number($("outline").value); $("outline").value = "";
  if (n) openFile(state.file, true, { line: n - 1, character: 0 });
};
function tidy() {
  if (state.view !== "code" || !state.file || !state.file.endsWith(".lua")) return;
  const text = view.state.doc.toString(), next = tidyLua(text);
  if (next === text) { info("This file is already tidy."); return; }
  view.dispatch({ changes: { from: 0, to: text.length, insert: next } });
}
$("btn-tidy").onclick = tidy;

// ---------- find in game, references, rename ----------
// Every Lua file's text: the open one as it is in the editor, the rest as saved.
async function luaFileTexts() {
  const out = {};
  for (const rel of state.files.filter((f) => f.endsWith(".lua"))) {
    out[rel] = rel === state.file && state.view === "code" ? view.state.doc.toString() : luaTexts[rel] ?? (await invoke("read_file", { cart: state.cart, rel }));
  }
  return out;
}
const findOpts = () => ({ caseSensitive: $("fd-case").checked, wholeWord: $("fd-word").checked, regex: $("fd-regex").checked });
function showHits(hits, title) {
  $("fd-title").textContent = title || "Find in game";
  const box = $("fd-results"); box.replaceChildren();
  const files = new Set(hits.map((h) => h.rel));
  $("fd-summary").textContent = hits.length ? `${hits.length} in ${files.size} file${files.size === 1 ? "" : "s"}${hits.length >= 2000 ? " (the first 2000)" : ""}` : "Nothing found.";
  let last = null;
  for (const h of hits) {
    if (h.rel !== last) { const f = document.createElement("div"); f.className = "fd-file"; f.textContent = h.rel; box.appendChild(f); last = h.rel; }
    const row = document.createElement("div"); row.className = "fd-hit";
    const ln = document.createElement("span"); ln.className = "ln"; ln.textContent = h.line;
    const start = Math.max(0, h.col - 30), text = h.text.slice(start, h.col + h.length + 60);
    const b = document.createElement("b"); b.textContent = h.text.substr(h.col, h.length);
    row.append(ln, (start ? "…" : "") + text.slice(0, h.col - start), b, text.slice(h.col - start + h.length));
    row.onclick = () => run("open", () => openFile(h.rel, false, { line: h.line - 1, character: h.col }));
    box.appendChild(row);
  }
}
let findTimer = null;
async function runFind() {
  if (!state.cart) return;
  const q = $("fd-query").value;
  if (!q) { showHits([], "Find in game"); $("fd-summary").textContent = "Type what to find. It looks in every Lua file of the game."; return; }
  showHits(findInFiles(await luaFileTexts(), q, findOpts()));
}
function openFind(query) {
  if (!state.cart) return;
  const d = $("find-dialog");
  if (!d.open) d.show();
  if (query !== undefined) $("fd-query").value = query;
  $("fd-query").focus(); $("fd-query").select();
  runFind();
}
$("btn-find").onclick = () => openFind();
$("fd-close").onclick = () => $("find-dialog").close();
for (const id of ["fd-query", "fd-case", "fd-word", "fd-regex"]) $(id).addEventListener("input", () => { clearTimeout(findTimer); findTimer = setTimeout(runFind, 150); });
$("fd-query").onkeydown = (e) => { if (e.key === "Escape") $("find-dialog").close(); };
$("fd-replace-all").onclick = () => run("replace", async () => {
  const q = $("fd-query").value; if (!q) return;
  await save();
  const texts = await luaFileTexts();
  let files = 0, count = 0;
  for (const [rel, text] of Object.entries(texts)) {
    const r = replaceInText(text, q, $("fd-replace").value, findOpts());
    if (!r.count) continue;
    await invoke("write_file", { cart: state.cart, rel, content: r.text });
    luaTexts[rel] = r.text; files++; count += r.count;
    if (rel === state.file && state.view === "code") { setDoc(r.text); state.dirty = false; }
    if (luaServer) luaServer.saved(rel);
  }
  luaIndex = buildIndex(state.scan ? state.scan.groups : {}, luaTexts);
  info(count ? `Replaced ${count} in ${files} file${files === 1 ? "" : "s"}.` : "Nothing to replace.");
  renderTitle(); runFind();
});
// the word under the cursor
function wordAt(v, pos) {
  const line = v.state.doc.lineAt(pos), i = pos - line.from;
  const left = line.text.slice(0, i).match(/[A-Za-z_]\w*$/), right = line.text.slice(i).match(/^\w*/);
  const w = (left ? left[0] : "") + (right ? right[0] : "");
  return /^[A-Za-z_]\w*$/.test(w) ? w : "";
}
async function referencesAt(v, pos) {
  const word = wordAt(v, pos); if (!word) return;
  if (luaServer && luaServer.ready) {
    const refs = await luaServer.references(state.file, v.state.doc.toString(), pos);
    if (refs.length) {
      const texts = await luaFileTexts();
      $("find-dialog").open || $("find-dialog").show();
      showHits(refs.map((r) => ({ rel: r.rel, line: r.line + 1, col: r.character, length: r.length || word.length, text: (texts[r.rel] || "").split("\n")[r.line] || "" })), `Uses of ${word}`);
      return;
    }
  }
  // without the language server: every whole-word match
  $("fd-word").checked = true; $("fd-case").checked = true; $("fd-regex").checked = false;
  openFind(word);
}
async function renameAt(v, pos) {
  const word = wordAt(v, pos); if (!word) return;
  if (!(luaServer && luaServer.ready)) {
    info("Renaming everywhere needs the Lua language server (scripts/fetch-luals.sh). Find in game is open with the name: type the new one beside Replace all.");
    $("fd-word").checked = true; $("fd-case").checked = true; $("fd-regex").checked = false;
    openFind(word); $("fd-replace").value = word; $("fd-replace").focus(); $("fd-replace").select();
    return;
  }
  const next = (prompt(`Rename ${word} everywhere in the game to:`, word) || "").trim();
  if (!next || next === word) return;
  if (!/^[A-Za-z_]\w*$/.test(next)) { fail(new Error("A Lua name uses letters, digits and _, and does not start with a digit.")); return; }
  await run("rename", async () => {
    const edits = await luaServer.rename(state.file, v.state.doc.toString(), pos, next);
    if (!edits) { info(`Nothing to rename at ${word}.`); return; }
    const texts = await luaFileTexts();
    let n = 0;
    for (const [rel, list] of Object.entries(edits)) {
      if (texts[rel] === undefined) continue;
      const out = applyEdits(texts[rel], list);
      await invoke("write_file", { cart: state.cart, rel, content: out });
      luaTexts[rel] = out; n += list.length;
      if (rel === state.file && state.view === "code") { const head = v.state.selection.main.head; setDoc(out); state.dirty = false; view.dispatch({ selection: { anchor: Math.min(head, out.length) } }); }
      luaServer.saved(rel);
    }
    luaIndex = buildIndex(state.scan ? state.scan.groups : {}, luaTexts);
    info(`Renamed ${word} to ${next}: ${n} place${n === 1 ? "" : "s"} in ${Object.keys(edits).length} file${Object.keys(edits).length === 1 ? "" : "s"}.`);
    renderTitle();
  });
}
window.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); openFind(state.view === "code" && view ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to) || undefined : undefined); }
  if (mod && e.shiftKey && e.key.toLowerCase() === "o" && !$("outline").hidden) { e.preventDefault(); fillOutline(); $("outline").focus(); $("outline").showPicker?.(); }
  if (e.shiftKey && e.altKey && e.code === "KeyF") { e.preventDefault(); tidy(); } // e.key is another letter with Option held on a Mac
});

// ---------- settings ----------
$("btn-settings").onclick = async () => {
  const s = await invoke("get_settings");
  $("set-workspace").value = s.workspace; $("set-host").value = s.device_host;
  $("set-theme").value = lookChoice();
  $("set-run-in").value = runInStudio() ? "studio" : "window";
  $("set-user").value = s.device_user; $("set-dir").value = s.device_dir;
  $("settings").showModal();
};
$("settings").addEventListener("close", async () => {
  if ($("settings").returnValue !== "save") return;
  try { localStorage.setItem("gs.runIn", $("set-run-in").value); } catch { /* stays in the studio */ }
  try {
    await invoke("save_settings", { settings: {
      workspace: $("set-workspace").value.trim(), device_host: $("set-host").value.trim(),
      device_user: $("set-user").value.trim(), device_dir: $("set-dir").value.trim() } });
    info("Settings saved.");
    await refreshGames(); render();
  } catch (e) { fail(e); }
});

// ---------- boot ----------
(async function boot() {
  const native = !!window.__TAURI_INTERNALS__; // the real app (the mock below fakes the commands, not the window)
  if (import.meta.env.DEV && !native) {
    await import("./mock-backend.js"); // plain-browser development: in-memory fake of the Rust commands
  }
  setupWindowChrome($("toolbar"), { native });
  play = createPlayPanel($("play"), {
    sendButtons: (mask) => { invoke("preview_buttons", { mask }).catch(() => { /* the game has just ended */ }); },
    popOut: () => { try { localStorage.setItem("gs.runIn", "window"); } catch { /* not remembered */ } showPlay(false); if (state.running) $("btn-run").click(); },
    close: () => { showPlay(false); if (state.running) invoke("stop_preview").catch(fail); },
  });
  setupPanels([
    { handle: $("gut-side"), target: $("app"), prop: "--side-w", axis: "x", from: "start", unit: "px", min: 160, max: () => Math.min(520, innerWidth * 0.45) },
    { handle: $("gut-log"), target: $("app"), prop: "--log-h", axis: "y", from: "end", unit: "px", min: 90, max: () => innerHeight - 220 },
    { handle: $("gut-play"), target: $("app"), prop: "--play-w", axis: "x", from: "end", unit: "px", min: 240, max: () => innerWidth * 0.6 },
    { handle: $("gut-split"), target: $("code-area"), prop: "--split-w", axis: "x", from: "start", unit: "%", min: 200, max: () => $("code-area").clientWidth - 200 },
  ]);
  listen("log", (e) => {
    const line = e.payload.line;
    const look = parseInspectLine(line); // the Inspector's answer, not for the Output
    // the panel is rebuilt with each answer, except while a field or menu in it is in use
    if (look) { insp.report = look; if (state.logTab === "insp" && !$("inspector").contains(document.activeElement)) renderInspector(); return; }
    const stats = parseStatsLine(line); // numbers for the Handheld panel, not for the Output
    if (stats) { state.live = stats; if (state.logTab === "hh") renderHandheld(); return; } // the engine's and runtime's budget warnings start with "warning:" and show in amber, not as errors
    log(line, /^warning:/.test(line) ? "warn" : e.payload.stream === "stderr" ? "err" : "");
  });
  listen("preview-state", (e) => {
    state.running = e.payload; if (!e.payload) { state.live = null; play.stopped(); }
    // a new run starts unpaused with the inspector's view as it was
    insp.paused = false; insp.report = null; inspSent = ""; if (e.payload) sendInspect();
    render(); if (state.logTab === "hh") renderHandheld(); renderInspector();
  });
  luaServer = createLuaServer({ invoke, listen, note: info, onDiagnostics: (rel) => { if (rel === state.file && state.view === "code") forceLinting(view); } });
  help = createHelp($("help-dialog"), { getApi: () => luaApi, hasGame: () => !!state.scan && state.scan.hasGame, addFile: addHelpFile, makeGame: makeHelpGame,
    getConsoles: () => allConsoles(state.customConsoles), openGame: openExample, onPage: (id) => { if (id === "first-game") stepDone("tutorial"); } });
  makeEditor();
  const palette = artPalette;
  paletteEditor = createPaletteEditor($("palette-editor"), {
    onChange: renderTitle, getLimits: () => bankLimits(conInfo()), getUsers: (name) => bankUsersCache[name] || [],
  });
  spriteEditor = createSpriteEditor($("sprite-editor"), { onChange: renderTitle, getPalette: palette, getBudgets: () => conInfo().budgets, getScreen: () => conInfo().screen });
  consoleEditor = createConsoleEditor($("console-dialog"), { takenIds: takenConsoleIds });
  roomEditor = createRoomEditor($("room-editor"), {
    onChange: renderTitle, getEntities: () => state.scan.groups.entities, getTilesets: () => state.scan.groups.tilesets,
    loadTileset: loadRoomTileset, entityLook, getScreen: () => conInfo().screen,
    editAsText: async () => { await save(); await openFile(dataRel(roomEditor.getKind(), roomEditor.getName()), true); },
    getSprites: () => state.scan.groups.sprites, getScenes: () => state.scan.groups.scenes, spriteLook,
    // a text's colour: a place in the classic palette, or (with colour banks) any of the game's bank colours, written as #rrggbb
    getPalette: () => { const p = artPalette(); return p.mode === "banks" ? { colors: [...new Set([...p.sprites, ...p.tiles].flatMap((b) => b.colors))], fixed: false } : { colors: p.colors || [], fixed: p.mode === "fixed" }; },
  });
  // The runtime's own synth makes every preview, so it sounds exactly like the game.
  sfxEditor = createSfxEditor($("sfx-editor"), {
    onChange: renderTitle,
    getInstrumentNames: instrumentNames,
    getChannels: () => conInfo().audio?.sfx_channels || 4,
    previewInstrument: (n) => previewNamed(n),
    previewNote: (n, note) => previewNamed(n, note),
    copyInstrument: (n) => copyBuiltin(n),
    getLookups: instrumentLookups,
    renderSfx: async (def, o) => { const c = await audioContext(); return renderChecked(renderSfxWith(def, c.lookups, { ...o, style: c.style, sfxChannels: c.sfxChannels })); },
  });
  instrumentEditor = createInstrumentEditor($("instrument-editor"), {
    onChange: renderTitle,
    getSamples: () => (state.scan ? state.scan.groups.sounds : []),
    renderInstrument: async (def, note) => { const c = await audioContext(); return renderChecked(instrumentPreviewDesc(def, note, c.lookups, { style: c.style, channels: c.channels, stereo: true })); },
  });
  musicEditor = createMusicEditor($("music-editor"), {
    onChange: renderTitle,
    getChannels: () => conInfo().audio?.music_tracks || 4,
    getLookups: instrumentLookups,
    previewInstrument: (n) => previewNamed(n),
    previewNote: (n, note) => previewNamed(n, note),
    copyInstrument: (n) => copyBuiltin(n),
    getInstrumentNames: instrumentNames,
    loadSfx: (n) => readJson(`sfx/${n}.json`),
    renderSong: async (song, o) => { const c = await audioContext(); return renderChecked(renderSongDesc(song, c.lookups, { style: c.style, channels: c.channels, sfxChannels: c.sfxChannels, seconds: o.seconds })); },
    renderNote: async (inst, note) => { const c = await audioContext(); return renderChecked(namedNotePreviewDesc(inst, note, c.lookups, { style: c.style, channels: c.channels, sfxChannels: c.sfxChannels, stereo: true })); },
  });
  tilesetEditor = createSpriteEditor($("tileset-editor"), { mode: "tileset", onChange: renderTitle, onError: fail, getPalette: palette });
  try {
    await refreshGames();
    await refreshConsoles();
    const s = await invoke("get_settings");
    info("Workspace: " + s.workspace);
    if (!(await invoke("runtime_status")).desktop) info("Desktop runtime not found: run ./scripts/build.sh in the workspace, or fix the workspace in Settings.");
    render(); // starts on the welcome screen: pick or create a game
  } catch (e) { fail(e); render(); }
})();
