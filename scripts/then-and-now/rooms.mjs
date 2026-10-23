// Builds rooms from drawings: one text picture per room gives both eras at once.
//   #  wall in both eras          N  wall only Now (rubble, a collapsed bulkhead)     T  wall only Then (a wall that has since fallen)
//   =  thin floor in both         n  thin floor only Now                               t  thin floor only Then (a catwalk that fell)
//   ~  hazard, Now only (a sparking cable)                                             X  a seal: wall in both until the story opens it
//   A-F  a door in the left or right wall, on its bottom tile (the three tiles up from it are cleared for it)
//   any other letter: a thing, from THINGS (lower case mostly; P is the start of a new game)
// A room is 20 columns by 15 rows a screen (320x240); w and h say how many screens, mx and my where it sits on the map.
import { TILE, backLayers } from "./tiles.mjs";

export const T = 16, SW = 20, SH = 15;

// letter -> entity name, how it stands (feet on the floor below the letter, or centred on it), and fixed values
export const THINGS = {
  s: { kind: "terminal", stand: true },
  k: { kind: "console", stand: true },
  c: { kind: "launch", stand: true },
  o: { kind: "ossie", stand: true },
  w: { kind: "jacket", stand: true },
  h: { kind: "pickup", props: { what: "hull" } },
  b: { kind: "pickup", props: { what: "battery" } },
  l: { kind: "loader", stand: true },
  r: { kind: "turret", top: true },
  e: { kind: "echo_pilot", stand: true },
  L: { kind: "lift", stand: true },
  S: { kind: "ship", stand: true },
  Z: { kind: "spot", props: { name: "boss" } },
  P: { kind: "spot", props: { name: "start" } },
};

export function buildRoom(def) {
  const cols = SW * (def.w || 1), rows = SH * (def.h || 1);
  if (def.map.length !== rows) throw new Error(`${def.id}: ${def.map.length} rows, expected ${rows}`);
  def.map.forEach((line, r) => { if (line.length !== cols) throw new Error(`${def.id} row ${r}: ${line.length} columns, expected ${cols}\n${line}`); });
  const g = def.map.map((line) => [...line]);
  const doors = {}, things = [], seals = [];
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = g[r][c];
    if (/[A-F]/.test(ch) && (c === 0 || c === cols - 1)) {
      const link = def.doors?.[ch];
      if (!link) throw new Error(`${def.id}: door ${ch} has no link`);
      doors[ch] = { side: c === 0 ? "left" : "right", x: c * T, y: (r + 1) * T, to: link[0], at: link[1] };
      for (let k = 0; k < 3; k++) g[r - k][c] = " ";
    } else if (ch === "X") {
      seals.push([c, r]);
    } else if (THINGS[ch]) {
      const t = THINGS[ch];
      const x = c * T + T / 2, y = t.stand ? (r + 1) * T : t.top ? r * T + 8 : r * T + T / 2;
      const props = { ...(t.props || {}), ...(def.props?.[`${ch}${n}`] || {}) };
      if (t.kind === "pickup" || t.kind === "jacket") props.id = `${def.id}_${c}_${r}`;
      things.push({ kind: t.kind, x, y, props });
      g[r][c] = " ";
      n++;
    } else if (!"#NT=nt~ ".includes(ch)) throw new Error(`${def.id}: unknown letter '${ch}' at row ${r}, column ${c}`);
  }
  // per-room values for things, in reading order: def.set = { ossie: {...}, jacket: { n = 1 } } applies to every thing of that kind
  for (const t of things) Object.assign(t.props, def.set?.[t.kind] || {});
  const solidFor = (wallChars, thinChars, hazard) => {
    const isWall = (r, c) => r < 0 || c < 0 || r >= rows || c >= cols || wallChars.includes(g[r][c]);
    return g.map((row, r) => row.map((ch, c) => {
      if (wallChars.includes(ch)) {
        return (isWall(r - 1, c) ? 0 : 1) + (isWall(r, c + 1) ? 0 : 2) + (isWall(r + 1, c) ? 0 : 4) + (isWall(r, c - 1) ? 0 : 8);
      }
      if (thinChars.includes(ch)) return TILE.THIN;
      if (hazard && ch === "~") return TILE.HAZARD;
      return -1;
    }));
  };
  const now = solidFor("#NX", "=n", true), then = solidFor("#TX", "=t", false);
  const solid = (ch) => ch === "#" || ch === "N" || ch === "X";
  const aboveFloor = (r, c) => r + 1 < rows && !solid(g[r][c]) && solid(g[r + 1][c]) && c > 0 && c < cols - 1;
  const back = backLayers(cols, rows, def.seed || def.id.length * 131 + cols, aboveFloor);
  return { cols, rows, now, then, back, doors, things, seals };
}

// The layout file of a room, read by the engine (scenes/rooms/<id>.layout.lua); the room's code is scenes/room.lua.
export function layoutLua(def, built) {
  const rowsLua = (data) => data.map((r) => "      { " + r.join(", ") + " },").join("\n");
  const val = (v) => typeof v === "string" ? JSON.stringify(v) : String(v);
  const ts = def.tiles || "hangar";
  const layer = (name, set, data, depth) => `    { name = "${name}", tileset = "ts_${ts}_${set}", depth = ${depth}, data = {\n${rowsLua(data)}\n    } },`;
  const thing = (t) => {
    const props = Object.entries(t.props);
    return `    { "${t.kind}", ${t.x}, ${t.y}${props.length ? ", { " + props.map(([k, v]) => `${k} = ${val(v)}`).join(", ") + " }" : ""} },`;
  };
  const door = (id, d) => `    { "door", ${d.x}, ${d.y}, { id = "${id}", side = "${d.side}", to = "${d.to}", at = "${d.at}" } },`;
  return [
    `-- ${def.name}. Written by scripts/make-then-and-now.mjs from scripts/then-and-now/${def.file}.mjs; edit the drawing there.`,
    "-- Layers: now / then (solid, one shown at a time by the Lens) and their backgrounds. The code for every room is scenes/room.lua.",
    "return {",
    `  code = "room",`,
    `  width = ${built.cols * T}, height = ${built.rows * T}, background = "#000000",`,
    "  layers = {",
    layer("back_now", "now", built.back.now, 200),
    layer("back_then", "then", built.back.then, 200),
    layer("now", "now", built.now, 100),
    layer("then", "then", built.then, 100),
    "  },",
    "  entities = {",
    ...Object.entries(built.doors).map(([id, d]) => door(id, d)),
    ...built.things.map(thing),
    "  },",
    "}",
    "",
  ].join("\n");
}

// One room's entry in lib/world.lua (what the map, the doors and the story need to know without loading the room)
export function worldLua(def, built) {
  const doors = Object.entries(built.doors).map(([id, d]) => `${id} = { side = "${d.side}", x = ${d.x}, y = ${d.y}, to = "${d.to}", at = "${d.at}" }`).join(", ");
  const seals = built.seals.map(([c, r]) => `{ ${c}, ${r} }`).join(", ");
  const extra = Object.entries(def.flags || {}).map(([k, v]) => `${k} = ${typeof v === "string" ? JSON.stringify(v) : v}`).join(", ");
  return `  ${def.id} = { name = ${JSON.stringify(def.name)}, biome = "${def.biome}", music = "${def.music}", mx = ${def.mx}, my = ${def.my}, w = ${def.w || 1}, h = ${def.h || 1},` +
    `${extra ? " " + extra + "," : ""}\n    doors = { ${doors} },\n    seals = { ${seals} } },`;
}
