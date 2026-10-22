// The room editor: paint tile layers, place entities, draw paths, set the room's size (the camera never shows outside it). Rooms are
// rooms/<name>.lua data files; room-core.js reads and writes them, this file is the DOM over it.
// hooks: { onChange(), getEntities() -> [names], getTilesets() -> [names], loadTileset(name) -> Promise<{ img, tw, th, cols, count }>,
//          entityLook(name) -> Promise<{ img, fw, fh, ox, oy } | null>, getScreen() -> { width, height }, editAsText() }
import { color as themeColor } from "./theme.js";
import * as R from "./room-core.js";
import { History } from "./sprite-core.js";

const TOOLS = [
  ["tiles", "Tiles", "Paint tiles on the chosen layer. Shift-click fills an area, Alt-click erases, right-click picks a tile up. (T)", "t"],
  ["entities", "Things", "Click to place the chosen entity; drag one to move it; Delete removes the selected one. (N)", "n"],
  ["paths", "Paths", "Click to add a point to the chosen path; drag a point to move it; Delete removes the selected point. (P)", "p"],
];

export function createRoomEditor(root, hooks = {}) {
  root.innerHTML = `
    <div class="se-left re-left">
      <div class="re-tools"></div>
      <div class="re-panel re-tiles-panel">
        <h3>Layers</h3>
        <div class="re-layers"></div>
        <div class="se-row"><select class="re-newlayer-ts" title="The tileset the new layer uses"></select><button data-act="addlayer" title="A new tile layer">+ Layer</button></div>
        <h3>Tile</h3>
        <div class="re-tilepal"><canvas class="re-tilecanvas"></canvas></div>
        <p class="se-hint re-tilehint"></p>
      </div>
      <div class="re-panel re-ents-panel">
        <h3>Entity to place</h3>
        <div class="re-entlist"></div>
        <p class="se-hint">Each one starts where you put it when <code>gs.load_room</code> builds the room.</p>
      </div>
      <div class="re-panel re-paths-panel">
        <h3>Paths</h3>
        <div class="re-pathlist"></div>
        <div class="se-row"><button data-act="addpath" title="A new, empty path">+ Path</button></div>
        <label class="se-field"><input type="checkbox" class="re-loop"> Goes round (loop)</label>
        <p class="se-hint">An entity walks one with <code>self:follow_path("name", speed)</code>.</p>
      </div>
    </div>
    <div class="se-center">
      <div class="se-canvaswrap re-wrap"><canvas class="se-canvas re-canvas"></canvas></div>
      <div class="se-status re-status"></div>
    </div>
    <div class="se-right">
      <h3>Room</h3>
      <div class="se-row se-fields">
        <label>W <input type="number" class="re-w" min="16" max="8192" step="16"></label>
        <label>H <input type="number" class="re-h" min="16" max="8192" step="16"></label>
      </div>
      <p class="se-hint re-sizehint"></p>
      <label class="se-field">Background <input type="color" class="re-bg"></label>
      <h3>View</h3>
      <div class="se-row"><button data-act="zoomout">&minus;</button><button data-act="fit">Fit</button><button data-act="zoomin">+</button></div>
      <label class="se-field"><input type="checkbox" class="re-snap" checked> Snap to the grid</label>
      <label class="se-field"><input type="checkbox" class="re-grid" checked> Show the grid</label>
      <div class="se-row"><button data-act="undo">Undo</button><button data-act="redo">Redo</button></div>
      <div class="re-selected">
        <h3>Selected</h3>
        <div class="re-selinfo"></div>
        <label class="se-field">Values <input class="re-props" spellcheck="false" placeholder="{ hp = 3 }" title="Starting values for this one only, as a Lua table"></label>
        <div class="se-row"><button data-act="delent">Delete</button></div>
      </div>
      <h3>As text</h3>
      <div class="se-row"><button data-act="text" title="Open rooms/…lua in the code editor">Edit as text</button></div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const canvas = $(".re-canvas"), ctx = canvas.getContext("2d"), wrap = $(".re-wrap");
  let room = null, name = "", dirty = false, tool = "tiles", zoom = 2;
  let layerIx = 0, tile = 0, entName = "", sel = -1, pathName = "", pointIx = -1;
  const tilesets = {}, looks = {};
  const history = new History(100);

  const snapshot = () => JSON.stringify(room);
  function commit(fn) { const before = snapshot(); fn(); if (snapshot() !== before) { history.record(before); markDirty(); } render(); }
  function markDirty() { dirty = true; hooks.onChange && hooks.onChange(); }
  const layer = () => room.layers[layerIx];
  const ts = (l) => l && tilesets[l.tileset];
  const grid = () => { const t = ts(layer()); return t ? t.tw : 16; };

  // ---------- assets ----------
  async function loadAssets() {
    for (const l of room.layers) if (l.tileset && !tilesets[l.tileset]) {
      try { tilesets[l.tileset] = await hooks.loadTileset(l.tileset); } catch { tilesets[l.tileset] = null; }
    }
    const names = new Set(room.entities.map((e) => e[0]));
    if (entName) names.add(entName);
    for (const n of names) if (!(n in looks)) { try { looks[n] = await hooks.entityLook(n); } catch { looks[n] = null; } }
    render();
  }

  // ---------- drawing ----------
  function render() {
    if (!room) return;
    const cw = Math.round(room.width * zoom), ch = Math.round(room.height * zoom);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; canvas.style.width = cw + "px"; canvas.style.height = ch + "px"; }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = room.background || "#000000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // layers back to front: a bigger depth is further back, as in the game
    const order = room.layers.map((l, i) => i).sort((a, b) => (room.layers[b].depth ?? 100) - (room.layers[a].depth ?? 100));
    for (const i of order) {
      const l = room.layers[i], t = ts(l);
      if (!t || l.visible === false) continue;
      ctx.globalAlpha = tool === "tiles" && i !== layerIx ? 0.45 : 1;
      l.data.forEach((row, r) => row.forEach((v, c) => {
        if (v < 0 || v >= t.count) return;
        ctx.drawImage(t.img, (v % t.cols) * t.tw, Math.floor(v / t.cols) * t.th, t.tw, t.th, c * t.tw * zoom, r * t.th * zoom, t.tw * zoom, t.th * zoom);
      }));
    }
    ctx.globalAlpha = 1;
    if ($(".re-grid").checked && zoom >= 1) {
      const g = grid() * zoom;
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = g; x < canvas.width; x += g) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, canvas.height); }
      for (let y = g; y < canvas.height; y += g) { ctx.moveTo(0, y + 0.5); ctx.lineTo(canvas.width, y + 0.5); }
      ctx.stroke();
    }
    // one screen's worth from the top-left corner: how much the camera shows at once
    const scr = hooks.getScreen ? hooks.getScreen() : { width: 320, height: 240 };
    ctx.setLineDash([6, 4]); ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.strokeRect(0.5, 0.5, Math.min(scr.width, room.width) * zoom - 1, Math.min(scr.height, room.height) * zoom - 1);
    ctx.setLineDash([]);
    // entities
    ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center";
    room.entities.forEach(([n, x, y], i) => {
      const look = looks[n], px = x * zoom, py = y * zoom;
      ctx.globalAlpha = tool === "entities" ? 1 : 0.6;
      if (look) ctx.drawImage(look.img, 0, 0, look.fw, look.fh, px - look.ox * zoom, py - look.oy * zoom, look.fw * zoom, look.fh * zoom);
      else { ctx.fillStyle = "#ffa38c"; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (i === sel && tool === "entities") { ctx.strokeStyle = themeColor("accent"); ctx.lineWidth = 2; ctx.strokeRect(px - 9, py - 9, 18, 18); }
      if (!look || i === sel) { ctx.fillStyle = "#ffffff"; ctx.fillText(n, px, py - 10); }
    });
    // paths
    for (const [k, p] of Object.entries(room.paths)) {
      const on = k === pathName && tool === "paths";
      ctx.strokeStyle = on ? "#f5d94a" : "rgba(245,217,74,0.4)"; ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath();
      p.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * zoom, y * zoom) : ctx.moveTo(x * zoom, y * zoom)));
      if (p.loop && p.points.length > 2) ctx.closePath();
      ctx.stroke();
      p.points.forEach(([x, y], i) => {
        ctx.fillStyle = on && i === pointIx ? "#ffffff" : on ? "#f5d94a" : "rgba(245,217,74,0.4)";
        ctx.fillRect(x * zoom - 3, y * zoom - 3, 6, 6);
      });
      if (p.points.length) { ctx.fillStyle = on ? "#f5d94a" : "rgba(245,217,74,0.6)"; ctx.fillText(k, p.points[0][0] * zoom, p.points[0][1] * zoom - 8); }
    }
    renderSide();
  }

  function renderSide() {
    root.querySelectorAll(".re-tools button").forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
    $(".re-tiles-panel").hidden = tool !== "tiles"; $(".re-ents-panel").hidden = tool !== "entities"; $(".re-paths-panel").hidden = tool !== "paths";
    // layers
    const lbox = $(".re-layers"); lbox.replaceChildren();
    if (!room.layers.length) { const p = document.createElement("p"); p.className = "se-hint"; p.textContent = "No tile layers yet. Pick a tileset and add one."; lbox.appendChild(p); }
    room.layers.forEach((l, i) => {
      const row = document.createElement("div"); row.className = "re-layer" + (i === layerIx ? " active" : "");
      const eye = document.createElement("input"); eye.type = "checkbox"; eye.checked = l.visible !== false; eye.title = "Show this layer (in the game too)";
      eye.onclick = (e) => { e.stopPropagation(); commit(() => { if (eye.checked) delete l.visible; else l.visible = false; }); };
      const label = document.createElement("span"); label.textContent = `${l.name || "layer " + (i + 1)} · ${l.tileset}`;
      label.title = `depth ${l.depth ?? 100} (a bigger depth is further back)${l.solid ? ", solid" : ""}`;
      const del = document.createElement("button"); del.className = "small"; del.textContent = "×"; del.title = "Delete this layer";
      del.onclick = (e) => { e.stopPropagation(); commit(() => { room.layers.splice(i, 1); layerIx = Math.max(0, Math.min(layerIx, room.layers.length - 1)); }); };
      row.append(eye, label, del);
      row.onclick = () => { layerIx = i; tile = 0; render(); };
      lbox.appendChild(row);
    });
    const tsSel = $(".re-newlayer-ts"), names = hooks.getTilesets ? hooks.getTilesets() : [];
    if (tsSel.options.length !== names.length) tsSel.replaceChildren(...names.map((n) => new Option(n, n)));
    $("[data-act=addlayer]").disabled = !names.length;
    drawTilePalette();
    // entities
    const ebox = $(".re-entlist"); ebox.replaceChildren();
    const ents = hooks.getEntities ? hooks.getEntities() : [];
    if (!ents.length) { const p = document.createElement("p"); p.className = "se-hint"; p.textContent = "No entities in this game yet."; ebox.appendChild(p); }
    for (const n of ents) {
      const b = document.createElement("button"); b.className = "re-pick" + (n === entName ? " active" : ""); b.textContent = n;
      b.onclick = () => { entName = n; if (!(n in looks)) loadAssets(); renderSide(); };
      ebox.appendChild(b);
    }
    // paths
    const pbox = $(".re-pathlist"); pbox.replaceChildren();
    for (const [k, p] of Object.entries(room.paths)) {
      const row = document.createElement("div"); row.className = "re-layer" + (k === pathName ? " active" : "");
      const label = document.createElement("span"); label.textContent = `${k} · ${p.points.length} point${p.points.length === 1 ? "" : "s"}`;
      const ren = document.createElement("button"); ren.className = "small"; ren.textContent = "✎"; ren.title = "Rename";
      ren.onclick = (e) => {
        e.stopPropagation();
        const n = (prompt("New name for the path", k) || "").trim();
        if (!n || n === k) return;
        if (!/^[A-Za-z_]\w*$/.test(n) || room.paths[n]) { alert("Use letters, digits and _ (not starting with a digit), and a name not taken."); return; }
        commit(() => { room.paths = Object.fromEntries(Object.entries(room.paths).map(([a, b]) => [a === k ? n : a, b])); pathName = n; });
      };
      const del = document.createElement("button"); del.className = "small"; del.textContent = "×"; del.title = "Delete this path";
      del.onclick = (e) => { e.stopPropagation(); commit(() => { delete room.paths[k]; if (pathName === k) pathName = ""; }); };
      row.append(label, ren, del);
      row.onclick = () => { pathName = k; pointIx = -1; render(); };
      pbox.appendChild(row);
    }
    const cur = room.paths[pathName];
    $(".re-loop").checked = !!(cur && cur.loop); $(".re-loop").disabled = !cur;
    // room and selection
    if (document.activeElement !== $(".re-w")) $(".re-w").value = room.width;
    if (document.activeElement !== $(".re-h")) $(".re-h").value = room.height;
    $(".re-bg").value = /^#[0-9a-fA-F]{6}$/.test(room.background || "") ? room.background : "#000000";
    const scr = hooks.getScreen ? hooks.getScreen() : { width: 320, height: 240 };
    $(".re-sizehint").textContent = `${(room.width / scr.width).toFixed(1)} × ${(room.height / scr.height).toFixed(1)} screens. The camera never shows outside the room; the dashed box is one screen.`;
    const e = room.entities[sel];
    $(".re-selected").hidden = !(tool === "entities" && e);
    if (e) {
      $(".re-selinfo").textContent = `${e[0]} at ${e[1]}, ${e[2]}`;
      if (document.activeElement !== $(".re-props")) $(".re-props").value = e[3] ? R.luaInline(e[3]) : "";
    }
  }

  function drawTilePalette() {
    const t = ts(layer()), c = $(".re-tilecanvas"), hint = $(".re-tilehint");
    if (!t) { c.width = c.height = 0; hint.textContent = layer() ? `Tileset '${layer().tileset}' could not be loaded.` : ""; return; }
    const k = Math.max(1, Math.floor(128 / (t.cols * t.tw)));
    c.width = t.img.width * k; c.height = t.img.height * k;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    g.drawImage(t.img, 0, 0, c.width, c.height);
    g.strokeStyle = themeColor("accent"); g.lineWidth = 2;
    g.strokeRect((tile % t.cols) * t.tw * k + 1, Math.floor(tile / t.cols) * t.th * k + 1, t.tw * k - 2, t.th * k - 2);
    c.onclick = (ev) => {
      const r = c.getBoundingClientRect(), sx = c.width / r.width;
      const col = Math.floor(((ev.clientX - r.left) * sx) / (t.tw * k)), row = Math.floor(((ev.clientY - r.top) * sx) / (t.th * k));
      const v = row * t.cols + col;
      if (v >= 0 && v < t.count) { tile = v; drawTilePalette(); }
    };
    hint.textContent = `Tile ${tile}. Right-click a tile in the room to pick it up.`;
  }

  // ---------- pointer ----------
  function worldAt(ev) {
    const r = canvas.getBoundingClientRect(), k = canvas.width / (r.width || 1); // the page may show the canvas smaller than it is
    return [((ev.clientX - r.left) * k) / zoom, ((ev.clientY - r.top) * k) / zoom];
  }
  const snapped = (v) => ($(".re-snap").checked ? R.snap(v, Math.max(1, grid() / 2)) : Math.round(v));
  let drag = null;

  function paintAt(x, y, erase, fill) {
    const l = layer(), t = ts(l);
    if (!l || !t) return;
    const c = Math.floor(x / t.tw), r = Math.floor(y / t.th);
    if (!l.data[r] || l.data[r][c] === undefined) return;
    const v = erase ? -1 : tile;
    if (fill) R.fillLayer(l, c, r, v);
    else l.data[r][c] = v;
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (ev) => {
    if (!room) return;
    const [x, y] = worldAt(ev);
    if (tool === "tiles") {
      const l = layer(), t = ts(l);
      if (!l) return;
      if (ev.button === 2 && t && !ev.altKey) { // right-click picks the tile up
        const v = l.data[Math.floor(y / t.th)]?.[Math.floor(x / t.tw)];
        if (v !== undefined && v >= 0) { tile = v; drawTilePalette(); return; }
      }
      const before = snapshot();
      drag = { kind: "paint", before, erase: ev.button === 2 || ev.altKey };
      paintAt(x, y, drag.erase, ev.shiftKey); render();
    } else if (tool === "entities") {
      const hit = R.entityAt(room, x, y, 12 / Math.min(zoom, 2) + 4);
      if (hit >= 0) { sel = hit; drag = { kind: "move", before: snapshot() }; render(); return; }
      if (!entName) { status("Pick an entity on the left first."); return; }
      commit(() => { room.entities.push([entName, snapped(x), snapped(y)]); sel = room.entities.length - 1; });
    } else if (tool === "paths") {
      if (!pathName) { commit(() => { pathName = R.freshName("path", Object.keys(room.paths)); room.paths[pathName] = { points: [], loop: false }; }); }
      const p = room.paths[pathName];
      const hit = p.points.findIndex(([px, py]) => Math.hypot(px - x, py - y) <= 6 / Math.min(zoom, 2) + 2);
      if (hit >= 0) { pointIx = hit; drag = { kind: "point", before: snapshot() }; render(); return; }
      commit(() => { p.points.push([snapped(x), snapped(y)]); pointIx = p.points.length - 1; });
    }
  });
  window.addEventListener("mousemove", (ev) => {
    if (!room || root.offsetParent === null) return;
    const [x, y] = worldAt(ev);
    if (ev.target === canvas) status(`${Math.floor(x)}, ${Math.floor(y)}` + (layer() && ts(layer()) ? `  ·  tile ${Math.floor(x / ts(layer()).tw)}, ${Math.floor(y / ts(layer()).th)}` : ""));
    if (!drag) return;
    if (drag.kind === "paint") { paintAt(x, y, drag.erase, false); render(); }
    else if (drag.kind === "move" && room.entities[sel]) { room.entities[sel][1] = snapped(x); room.entities[sel][2] = snapped(y); render(); }
    else if (drag.kind === "point") { const p = room.paths[pathName]; if (p && p.points[pointIx]) { p.points[pointIx] = [snapped(x), snapped(y)]; render(); } }
  });
  window.addEventListener("mouseup", () => {
    if (!drag) return;
    if (snapshot() !== drag.before) { history.record(drag.before); markDirty(); }
    drag = null; render();
  });
  root.addEventListener("keydown", (ev) => {
    if (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT") return;
    const k = ev.key.toLowerCase();
    if ((ev.metaKey || ev.ctrlKey) && k === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      if (tool === "entities" && sel >= 0) commit(() => { room.entities.splice(sel, 1); sel = -1; });
      else if (tool === "paths" && room.paths[pathName] && pointIx >= 0) commit(() => { room.paths[pathName].points.splice(pointIx, 1); pointIx = -1; });
      ev.preventDefault(); return;
    }
    const t = TOOLS.find((x) => x[3] === k);
    if (t && !ev.metaKey && !ev.ctrlKey) { tool = t[0]; render(); }
  });
  root.tabIndex = 0;

  function status(text) { $(".re-status").textContent = text; }

  // ---------- buttons and fields ----------
  for (const [id, label, tip] of TOOLS) {
    const b = document.createElement("button"); b.dataset.tool = id; b.textContent = label; b.title = tip;
    b.onclick = () => { tool = id; render(); };
    $(".re-tools").appendChild(b);
  }
  function undo() { const s = history.undo(snapshot()); if (s) { room = JSON.parse(s); markDirty(); clampSel(); render(); } }
  function redo() { const s = history.redo(snapshot()); if (s) { room = JSON.parse(s); markDirty(); clampSel(); render(); } }
  function clampSel() { if (sel >= room.entities.length) sel = -1; layerIx = Math.min(layerIx, Math.max(0, room.layers.length - 1)); if (!room.paths[pathName]) pathName = ""; }
  function fit() {
    const w = wrap.clientWidth - 24, h = wrap.clientHeight - 24;
    if (w <= 0 || h <= 0) return; // not on screen yet: showView calls refit once it is
    zoom = Math.max(0.25, Math.min(4, Math.min(w / room.width, h / room.height)));
    zoom = zoom >= 1 ? Math.floor(zoom) : Math.round(zoom * 4) / 4;
    render();
  }
  const acts = {
    zoomin: () => { zoom = Math.min(8, zoom >= 1 ? zoom + 1 : zoom * 2); render(); },
    zoomout: () => { zoom = Math.max(0.25, zoom > 1 ? zoom - 1 : zoom / 2); render(); },
    fit, undo, redo,
    text: () => hooks.editAsText && hooks.editAsText(),
    addlayer: async () => {
      const tsName = $(".re-newlayer-ts").value; if (!tsName) return;
      if (!tilesets[tsName]) { try { tilesets[tsName] = await hooks.loadTileset(tsName); } catch (e) { status(String(e.message || e)); return; } }
      const t = tilesets[tsName];
      commit(() => {
        const used = room.layers.map((l) => l.name).filter(Boolean);
        room.layers.push(R.fitLayer({ name: R.freshName("layer", used), tileset: tsName, depth: 100 - room.layers.length * 10, data: [] }, room, t.tw, t.th));
        layerIx = room.layers.length - 1;
      });
    },
    addpath: () => commit(() => { pathName = R.freshName("path", Object.keys(room.paths)); room.paths[pathName] = { points: [], loop: false }; pointIx = -1; tool = "paths"; }),
    delent: () => commit(() => { if (sel >= 0) room.entities.splice(sel, 1); sel = -1; }),
  };
  root.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b && acts[b.dataset.act]) acts[b.dataset.act](); });
  $(".re-loop").onchange = () => commit(() => { if (room.paths[pathName]) room.paths[pathName].loop = $(".re-loop").checked; });
  $(".re-grid").onchange = () => render();
  $(".re-bg").onchange = () => commit(() => { room.background = $(".re-bg").value; });
  // the room's size: every layer grows or shrinks with it, so painting reaches the new edge
  const resize = () => commit(() => {
    room.width = Math.max(16, Math.min(8192, Math.round(Number($(".re-w").value) || room.width)));
    room.height = Math.max(16, Math.min(8192, Math.round(Number($(".re-h").value) || room.height)));
    room.layers = room.layers.map((l) => { const t = tilesets[l.tileset]; return t ? R.fitLayer(l, room, t.tw, t.th) : l; });
  });
  $(".re-w").onchange = resize; $(".re-h").onchange = resize;
  $(".re-props").onchange = () => {
    const e = room.entities[sel]; if (!e) return;
    const text = $(".re-props").value.trim();
    if (!text) { commit(() => { e.length = 3; }); return; }
    const r = R.parseRoom(`return { p = ${text} }`);
    if (r.error || !r.room.p || typeof r.room.p !== "object" || Array.isArray(r.room.p)) { status("Values are a Lua table of names, like { hp = 3, speed = 40 }."); return; }
    commit(() => { e[3] = r.room.p; });
  };

  return {
    async load(n, def) {
      name = n; room = R.normalizeRoom(def); dirty = false; history.undoStack = []; history.redoStack = [];
      layerIx = 0; tile = 0; sel = -1; pathName = Object.keys(room.paths)[0] || ""; pointIx = -1;
      if (!entName) entName = (hooks.getEntities ? hooks.getEntities() : [])[0] || "";
      render();
      await loadAssets();
      // layers written by hand may be smaller than the room: grow them so every cell can be painted
      room.layers = room.layers.map((l) => { const t = tilesets[l.tileset]; return t ? R.fitLayer(l, room, t.tw, t.th) : l; });
      requestAnimationFrame(fit);
    },
    getDef: () => room,
    getName: () => name,
    isDirty: () => dirty,
    markClean: () => { dirty = false; },
    refit: () => room && fit(),
    redraw: () => room && render(), // the look changed
  };
}
