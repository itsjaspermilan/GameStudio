// Pixel-art sprite editor UI. Pure editing logic is in sprite-core.js.
import { color as themeColor, ink, tint } from "./theme.js";
import * as C from "./sprite-core.js";
import * as P from "./palette-core.js";

const PALETTE = ["#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
  "#ff004d", "#ffa300", "#ffec27", "#00e436", "#29adff", "#83769c", "#ff77a8", "#ffccaa"];
// [id, tooltip, the word on the button]: words, not letters, so the tools read without hovering; the letter is the key
const TOOLS = [
  ["pencil", "Pencil: draw single pixels (B)", "Pencil"], ["eraser", "Eraser: make pixels see-through (E)", "Eraser"], ["fill", "Fill an area of one colour (G)", "Fill"],
  ["line", "Line (L)", "Line"], ["rect", "Rectangle (R, Shift = filled)", "Box"], ["picker", "Pick a colour from the picture (I)", "Pick"],
  ["origin", "Set origin: the point that sits on the entity's position, usually between the feet (O)", "Origin"], ["mask", "Collision box: the part that touches things (M)", "Hitbox"],
];
const KEY_TOOL = { b: "pencil", e: "eraser", g: "fill", l: "line", r: "rect", i: "picker", o: "origin", m: "mask" };

