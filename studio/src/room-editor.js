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
import { FONT8, FONT8_FIRST } from "./font8.js";

const TOOLS = [
  ["select", "Select", "Click a thing to select it; drag to move it (Shift: in a straight line), drag a panel's handles to resize it. Arrow keys nudge, Delete removes. The other tools only place. (V, or Escape)", "v"],
  ["tiles", "Tiles", "Paint tiles on the chosen layer. Shift-click fills an area, Alt-click erases, right-click picks a tile up. (T)", "t"],
  ["entities", "Things", "Click to place the chosen entity; drag one to move it; Delete removes the selected one. (N)", "n"],
  ["texts", "Text", "Click to put a text; drag one to move it; Delete removes the selected one. (X)", "x"],
  ["pictures", "Pictures", "Click to put the chosen sprite as a picture (no code of its own); drag one to move it; Delete removes it. (I)", "i"],
  ["panels", "Panels", "Drag to draw a panel or a bar made of tiles, behind texts and pictures. Drag one to move it; Delete removes it. (B)", "b"],
  ["paths", "Paths", "Click to add a point to the chosen path; drag a point to move it; Delete removes the selected point. (P)", "p"],
];
// what each tool places and selects
const KIND_OF = { entities: "entities", texts: "texts", pictures: "pictures", panels: "panels" };
// what a drag onto the layout carries (from its own palettes and from the studio's side tree): { what: "entity" | "sprite", name }
export const PLACE = "application/x-gs-place";

