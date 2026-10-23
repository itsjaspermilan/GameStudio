// The Colours editor: the game's colour banks (palette.json), GBA style. Logic is in palette-core.js.
// hooks: onChange(), getLimits() -> {sprites, tiles, places, bits} (from the console), getUsers(name) -> ["sprite hero", ...]
import * as P from "./palette-core.js";

const KINDS = [
  { key: "sprites", title: "Sprite banks", single: "sprite", tip: "A sprite draws with one of these: 15 colours and see-through. Give each kind of character its own bank, like on a GBA." },
  { key: "tiles", title: "Tile banks", single: "tile", tip: "Tilesets draw with these. Each tile keeps to one bank, but one tileset can use several (grass, water and stone in one sheet)." },
];

export function createPaletteEditor(root, hooks = {}) {
  root.innerHTML = `
    <div class="pe-scroll">
      <div class="pe-intro">
        <h2>Colours</h2>
        <p class="se-hint">Your game's colour banks. A bank has 16 places: place 0 is see-through and places 1 to 15 are colours, picked from
        the console's 32,768. A sprite uses one sprite bank; each tile of a tileset uses one of its tile banks. With 16 of each, the screen can
        show up to 512 colours at once. Code can use a bank colour as <code>"water:3"</code> (bank water, place 3).</p>
      </div>
      <div class="pe-classic" hidden>
        <p>This game uses the console's 32 classic colours. Colour banks give each sprite and tile its own 15 colours, with smooth shading ramps.</p>
        <p class="se-hint">Starting banks gives you ready-made ones (heroes, knights, fire, meadow, forest, water...) to change as you like. Afterwards,
        open each sprite and tileset and choose its bank; the art stays as it is until you do.</p>
        <button class="pe-start primary">Start colour banks</button>
      </div>
      <div class="pe-problems" hidden></div>
      <div class="pe-kinds"></div>
    </div>
    <input type="color" class="pe-picker" hidden>`;
  const $ = (sel) => root.querySelector(sel);
  const picker = $(".pe-picker");
  let pal = null, dirty = false, classic = false, editing = null; // editing: {bank, place} while the colour picker is open
  let origins = new Map(); // bank object -> the name it had when loaded (for renames)

  const limits = () => (hooks.getLimits ? hooks.getLimits() : P.bankLimits(null));
  function markDirty() { dirty = true; hooks.onChange && hooks.onChange(); }

  function render() {
    $(".pe-classic").hidden = !classic;
    $(".pe-kinds").hidden = classic;
    const probs = $(".pe-problems");
    const list = classic ? [] : P.checkPalette(pal, { palette: { sprite_banks: limits().sprites, tile_banks: limits().tiles, bank_colors: limits().places + 1, color_bits: limits().bits } });
    probs.hidden = !list.length;
    probs.replaceChildren(...list.map((t) => { const p = document.createElement("p"); p.textContent = t; return p; }));
    const box = $(".pe-kinds");
    box.replaceChildren();
    if (classic) return;
    const starters = P.starterPalette();
    for (const k of KINDS) {
      const sec = document.createElement("section"); sec.className = "pe-kind";
      const h = document.createElement("h3"); h.title = k.tip;
      h.textContent = `${k.title} `;
      const count = document.createElement("span"); count.className = "pe-count"; count.textContent = `${pal[k.key].length} of ${limits()[k.key]}`;
      h.appendChild(count);
      sec.appendChild(h);
      pal[k.key].forEach((b, i) => sec.appendChild(bankRow(k, b, i)));
      const row = document.createElement("div"); row.className = "se-row";
      const full = pal[k.key].length >= limits()[k.key];
      const add = document.createElement("button"); add.textContent = "+ New bank"; add.disabled = full;
      add.title = full ? `This console has room for ${limits()[k.key]} ${k.single} banks.` : "A bank of 15 greys to colour in (click a place, then Ramp makes shades of it)";
      add.onclick = () => { pal[k.key].push({ name: P.freeBankName(pal, k.single === "sprite" ? "sprite" : "tiles"), colors: [...P.ramp(220, 0.1), ...P.ramp(30, 0.12), ...P.ramp(0, 0)] }); markDirty(); render(); };
      const ready = document.createElement("select"); ready.disabled = full;
      ready.title = "Add one of the ready-made banks";
      ready.add(new Option("+ Ready-made bank…", ""));
      for (const s of starters[k.key]) ready.add(new Option(s.name, s.name));
      ready.onchange = () => {
        const s = starters[k.key].find((x) => x.name === ready.value);
        if (s) { pal[k.key].push({ name: P.freeBankName(pal, s.name), colors: [...s.colors] }); markDirty(); render(); }
      };
      row.append(add, ready);
      sec.appendChild(row);
      box.appendChild(sec);
    }
  }

  function bankRow(k, b, i) {
    const row = document.createElement("div"); row.className = "pe-bank";
    const name = document.createElement("input"); name.className = "pe-name"; name.value = b.name; name.spellcheck = false;
    name.title = "The bank's name: sprites and tilesets use it, and code writes its colours as \"name:place\". Renaming updates sprites and tilesets (not code).";
    name.onchange = () => {
      const v = name.value.trim();
      if (v === b.name) return;
      if (!P.BANK_NAME.test(v) || P.allBankNames(pal).includes(v)) { name.value = b.name; name.classList.add("bad"); setTimeout(() => name.classList.remove("bad"), 900); return; }
      b.name = v; markDirty(); render();
    };
    const places = document.createElement("div"); places.className = "pe-places";
    const clear = document.createElement("span"); clear.className = "swatch see-through"; clear.title = "Place 0: see-through";
    places.appendChild(clear);
    for (let p = 0; p < limits().places; p++) {
      const hex = b.colors[p], s = document.createElement("button");
      s.type = "button"; s.className = "swatch" + (hex ? "" : " pe-empty");
      if (hex) { s.style.background = hex; s.title = `Place ${p + 1}: ${hex}  ("${b.name}:${p + 1}"). Click to change.`; }
      else { s.textContent = "+"; s.title = `Place ${p + 1}: empty. Click to add a colour.`; s.disabled = p > b.colors.length; }
      if (editing && editing.bank === b && editing.place === p) s.classList.add("sel");
      s.onclick = () => {
        editing = { bank: b, place: p };
        picker.value = hex || b.colors[b.colors.length - 1] || "#808080";
        places.querySelectorAll(".swatch.sel").forEach((x) => x.classList.remove("sel")); s.classList.add("sel");
        picker.click();
      };
      places.appendChild(s);
    }
    const tools = document.createElement("div"); tools.className = "pe-tools";
    const btn = (text, title, fn) => { const x = document.createElement("button"); x.className = "small"; x.textContent = text; x.title = title; x.onclick = fn; tools.appendChild(x); return x; };
    btn("Ramp", "Make five shades, dark to light, from the place you clicked last, starting at the ramp it is in (places 1-5, 6-10 or 11-15)", () => {
      if (!editing || editing.bank !== b) return;
      const start = Math.floor(editing.place / 5) * 5, r = P.rampFrom(b.colors[editing.place] || "#808080");
      for (let j = 0; j < 5 && start + j < limits().places; j++) b.colors[start + j] = r[j];
      for (let j = 0; j < b.colors.length; j++) if (!b.colors[j]) b.colors[j] = "#000000"; // no holes
      markDirty(); render();
    });
    btn("Copy", "A copy of this bank, for a palette swap (the same sprite in other colours)", () => {
      const list = pal[k.key];
      if (list.length >= limits()[k.key]) return;
      list.splice(i + 1, 0, { name: P.freeBankName(pal, b.name), colors: [...b.colors] }); markDirty(); render();
    });
    btn("Delete", "Remove this bank (sprites and tilesets that use it will ask for another)", () => {
      const users = hooks.getUsers ? hooks.getUsers(b.name) : [];
      if (users.length && !confirm(`Bank ${b.name} is used by ${users.slice(0, 6).join(", ")}${users.length > 6 ? "…" : ""}. Remove it anyway?`)) return;
      pal[k.key].splice(i, 1); origins.delete(b); markDirty(); render();
    });
    row.append(name, places, tools);
    return row;
  }

  // The console can only show 15-bit colours, so a picked colour is rounded as it is chosen.
  picker.addEventListener("input", () => {
    if (!editing) return;
    const { bank, place } = editing, hex = P.quantize(picker.value, limits().bits);
    while (bank.colors.length < place) bank.colors.push(bank.colors[bank.colors.length - 1] || "#000000");
    bank.colors[place] = hex;
    markDirty(); render();
  });

  $(".pe-start").onclick = () => {
    pal = P.starterPalette(); classic = false; origins = new Map(); markDirty(); render();
  };

  return {
    // pal: palette.json's contents, or null for a game that still uses the classic colours
    load(raw) {
      classic = raw == null; pal = classic ? P.emptyPalette() : P.normalizePalette(raw);
      origins = new Map([...pal.sprites, ...pal.tiles].map((b) => [b, b.name]));
      editing = null; dirty = false; render();
    },
    getDef: () => (classic ? null : P.normalizePalette(pal)),
    // [old name, new name] for every bank renamed since loading, so sprites and tilesets can follow
    getRenames: () => [...pal.sprites, ...pal.tiles].filter((b) => origins.has(b) && origins.get(b) !== b.name).map((b) => [origins.get(b), b.name]),
    isDirty: () => dirty,
    markClean() { dirty = false; origins = new Map([...pal.sprites, ...pal.tiles].map((b) => [b, b.name])); },
    refresh: render,
  };
}