export function createSpriteEditor(root, hooks = {}) {
  root.innerHTML = `
    <div class="se-left">
      <div class="se-toolbtns"></div>
      <div class="se-banks"></div>
      <div class="se-palette"></div>
      <label class="se-color">Color <input type="color" class="se-colorinput" value="#ff004d"></label>
      <div class="se-row"><button data-act="undo">Undo</button><button data-act="redo">Redo</button></div>
      <div class="se-row"><button data-act="zoomout">&minus;</button><button data-act="fit">Fit</button><button data-act="zoomin">+</button></div>
    </div>
    <div class="se-center">
      <div class="se-banner" hidden></div>
      <div class="se-canvaswrap"><canvas class="se-canvas"></canvas></div>
      <div class="se-status"></div>
    </div>
    <div class="se-right">
      <div class="se-tileset-only">
        <h3>Tile size</h3>
        <div class="se-row se-fields">
          <label>W <input type="number" class="p-tw" min="1" max="256"></label>
          <label>H <input type="number" class="p-th" min="1" max="256"></label>
        </div>
        <h3>Sheet (tiles across &times; down)</h3>
        <div class="se-row se-fields">
          <label>Cols <input type="number" class="p-cols" min="1" max="256"></label>
          <label>Rows <input type="number" class="p-rows" min="1" max="256"></label>
          <button data-act="resizesheet">Apply</button>
        </div>
        <p class="se-hint">Tiles are numbered left to right, top to bottom. Changing the tile size or counts keeps your pixels where they are.</p>
        <h3>Import</h3>
        <div class="se-row"><button data-act="import">Import PNG&hellip;</button></div>
        <p class="se-hint">Replaces the sheet with a PNG tile sheet (up to 1024&times;1024). Set the tile size first, then import.</p>
        <input type="file" class="se-file" accept="image/png" hidden>
      </div>
      <div class="se-sprite-only">
      <div class="se-use se-sprite-only"><button data-act="makeentity" class="primary" title="Make an entity (entities/<name>.lua) that looks like this sprite, ready to place in a layout or spawn from code">Make an entity with it</button></div>
      <h3>Frames</h3>
      <div class="se-frames"></div>
      <div class="se-row">
        <button data-act="addframe" title="New blank frame">+ New</button>
        <button data-act="dupframe" title="Duplicate frame">Copy</button>
        <button data-act="delframe" title="Delete frame">Delete</button>
      </div>
      <div class="se-row">
        <button data-act="frameleft" title="Move frame left">&larr;</button>
        <button data-act="frameright" title="Move frame right">&rarr;</button>
      </div>
      <h3>Preview</h3>
      <canvas class="se-preview"></canvas>
      <h3>On the screen</h3>
      <canvas class="se-screen" title="The whole console screen, with your sprite at its real size next to squares of 16, 32, 48 and 64 pixels"></canvas>
      <p class="se-hint se-screen-hint"></p>
      <label class="se-field">Speed (frames/sec) <input type="number" class="p-fps" min="0" max="60" step="1"></label>
      <h3>Animations</h3>
      <div class="se-anims"></div>
      <div class="se-row"><button data-act="addanim" title="Name a run of frames, like walk or jump, so an entity can play it">+ New animation</button></div>
      <p class="se-hint">An entity plays one with <code>self:play("walk")</code>. Without any, the whole sprite just loops.</p>
      <h3>Size</h3>
      <div class="se-row se-fields">
        <label>W <input type="number" class="p-w" min="1" max="256"></label>
        <label>H <input type="number" class="p-h" min="1" max="256"></label>
        <button data-act="resize">Resize</button>
      </div>
      <h3>Origin</h3>
      <div class="se-row se-fields">
        <label>X <input type="number" class="p-ox"></label>
        <label>Y <input type="number" class="p-oy"></label>
      </div>
      <h3>Collision box</h3>
      <label class="se-field"><input type="checkbox" class="p-mask-on"> Custom box (otherwise the whole sprite)</label>
      <div class="se-row se-fields">
        <label>X <input type="number" class="p-mx"></label><label>Y <input type="number" class="p-my"></label>
        <label>W <input type="number" class="p-mw"></label><label>H <input type="number" class="p-mh"></label>
      </div>
      </div>
    </div>`;
  root.classList.toggle("se-tileset", hooks.mode === "tileset");
  const isTS = () => hooks.mode === "tileset";

  const $ = (sel) => root.querySelector(sel);
  const canvas = $(".se-canvas"), ctx = canvas.getContext("2d");
  const off = document.createElement("canvas"), offCtx = off.getContext("2d");
  const colorInput = $(".se-colorinput");

  let s = null, f = 0, tool = "pencil", zoom = 8, userZoom = false, dirty = false;
  let history = new C.History();
  let drag = null; // {kind, last:[x,y], start:[x,y], cur:[x,y], filled}
  let cursor = null;
  let previewRaf = 0, previewT = 0, previewLast = 0;

  const color = () => C.hexToRgba(colorInput.value);

  // ---------- tools and palette ----------
  const toolBox = $(".se-toolbtns");
  for (const [id, title, label] of TOOLS.filter(([id]) => !(isTS() && (id === "origin" || id === "mask")))) {
    const b = document.createElement("button");
    b.textContent = label; b.title = title; b.dataset.tool = id;
    b.onclick = () => setTool(id);
    toolBox.appendChild(b);
  }
  function setTool(id) {
    tool = id;
    toolBox.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tool === id));
    renderCanvas();
  }
  // ---------- palette: the console decides which colours exist ----------
  // fixed: only the console's colours (the free colour picker is hidden); limited: any colours, but at most N distinct;
  // free: anything; banks: the game's colour banks (palette.json). A sprite draws with its one sprite bank; a tileset with the tile banks
  // it lists, each tile keeping to one of them.
  const pal = $(".se-palette"), bankBox = $(".se-banks");
  const palInfo = () => (hooks.getPalette ? hooks.getPalette() : { mode: "free" });
  const banksMode = () => palInfo().mode === "banks";
  const bankList = () => { const p = palInfo(); return (isTS() ? p.tiles : p.sprites) || []; };
  // the banks this picture draws with now (those that still exist)
  const myBanks = () => {
    if (!s || !banksMode()) return [];
    const list = bankList(), names = isTS() ? s.banks || [] : s.bank ? [s.bank] : [];
    return names.map((n) => list.find((b) => b.name === n)).filter(Boolean);
  };
  const fixedRgb = () => {
    const p = palInfo();
    if (p.mode === "fixed") return p.colors.map((h) => C.hexToRgba(h).slice(0, 3));
    if (p.mode === "banks" && !isTS()) { const b = myBanks()[0]; return b ? P.bankRgb(b) : null; }
    return null;
  };
  const colorLimit = () => { const p = palInfo(); return p.mode === "limited" ? p.size : 0; };
  let note = ""; // a message shown in the banner until the next action
  function markSelected() {
    const cur = colorInput.value.toLowerCase();
    pal.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("sel", b.title.toLowerCase() === cur));
  }
  function swatch(hex, title) {
    const b = document.createElement("button");
    b.className = "swatch"; b.style.background = hex; b.title = title || hex;
    b.onclick = () => { colorInput.value = hex; if (tool === "eraser") setTool("pencil"); markSelected(); };
    return b;
  }
  // Place 0 of a bank is see-through: its swatch picks the eraser.
  function clearSwatch() {
    const b = document.createElement("button");
    b.className = "swatch see-through"; b.title = "Place 0: see-through (the eraser)";
    b.onclick = () => setTool("eraser");
    return b;
  }
  function buildPalette() {
    const info = palInfo(), fixed = info.mode === "fixed";
    pal.replaceChildren(); bankBox.replaceChildren();
    $(".se-color").hidden = fixed || info.mode === "banks";
    if (info.mode === "banks") return buildBanks();
    for (const hex of fixed ? info.colors : PALETTE) {
      const b = document.createElement("button");
      b.className = "swatch"; b.style.background = hex; b.title = hex;
      b.onclick = () => { colorInput.value = hex; if (tool === "eraser") setTool("pencil"); markSelected(); };
      pal.appendChild(b);
    }
    if (fixed && !info.colors.includes(colorInput.value.toLowerCase())) colorInput.value = info.colors[Math.min(1, info.colors.length - 1)];
    markSelected();
  }
  // The bank chooser and the bank's 16 places (4 x 4, like the GBA's palette RAM). A tileset can tick several banks.
  function buildBanks() {
    const list = bankList();
    if (!s) return;
    if (!list.length) {
      bankBox.innerHTML = `<p class="se-hint">This game has no ${isTS() ? "tile" : "sprite"} banks yet. Open <b>Colours</b> in the side bar to add some.</p>`;
      return;
    }
    if (isTS()) {
      const h = document.createElement("div"); h.className = "se-bank-head"; h.textContent = "Tile banks";
      h.title = "The colour banks this tileset uses. Each tile keeps to one of them, like on a GBA.";
      const box = document.createElement("div"); box.className = "se-bank-ticks";
      for (const b of list) {
        const l = document.createElement("label"), c = document.createElement("input");
        c.type = "checkbox"; c.checked = (s.banks || []).includes(b.name);
        c.onchange = () => commit(() => { const now = new Set(s.banks || []); c.checked ? now.add(b.name) : now.delete(b.name); s.banks = list.map((x) => x.name).filter((n) => now.has(n)); buildPalette(); });
        l.append(c, " " + b.name); box.appendChild(l);
      }
      bankBox.append(h, box);
    } else {
      const l = document.createElement("label"); l.className = "se-field se-bank-pick";
      l.title = "The colour bank this sprite draws with: 15 colours and see-through. Picking another moves every pixel to the same place in the new bank.";
      const sel = document.createElement("select");
      if (!s.bank || !list.some((b) => b.name === s.bank)) sel.add(new Option(s.bank ? `${s.bank} (missing)` : "Choose a bank", s.bank || ""));
      for (const b of list) sel.add(new Option(b.name, b.name));
      sel.value = s.bank || "";
      sel.onchange = () => setBank(sel.value);
      l.append("Bank ", sel); bankBox.appendChild(l);
    }
    const mine = myBanks();
    for (const b of mine) {
      if (isTS()) { const cap = document.createElement("div"); cap.className = "se-bank-cap"; cap.textContent = b.name; pal.appendChild(cap); }
      pal.appendChild(clearSwatch());
      b.colors.forEach((hex, i) => pal.appendChild(swatch(hex, `Place ${i + 1}: ${hex}  (in code: "${b.name}:${i + 1}")`)));
    }
    const all = mine.flatMap((b) => b.colors);
    if (all.length && !all.includes(colorInput.value.toLowerCase())) colorInput.value = all[Math.min(1, all.length - 1)];
    markSelected();
  }
  // A sprite moved to another bank keeps its shading: each pixel takes the colour in the same place of the new bank.
  function setBank(name) {
    const from = myBanks()[0], to = bankList().find((b) => b.name === name);
    commit(() => {
      s.bank = name || undefined;
      if (from && to) {
        const n = s.frames.reduce((k, fr) => k + P.recolorByPlace(fr, from, to), 0);
        if (n) note = `Moved to bank ${name}: each pixel took the colour in the same place.`;
      }
    });
    buildPalette(); updateBanner();
  }
  colorInput.addEventListener("input", markSelected);

  function updateBanner() {
    const box = $(".se-banner"); box.replaceChildren();
    if (!s) { box.hidden = true; return; }
    const rgb = fixedRgb(), lim = colorLimit();
    let text = note;
    if (banksMode()) {
      const add = (t) => { text += `${text ? "  " : ""}${t}`; };
      if (isTS()) {
        const mine = myBanks();
        if (!mine.length) add("Tick the tile banks this tileset uses.");
        else {
          const bad = P.tilesOutsideBanks(s, mine);
          if (bad.length) {
            add(`${bad.length === 1 ? "Tile" : "Tiles"} ${bad.slice(0, 8).join(", ")}${bad.length > 8 ? "…" : ""} ${bad.length === 1 ? "uses" : "use"} colours from more than one bank (or from none). Each tile keeps to one bank.`);
            const b = document.createElement("button"); b.textContent = "Snap tiles to banks";
            b.title = "Each tile goes to the bank closest to its colours";
            b.onclick = () => commit(() => P.snapTilesToBanks(s, mine));
            box.append(document.createTextNode(text), b); box.hidden = false; return;
          }
        }
      } else if (!rgb) add(s.bank ? `Bank ${s.bank} is not in the game's colours any more: choose a bank.` : "Choose a colour bank for this sprite.");
    }
    const frameBudget = !isTS() && hooks.getBudgets ? (hooks.getBudgets() || {}).frames_per_sprite : 0;
    if (frameBudget && s.frames.length > frameBudget) text += `${text ? "  " : ""}This sprite has ${s.frames.length} frames; the console's budget is ${frameBudget}.`;
    if (rgb) {
      const off = C.offPaletteCount(s, rgb);
      if (off > 0) {
        text += `${text ? "  " : ""}${off} pixel${off === 1 ? "" : "s"} use colours outside ${banksMode() ? `bank ${s.bank}` : "this console's palette"}.`;
        const b = document.createElement("button"); b.textContent = banksMode() ? "Snap to bank" : "Snap to palette";
        b.onclick = () => commit(() => C.snapToPalette(s, rgb));
        box.append(document.createTextNode(text), b); box.hidden = false; return;
      }
    } else if (lim) {
      text += `${text ? "  " : ""}Colours used: ${C.usedColors(s).size} of ${lim}.`;
    }
    box.textContent = text; box.hidden = !text;
  }
  // Drawing with a colour that would go over a limited palette is refused, with a message.
  function allowColor() {
    const lim = colorLimit();
    if (!lim || C.colorAllowed(s, color(), lim)) return true;
    note = `This console allows ${lim} colours: use one you have already used, or free one up first.`;
    updateBanner();
    return false;
  }

  // ---------- state helpers ----------
  function markDirty() { dirty = true; hooks.onChange && hooks.onChange(); }
  function commit(mutator) {
    history.record(C.snapshot(s));
    mutator();
    f = Math.min(f, s.frames.length - 1);
    if (s.animations) s.animations = C.normalizeAnimations(s.animations, s.frames.length, s.fps); // frames may have been deleted
    markDirty();
    renderAll();
  }
  function fitZoom() {
    const wrap = $(".se-canvaswrap");
    const aw = Math.max(64, wrap.clientWidth - 24), ah = Math.max(64, wrap.clientHeight - 24);
    zoom = Math.max(2, Math.min(32, Math.floor(Math.min(aw / s.w, ah / s.h))));
  }

  // ---------- rendering ----------
  function renderCanvas() {
    if (!s) return;
    const z = zoom;
    canvas.width = s.w * z; canvas.height = s.h * z;
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        ctx.fillStyle = (x + y) % 2 ? themeColor("checker-a") : themeColor("checker-b");
        ctx.fillRect(x * z, y * z, z, z);
      }
    off.width = s.w; off.height = s.h;
    offCtx.putImageData(new ImageData(s.frames[f], s.w, s.h), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, s.w * z, s.h * z);

    if (z >= 8) {
      ctx.strokeStyle = ink(0.1); ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 1; x < s.w; x++) { ctx.moveTo(x * z + 0.5, 0); ctx.lineTo(x * z + 0.5, s.h * z); }
      for (let y = 1; y < s.h; y++) { ctx.moveTo(0, y * z + 0.5); ctx.lineTo(s.w * z, y * z + 0.5); }
      ctx.stroke();
    }
    if (isTS() && s.tile) { // tile boundaries
      ctx.strokeStyle = tint("accent", 0.7); ctx.lineWidth = 1; ctx.beginPath();
      for (let x = s.tile[0]; x < s.w; x += s.tile[0]) { ctx.moveTo(x * z + 0.5, 0); ctx.lineTo(x * z + 0.5, s.h * z); }
      for (let y = s.tile[1]; y < s.h; y += s.tile[1]) { ctx.moveTo(0, y * z + 0.5); ctx.lineTo(s.w * z, y * z + 0.5); }
      ctx.stroke();
    }
    // shape preview while dragging
    if (drag && (drag.kind === "line" || drag.kind === "rect")) {
      ctx.fillStyle = colorInput.value; ctx.globalAlpha = 0.7;
      const plot = (x, y) => { if (C.inBounds(s, x, y)) ctx.fillRect(x * z, y * z, z, z); };
      if (drag.kind === "line") C.line(drag.start[0], drag.start[1], drag.cur[0], drag.cur[1], plot);
      else C.rect(drag.start[0], drag.start[1], drag.cur[0], drag.cur[1], drag.filled, plot);
      ctx.globalAlpha = 1;
    }
    // collision box
    const m = isTS() ? null : (drag && drag.kind === "mask") ? C.clampMask(s, maskFromDrag()) : s.mask;
    if (m) {
      ctx.strokeStyle = "#00e436"; ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
      ctx.strokeRect(m[0] * z + 1, m[1] * z + 1, m[2] * z - 2, m[3] * z - 2); ctx.setLineDash([]);
    }
    if (!isTS()) { // origin
      const ox = s.origin[0] * z, oy = s.origin[1] * z;
      ctx.strokeStyle = "#ff004d"; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(ox - 6, oy + z / 2); ctx.lineTo(ox + z + 6, oy + z / 2);
      ctx.moveTo(ox + z / 2, oy - 6); ctx.lineTo(ox + z / 2, oy + z + 6); ctx.stroke();
    }
    // hover cell
    if (cursor && C.inBounds(s, cursor[0], cursor[1])) {
      ctx.strokeStyle = ink(0.6); ctx.lineWidth = 1;
      ctx.strokeRect(cursor[0] * z + 0.5, cursor[1] * z + 0.5, z - 1, z - 1);
    }
    renderStatus();
  }

  function renderStatus() {
    const pos = cursor && C.inBounds(s, cursor[0], cursor[1]) ? `${cursor[0]}, ${cursor[1]}` : "-";
    if (isTS()) {
      const ti = cursor ? C.tileIndexAt(s, cursor[0], cursor[1]) : -1;
      $(".se-status").textContent = `${s.name}  |  ${s.w}\u00D7${s.h}px  |  ${C.tilesetCols(s)}\u00D7${C.tilesetRows(s)} tiles of ${s.tile[0]}\u00D7${s.tile[1]}  |  zoom ${zoom}x  |  pixel ${pos}  |  tile ${ti >= 0 ? ti : "-"}`;
      return;
    }
    $(".se-status").textContent =
      `${s.name}  |  ${s.w}×${s.h}  |  frame ${f + 1}/${s.frames.length}  |  zoom ${zoom}x  |  pixel ${pos}`;
  }

  function thumb(frame, w, h, cls) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h; if (cls) c.className = cls;
    c.getContext("2d").putImageData(new ImageData(frame, w, h), 0, 0);
    return c;
  }
  function renderFrames() {
    const box = $(".se-frames"); box.replaceChildren();
    s.frames.forEach((fr, i) => {
      const cell = document.createElement("div");
      cell.className = "se-frame" + (i === f ? " active" : "");
      cell.appendChild(thumb(fr, s.w, s.h, "se-thumb"));
      const n = document.createElement("span"); n.textContent = i + 1; cell.appendChild(n);
      cell.onclick = () => { f = i; renderAll(); };
      box.appendChild(cell);
    });
  }
  function syncProps() {
    if (isTS()) {
      $(".p-tw").value = s.tile[0]; $(".p-th").value = s.tile[1];
      $(".p-cols").value = C.tilesetCols(s); $(".p-rows").value = C.tilesetRows(s);
      return;
    }
    $(".p-fps").value = s.fps; $(".p-w").value = s.w; $(".p-h").value = s.h;
    $(".p-ox").value = s.origin[0]; $(".p-oy").value = s.origin[1];
    const m = s.mask || [0, 0, s.w, s.h];
    $(".p-mask-on").checked = !!s.mask;
    ["mx", "my", "mw", "mh"].forEach((k, i) => { const el = $(".p-" + k); el.value = m[i]; el.disabled = !s.mask; });
  }
  // One row per named animation: name, first and last frame (counted from 1), speed, loop, play (shows it in the preview) and delete.
  let playing = null; // the animation name the preview is showing, or null for the whole sprite
  function renderAnims() {
    const box = $(".se-anims"); if (!box) return;
    box.replaceChildren();
    const anims = s.animations || {};
    if (playing && !anims[playing]) playing = null;
    for (const [name, a] of Object.entries(anims)) {
      const row = document.createElement("div"); row.className = "se-anim" + (playing === name ? " playing" : "");
      const field = (cls, value, title, max) => {
        const el = document.createElement("input"); el.type = "number"; el.className = cls; el.value = value; el.title = title; el.min = 0; if (max) el.max = max; return el;
      };
      const nm = document.createElement("input"); nm.className = "se-anim-name"; nm.value = name; nm.spellcheck = false; nm.title = "Animation name";
      nm.onchange = () => { if (nm.value !== name && !commitIf(() => C.renameAnimation(s, name, nm.value.trim()))) nm.value = name; };
      const from = field("se-anim-from", a.from + 1, "First frame", s.frames.length), to = field("se-anim-to", a.to + 1, "Last frame", s.frames.length);
      const fps = field("se-anim-fps", a.fps, "Frames per second", 60);
      const edit = () => commit(() => { Object.assign(s.animations, C.normalizeAnimations({ ...s.animations, [name]: { ...a, from: from.value - 1, to: to.value - 1, fps: Number(fps.value) } }, s.frames.length)); });
      from.onchange = to.onchange = fps.onchange = edit;
      const loop = document.createElement("input"); loop.type = "checkbox"; loop.checked = a.loop; loop.title = "Start over when it reaches the end";
      loop.onchange = () => commit(() => { a.loop = loop.checked; });
      const play = document.createElement("button"); play.className = "small"; play.textContent = playing === name ? "\u25A0" : "\u25B6"; play.title = "Show it in the preview";
      play.onclick = () => { playing = playing === name ? null : name; previewT = 0; renderAnims(); };
      const del = document.createElement("button"); del.className = "small"; del.textContent = "\u00D7"; del.title = "Delete this animation";
      del.onclick = () => commit(() => C.removeAnimation(s, name));
      const lab = (text, el) => { const l = document.createElement("label"); l.append(text, el); return l; };
      row.append(nm, lab("from", from), lab("to", to), lab("fps", fps), lab("loop", loop), play, del);
      box.appendChild(row);
    }
  }
  // Run a change that may be refused (a bad or taken name); only a change that happened goes on the undo list.
  function commitIf(mutator) {
    const snap = C.snapshot(s);
    if (!mutator()) return false;
    history.record(snap); markDirty(); renderAll();
    return true;
  }
  function renderAll() { renderCanvas(); renderFrames(); syncProps(); renderAnims(); drawPreviewFrame(); updateBanner(); }

  // ---------- preview animation ----------
  const pv = $(".se-preview"), pvCtx = pv.getContext("2d");
  function drawPreviewFrame() {
    if (!s) return;
    pv.width = s.w; pv.height = s.h;
    const clip = playing && s.animations && s.animations[playing];
    const idx = clip ? C.animationFrame(clip, previewT) : s.fps > 0 ? Math.floor(previewT * s.fps) % s.frames.length : f;
    pvCtx.clearRect(0, 0, s.w, s.h);
    pvCtx.putImageData(new ImageData(s.frames[idx], s.w, s.h), 0, 0);
    drawScreen(idx);
  }
  // The sprite at its real size on the console's screen, standing on a line next to reference squares, to judge size by eye.
  const scr = $(".se-screen"), scrCtx = scr.getContext("2d"), one = document.createElement("canvas");
  let screenHint = "";
  function drawScreen(idx) {
    if (isTS()) return;
    const size = hooks.getScreen ? hooks.getScreen() : { width: 256, height: 192 };
    if (scr.width !== size.width || scr.height !== size.height) { scr.width = size.width; scr.height = size.height; }
    scrCtx.fillStyle = "#14141e"; scrCtx.fillRect(0, 0, scr.width, scr.height);
    const ground = scr.height - 24;
    scrCtx.fillStyle = "#343846"; scrCtx.fillRect(0, ground, scr.width, 1);
    scrCtx.strokeStyle = "#5a5f73"; scrCtx.lineWidth = 1;
    let x = 12;
    for (const n of C.REFERENCE_SIZES) { scrCtx.strokeRect(x + 0.5, ground - n + 0.5, n - 1, n - 1); x += n + 10; }
    if (one.width !== s.w || one.height !== s.h) { one.width = s.w; one.height = s.h; }
    one.getContext("2d").putImageData(new ImageData(s.frames[idx], s.w, s.h), 0, 0);
    scrCtx.drawImage(one, Math.max(x + 14, Math.floor((scr.width - s.w) / 2)), ground - s.h);
    const hint = `${s.w}×${s.h}: ${Math.round((s.h / size.height) * 100)}% of the screen's height. The squares are ${C.REFERENCE_SIZES.slice(0, -1).join(", ")} and ${C.REFERENCE_SIZES.at(-1)}.`;
    if (hint !== screenHint) { screenHint = hint; $(".se-screen-hint").textContent = hint; }
  }
  function previewLoop(now) {
    if (!previewLast) previewLast = now;
    previewT += (now - previewLast) / 1000; previewLast = now;
    if (root.offsetParent !== null) drawPreviewFrame();
    previewRaf = requestAnimationFrame(previewLoop);
  }

  // ---------- pointer input ----------
  function pixelAt(e) {
    const r = canvas.getBoundingClientRect();
    return [Math.floor((e.clientX - r.left) / zoom), Math.floor((e.clientY - r.top) / zoom)];
  }
  function maskFromDrag() {
    const [x0, y0] = drag.start, [x1, y1] = drag.cur;
    return [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1];
  }
  function paint(x, y) {
    if (tool !== "eraser" && !allowColor()) return;
    C.setPixel(s, f, x, y, tool === "eraser" ? [0, 0, 0, 0] : color());
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!s || e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    if (note) { note = ""; updateBanner(); }
    const p = pixelAt(e);
    if (tool === "pencil" || tool === "eraser") {
      history.record(C.snapshot(s)); markDirty();
      drag = { kind: "paint", last: p };
      paint(p[0], p[1]);
    } else if (tool === "fill") {
      if (C.inBounds(s, p[0], p[1]) && allowColor()) commit(() => C.floodFill(s, f, p[0], p[1], color()));
    } else if (tool === "picker") {
      if (C.inBounds(s, p[0], p[1])) {
        const px = C.getPixel(s, f, p[0], p[1]);
        if (px[3] > 0) { colorInput.value = C.rgbaToHex(px); markSelected(); }
      }
    } else if (tool === "origin") {
      if (C.inBounds(s, p[0], p[1])) commit(() => { s.origin = [p[0], p[1]]; });
    } else if (tool === "line" || tool === "rect") {
      drag = { kind: tool, start: p, cur: p, filled: e.shiftKey };
    } else if (tool === "mask") {
      drag = { kind: "mask", start: p, cur: p };
    }
    renderCanvas();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!s) return;
    const p = pixelAt(e);
    cursor = p;
    if (drag) {
      if (drag.kind === "paint") {
        C.line(drag.last[0], drag.last[1], p[0], p[1], paint);
        drag.last = p;
        renderFrames();
      } else {
        drag.cur = p; drag.filled = e.shiftKey;
      }
    }
    renderCanvas();
  });

  function endDrag(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === "paint") {
      renderAll();
    } else if (d.kind === "line" || d.kind === "rect") {
      if (!allowColor()) { renderAll(); return; }
      commit(() => {
        const plot = (x, y) => C.setPixel(s, f, x, y, color());
        if (d.kind === "line") C.line(d.start[0], d.start[1], d.cur[0], d.cur[1], plot);
        else C.rect(d.start[0], d.start[1], d.cur[0], d.cur[1], d.filled, plot);
      });
    } else if (d.kind === "mask") {
      d.cur = pixelAt(e);
      drag = d; const m = C.clampMask(s, maskFromDrag()); drag = null;
      commit(() => { s.mask = m; });
    }
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", () => { drag = null; renderCanvas(); });
  canvas.addEventListener("pointerleave", () => { cursor = null; renderCanvas(); });

  // ---------- buttons and property fields ----------
  function undo() {
    const snap = history.undo(C.snapshot(s));
    if (snap) { C.restore(s, snap); f = Math.min(f, s.frames.length - 1); note = ""; markDirty(); fitIfNeeded(); buildPalette(); renderAll(); }
  }
  function redo() {
    const snap = history.redo(C.snapshot(s));
    if (snap) { C.restore(s, snap); f = Math.min(f, s.frames.length - 1); note = ""; markDirty(); fitIfNeeded(); buildPalette(); renderAll(); }
  }
  function fitIfNeeded() { if (!userZoom) fitZoom(); }

  const actions = {
    undo, redo,
    zoomin: () => { userZoom = true; zoom = Math.min(32, zoom + 1); renderCanvas(); },
    zoomout: () => { userZoom = true; zoom = Math.max(1, zoom - 1); renderCanvas(); },
    fit: () => { userZoom = false; fitZoom(); renderCanvas(); },
    addframe: () => commit(() => { C.addFrame(s, f + 1); f = f + 1; }),
    makeentity: () => hooks.makeEntity && hooks.makeEntity(),
    addanim: () => commit(() => { let n = 1; while ((s.animations || {})["anim" + n]) n++; C.addAnimation(s, "anim" + n); }),
    dupframe: () => commit(() => { if (C.duplicateFrame(s, f)) f = f + 1; }),
    delframe: () => commit(() => { C.deleteFrame(s, f); }),
    frameleft: () => commit(() => { if (C.moveFrame(s, f, f - 1)) f = f - 1; }),
    frameright: () => commit(() => { if (C.moveFrame(s, f, f + 1)) f = f + 1; }),
    resizesheet: () => {
      const tw = +$(".p-tw").value, th = +$(".p-th").value, cols = +$(".p-cols").value, rows = +$(".p-rows").value;
      commit(() => C.resizeSheet(s, tw, th, cols, rows));
      fitIfNeeded(); renderCanvas();
    },
    import: () => $(".se-file").click(),
    resize: () => {
      const nw = +$(".p-w").value, nh = +$(".p-h").value;
      if (nw === s.w && nh === s.h) return;
      commit(() => C.resize(s, nw, nh));
      fitIfNeeded(); renderCanvas();
    },
  };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (b && actions[b.dataset.act]) actions[b.dataset.act]();
  });

  $(".se-file").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file || !s) return;
    try {
      const bmp = await createImageBitmap(file);
      if (bmp.width > C.MAX_SHEET || bmp.height > C.MAX_SHEET) throw new Error(`Image is ${bmp.width}\u00D7${bmp.height}; the limit is ${C.MAX_SHEET}\u00D7${C.MAX_SHEET}.`);
      const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
      const cx = c.getContext("2d", { willReadFrequently: true }); cx.drawImage(bmp, 0, 0);
      const img = cx.getImageData(0, 0, bmp.width, bmp.height);
      const rgb = fixedRgb(); // a console with a fixed palette: imported pixels are moved onto it
      let snapped = rgb ? C.snapPixels(img.data, rgb) : 0;
      commit(() => { C.importSheet(s, img.width, img.height, img.data); if (banksMode() && myBanks().length) snapped = P.snapTilesToBanks(s, myBanks()); });
      if (snapped) { note = `Imported, and moved ${snapped} pixel${snapped === 1 ? "" : "s"} onto ${banksMode() ? "the tileset's banks" : "the console's palette"}.`; updateBanner(); }
      fitIfNeeded(); renderCanvas();
    } catch (err) { hooks.onError ? hooks.onError(err) : alert(err.message); }
  });

  const num = (sel) => { const v = parseInt($(sel).value, 10); return Number.isFinite(v) ? v : 0; };
  $(".p-fps").addEventListener("change", () => commit(() => { s.fps = Math.max(0, Math.min(60, num(".p-fps"))); }));
  const setOrigin = () => commit(() => {
    s.origin = [Math.max(0, Math.min(s.w - 1, num(".p-ox"))), Math.max(0, Math.min(s.h - 1, num(".p-oy")))];
  });
  $(".p-ox").addEventListener("change", setOrigin);
  $(".p-oy").addEventListener("change", setOrigin);
  $(".p-mask-on").addEventListener("change", (e) => commit(() => { s.mask = e.target.checked ? [0, 0, s.w, s.h] : null; }));
  for (const k of ["mx", "my", "mw", "mh"]) {
    $(".p-" + k).addEventListener("change", () =>
      commit(() => { s.mask = C.clampMask(s, [num(".p-mx"), num(".p-my"), num(".p-mw"), num(".p-mh")]); }));
  }

  // ---------- keyboard ----------
  document.addEventListener("keydown", (e) => {
    if (!s || root.offsetParent === null) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA") && t.type !== "color" && t.type !== "checkbox") return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && k === "y") { e.preventDefault(); redo(); return; }
    if (mod) return;
    if (KEY_TOOL[k] && !(isTS() && (k === "o" || k === "m"))) { setTool(KEY_TOOL[k]); return; }
    if (isTS()) return;
    if (k === ",") { f = Math.max(0, f - 1); renderAll(); }
    if (k === ".") { f = Math.min(s.frames.length - 1, f + 1); renderAll(); }
  });
  window.addEventListener("resize", () => { if (s && !userZoom && root.offsetParent !== null) { fitZoom(); renderCanvas(); } });

  setTool("pencil");
  previewRaf = requestAnimationFrame(previewLoop);

  return {
    load(sprite) {
      s = sprite; f = 0; history = new C.History(); dirty = false; drag = null; userZoom = false; note = "";
      buildPalette();
      requestAnimationFrame(() => { fitZoom(); renderAll(); }); // after layout, so the wrap has a size
      fitZoom(); renderAll();
    },
    refit() { if (s && !userZoom) { fitZoom(); renderCanvas(); } },
    redraw() { if (s) renderAll(); }, // the look changed
    refreshPalette() { if (s) { buildPalette(); updateBanner(); } }, // the game's colours changed
    getSprite: () => s,
    isDirty: () => dirty,
    markClean() { dirty = false; },
    destroy() { cancelAnimationFrame(previewRaf); },
  };
}
