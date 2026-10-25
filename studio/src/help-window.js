// The Help window (help.html): the help pages beside the studio rather than over it. What a page does to the game (add a file, make a
// tutorial's game, open an example) is asked of the studio's window through the bridge, which answers when it is done.
import "./style.css";
import { createHelp } from "./help.js";
import { createBridge } from "./help-bridge.js";
import { parseApi } from "./lua-intel-core.js";
import { BUILTIN_CONSOLES } from "./consoles.js";
import "./theme.js"; // the system's light or dark, or the look picked in the studio's Settings
import apiText from "../../engine/api/gs.d.lua?raw";

const luaApi = parseApi(apiText);
let studio = { hasGame: false, consoles: BUILTIN_CONSOLES }; // what the studio last said about itself
let nextId = 1;
const waiting = {};

(async function start() {
  const bridge = await createBridge(!!window.__TAURI_INTERNALS__); // this page never loads the mock, so this is the real app
  const ask = (action, args) => new Promise((resolve, reject) => {
    const id = nextId++;
    waiting[id] = { resolve, reject };
    bridge.send("to-studio:request", { id, action, args });
  });
  await bridge.on("to-help:reply", ({ id, ok, error }) => {
    const w = waiting[id]; if (!w) return;
    delete waiting[id];
    if (ok) w.resolve(); else w.reject(new Error(error || "the studio could not do that"));
  });
  const help = createHelp(document.getElementById("help-root"), {
    getApi: () => luaApi, hasGame: () => studio.hasGame, getConsoles: () => studio.consoles,
    addFile: (rel, text) => ask("addFile", { rel, text }),
    makeGame: (title, files, consoleId) => ask("makeGame", { title, files, consoleId }),
    openGame: (name) => ask("openGame", { name }),
    onPage: (id) => bridge.send("to-studio:page", { id }),
  }, { window: true });
  await bridge.on("to-help:state", (s) => { const had = studio.hasGame; studio = s; if (had !== s.hasGame) help.refresh(); });
  await bridge.on("to-help:open", ({ page, anchor }) => help.open(page, anchor));
  const [page, anchor] = decodeURIComponent(location.hash.slice(1)).split("/");
  help.open(page || undefined, anchor || undefined);
  bridge.send("to-studio:hello");
})();
