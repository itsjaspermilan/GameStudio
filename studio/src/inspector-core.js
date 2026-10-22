// The Inspector tab's logic: what the studio asks the running game (engine/gs/inspect.lua reads it from the GS_INSPECT file) and the
// "@@gsi {json}" lines it answers with.
export const SPEEDS = [0.25, 0.5, 1, 2];

export function parseInspectLine(line) {
  if (typeof line !== "string" || !line.startsWith("@@gsi ")) return null;
  try {
    const d = JSON.parse(line.slice(6));
    return d && Array.isArray(d.classes) ? d : null;
  } catch { return null; }
}

// The command file's text: only what the game needs, in a stable order so an unchanged request is the same text.
export function commandText(s) {
  return JSON.stringify({
    open: !!s.open, paused: !!s.paused, step_seq: s.stepSeq | 0, speed: SPEEDS.includes(s.speed) ? s.speed : 1,
    class: s.cls || null, entity: Number.isInteger(s.entity) ? s.entity : null, watch: (s.watch || []).filter((w) => w.trim()).slice(0, 12),
  });
}

// Kinds sorted by time (update + draw + collisions), with a short name ("enemies.grub") and how much of the frame each takes.
export function classRows(report) {
  const rows = (report.classes || []).map((c) => {
    const ms = (c.update_ms || 0) + (c.draw_ms || 0) + (c.collide_ms || 0);
    return { name: c.name, short: String(c.name).replace(/^entities\./, ""), count: c.count, ms, update: c.update_ms || 0, draw: c.draw_ms || 0, collide: c.collide_ms || 0 };
  });
  rows.sort((a, b) => b.ms - a.ms || b.count - a.count || a.short.localeCompare(b.short));
  const total = rows.reduce((t, r) => t + r.ms, 0);
  for (const r of rows) r.share = total > 0 ? r.ms / total : 0;
  return rows;
}

export const fmtMs = (ms) => (ms >= 1 ? ms.toFixed(1) : ms >= 0.01 ? ms.toFixed(2) : ms > 0 ? "<0.01" : "0") + " ms";
