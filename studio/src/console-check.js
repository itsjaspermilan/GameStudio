// What would change if a project moved to a different console? A report of the things that no longer fit, so you know
// before you switch. Pure: the studio gathers the facts about the project, this turns them into messages.
//
// facts = {
//   rooms:    { name: {width, height, instances: n, layers: n} },
//   sprites:  { name: {w, h, frames, offPalette?, colors?} },
//   tilesets: { name: {w, h, tile_w, tile_h, offPalette?, colors?} },
//   palette:  { sprites: n, tiles: n, problems: [text] }   only for a game with colour banks (palette.json); its sprites then carry
//             noBank (true, or the missing bank's name) or offBank (pixels outside their bank), its tilesets noBank or tilesOff (tiles that keep to no bank)
// }
// Returns [{ level: "problem" | "note", text }], problems first.
export function checkProject(oldConsole, c, facts) {
  const out = [];
  const problem = (text) => out.push({ level: "problem", text });
  const note = (text) => out.push({ level: "note", text });

  if (oldConsole && (oldConsole.screen.width !== c.screen.width || oldConsole.screen.height !== c.screen.height)) {
    note(`The screen changes from ${oldConsole.screen.width}×${oldConsole.screen.height} to ${c.screen.width}×${c.screen.height}. Levels and positions are not changed.`);
  }
  const r = c.rooms, lim = c.limits || {}, bud = c.budgets || {};
  for (const [name, room] of Object.entries(facts.rooms || {})) {
    if (room.width > r.max_width || room.height > r.max_height) problem(`Level ${name} is ${room.width}×${room.height}; this console allows up to ${r.max_width}×${r.max_height}.`);
    if (lim.instances_per_room && room.instances > lim.instances_per_room) problem(`Level ${name} has ${room.instances} entities; this console allows ${lim.instances_per_room}.`);
    if (lim.instances_alive && (!lim.instances_per_room || lim.instances_alive < lim.instances_per_room) && room.instances > lim.instances_alive) problem(`Level ${name} starts with ${room.instances} entities; this console allows ${lim.instances_alive} alive at once, so the rest would be ignored.`);
    if (room.layers > r.tile_layers) problem(`Level ${name} has ${room.layers} tile layers; this console allows ${r.tile_layers}.`);
  }
  const g = c.graphics, ss = g.sprite_size;
  for (const [name, s] of Object.entries(facts.sprites || {})) {
    const fw = s.w;
    if (fw > ss.max_width || s.h > ss.max_height) problem(`Sprite ${name} is ${fw}×${s.h}; this console allows up to ${ss.max_width}×${ss.max_height}.`);
    else if (ss.multiple_of > 1 && (fw % ss.multiple_of || s.h % ss.multiple_of)) problem(`Sprite ${name} is ${fw}×${s.h}; sizes must be multiples of ${ss.multiple_of}.`);
    if (bud.frames_per_sprite && s.frames > bud.frames_per_sprite) note(`Sprite ${name} has ${s.frames} frames; the budget is ${bud.frames_per_sprite}.`);
  }
  for (const [name, t] of Object.entries(facts.tilesets || {})) {
    if (g.tile_sizes && !(t.tile_w === t.tile_h && g.tile_sizes.includes(t.tile_w))) problem(`Tileset ${name} uses ${t.tile_w}×${t.tile_h} tiles; this console allows ${g.tile_sizes.map((n) => `${n}×${n}`).join(" or ")}.`);
    if (t.w > g.tileset_max.width || t.h > g.tileset_max.height) problem(`Tileset ${name} is ${t.w}×${t.h}; this console allows up to ${g.tileset_max.width}×${g.tileset_max.height}.`);
  }
  const pal = c.palette || {};
  const banks = pal.mode === "banks" && facts.palette;
  if (banks) for (const t of facts.palette.problems || []) problem(`Colours: ${t}`);
  if (facts.palette && pal.mode !== "banks") note("The game's colour banks (palette.json) are not used on this console.");
  for (const [kind, group] of [["Sprite", facts.sprites], ["Tileset", facts.tilesets]]) {
    for (const [name, a] of Object.entries(group || {})) {
      if (banks) {
        if (a.noBank) problem(typeof a.noBank === "string" ? `${kind} ${name} uses bank ${a.noBank}, which the game's colours do not have.` : `${kind} ${name} has no colour bank yet (open it and choose ${kind === "Sprite" ? "one" : "its banks"}).`);
        else if (a.offBank > 0) problem(`${kind} ${name} has ${a.offBank} pixels outside its bank (open it and use "Snap to bank").`);
        else if (a.tilesOff > 0) problem(`${kind} ${name} has ${a.tilesOff} tile${a.tilesOff === 1 ? "" : "s"} that mix colours from more than one bank (open it and use "Snap tiles to banks").`);
        continue;
      }
      if ((pal.mode === "fixed" || pal.mode === "banks") && a.offPalette > 0) problem(`${kind} ${name} has ${a.offPalette} pixels outside this console's ${pal.mode === "banks" ? "classic colours" : "palette"} (open it and use "Snap to palette").`);
      if (pal.mode === "limited" && a.colors > pal.size) problem(`${kind} ${name} uses ${a.colors} colours; this console allows ${pal.size}.`);
    }
  }
  return [...out.filter((o) => o.level === "problem"), ...out.filter((o) => o.level === "note")];
}
