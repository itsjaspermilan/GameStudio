// The layout editor: paint tile layers, place entities, texts and pictures, draw paths, set the size (the camera never shows outside it).
// It edits a scene's layout (scenes/<name>.layout.lua, built when the scene starts) or an older room (rooms/<name>.lua); room-core.js reads
// and writes both, this file is the DOM over it. Anything given a name is a field of the scene's code (self.<name>): renaming one is
// remembered until the layout is saved, and main.js then renames it in the code too (getRenames).
// hooks: { onChange(), getEntities() -> [names], getTilesets() -> [names], getSprites() -> [names], getScenes() -> [names],
//          loadTileset(name) -> Promise<{ img, tw, th, cols, count }>, entityLook(name), spriteLook(name) -> Promise<{ img, fw, fh, ox, oy } | null>,
//          getScreen() -> { width, height }, getPalette() -> { colors: ["#rrggbb", ...], fixed }, editAsText() }
// A text's colour is a place in the palette when the console has a fixed one (as the game's code writes it), otherwise "#rrggbb".
import { color as themeColor } from "./theme.js";
import * as R from "./room-core.js";
import { History } from "./sprite-core.js";
import { settleRenames } from "./rename-core.js";

const TOOLS = [
  ["tiles", "Tiles", "Paint tiles on the chosen layer. Shift-click fills an area, Alt-click erases, right-click picks a tile up. (T)", "t"],
  ["entities", "Things", "Click to place the chosen entity; drag one to move it; Delete removes the selected one. (N)", "n"],
  ["texts", "Text", "Click to put a text; drag one to move it; Delete removes the selected one. (X)", "x"],
  ["pictures", "Pictures", "Click to put the chosen sprite as a picture (no code of its own); drag one to move it; Delete removes it. (I)", "i"],
  ["panels", "Panels", "Drag to draw a panel or a bar made of tiles, behind texts and pictures. Drag one to move it; Delete removes it. (B)", "b"],
  ["paths", "Paths", "Click to add a point to the chosen path; drag a point to move it; Delete removes the selected point. (P)", "p"],
];
// what each tool places and selects
const KIND_OF = { entities: "entities", texts: "texts", pictures: "pictures", panels: "panels" };

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
        <p class="se-hint re-ents-hint"></p>
      </div>
      <div class="re-panel re-texts-panel">
        <h3>Text</h3>
        <p class="se-hint">Click where the text goes. Each text gets a name, so the code can change it: <code>self.title.text = "GO!"</code>.</p>
      </div>
      <div class="re-panel re-pics-panel">
        <h3>Sprite to place</h3>
        <div class="re-spritelist"></div>
        <p class="se-hint">A picture is a sprite with no code of its own: a logo, a sign, a decoration. The code can move it: <code>self.logo.y = 40</code>.</p>
      </div>
      <div class="re-panel re-panels-panel">
        <h3>Panel tiles</h3>
        <select class="re-panel-ts" title="The tileset the panel's tiles come from"></select>
        <div class="re-tilepal"><canvas class="re-blockcanvas"></canvas></div>
        <p class="se-hint">Click the top-left tile of a 3 × 3 block: its corners stay as drawn and the edges and middle repeat to fill the panel. One tile high, a panel is a bar made of the block's top row. Then drag in the layout to draw one; with a panel selected, a click here changes its tiles.</p>
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
      <div class="re-selected">
        <h3>Selected</h3>
        <div class="re-selinfo"></div>
        <label class="se-field" title="With a name, the scene's code can use it as self.<name>. Renaming it here renames it in the code too, when you save.">Name <input class="re-name" spellcheck="false" placeholder="no name"></label>
        <p class="se-hint re-name-hint"></p>
        <div class="re-sel-entity">
          <label class="se-field">Values <input class="re-props" spellcheck="false" placeholder="{ hp = 3 }" title="Starting values for this one only, as a Lua table"></label>
        </div>
        <div class="re-sel-text">
          <label class="se-field">Text <input class="re-text" spellcheck="false"></label>
          <div class="se-row se-fields">
            <label title="How big: the built-in font is 8 pixels a letter at size 1">Size <select class="re-size"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
            <label title="Where the text sits against its point">Align <select class="re-align"><option value="left">left</option><option value="center">centre</option><option value="right">right</option></select></label>
          </div>
          <label class="se-field" title="Built in: 8 x 8 letters in any colour of the palette. A sprite: its frames are the letters, from the space on in ASCII order (! &quot; # ... 0-9 ... A-Z), in the sprite's own colours.">Font <select class="re-font"></select></label>
          <div class="re-colors re-text-colors" title="The text's colour, from the console's palette (the built-in font only)"></div>
        </div>
        <div class="re-sel-panel">
          <div class="se-row se-fields">
            <label>X <input type="number" class="re-bx" step="1"></label><label>Y <input type="number" class="re-by" step="1"></label>
            <label>W <input type="number" class="re-bw" min="1" step="1"></label><label>H <input type="number" class="re-bh" min="1" step="1"></label>
          </div>
          <p class="se-hint re-panel-info"></p>
        </div>
        <div class="re-sel-picture">
          <label class="se-field">Sprite <select class="re-sprite"></select></label>
          <div class="se-row se-fields">
            <label>Frame <input type="number" class="re-frame" min="0" step="1"></label>
            <label>Scale <input type="number" class="re-scale" min="0.25" max="16" step="0.25"></label>
          </div>
        </div>
        <label class="se-field re-screen-row" title="Stays put when the camera scrolls (a score, a hint). Otherwise it is part of the world."><input type="checkbox" class="re-screen"> Fixed on the screen</label>
        <div class="se-row"><button data-act="delsel">Delete</button></div>
      </div>
      <h3 class="re-size-title">Size</h3>
      <div class="se-row se-fields">
        <label>W <input type="number" class="re-w" min="16" max="8192" step="16"></label>
        <label>H <input type="number" class="re-h" min="16" max="8192" step="16"></label>
      </div>
      <p class="se-hint re-sizehint"></p>
      <label class="se-field">Background <input type="color" class="re-bg"></label>
      <div class="re-code-row">
        <label class="se-field" title="Ten levels can share one set of rules: each level's layout runs the same scene's code">Code <select class="re-code"></select></label>
      </div>
      <h3>View</h3>
      <div class="se-row"><button data-act="zoomout">&minus;</button><button data-act="fit">Fit</button><button data-act="zoomin">+</button></div>
      <label class="se-field"><input type="checkbox" class="re-snap" checked> Snap to the grid</label>
      <label class="se-field"><input type="checkbox" class="re-grid" checked> Show the grid</label>
      <div class="se-row"><button data-act="undo">Undo</button><button data-act="redo">Redo</button></div>
      <h3>As text</h3>
      <div class="se-row"><button data-act="text" class="re-astext">Edit as text</button></div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const canvas = $(".re-canvas"), ctx = canvas.getContext("2d"), wrap = $(".re-wrap");
  let room = null, name = "", kind = "room", dirty = false, tool = "tiles", zoom = 2;
  let layerIx = 0, tile = 0, entName = "", spriteName = "", sel = null, pathName = "", pointIx = -1;
  let panelTs = "", panelTile = 0; // what a new panel is made of: a tileset and the top-left tile of a 3x3 block
  let renames = []; // [old, new] in order since the last save
  const tilesets = {}, looks = {}, pics = {};
  const history = new History(100);

  const snapshot = () => JSON.stringify(room);
  function commit(fn) { const before = snapshot(); fn(); if (snapshot() !== before) { history.record(before); markDirty(); } render(); }
  function markDirty() { dirty = true; hooks.onChange && hooks.onChange(); }
  const layer = () => room.layers[layerIx];
  // a layer sized to the room, so painting reaches every edge; one that repeats (wrap) keeps its own size: it is a pattern, not a map
  const fitted = (l) => { const t = tilesets[l.tileset]; return t && !l.wrap_x && !l.wrap_y ? R.fitLayer(l, room, t.tw, t.th) : l; };
  const ts = (l) => l && tilesets[l.tileset];
  const grid = () => { const t = ts(layer()); return t ? t.tw : 16; };
  const BASIC = ["#000000", "#ffffff", "#8a90a8", "#ea5a4b", "#e8913a", "#f5d94a", "#6ccf4f", "#45d1c5", "#4f9bf0", "#a56be0"];
  const pal = () => { const p = hooks.getPalette ? hooks.getPalette() : null; return p && p.fixed && p.colors.length ? p : { colors: BASIC, fixed: false }; };
  const palette = () => pal().colors;
  const colorOf = (c) => (typeof c === "number" ? palette()[c] || "#ffffff" : /^#[0-9a-fA-F]{6}/.test(c || "") ? c.slice(0, 7) : "#ffffff");

  // ---------- the selection: one entity, text or picture ----------
  const selected = () => (sel && room[sel.kind] ? room[sel.kind][sel.i] : null);
  const posOf = (k, item) => (k === "entities" ? [item[1], item[2]] : [item.x, item.y]);
  const setPos = (k, item, x, y) => { if (k === "entities") { item[1] = x; item[2] = y; } else { item.x = x; item.y = y; } };
  const nameOf = (k, item) => (k === "entities" ? item[4] : item.name);
  const setName = (k, item, n) => { if (k === "entities") item[4] = n || undefined; else if (n) item.name = n; else delete item.name; };
  const allNames = () => R.layoutNames(room).map((n) => n.name);

  // ---------- assets ----------
  async function loadAssets() {
    for (const l of room.layers) if (l.tileset && !tilesets[l.tileset]) {
      try { tilesets[l.tileset] = await hooks.loadTileset(l.tileset); } catch { tilesets[l.tileset] = null; }
    }
    const names = new Set(room.entities.map((e) => e[0]));
    if (entName) names.add(entName);
    for (const n of names) if (!(n in looks)) { try { looks[n] = await hooks.entityLook(n); } catch { looks[n] = null; } }
    for (const n of new Set([...room.panels.map((p) => p.tileset), panelTs].filter(Boolean))) if (!tilesets[n] && tilesets[n] !== null) {
      try { tilesets[n] = await hooks.loadTileset(n); } catch { tilesets[n] = null; }
    }
    const sprites = new Set([...room.pictures.map((p) => p.sprite), ...room.texts.map((t) => t.font).filter(Boolean)]);
    if (spriteName) sprites.add(spriteName);
    for (const n of sprites) if (!(n in pics)) { try { pics[n] = hooks.spriteLook ? await hooks.spriteLook(n) : null; } catch { pics[n] = null; } }
    render();
  }
  // a text's box, in its font's letter size
  const fontSize = (t) => { const f = t.font && pics[t.font]; return f ? [f.fw, f.fh] : undefined; };
  const textBoxOf = (t) => R.textBox(t, fontSize(t));
  // a picture's box in the room, from its sprite (its origin is where x, y is)
  function pictureBox(p) {
    const look = pics[p.sprite], s = Number(p.scale) || 1;
    if (!look) return [p.x - 6, p.y - 6, p.x + 6, p.y + 6];
    return [p.x - look.ox * s, p.y - look.oy * s, p.x + (look.fw - look.ox) * s, p.y + (look.fh - look.oy) * s];
  }
  function hitAt(k, x, y) {
    if (k === "entities") { const i = R.entityAt(room, x, y, 12 / Math.min(zoom, 2) + 4); return i; }
    const list = room[k], box = k === "texts" ? textBoxOf : k === "panels" ? (b) => [b.x, b.y, b.x + b.w, b.y + b.h] : pictureBox;
    for (let i = list.length - 1; i >= 0; i--) { const [x0, y0, x1, y1] = box(list[i]); if (x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 2 && y <= y1 + 2) return i; }
    return -1;
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
      // a repeating layer is drawn as often as it takes to fill the layout, as the game shows it
      const pw = (l.data[0] || []).length * t.tw, ph = l.data.length * t.th;
      const nx = l.wrap_x && pw ? Math.ceil(room.width / pw) : 1, ny = l.wrap_y && ph ? Math.ceil(room.height / ph) : 1;
      for (let ky = 0; ky < ny; ky++) for (let kx = 0; kx < nx; kx++) l.data.forEach((row, r) => row.forEach((v, c) => {
        if (v < 0 || v >= t.count) return;
        ctx.drawImage(t.img, (v % t.cols) * t.tw, Math.floor(v / t.cols) * t.th, t.tw, t.th, (kx * pw + c * t.tw) * zoom, (ky * ph + r * t.th) * zoom, t.tw * zoom, t.th * zoom);
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
    const labels = []; // names drawn last, above everything: [text, x, y]
    const ring = (x0, y0, x1, y1) => { ctx.strokeStyle = themeColor("accent"); ctx.lineWidth = 2; ctx.strokeRect(x0 * zoom - 2, y0 * zoom - 2, (x1 - x0) * zoom + 4, (y1 - y0) * zoom + 4); };
    const isSel = (k, i) => sel && sel.kind === k && sel.i === i;
    // panels, then pictures, then texts: the order the game builds them in
    room.panels.forEach((b, i) => {
      ctx.globalAlpha = tool === "panels" ? 1 : 0.9;
      drawPanel(b);
      ctx.globalAlpha = 1;
      if (isSel("panels", i)) ring(b.x, b.y, b.x + b.w, b.y + b.h);
      if (b.name) labels.push([`self.${b.name}`, b.x + b.w / 2, b.y + 14]);
    });
    // pictures
    room.pictures.forEach((p, i) => {
      const look = pics[p.sprite], s = Number(p.scale) || 1;
      ctx.globalAlpha = tool === "pictures" ? 1 : 0.75;
      if (look) {
        const fr = Math.max(0, Math.floor(p.frame || 0)) % Math.max(1, Math.floor(look.img.width / look.fw));
        ctx.drawImage(look.img, fr * look.fw, 0, look.fw, look.fh, (p.x - look.ox * s) * zoom, (p.y - look.oy * s) * zoom, look.fw * s * zoom, look.fh * s * zoom);
      } else { ctx.fillStyle = "#8a90a8"; ctx.fillRect((p.x - 6) * zoom, (p.y - 6) * zoom, 12 * zoom, 12 * zoom); }
      ctx.globalAlpha = 1;
      const b = pictureBox(p);
      if (isSel("pictures", i)) ring(...b);
      if (p.name) labels.push([`self.${p.name}`, (b[0] + b[2]) / 2, b[1]]);
    });
    // entities
    ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    room.entities.forEach(([n, x, y, , nm], i) => {
      const look = looks[n], px = x * zoom, py = y * zoom;
      ctx.globalAlpha = tool === "entities" ? 1 : 0.6;
      if (look) ctx.drawImage(look.img, 0, 0, look.fw, look.fh, px - look.ox * zoom, py - look.oy * zoom, look.fw * zoom, look.fh * zoom);
      else { ctx.fillStyle = "#ffa38c"; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (isSel("entities", i)) { ctx.strokeStyle = themeColor("accent"); ctx.lineWidth = 2; ctx.strokeRect(px - 9, py - 9, 18, 18); }
      if (nm) labels.push([`self.${nm}`, x, y - (look ? look.oy : 6)]);
      else if (!look || isSel("entities", i)) { ctx.fillStyle = "#ffffff"; ctx.fillText(n, px, py - 10); }
    });
    // texts: a sprite font as the game draws it; the built-in font in its size (8 pixels a letter), the Play panel shows its real letters
    room.texts.forEach((t, i) => {
      const size = Number(t.size) || 1, [x0, y0, x1, y1] = textBoxOf(t), font = t.font && pics[t.font];
      ctx.globalAlpha = tool === "texts" ? 1 : 0.8;
      ctx.font = `${8 * size * zoom}px ui-monospace, Menlo, monospace`; ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.fillStyle = colorOf(t.color);
      const s = String(t.text ?? "");
      const frames = font ? Math.max(1, Math.floor(font.img.width / font.fw)) : 0;
      for (let k = 0; k < s.length; k++) {
        if (!font) { ctx.fillText(s[k], (x0 + k * 8 * size) * zoom, y0 * zoom, 8 * size * zoom); continue; }
        const f = s.charCodeAt(k) - 32;
        if (f >= 0 && f < frames) ctx.drawImage(font.img, f * font.fw, 0, font.fw, font.fh, (x0 + k * font.fw * size) * zoom, y0 * zoom, font.fw * size * zoom, font.fh * size * zoom);
      }
      if (!s) { ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.strokeRect(x0 * zoom, y0 * zoom, (x1 - x0) * zoom, (y1 - y0) * zoom); }
      ctx.globalAlpha = 1;
      if (isSel("texts", i)) ring(x0, y0, x1, y1);
      if (t.name) labels.push([`self.${t.name}`, (x0 + x1) / 2, y0]);
    });
    // paths
    ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
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
    // names: the way the code reaches them
    ctx.font = "11px ui-monospace, Menlo, monospace";
    for (const [text, x, y] of labels) {
      const w = ctx.measureText(text).width + 8, lx = x * zoom - w / 2, ly = y * zoom - 18;
      ctx.fillStyle = "rgba(10,12,20,0.75)"; ctx.fillRect(lx, ly, w, 15);
      ctx.fillStyle = "#a8d4ff"; ctx.fillText(text, x * zoom, ly + 11);
    }
    renderSide();
  }

  function renderSide() {
    root.querySelectorAll(".re-tools button").forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
    $(".re-tiles-panel").hidden = tool !== "tiles"; $(".re-ents-panel").hidden = tool !== "entities"; $(".re-paths-panel").hidden = tool !== "paths";
    $(".re-texts-panel").hidden = tool !== "texts"; $(".re-pics-panel").hidden = tool !== "pictures"; $(".re-panels-panel").hidden = tool !== "panels";
    if (tool === "panels") drawBlockPicker();
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
    // things to place
    pickList($(".re-entlist"), hooks.getEntities ? hooks.getEntities() : [], entName, "No entities in this game yet.", (n) => { entName = n; if (!(n in looks)) loadAssets(); });
    pickList($(".re-spritelist"), hooks.getSprites ? hooks.getSprites() : [], spriteName, "No sprites in this game yet.", (n) => { spriteName = n; if (!(n in pics)) loadAssets(); });
    $(".re-ents-hint").textContent = kind === "layout" ? "Each one is made where you put it when the scene starts. Give one a name to use it in the code (self.name)." : "Each one starts where you put it when gs.load_room builds the room.";
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
    // size, background, code
    $(".re-size-title").textContent = kind === "layout" ? "Layout size" : "Room size";
    if (document.activeElement !== $(".re-w")) $(".re-w").value = room.width;
    if (document.activeElement !== $(".re-h")) $(".re-h").value = room.height;
    $(".re-bg").value = /^#[0-9a-fA-F]{6}$/.test(room.background || "") ? room.background : "#000000";
    const scr = hooks.getScreen ? hooks.getScreen() : { width: 320, height: 240 };
    $(".re-sizehint").textContent = `${(room.width / scr.width).toFixed(1)} × ${(room.height / scr.height).toFixed(1)} screens. The camera never shows outside it; the dashed box is one screen.`;
    $(".re-code-row").hidden = kind !== "layout";
    if (kind === "layout") {
      const codeSel = $(".re-code"), scenes = (hooks.getScenes ? hooks.getScenes() : []).filter((n) => n !== name);
      const want = ["", ...scenes];
      if ([...codeSel.options].map((o) => o.value).join("|") !== want.join("|")) {
        codeSel.replaceChildren(new Option(`its own (scenes/${name}.lua)`, ""), ...scenes.map((n) => new Option(`${n}'s code`, n)));
      }
      codeSel.value = room.code || "";
    }
    $(".re-astext").title = kind === "layout" ? `Open scenes/${name}.layout.lua in the code editor` : `Open rooms/${name}.lua in the code editor`;
    renderSelected();
  }

  function pickList(box, list, current, empty, pick) {
    box.replaceChildren();
    if (!list.length) { const p = document.createElement("p"); p.className = "se-hint"; p.textContent = empty; box.appendChild(p); }
    for (const n of list) {
      const b = document.createElement("button"); b.className = "re-pick" + (n === current ? " active" : ""); b.textContent = n;
      b.onclick = () => { pick(n); renderSide(); };
      box.appendChild(b);
    }
  }

  function renderSelected() {
    const item = selected(), k = sel && sel.kind;
    $(".re-selected").hidden = !(item && KIND_OF[tool] === k);
    if (!item) return;
    const [x, y] = posOf(k, item);
    $(".re-selinfo").textContent = k === "entities" ? `${item[0]} at ${x}, ${y}` : k === "texts" ? `Text at ${x}, ${y}` : k === "panels" ? `Panel ${item.w} × ${item.h}` : `Picture of ${item.sprite} at ${x}, ${y}`;
    const keep = (el, v) => { if (document.activeElement !== el) el.value = v; };
    keep($(".re-name"), nameOf(k, item) || "");
    $(".re-name-hint").textContent = nameOf(k, item) ? `In the code: self.${nameOf(k, item)}` : kind === "layout" ? "Give it a name to use it in the scene's code." : "";
    $(".re-sel-entity").hidden = k !== "entities"; $(".re-sel-text").hidden = k !== "texts"; $(".re-sel-picture").hidden = k !== "pictures"; $(".re-sel-panel").hidden = k !== "panels";
    $(".re-screen-row").hidden = k === "entities";
    if (k === "entities") keep($(".re-props"), item[3] ? R.luaInline(item[3]) : "");
    if (k === "texts") {
      keep($(".re-text"), item.text ?? "");
      $(".re-size").value = String(item.size || 1); $(".re-align").value = item.align || "left";
      const fonts = ["", ...(hooks.getSprites ? hooks.getSprites() : [])], fsel = $(".re-font");
      if ([...fsel.options].map((o) => o.value).join("|") !== fonts.join("|")) fsel.replaceChildren(...fonts.map((n) => new Option(n || "built in (8 × 8)", n)));
      fsel.value = item.font || "";
      $(".re-text-colors").hidden = !!item.font;
      swatches($(".re-text-colors"), item.color ?? (pal().fixed ? palette().indexOf("#ffffff") : "#ffffff"), (v) => { item.color = v; });
    }
    if (k === "panels") {
      for (const [cls, f] of [[".re-bx", "x"], [".re-by", "y"], [".re-bw", "w"], [".re-bh", "h"]]) keep($(cls), item[f]);
      $(".re-panel-info").textContent = `Tiles ${item.tile} onwards of ${item.tileset}. Pick other tiles on the left.`;
    }
    if (k === "pictures") {
      const sprites = hooks.getSprites ? hooks.getSprites() : [];
      const s = $(".re-sprite");
      if ([...s.options].map((o) => o.value).join("|") !== sprites.join("|")) s.replaceChildren(...sprites.map((n) => new Option(n, n)));
      s.value = item.sprite;
      keep($(".re-frame"), item.frame || 0); keep($(".re-scale"), item.scale || 1);
    }
    $(".re-screen").checked = !!item.screen;
  }

  // the palette as buttons: a click sets the colour (a place in the palette when the console has a fixed one); `none` adds a "no colour" first
  function swatches(box, current, set, none) {
    box.replaceChildren();
    const fixed = pal().fixed;
    if (none) {
      const b = document.createElement("button"); b.className = "re-swatch re-none" + (current === undefined || current === null ? " active" : ""); b.title = "none"; b.textContent = "∅";
      b.onclick = () => commit(() => set(undefined));
      box.appendChild(b);
    }
    palette().forEach((c, i) => {
      const value = fixed ? i : c;
      const b = document.createElement("button"); b.className = "re-swatch" + (current === value ? " active" : ""); b.style.background = c;
      b.title = fixed ? `palette colour ${i} (${c})` : c;
      b.onclick = () => commit(() => set(value));
      box.appendChild(b);
    });
  }

  // a panel on the layout canvas, as the game draws it: corners as they are, edges and middle repeated, cut at the far edges
  function drawPanel(b) {
    const t = tilesets[b.tileset];
    if (!t) { ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.strokeRect(b.x * zoom, b.y * zoom, b.w * zoom, b.h * zoom); return; }
    const { tw, th } = t, cols = Math.max(b.w > tw ? 2 : 1, Math.ceil(b.w / tw)), rows = Math.max(b.h > th ? 2 : 1, Math.ceil(b.h / th));
    const part = (i, n) => (n === 1 || i === 0 ? 0 : i === n - 1 ? 2 : 1);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = b.tile + part(r, rows) * t.cols + part(c, cols);
      if (v < 0 || v >= t.count) continue;
      // the last column and row sit against the far side; the one before them is cut where they begin
      const x = c === cols - 1 && cols > 1 ? b.w - tw : c * tw, y = r === rows - 1 && rows > 1 ? b.h - th : r * th;
      const w = c === cols - 1 && cols > 1 ? tw : Math.min(tw, (cols > 1 ? b.w - tw : b.w) - c * tw), h = r === rows - 1 && rows > 1 ? th : Math.min(th, (rows > 1 ? b.h - th : b.h) - r * th);
      if (w <= 0 || h <= 0) continue;
      ctx.drawImage(t.img, (v % t.cols) * tw, Math.floor(v / t.cols) * th, w, h, (b.x + x) * zoom, (b.y + y) * zoom, w * zoom, h * zoom);
    }
  }

  // the tileset of new panels (or of the selected one), with the chosen 3x3 block outlined; a click picks a block
  function drawBlockPicker() {
    const names = hooks.getTilesets ? hooks.getTilesets() : [], tsSel = $(".re-panel-ts");
    const cur = selected() && sel.kind === "panels" ? selected() : null;
    if (cur) { panelTs = cur.tileset; panelTile = cur.tile; }
    if (!panelTs && names.length) panelTs = names[0];
    if ([...tsSel.options].map((o) => o.value).join("|") !== names.join("|")) tsSel.replaceChildren(...names.map((n) => new Option(n, n)));
    tsSel.value = panelTs;
    const t = tilesets[panelTs], c = $(".re-blockcanvas");
    if (!t) { c.width = c.height = 0; if (panelTs && !(panelTs in tilesets)) loadAssets(); return; }
    const k = Math.max(1, Math.floor(128 / (t.cols * t.tw)));
    c.width = t.img.width * k; c.height = t.img.height * k;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    g.drawImage(t.img, 0, 0, c.width, c.height);
    g.strokeStyle = themeColor("accent"); g.lineWidth = 2;
    g.strokeRect((panelTile % t.cols) * t.tw * k + 1, Math.floor(panelTile / t.cols) * t.th * k + 1, 3 * t.tw * k - 2, 3 * t.th * k - 2);
    c.onclick = (ev) => {
      const r = c.getBoundingClientRect(), sx = c.width / r.width;
      const col = Math.floor(((ev.clientX - r.left) * sx) / (t.tw * k)), row = Math.floor(((ev.clientY - r.top) * sx) / (t.th * k));
      const v = row * t.cols + col;
      if (v < 0 || v >= t.count) return;
      panelTile = v;
      const p = selected() && sel.kind === "panels" ? selected() : null;
      if (p) commit(() => { p.tileset = panelTs; p.tile = v; }); else drawBlockPicker();
    };
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

  // a name for a new text or picture: from its sprite ("spr_logo" -> logo) or "text", not yet used
  function freshName(base) {
    const clean = String(base).replace(/^(spr|sprite|ts)_/, "").replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1") || "thing";
    const ok = R.nameProblem(clean, room) ? "thing" : clean;
    return R.freshName(ok, allNames());
  }

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (ev) => {
    if (!room) return;
    root.focus({ preventScroll: true });
    const [x, y] = worldAt(ev);
    const k = KIND_OF[tool];
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
    } else if (k) {
      const hit = hitAt(k, x, y);
      if (hit >= 0) { const [ix, iy] = posOf(k, room[k][hit]); sel = { kind: k, i: hit }; drag = { kind: "move", before: snapshot(), dx: ix - x, dy: iy - y }; render(); return; }
      if (k === "entities") {
        if (!entName) { status("Pick an entity on the left first."); return; }
        commit(() => { room.entities.push([entName, snapped(x), snapped(y)]); sel = { kind: k, i: room.entities.length - 1 }; });
      } else if (k === "panels") {
        if (!panelTs) { status("Pick a tileset for the panel on the left first."); return; }
        const before = snapshot();
        room.panels.push({ x: snapped(x), y: snapped(y), w: 1, h: 1, tileset: panelTs, tile: panelTile, name: freshName("panel") });
        sel = { kind: k, i: room.panels.length - 1 };
        drag = { kind: "draw", before, x0: snapped(x), y0: snapped(y) };
        render();
      } else if (k === "texts") {
        commit(() => { room.texts.push({ text: "TEXT", x: snapped(x), y: snapped(y), name: freshName("text"), size: 1 }); sel = { kind: k, i: room.texts.length - 1 }; });
        requestAnimationFrame(() => { $(".re-text").focus(); $(".re-text").select(); });
      } else {
        if (!spriteName) { status("Pick a sprite on the left first."); return; }
        commit(() => { room.pictures.push({ sprite: spriteName, x: snapped(x), y: snapped(y), name: freshName(spriteName) }); sel = { kind: k, i: room.pictures.length - 1 }; });
      }
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
    else if (drag.kind === "draw" && selected()) {
      const b = selected(), x1 = snapped(x), y1 = snapped(y);
      b.x = Math.min(drag.x0, x1); b.y = Math.min(drag.y0, y1); b.w = Math.max(1, Math.abs(x1 - drag.x0)); b.h = Math.max(1, Math.abs(y1 - drag.y0));
      render();
    }
    else if (drag.kind === "move" && selected()) { setPos(sel.kind, selected(), snapped(x + drag.dx), snapped(y + drag.dy)); render(); }
    else if (drag.kind === "point") { const p = room.paths[pathName]; if (p && p.points[pointIx]) { p.points[pointIx] = [snapped(x), snapped(y)]; render(); } }
  });
  window.addEventListener("mouseup", () => {
    if (!drag) return;
    // a click without a drag makes a panel three tiles square
    if (drag.kind === "draw" && selected() && selected().w < 4 && selected().h < 4) { const t = tilesets[selected().tileset]; selected().w = 3 * (t ? t.tw : 8); selected().h = 3 * (t ? t.th : 8); }
    if (snapshot() !== drag.before) { history.record(drag.before); markDirty(); }
    drag = null; render();
  });
  root.addEventListener("keydown", (ev) => {
    if (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT") return;
    const key = ev.key.toLowerCase();
    if ((ev.metaKey || ev.ctrlKey) && key === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      if (selected() && KIND_OF[tool] === sel.kind) deleteSelected();
      else if (tool === "paths" && room.paths[pathName] && pointIx >= 0) commit(() => { room.paths[pathName].points.splice(pointIx, 1); pointIx = -1; });
      ev.preventDefault(); return;
    }
    // arrow keys nudge what is selected by a pixel (or the grid with shift)
    const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
    if (arrows && selected() && KIND_OF[tool] === sel.kind) {
      ev.preventDefault();
      const step = ev.shiftKey ? grid() : 1, [x, y] = posOf(sel.kind, selected());
      commit(() => setPos(sel.kind, selected(), x + arrows[0] * step, y + arrows[1] * step));
      return;
    }
    const t = TOOLS.find((x) => x[3] === key);
    if (t && !ev.metaKey && !ev.ctrlKey) { tool = t[0]; render(); }
  });
  root.tabIndex = 0;

  function status(text) { $(".re-status").textContent = text; }
  function deleteSelected() { commit(() => { room[sel.kind].splice(sel.i, 1); sel = null; }); }

  // ---------- buttons and fields ----------
  for (const [id, label, tip] of TOOLS) {
    const b = document.createElement("button"); b.dataset.tool = id; b.textContent = label; b.title = tip;
    b.onclick = () => { tool = id; render(); };
    $(".re-tools").appendChild(b);
  }
  function undo() { const s = history.undo(snapshot()); if (s) { room = JSON.parse(s); markDirty(); clampSel(); render(); } }
  function redo() { const s = history.redo(snapshot()); if (s) { room = JSON.parse(s); markDirty(); clampSel(); render(); } }
  function clampSel() { if (sel && !(room[sel.kind] && room[sel.kind][sel.i])) sel = null; layerIx = Math.min(layerIx, Math.max(0, room.layers.length - 1)); if (!room.paths[pathName]) pathName = ""; }
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
    delsel: () => { if (selected()) deleteSelected(); },
  };
  root.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b && acts[b.dataset.act]) acts[b.dataset.act](); });
  $(".re-loop").onchange = () => commit(() => { if (room.paths[pathName]) room.paths[pathName].loop = $(".re-loop").checked; });
  $(".re-grid").onchange = () => render();
  $(".re-bg").onchange = () => commit(() => { room.background = $(".re-bg").value; });
  $(".re-code").onchange = () => commit(() => { if ($(".re-code").value) room.code = $(".re-code").value; else delete room.code; });
  // the size: every layer grows or shrinks with it, so painting reaches the new edge
  const resize = () => commit(() => {
    room.width = Math.max(16, Math.min(8192, Math.round(Number($(".re-w").value) || room.width)));
    room.height = Math.max(16, Math.min(8192, Math.round(Number($(".re-h").value) || room.height)));
    room.layers = room.layers.map(fitted);
  });
  $(".re-w").onchange = resize; $(".re-h").onchange = resize;
  $(".re-props").onchange = () => {
    const e = selected(); if (!e || sel.kind !== "entities") return;
    const text = $(".re-props").value.trim();
    if (!text) { commit(() => { e[3] = undefined; }); return; }
    const r = R.parseRoom(`return { p = ${text} }`);
    if (r.error || !r.room.p || typeof r.room.p !== "object" || Array.isArray(r.room.p)) { status("Values are a Lua table of names, like { hp = 3, speed = 40 }."); return; }
    commit(() => { e[3] = r.room.p; });
  };
  // a new name: checked, and remembered so the code follows when the layout is saved
  $(".re-name").onchange = () => {
    const item = selected(); if (!item) return;
    const old = nameOf(sel.kind, item) || "", next = $(".re-name").value.trim();
    if (next === old) return;
    const problem = R.nameProblem(next, room, old);
    if (problem) { status(problem); $(".re-name").value = old; return; }
    commit(() => setName(sel.kind, item, next));
    if (old && next) renames.push([old, next]);
    status(old && next ? `Renamed: the code's self.${old} becomes self.${next} when you save.` : next ? `In the code this is self.${next}.` : "");
  };
  // typing shows at once; the whole edit is one step to undo
  let textBefore = null;
  $(".re-text").onfocus = () => { textBefore = snapshot(); };
  $(".re-text").oninput = () => { const t = selected(); if (t && sel.kind === "texts") { t.text = $(".re-text").value; markDirty(); render(); } };
  $(".re-text").onchange = () => { if (textBefore && textBefore !== snapshot()) history.record(textBefore); textBefore = snapshot(); };
  $(".re-size").onchange = () => commit(() => { selected().size = Number($(".re-size").value); });
  $(".re-align").onchange = () => commit(() => { const t = selected(); if ($(".re-align").value === "left") delete t.align; else t.align = $(".re-align").value; });
  $(".re-sprite").onchange = () => { spriteName = $(".re-sprite").value; commit(() => { selected().sprite = spriteName; }); loadAssets(); };
  $(".re-frame").onchange = () => commit(() => { const v = Math.max(0, Math.floor(Number($(".re-frame").value) || 0)); if (v) selected().frame = v; else delete selected().frame; });
  $(".re-scale").onchange = () => commit(() => { const v = Math.max(0.25, Math.min(16, Number($(".re-scale").value) || 1)); if (v !== 1) selected().scale = v; else delete selected().scale; });
  for (const [cls, f, min] of [[".re-bx", "x", -8192], [".re-by", "y", -8192], [".re-bw", "w", 1], [".re-bh", "h", 1]]) {
    $(cls).onchange = () => commit(() => { const b = selected(); if (b && sel.kind === "panels") b[f] = Math.max(min, Math.round(Number($(cls).value) || 0)); });
  }
  $(".re-font").onchange = () => { const t = selected(); if (!t || sel.kind !== "texts") return; commit(() => { if ($(".re-font").value) t.font = $(".re-font").value; else delete t.font; }); loadAssets(); };
  $(".re-panel-ts").onchange = async () => { panelTs = $(".re-panel-ts").value; panelTile = 0; await loadAssets(); drawBlockPicker(); };
  $(".re-screen").onchange = () => commit(() => { if ($(".re-screen").checked) selected().screen = true; else delete selected().screen; });

  return {
    // kind: "layout" (a scene's) or "room"
    async load(n, def, k = "room") {
      name = n; kind = k; room = R.normalizeRoom(def); dirty = false; history.undoStack = []; history.redoStack = []; renames = [];
      layerIx = 0; tile = 0; sel = null; pathName = Object.keys(room.paths)[0] || ""; pointIx = -1;
      if (!entName) entName = (hooks.getEntities ? hooks.getEntities() : [])[0] || "";
      if (!spriteName) spriteName = (hooks.getSprites ? hooks.getSprites() : [])[0] || "";
      render();
      await loadAssets();
      // layers written by hand may be smaller than the room: grow them so every cell can be painted
      room.layers = room.layers.map(fitted);
      requestAnimationFrame(fit);
    },
    getDef: () => room,
    getName: () => name,
    getKind: () => kind,
    // { old: new } for the names changed since the last save that are still changed
    getRenames: () => settleRenames(renames, allNames()),
    isDirty: () => dirty,
    markClean: () => { dirty = false; renames = []; },
    refit: () => room && fit(),
    redraw: () => room && render(), // the look changed
  };
}
