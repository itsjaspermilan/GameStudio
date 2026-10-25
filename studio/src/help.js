// Help: the pages in docs/help/ (HTML written by hand), a search box, and the API reference made from the editor's own notes. It fills
// the Help window (help.html, help-window.js), a window of its own beside the studio; opts.window false puts it in a <dialog> instead.
// hooks: { getApi(), hasGame(), addFile(rel, text) -> Promise, makeGame(title, files, consoleId) -> Promise, getConsoles(), openGame(name) -> Promise }
// Links in pages: help:<page> opens a page, open:<game> opens a game from the workspace (the finished examples).
import { parsePage, gameFiles, contents, search, apiPageHtml, highlightLua } from "./help-core.js";

const raw = import.meta.glob("../../docs/help/*.html", { query: "?raw", import: "default", eager: true });
// pictures a page shows with <img src="img/name.png">: bundled with the studio, so the window finds them offline
const pictures = Object.fromEntries(Object.entries(import.meta.glob("../../docs/help/img/*.png", { query: "?url", import: "default", eager: true })).map(([path, url]) => ["img/" + path.split("/").pop(), url]));
const filePages = Object.entries(raw).map(([path, text]) => parsePage(text, path.split("/").pop().replace(/^\d+-|\.html$/g, "")));

export function createHelp(dialog, hooks, opts = {}) {
  const inWindow = !!opts.window;
  const done = () => { if (!inWindow) dialog.close(); }; // a dialog gets out of the way of the game it just opened; the window stays beside it
  let pages = filePages, current = null;
  const api = { id: "api", title: "API reference", group: "Guides", order: 999, summary: "Every function and value the engine gives you.", body: "" };
  const all = () => { api.body = apiPageHtml(hooks.getApi()); return [...pages, api]; };

  dialog.className = "help-dialog" + (inWindow ? " help-window" : "");
  dialog.innerHTML = `
    <div class="help-nav">
      <div class="help-title">Help</div>
      <input class="help-search" type="search" placeholder="Search the help" spellcheck="false">
      <div class="help-list"></div>
    </div>
    <div class="help-main">
      <div class="help-bar"><span class="help-crumb"></span><button class="small help-close">Close</button></div>
      <article class="help-article"></article>
    </div>`;
  const list = dialog.querySelector(".help-list"), box = dialog.querySelector(".help-search"), article = dialog.querySelector(".help-article"), crumb = dialog.querySelector(".help-crumb");
  if (inWindow) dialog.querySelector(".help-close").remove(); // the window has its own close button
  else dialog.querySelector(".help-close").onclick = () => dialog.close();

  function renderList() {
    list.replaceChildren();
    const q = box.value.trim();
    const entry = (p, extra) => {
      const a = document.createElement("a"); a.className = "help-item" + (current === p.id ? " active" : ""); a.href = "#"; a.title = p.summary;
      a.textContent = p.title; if (extra) { const s = document.createElement("small"); s.textContent = extra; a.appendChild(s); }
      a.onclick = (e) => { e.preventDefault(); show(p.id); };
      return a;
    };
    if (q) {
      const found = search(all(), q);
      if (!found.length) { const n = document.createElement("div"); n.className = "help-none"; n.textContent = "Nothing found."; list.appendChild(n); }
      for (const p of found) list.appendChild(entry(p, p.group));
      return;
    }
    for (const g of contents(all())) {
      const h = document.createElement("div"); h.className = "help-group"; h.textContent = g.group; list.appendChild(h);
      for (const p of g.pages) list.appendChild(entry(p));
    }
  }

  function decorate(page) {
    for (const pre of article.querySelectorAll("pre")) {
      const code = pre.querySelector("code"); if (!code) continue;
      const text = code.textContent;
      if (pre.classList.contains("lua")) code.innerHTML = highlightLua(text);
      const bar = document.createElement("div"); bar.className = "help-codebar";
      const name = document.createElement("span"); name.textContent = pre.dataset.path || (pre.classList.contains("shell") ? "terminal" : "");
      bar.appendChild(name);
      const copy = document.createElement("button"); copy.className = "small"; copy.textContent = "Copy";
      copy.onclick = async () => { try { await navigator.clipboard.writeText(text); copy.textContent = "Copied"; setTimeout(() => { copy.textContent = "Copy"; }, 1200); } catch { copy.textContent = "Select and copy by hand"; } };
      bar.appendChild(copy);
      if (pre.dataset.path && hooks.hasGame()) {
        const add = document.createElement("button"); add.className = "small"; add.textContent = "Add to my game"; add.title = "Create this file in the game you have open";
        add.onclick = async () => { try { await hooks.addFile(pre.dataset.path, text + "\n"); add.textContent = "Added"; add.disabled = true; } catch (e) { add.textContent = String(e).slice(0, 60); } };
        bar.appendChild(add);
      }
      pre.before(bar);
    }
    const files = gameFiles(page);
    if (files) {
      const foot = document.createElement("div"); foot.className = "help-make";
      const b = document.createElement("button"); b.className = "primary"; b.textContent = "Make this game";
      b.title = "Creates a new game from the files on this page and opens it";
      const pick = document.createElement("select"); pick.className = "help-console";
      pick.title = "The console the new game is made for. The tutorials are laid out for Glow43 (256×192); on a smaller screen some things may sit off the edge.";
      for (const c of hooks.getConsoles ? hooks.getConsoles() : []) pick.appendChild(new Option(`${c.name} ${c.screen.width}×${c.screen.height}`, c.id));
      b.onclick = async () => { b.disabled = true; try { await hooks.makeGame(page.title, files, pick.value || "glow43"); b.textContent = "Made: it is open in the studio"; done(); } catch (e) { b.textContent = String(e).slice(0, 80); } };
      const t = document.createElement("span"); t.textContent = `${Object.keys(files).length} files, ready to run.`;
      foot.append(b, ...(pick.options.length > 1 ? [pick] : []), t); article.appendChild(foot);
    }
  }

  function show(id, anchor) {
    const page = all().find((p) => p.id === id) || all()[0];
    current = page.id;
    if (hooks.onPage) hooks.onPage(page.id);
    article.innerHTML = page.body;
    for (const img of article.querySelectorAll("img[src^='img/']")) img.src = pictures[img.getAttribute("src")] || "";
    crumb.textContent = `${page.group}  ›  ${page.title}`;
    decorate(page);
    for (const a of article.querySelectorAll("a[href^='help:']")) a.onclick = (e) => { e.preventDefault(); show(a.getAttribute("href").slice(5)); };
    for (const a of article.querySelectorAll("a[href^='open:']")) {
      a.classList.add("help-open");
      a.onclick = async (e) => {
        e.preventDefault();
        try { await hooks.openGame(a.getAttribute("href").slice(5)); done(); } catch (err) { a.textContent = String(err.message || err); }
      };
    }
    for (const a of article.querySelectorAll("a[href^='#']")) a.onclick = (e) => { e.preventDefault(); const t = article.querySelector(`[id="${CSS.escape(a.getAttribute("href").slice(1))}"]`); if (t) t.scrollIntoView({ block: "start" }); };
    renderList();
    const target = anchor && article.querySelector(`[id="${CSS.escape(anchor)}"]`);
    if (target) target.scrollIntoView({ block: "start" }); else article.scrollTop = 0;
  }

  box.oninput = renderList;
  return {
    open(id, anchor) { box.value = ""; show(id || current || "welcome", anchor); if (!inWindow && !dialog.open) dialog.showModal(); },
    refresh() { const top = article.scrollTop; show(current || "welcome"); article.scrollTop = top; }, // the studio opened or closed a game
    pages: () => all(),
  };
}