export function createRoomEditor(root, hooks = {}) {
  root.innerHTML = `
    <div class="se-left re-left">
      <div class="re-lefttabs" role="tablist"><button data-side="list" class="on">In this layout</button><button data-side="details">Layout</button></div>
      <section class="re-outline-wrap"><div class="re-outline"></div></section>
      <section class="re-details" hidden>
        <h3>Size</h3>
        <label class="se-field" title="Menus and screens that do not scroll are one screen"><input type="radio" name="re-sizekind" class="re-one" value="one"> <span class="re-one-label">One screen</span></label>
        <label class="se-field" title="A level bigger than the screen: the camera follows the player inside it"><input type="radio" name="re-sizekind" class="re-big" value="big"> Bigger: it scrolls</label>
        <div class="se-row se-fields re-bigsize">
          <label>W <input type="number" class="re-w" min="16" max="8192" step="16"></label>
          <label>H <input type="number" class="re-h" min="16" max="8192" step="16"></label>
        </div>
        <p class="se-hint re-sizehint"></p>
        <h3>Background</h3>
        <div class="re-colors re-bg-colors" title="The colour behind everything, where no tile is"></div>
        <div class="re-code-row">
          <h3>Runs the code of</h3>
          <select class="re-code" title="Ten levels can share one set of rules: each level's layout runs the same scene's code"></select>
        </div>
        <p class="re-astext-row"><button class="link re-astext" data-act="text">Edit as text…</button></p>
      </section>
    </div>
    <div class="se-center">
      <div class="re-toolrow"><div class="re-tools" role="toolbar"></div>
        <span class="re-view" title="How the layout is shown here (not part of the layout)">
          <button data-act="undo" title="Undo (Cmd/Ctrl+Z)">↶</button><button data-act="redo" title="Redo (Shift+Cmd/Ctrl+Z)">↷</button>
          <span class="re-sep"></span>
          <button data-act="zoomout" title="Smaller">&minus;</button><button data-act="fit" title="As big as fits">Fit</button><button data-act="zoomin" title="Bigger">+</button>
          <span class="re-sep"></span>
          <label title="Show the grid"><input type="checkbox" class="re-grid" checked> Grid</label>
          <label title="Things you place or move land on the grid (half a tile)"><input type="checkbox" class="re-snap" checked> Snap</label>
        </span>
      </div>
      <div class="se-canvaswrap re-wrap"><canvas class="se-canvas re-canvas"></canvas></div>
      <div class="se-status re-status"></div>
    </div>
    <div class="se-right">
      <div class="re-nothing se-hint">Select something in the layout, or in the list on the left, to see and change it here.</div>
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
        <div class="se-row se-fields re-look re-look-item" title="How it mixes with what is behind it, like a GBA's blending: Glow adds light (fire, light shafts, magic), Shadow darkens (shade, tinted glass, night). Strength is how much: below 100% it is see-through.">
          <label>Look <select class="re-blend"><option value="">normal</option><option value="add">glow (add)</option><option value="darken">shadow (darken)</option></select></label>
          <label>Strength <input type="range" class="re-alpha" min="0" max="100" step="5"> <span class="re-alpha-val"></span></label>
        </div>
        <label class="se-field re-screen-row" title="Stays put when the camera scrolls (a score, a hint). Otherwise it is part of the world."><input type="checkbox" class="re-screen"> Fixed on the screen</label>
        <div class="se-row"><button data-act="delsel">Delete</button></div>
      </div>
      <div class="re-panel re-tiles-panel">
        <h3>Paint tiles</h3>
        <div class="se-row"><select class="re-newlayer-ts" title="The tileset the new layer uses"></select><button data-act="addlayer" title="A new tile layer">+ Layer</button></div>
        <p class="se-hint re-layerhint"></p>
        <div class="se-row se-fields re-look re-look-layer" title="How it mixes with what is behind it, like a GBA's blending: Glow adds light (fire, light shafts, magic), Shadow darkens (shade, tinted glass, night). Strength is how much: below 100% it is see-through.">
          <label>Look <select class="re-blend"><option value="">normal</option><option value="add">glow (add)</option><option value="darken">shadow (darken)</option></select></label>
          <label>Strength <input type="range" class="re-alpha" min="0" max="100" step="5"> <span class="re-alpha-val"></span></label>
        </div>
        <div class="re-tilepal"><canvas class="re-tilecanvas"></canvas></div>
        <p class="se-hint re-tilehint"></p>
      </div>
      <div class="re-panel re-add-panel">
        <h3>Add</h3>
        <input class="re-search" type="search" placeholder="Search entities and sprites" spellcheck="false">
        <div class="re-libhead">Entities</div>
        <div class="re-entlist re-thumbs"></div>
        <div class="re-libhead">Sprites <span class="re-libnote">(a picture, no code of its own)</span></div>
        <div class="re-spritelist re-thumbs"></div>
        <p class="se-hint re-ents-hint"></p>
      </div>
      <div class="re-panel re-texts-panel">
        <h3>Text</h3>
        <p class="se-hint">Click where the text goes. Each text gets a name, so the code can change it: <code>self.title.text = "GO!"</code>.</p>
      </div>
      <div class="re-panel re-panels-panel">
        <h3>Panel styles</h3>
        <select class="re-panel-ts" title="The tileset the panels' tiles come from"></select>
        <div class="re-styles"></div>
        <p class="se-hint re-styles-hint">Pick a style, then drag in the layout to draw a panel. With a panel selected, a click on a style changes it.</p>
        <details class="re-anytiles">
          <summary title="For tilesets whose 3 × 3 blocks do not start every third tile">Start at any tile</summary>
          <div class="re-tilepal re-tilepal-wide"><canvas class="re-blockcanvas"></canvas></div>
          <p class="se-hint">Click the top-left tile of a 3 × 3 block. Its corners stay as drawn; the edges and middle repeat to fill the panel.</p>
        </details>
      </div>
      <div class="re-panel re-paths-panel">
        <h3>Paths</h3>
        <div class="se-row"><button data-act="addpath" title="A new, empty path">+ Path</button></div>
        <label class="se-field"><input type="checkbox" class="re-loop"> Goes round (loop)</label>
        <p class="se-hint">Click to add points to the chosen path (in the list above). An entity walks one with <code>self:follow_path("name", speed)</code>.</p>
      </div>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const canvas = $(".re-canvas"), ctx = canvas.getContext("2d"), wrap = $(".re-wrap");
  let room = null, name = "", kind = "room", dirty = false, tool = "select", zoom = 2;
  let layerIx = 0, tile = 0, entName = "", spriteName = "", sel = null, pathName = "", pointIx = -1;
  let hover = null; // { kind, i } under the pointer
  let side = "list", bigSize = false; // the left side's tab; "Bigger" chosen while the size still is one screen
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
  // a panel's resize handles: corners and edge middles, with which sides each moves ([x, y, left, top, right, bottom])
  const handlesOf = (b) => [[0, 0, 1, 1, 0, 0], [0.5, 0, 0, 1, 0, 0], [1, 0, 0, 1, 1, 0], [1, 0.5, 0, 0, 1, 0], [1, 1, 0, 0, 1, 1], [0.5, 1, 0, 0, 0, 1], [0, 1, 1, 0, 0, 1], [0, 0.5, 1, 0, 0, 0]]
    .map(([fx, fy, ...sides]) => [b.x + b.w * fx, b.y + b.h * fy, ...sides]);
  // drawn again only when it changes (the list is rebuilt with every drawing)
  function setHover(h) {
    if ((h && h.kind) === (hover && hover.kind) && (h && h.i) === (hover && hover.i)) return;
    hover = h; render();
  }
  // the topmost thing at a point, whatever its kind (texts are on top, then pictures, entities and panels)
  function thingAt(x, y) {
    for (const k of ["texts", "pictures", "entities", "panels"]) { const i = hitAt(k, x, y); if (i >= 0) return { kind: k, i }; }
    return null;
  }
  function hitAt(k, x, y) {
    if (k === "entities") { const i = R.entityAt(room, x, y, 12 / Math.min(zoom, 2) + 4); return i; }
    const list = room[k], box = k === "texts" ? textBoxOf : k === "panels" ? (b) => [b.x, b.y, b.x + b.w, b.y + b.h] : pictureBox;
    for (let i = list.length - 1; i >= 0; i--) { const [x0, y0, x1, y1] = box(list[i]); if (x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 2 && y <= y1 + 2) return i; }
    return -1;
  }

  // ---------- drawing ----------
  // the built-in font as a strip of letters in one colour, made once for each colour used
  const font8Strips = new Map();
  function font8(colour) {
    let c = font8Strips.get(colour);
    if (c) return c;
    c = document.createElement("canvas"); c.width = FONT8.length * 8; c.height = 8;
    const g = c.getContext("2d"); g.fillStyle = colour;
    FONT8.forEach((hex, i) => { for (let y = 0; y < 8; y++) { const v = parseInt(hex.slice(y * 2, y * 2 + 2), 16); for (let x = 0; x < 8; x++) if (v & (0x80 >> x)) g.fillRect(i * 8 + x, y, 1, 1); } });
    font8Strips.set(colour, c);
    return c;
  }
  // a thing's look as the game draws it: its blend mode, and its alpha times how faint the editor shows it now
  const COMPOSITE = { add: "lighter", darken: "multiply" };
  function looks_(item, faint) {
    ctx.globalAlpha = faint * (item.alpha ?? 1);
    ctx.globalCompositeOperation = COMPOSITE[item.blend] || "source-over";
  }
  function plain() { ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; }
  function render() {
    if (!room) return;
    const cw = Math.round(room.width * zoom), ch = Math.round(room.height * zoom);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; canvas.style.width = cw + "px"; canvas.style.height = ch + "px"; }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = room.background == null ? "#000000" : colorOf(room.background); ctx.fillRect(0, 0, canvas.width, canvas.height);
    // layers back to front: a bigger depth is further back, as in the game
    const order = room.layers.map((l, i) => i).sort((a, b) => (room.layers[b].depth ?? 100) - (room.layers[a].depth ?? 100));
    for (const i of order) {
      const l = room.layers[i], t = ts(l);
      if (!t || l.visible === false) continue;
      looks_(l, tool === "tiles" && i !== layerIx ? 0.45 : 1);
      // a repeating layer is drawn as often as it takes to fill the layout, as the game shows it
      const pw = (l.data[0] || []).length * t.tw, ph = l.data.length * t.th;
      const nx = l.wrap_x && pw ? Math.ceil(room.width / pw) : 1, ny = l.wrap_y && ph ? Math.ceil(room.height / ph) : 1;
      for (let ky = 0; ky < ny; ky++) for (let kx = 0; kx < nx; kx++) l.data.forEach((row, r) => row.forEach((v, c) => {
        if (v < 0 || v >= t.count) return;
        ctx.drawImage(t.img, (v % t.cols) * t.tw, Math.floor(v / t.cols) * t.th, t.tw, t.th, (kx * pw + c * t.tw) * zoom, (ky * ph + r * t.th) * zoom, t.tw * zoom, t.th * zoom);
      }));
    }
    plain();
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
    // only the Select tool selects and shows what is under the pointer; the others place things
    const selecting = tool === "select";
    const isSel = (k, i) => selecting && ((sel && sel.kind === k && sel.i === i) || (hover && hover.kind === k && hover.i === i && !drag));
    const dim = (k, faint) => (selecting || KIND_OF[tool] === k ? 1 : faint);
    // panels, then pictures, then texts: the order the game builds them in
    room.panels.forEach((b, i) => {
      looks_(b, dim("panels", 0.9));
      drawPanel(b);
      plain();
      if (isSel("panels", i)) ring(b.x, b.y, b.x + b.w, b.y + b.h);
      if (selecting && sel && sel.kind === "panels" && sel.i === i) for (const [hx, hy] of handlesOf(b)) { ctx.fillStyle = "#ffffff"; ctx.strokeStyle = themeColor("accent"); ctx.lineWidth = 1; ctx.fillRect(hx * zoom - 4, hy * zoom - 4, 8, 8); ctx.strokeRect(hx * zoom - 3.5, hy * zoom - 3.5, 7, 7); }
      if (b.name) labels.push([`self.${b.name}`, b.x + b.w / 2, b.y + 14, "panels", i]);
    });
    // pictures
    room.pictures.forEach((p, i) => {
      const look = pics[p.sprite], s = Number(p.scale) || 1;
      looks_(p, dim("pictures", 0.75));
      if (look) {
        const fr = Math.max(0, Math.floor(p.frame || 0)) % Math.max(1, Math.floor(look.img.width / look.fw));
        ctx.drawImage(look.img, fr * look.fw, 0, look.fw, look.fh, (p.x - look.ox * s) * zoom, (p.y - look.oy * s) * zoom, look.fw * s * zoom, look.fh * s * zoom);
      } else { ctx.fillStyle = "#8a90a8"; ctx.fillRect((p.x - 6) * zoom, (p.y - 6) * zoom, 12 * zoom, 12 * zoom); }
      plain();
      const b = pictureBox(p);
      if (isSel("pictures", i)) ring(...b);
      if (p.name) labels.push([`self.${p.name}`, (b[0] + b[2]) / 2, b[1], "pictures", i]);
    });
    // entities
    ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    room.entities.forEach(([n, x, y, , nm], i) => {
      const look = looks[n], px = x * zoom, py = y * zoom;
      ctx.globalAlpha = dim("entities", 0.6);
      if (look) ctx.drawImage(look.img, 0, 0, look.fw, look.fh, px - look.ox * zoom, py - look.oy * zoom, look.fw * zoom, look.fh * zoom);
      else { ctx.fillStyle = "#ffa38c"; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (isSel("entities", i)) { ctx.strokeStyle = themeColor("accent"); ctx.lineWidth = 2; ctx.strokeRect(px - 9, py - 9, 18, 18); }
      if (nm) labels.push([`self.${nm}`, x, y - (look ? look.oy : 6), "entities", i]);
      else if (!look || isSel("entities", i)) { ctx.fillStyle = "#ffffff"; ctx.fillText(n, px, py - 10); }
    });
    // texts: a sprite font as the game draws it; the built-in font in its size (8 pixels a letter), the Play panel shows its real letters
    room.texts.forEach((t, i) => {
      const size = Number(t.size) || 1, [x0, y0, x1, y1] = textBoxOf(t), font = t.font && pics[t.font];
      looks_(t, dim("texts", 0.8));
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = colorOf(t.color);
      const s = String(t.text ?? "");
      const frames = font ? Math.max(1, Math.floor(font.img.width / font.fw)) : 0;
      for (let k = 0; k < s.length; k++) {
        if (!font) { // the runtime's own letters (font8.js), in the text's colour
          const f = s.charCodeAt(k) - FONT8_FIRST;
          if (f >= 0 && f < FONT8.length) ctx.drawImage(font8(ctx.fillStyle), f * 8, 0, 8, 8, (x0 + k * 8 * size) * zoom, y0 * zoom, 8 * size * zoom, 8 * size * zoom);
          continue;
        }
        const f = s.charCodeAt(k) - 32;
        if (f >= 0 && f < frames) ctx.drawImage(font.img, f * font.fw, 0, font.fw, font.fh, (x0 + k * font.fw * size) * zoom, y0 * zoom, font.fw * size * zoom, font.fh * size * zoom);
      }
      if (!s) { ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.strokeRect(x0 * zoom, y0 * zoom, (x1 - x0) * zoom, (y1 - y0) * zoom); }
      plain();
      if (isSel("texts", i)) ring(x0, y0, x1, y1);
      if (t.name) labels.push([`self.${t.name}`, (x0 + x1) / 2, y0, "texts", i]);
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
    // names, the way the code reaches them: the selected thing's first, then the one under the pointer, then the current tool's kind;
    // a label that would cover one already drawn is left out
    ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const rank = (l) => (isSel(l[3], l[4]) ? 0 : selecting || KIND_OF[tool] === l[3] ? 2 : 9);
    const placed = [];
    for (const l of labels.filter((l) => rank(l) < 9).sort((a, b) => rank(a) - rank(b))) {
      const [text, x, y] = l, w = ctx.measureText(text).width + 8, lx = x * zoom - w / 2, ly = y * zoom - 18;
      if (placed.some(([px, py, pw]) => lx < px + pw && lx + w > px && ly < py + 15 && ly + 15 > py)) continue;
      placed.push([lx, ly, w]);
      ctx.fillStyle = "rgba(10,12,20,0.8)"; ctx.fillRect(lx, ly, w, 15);
      ctx.fillStyle = "#a8d4ff"; ctx.fillText(text, x * zoom, ly + 11);
    }
    renderSide();
  }

  function renderSide() {
    root.querySelectorAll(".re-tools button").forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
    $(".re-tiles-panel").hidden = tool !== "tiles"; $(".re-add-panel").hidden = !["entities", "pictures"].includes(tool);
    $(".re-nothing").hidden = !(tool === "select" && !selected());
    // the pointer says what a click will do: move something, select, or place
    canvas.style.cursor = tool === "select" ? (hover ? "move" : "default") : "crosshair"; $(".re-paths-panel").hidden = tool !== "paths";
    $(".re-texts-panel").hidden = tool !== "texts"; $(".re-panels-panel").hidden = tool !== "panels";
    if (tool === "panels") drawBlockPicker();
    renderOutline();
    $(".re-look-layer").hidden = !layer();
    if (layer()) showLook($(".re-look-layer"), layer());
    $(".re-layerhint").textContent = room.layers.length ? `Painting on ${layer() ? layer().name || "layer " + (layerIx + 1) : "no layer"} (pick another in the list above).` : "No tile layers yet: pick a tileset and add one.";
    const tsSel = $(".re-newlayer-ts"), names = hooks.getTilesets ? hooks.getTilesets() : [];
    if (tsSel.options.length !== names.length) tsSel.replaceChildren(...names.map((n) => new Option(n, n)));
    $("[data-act=addlayer]").disabled = !names.length;
    drawTilePalette();
    // things to place
    if (["entities", "pictures"].includes(tool)) {
      const q = $(".re-search").value.trim().toLowerCase(), match = (n) => !q || n.toLowerCase().includes(q);
      pickList($(".re-entlist"), "entity", (hooks.getEntities ? hooks.getEntities() : []).filter(match), tool === "entities" ? entName : "", q ? "No entity matches." : "No entities in this game yet.", (n) => { entName = n; tool = "entities"; });
      pickList($(".re-spritelist"), "sprite", (hooks.getSprites ? hooks.getSprites() : []).filter(match), tool === "pictures" ? spriteName : "", q ? "No sprite matches." : "No sprites in this game yet.", (n) => { spriteName = n; tool = "pictures"; });
    }
    $(".re-ents-hint").textContent = (kind === "layout" ? "Click one, then click in the layout; or drag it in (from here or from the side tree). Give one a name to use it in the code (self.name)." : "Each one starts where you put it when gs.load_room builds the room.");
    const cur = room.paths[pathName];
    $(".re-loop").checked = !!(cur && cur.loop); $(".re-loop").disabled = !cur;
    // size, background, code
    // the left side: what is in the layout, or the layout's own details
    root.querySelectorAll(".re-lefttabs button").forEach((b) => b.classList.toggle("on", b.dataset.side === side));
    $(".re-outline-wrap").hidden = side !== "list"; $(".re-details").hidden = side !== "details";
    // size: one screen (the console's) unless the level scrolls
    const scr = hooks.getScreen ? hooks.getScreen() : { width: 320, height: 240 };
    const one = room.width === scr.width && room.height === scr.height && !bigSize;
    $(".re-one").checked = one; $(".re-big").checked = !one; $(".re-bigsize").hidden = one;
    $(".re-one-label").textContent = `One screen (${scr.width} × ${scr.height}, the console's)`;
    if (document.activeElement !== $(".re-w")) $(".re-w").value = room.width;
    if (document.activeElement !== $(".re-h")) $(".re-h").value = room.height;
    $(".re-sizehint").textContent = one ? "The camera stays put. Right for menus and single-screen games." : `${(room.width / scr.width).toFixed(1)} × ${(room.height / scr.height).toFixed(1)} screens. The camera never shows outside it; the dashed box in the layout is one screen.`;
    swatches($(".re-bg-colors"), room.background ?? (pal().fixed ? 0 : "#000000"), (v) => { room.background = v; });
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

  // Everything in the layout, by kind, in the order the game draws it (back to front). A click selects it (and the tool for its kind),
  // the pointer over a row shows which one it is in the layout, × deletes it.
  function renderOutline() {
    const box = $(".re-outline"); box.replaceChildren();
    const group = (title, items) => {
      if (!items.length) return;
      const h = document.createElement("div"); h.className = "re-og"; h.textContent = `${title} · ${items.length}`; box.appendChild(h);
      for (const it of items) {
        const row = document.createElement("div"); row.className = "re-orow" + (it.on ? " active" : "") + (it.off ? " off" : "");
        if (it.eye) row.appendChild(it.eye);
        const main = document.createElement("span"); main.className = "re-oname"; main.textContent = it.label; row.appendChild(main);
        if (it.detail) { const d = document.createElement("span"); d.className = "re-odetail"; d.textContent = it.detail; row.appendChild(d); }
        for (const [glyph, tip, fn] of it.buttons || []) {
          const b = document.createElement("button"); b.className = "x"; b.textContent = glyph; b.title = tip;
          b.onclick = (e) => { e.stopPropagation(); fn(); };
          row.appendChild(b);
        }
        row.onclick = it.pick;
        if (it.hover) { row.onmouseenter = () => { if (tool === "select") setHover(it.hover); }; row.onmouseleave = () => setHover(null); }
        box.appendChild(row);
      }
    };
    const del = (k, i) => ["×", "Delete", () => commit(() => { room[k].splice(i, 1); if (sel && sel.kind === k) sel = null; })];
    const choose = (k, i) => () => { tool = "select"; sel = { kind: k, i }; render(); };
    const isOn = (k, i) => tool === "select" && !!(sel && sel.kind === k && sel.i === i);
    group("Tile layers", room.layers.map((l, i) => {
      const eye = document.createElement("input"); eye.type = "checkbox"; eye.checked = l.visible !== false; eye.title = "Show this layer (in the game too)";
      eye.onclick = (e) => { e.stopPropagation(); commit(() => { if (eye.checked) delete l.visible; else l.visible = false; }); };
      return { label: l.name || `layer ${i + 1}`, detail: l.tileset, eye, on: tool === "tiles" && i === layerIx, off: l.visible === false,
        pick: () => { tool = "tiles"; layerIx = i; tile = 0; render(); },
        buttons: [["×", "Delete this layer", () => commit(() => { room.layers.splice(i, 1); layerIx = Math.max(0, Math.min(layerIx, room.layers.length - 1)); })]] };
    }));
    group("Panels", room.panels.map((p, i) => ({ label: p.name ? `self.${p.name}` : "panel", detail: `${p.w} × ${p.h}`, on: isOn("panels", i), pick: choose("panels", i), hover: { kind: "panels", i }, buttons: [del("panels", i)] })));
    group("Pictures", room.pictures.map((p, i) => ({ label: p.name ? `self.${p.name}` : p.sprite, detail: p.name ? p.sprite : "", on: isOn("pictures", i), pick: choose("pictures", i), hover: { kind: "pictures", i }, buttons: [del("pictures", i)] })));
    group("Things", room.entities.map((e, i) => ({ label: e[4] ? `self.${e[4]}` : e[0], detail: e[4] ? e[0] : `${e[1]}, ${e[2]}`, on: isOn("entities", i), pick: choose("entities", i), hover: { kind: "entities", i }, buttons: [del("entities", i)] })));
    group("Texts", room.texts.map((t, i) => ({ label: t.name ? `self.${t.name}` : `"${t.text}"`, detail: t.name ? `"${t.text}"` : "", on: isOn("texts", i), pick: choose("texts", i), hover: { kind: "texts", i }, buttons: [del("texts", i)] })));
    group("Paths", Object.entries(room.paths).map(([k, p]) => ({ label: k, detail: `${p.points.length} point${p.points.length === 1 ? "" : "s"}`, on: tool === "paths" && k === pathName,
      pick: () => { tool = "paths"; pathName = k; pointIx = -1; render(); },
      buttons: [["✎", "Rename", () => {
        const n = (prompt("New name for the path", k) || "").trim();
        if (!n || n === k) return;
        if (!/^[A-Za-z_]\w*$/.test(n) || room.paths[n]) { alert("Use letters, digits and _ (not starting with a digit), and a name not taken."); return; }
        commit(() => { room.paths = Object.fromEntries(Object.entries(room.paths).map(([a, b]) => [a === k ? n : a, b])); pathName = n; });
      }], ["×", "Delete this path", () => commit(() => { delete room.paths[k]; if (pathName === k) pathName = ""; })]] })));
    if (!box.children.length) { const p = document.createElement("p"); p.className = "se-hint"; p.textContent = "Nothing here yet. Pick a tool above the layout and add something."; box.appendChild(p); }
  }

  // what can be placed, as pictures with their names; click to choose, or drag onto the layout
  function pickList(box, what, list, current, empty, pick) {
    box.replaceChildren();
    if (!list.length) { const p = document.createElement("p"); p.className = "se-hint"; p.textContent = empty; box.appendChild(p); }
    const store = what === "entity" ? looks : pics, load = what === "entity" ? hooks.entityLook : hooks.spriteLook;
    let missing = false;
    for (const n of list) {
      const b = document.createElement("button"); b.className = "re-thumb" + (n === current ? " active" : ""); b.title = n; b.draggable = true;
      const c = document.createElement("canvas"); c.width = c.height = 32;
      const look = store[n];
      if (n in store) { if (look) thumb(c, look); } else missing = true;
      const label = document.createElement("span"); label.textContent = n.split(/[/.]/).pop();
      b.append(c, label);
      b.onclick = () => { pick(n); renderSide(); };
      b.addEventListener("dragstart", (e) => { e.dataTransfer.setData(PLACE, JSON.stringify({ what, name: n })); e.dataTransfer.effectAllowed = "copy"; });
      box.appendChild(b);
    }
    // fetch the pictures not seen yet, then draw the list again
    if (missing && load) Promise.all(list.filter((n) => !(n in store)).map(async (n) => { try { store[n] = await load(n); } catch { store[n] = null; } })).then(() => renderSide());
  }
  // the first frame of a look, as big as fits a 32 x 32 square, pixels kept sharp
  function thumb(c, look) {
    const g = c.getContext("2d"), k = Math.max(0.25, Math.min(4, Math.floor(32 / Math.max(look.fw, look.fh)) || 32 / Math.max(look.fw, look.fh)));
    g.imageSmoothingEnabled = false;
    const w = look.fw * k, h = look.fh * k;
    g.drawImage(look.img, 0, 0, look.fw, look.fh, (32 - w) / 2, (32 - h) / 2, w, h);
  }

  function renderSelected() {
    const item = selected(), k = sel && sel.kind;
    $(".re-selected").hidden = !(item && tool === "select");
    if (!item) return;
    const [x, y] = posOf(k, item);
    $(".re-selinfo").textContent = k === "entities" ? `${item[0]} at ${x}, ${y}` : k === "texts" ? `Text at ${x}, ${y}` : k === "panels" ? `Panel ${item.w} × ${item.h}` : `Picture of ${item.sprite} at ${x}, ${y}`;
    const keep = (el, v) => { if (document.activeElement !== el) el.value = v; };
    keep($(".re-name"), nameOf(k, item) || "");
    const nm = nameOf(k, item);
    $(".re-name-hint").textContent = /^dialogue_(box|text|name|cursor)$/.test(nm || "") ? `The look of gs.say and gs.ask's box (${nm.slice(9)}): the game does not show it by itself.`
      : nm ? `In the code: self.${nm}` : kind === "layout" ? "Give it a name to use it in the scene's code. dialogue_box, dialogue_text, dialogue_name and dialogue_cursor give gs.say its look." : "";
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
    $(".re-look-item").hidden = k === "entities"; // an entity's look is its own code's (blend = "add" in its file, or in Values)
    showLook($(".re-look-item"), item);
  }
  function showLook(row, item) {
    if (!item) return;
    row.querySelector(".re-blend").value = item.blend || "";
    const a = Math.round((item.alpha ?? 1) * 100), r = row.querySelector(".re-alpha");
    if (document.activeElement !== r) r.value = a;
    row.querySelector(".re-alpha-val").textContent = `${a}%`;
  }
  // a look written only when it is not the plain one, so layouts stay short
  function setLook(item, blend, alpha) {
    if (blend) item.blend = blend; else delete item.blend;
    if (alpha < 1) item.alpha = alpha; else delete item.alpha;
  }
  for (const [row, target] of [[".re-look-item", () => selected()], [".re-look-layer", () => layer()]]) {
    const el = $(row), get = () => [el.querySelector(".re-blend").value, Number(el.querySelector(".re-alpha").value) / 100];
    el.querySelector(".re-blend").onchange = () => { const t = target(); if (t) commit(() => setLook(t, ...get())); };
    // the slider changes the look as it moves; one undo step covers the whole drag
    let before = null;
    el.querySelector(".re-alpha").onpointerdown = () => { before = snapshot(); };
    el.querySelector(".re-alpha").oninput = () => {
      const t = target(); if (!t) return;
      if (before === null) before = snapshot();
      setLook(t, ...get()); el.querySelector(".re-alpha-val").textContent = `${Math.round(get()[1] * 100)}%`; markDirty(); render();
    };
    el.querySelector(".re-alpha").onchange = () => { if (before !== null && before !== snapshot()) history.record(before); before = null; };
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
    if (!t) { c.width = c.height = 0; $(".re-styles").replaceChildren(); if (panelTs && !(panelTs in tilesets)) loadAssets(); return; }
    drawStyles(t);
    const k = Math.max(2, Math.floor(160 / (t.cols * t.tw)));
    c.width = t.img.width * k; c.height = t.img.height * k;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    g.drawImage(t.img, 0, 0, c.width, c.height);
    g.strokeStyle = themeColor("accent"); g.lineWidth = 2;
    g.strokeRect((panelTile % t.cols) * t.tw * k + 1, Math.floor(panelTile / t.cols) * t.th * k + 1, 3 * t.tw * k - 2, 3 * t.th * k - 2);
    c.onclick = (ev) => {
      const r = c.getBoundingClientRect(), sx = c.width / r.width;
      const col = Math.floor(((ev.clientX - r.left) * sx) / (t.tw * k)), row = Math.floor(((ev.clientY - r.top) * sx) / (t.th * k));
      const v = row * t.cols + col;
      if (v >= 0 && v < t.count) choosePanelTile(v);
    };
  }

  // The tileset's 3 x 3 blocks that start every third tile, each shown as a small panel; empty ones are left out.
  function drawStyles(t) {
    const box = $(".re-styles"); box.replaceChildren();
    const blocks = panelBlocks(t), rows = Math.floor(t.img.height / t.th);
    $(".re-styles-hint").textContent = blocks.length ? "Pick a style, then drag in the layout to draw a panel. With a panel selected, a click on a style changes it."
      : `${t.cols} × ${rows} tiles: no 3 × 3 blocks to make panels of. Draw them in the tileset, or start at any tile below.`;
    for (const tile0 of blocks) {
      const b = document.createElement("button"); b.className = "re-style" + (tile0 === panelTile ? " active" : ""); b.title = `tiles from ${tile0}`;
      const c = document.createElement("canvas"), k = Math.max(1, Math.floor(16 / t.tw) || 1);
      c.width = 5 * t.tw * k; c.height = 3 * t.th * k; // the middle column twice more, so it shows how it stretches
      const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
      [0, 1, 1, 1, 2].forEach((pc, x) => [0, 1, 2].forEach((pr) => {
        const v = tile0 + pr * t.cols + pc;
        g.drawImage(t.img, (v % t.cols) * t.tw, Math.floor(v / t.cols) * t.th, t.tw, t.th, x * t.tw * k, pr * t.th * k, t.tw * k, t.th * k);
      }));
      b.appendChild(c);
      b.onclick = () => choosePanelTile(tile0);
      box.appendChild(b);
    }
  }
  const blockCache = new Map();
  function panelBlocks(t) {
    if (blockCache.has(t)) return blockCache.get(t);
    const out = [];
    let px = null;
    try { const c = document.createElement("canvas"); c.width = t.img.width; c.height = t.img.height; const g = c.getContext("2d"); g.drawImage(t.img, 0, 0); px = g.getImageData(0, 0, c.width, c.height).data; } catch { /* cannot look: show them all */ }
    const empty = (x0, y0, w, h) => { if (!px) return false; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (px[(y * t.img.width + x) * 4 + 3]) return false; return true; };
    const rows = Math.floor(t.img.height / t.th);
    for (let r = 0; r + 3 <= rows; r += 3) for (let c = 0; c + 3 <= t.cols; c += 3) if (!empty(c * t.tw, r * t.th, 3 * t.tw, 3 * t.th)) out.push(r * t.cols + c);
    blockCache.set(t, out);
    return out;
  }
  function choosePanelTile(v) {
    panelTile = v;
    const p = selected() && sel.kind === "panels" ? selected() : null;
    if (p) commit(() => { p.tileset = panelTs; p.tile = v; }); else drawBlockPicker();
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

  // dropped from the palette on the left or from the studio's side tree: an entity is placed, a sprite becomes a picture
  wrap.addEventListener("dragover", (e) => { if (room && e.dataTransfer.types.includes(PLACE)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; wrap.classList.add("drop"); } });
  wrap.addEventListener("dragleave", () => wrap.classList.remove("drop"));
  wrap.addEventListener("drop", (e) => {
    wrap.classList.remove("drop");
    const raw = e.dataTransfer.getData(PLACE); if (!raw || !room) return;
    e.preventDefault();
    const { what, name: n } = JSON.parse(raw), [x, y] = worldAt(e);
    placeAt(what, n, x, y);
  });
  function placeAt(what, n, x, y) {
    if (what === "entity") { entName = n; tool = "select"; commit(() => { room.entities.push([n, snapped(x), snapped(y)]); sel = { kind: "entities", i: room.entities.length - 1 }; }); }
    else { spriteName = n; tool = "select"; commit(() => { room.pictures.push({ sprite: n, x: snapped(x), y: snapped(y), name: freshName(n) }); sel = { kind: "pictures", i: room.pictures.length - 1 }; }); }
    loadAssets();
    root.focus({ preventScroll: true });
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
    } else if (tool === "select") {
      // a handle of the selected panel first, then the topmost thing under the pointer; empty space selects nothing
      const p = sel && sel.kind === "panels" ? selected() : null;
      const h = p && handlesOf(p).find(([hx, hy]) => Math.abs(hx - x) * zoom <= 5 && Math.abs(hy - y) * zoom <= 5);
      if (h) { drag = { kind: "resize", before: snapshot(), sides: h.slice(2), from: { x: p.x, y: p.y, w: p.w, h: p.h } }; return; }
      const hit = thingAt(x, y);
      if (!hit) { sel = null; render(); return; }
      const [ix, iy] = posOf(hit.kind, room[hit.kind][hit.i]);
      sel = hit; drag = { kind: "move", before: snapshot(), dx: ix - x, dy: iy - y, x0: ix, y0: iy };
      render();
    } else if (k) {
      // placing tools only place; texts and panels go on to Select, to type their words or set their size
      if (k === "entities") {
        if (!entName) { status("Pick an entity on the left first."); return; }
        commit(() => { room.entities.push([entName, snapped(x), snapped(y)]); sel = { kind: k, i: room.entities.length - 1 }; });
      } else if (k === "panels") {
        if (!panelTs) { status("Pick a tileset for the panel on the left first."); return; }
        const before = snapshot();
        room.panels.push({ x: snapped(x), y: snapped(y), w: 1, h: 1, tileset: panelTs, tile: panelTile, name: freshName("panel") });
        sel = { kind: k, i: room.panels.length - 1 };
        drag = { kind: "draw", before, x0: snapped(x), y0: snapped(y), then: "select" };
        render();
      } else if (k === "texts") {
        commit(() => { room.texts.push({ text: "TEXT", x: snapped(x), y: snapped(y), name: freshName("text"), size: 1 }); sel = { kind: k, i: room.texts.length - 1 }; tool = "select"; });
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
    // what is under the pointer: its name is shown, and its row in the list lights up
    if (!drag) setHover(tool === "select" && ev.target === canvas ? thingAt(x, y) : null);
    if (!drag) return;
    if (drag.kind === "paint") { paintAt(x, y, drag.erase, false); render(); }
    else if (drag.kind === "draw" && selected()) {
      const b = selected(), x1 = snapped(x), y1 = snapped(y);
      b.x = Math.min(drag.x0, x1); b.y = Math.min(drag.y0, y1); b.w = Math.max(1, Math.abs(x1 - drag.x0)); b.h = Math.max(1, Math.abs(y1 - drag.y0));
      render();
    }
    else if (drag.kind === "move" && selected()) {
      let nx = snapped(x + drag.dx), ny = snapped(y + drag.dy);
      if (ev.shiftKey) { if (Math.abs(nx - drag.x0) >= Math.abs(ny - drag.y0)) ny = drag.y0; else nx = drag.x0; } // in a straight line
      setPos(sel.kind, selected(), nx, ny); render();
    }
    else if (drag.kind === "resize" && selected()) {
      const b = selected(), f = drag.from, [l, t, r, bt] = drag.sides, px = snapped(x), py = snapped(y);
      const x0 = l ? Math.min(px, f.x + f.w - 1) : f.x, y0 = t ? Math.min(py, f.y + f.h - 1) : f.y;
      const x1 = r ? Math.max(px, f.x + 1) : f.x + f.w, y1 = bt ? Math.max(py, f.y + 1) : f.y + f.h;
      b.x = x0; b.y = y0; b.w = x1 - x0; b.h = y1 - y0; render();
    }
    else if (drag.kind === "point") { const p = room.paths[pathName]; if (p && p.points[pointIx]) { p.points[pointIx] = [snapped(x), snapped(y)]; render(); } }
  });
  window.addEventListener("mouseup", () => {
    if (!drag) return;
    // a click without a drag makes a panel three tiles square
    if (drag.kind === "draw" && selected() && selected().w < 4 && selected().h < 4) { const t = tilesets[selected().tileset]; selected().w = 3 * (t ? t.tw : 8); selected().h = 3 * (t ? t.th : 8); }
    if (drag.then) tool = drag.then;
    if (snapshot() !== drag.before) { history.record(drag.before); markDirty(); }
    drag = null; render();
  });
  root.addEventListener("keydown", (ev) => {
    if (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT") return;
    const key = ev.key.toLowerCase();
    if ((ev.metaKey || ev.ctrlKey) && key === "z") { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      if (selected() && tool === "select") deleteSelected();
      else if (tool === "paths" && room.paths[pathName] && pointIx >= 0) commit(() => { room.paths[pathName].points.splice(pointIx, 1); pointIx = -1; });
      ev.preventDefault(); return;
    }
    // arrow keys nudge what is selected by a pixel (or the grid with shift)
    const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
    if (arrows && selected() && tool === "select") {
      ev.preventDefault();
      const step = ev.shiftKey ? grid() : 1, [x, y] = posOf(sel.kind, selected());
      commit(() => setPos(sel.kind, selected(), x + arrows[0] * step, y + arrows[1] * step));
      return;
    }
    if (ev.key === "Escape") { tool = "select"; render(); return; }
    const t = TOOLS.find((x) => x[3] === key);
    if (t && !ev.metaKey && !ev.ctrlKey) { tool = t[0]; render(); }
  });
  root.tabIndex = 0;

  function status(text) { $(".re-status").textContent = text; }
  function deleteSelected() { commit(() => { room[sel.kind].splice(sel.i, 1); sel = null; }); }

  // ---------- buttons and fields ----------
  for (const [id, label, tip, key] of TOOLS) {
    const b = document.createElement("button"); b.dataset.tool = id; b.title = tip;
    const k = document.createElement("kbd"); k.textContent = key.toUpperCase();
    b.append(label, k);
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
  root.querySelectorAll(".re-lefttabs button").forEach((b) => { b.onclick = () => { side = b.dataset.side; renderSide(); }; });
  $(".re-one").onchange = () => { bigSize = false; const scr = hooks.getScreen ? hooks.getScreen() : { width: 320, height: 240 }; $(".re-w").value = scr.width; $(".re-h").value = scr.height; resize(); };
  $(".re-big").onchange = () => { bigSize = true; const scr = hooks.getScreen ? hooks.getScreen() : { width: 320, height: 240 }; if (room.width === scr.width && room.height === scr.height) { $(".re-w").value = scr.width * 2; $(".re-h").value = scr.height; resize(); } else renderSide(); };
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
  $(".re-search").oninput = () => renderSide();
  $(".re-search").onkeydown = (e) => { if (e.key === "Escape") { $(".re-search").value = ""; renderSide(); } };
  $(".re-font").onchange = () => { const t = selected(); if (!t || sel.kind !== "texts") return; commit(() => { if ($(".re-font").value) t.font = $(".re-font").value; else delete t.font; }); loadAssets(); };
  $(".re-panel-ts").onchange = async () => { panelTs = $(".re-panel-ts").value; panelTile = 0; await loadAssets(); drawBlockPicker(); };
  $(".re-screen").onchange = () => commit(() => { if ($(".re-screen").checked) selected().screen = true; else delete selected().screen; });

  return {
    // kind: "layout" (a scene's) or "room"
    async load(n, def, k = "room") {
      const scr = hooks.getScreen ? hooks.getScreen() : { width: 320, height: 240 };
      name = n; kind = k; room = R.normalizeRoom(def && def.width == null ? { ...def, width: scr.width, height: scr.height } : def); bigSize = false; dirty = false; history.undoStack = []; history.redoStack = []; renames = [];
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
