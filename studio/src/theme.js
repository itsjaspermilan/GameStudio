// The studio's look follows the system: macOS or Windows colours (style.css, by data-os) in the system's light or dark mode
// (data-scheme), switching live when the system does. Settings > Look can pin light or dark instead (kept in the browser, per person).
// index.html sets both attributes before the first paint; this keeps data-scheme current and tells the editors that draw on canvases.
const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;
const listeners = new Set();
let values = new Map();

export function lookChoice() {
  try { const v = localStorage.getItem("gs.look"); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
}
export const scheme = () => document.documentElement.dataset.scheme || "dark";

function apply() {
  const c = lookChoice(), next = c === "system" ? (media && media.matches ? "light" : "dark") : c;
  if (document.documentElement.dataset.scheme === next) return;
  document.documentElement.dataset.scheme = next;
  values = new Map();
  for (const fn of listeners) fn(next);
}
export function setLook(choice) {
  try { if (choice === "light" || choice === "dark") localStorage.setItem("gs.look", choice); else localStorage.removeItem("gs.look"); } catch { /* not remembered */ }
  apply();
}
export function onLookChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// A theme colour for canvas drawing ("surface", "muted", "accent", ...), read once per look.
export function color(name) {
  let v = values.get(name);
  if (v === undefined) { v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim(); values.set(name, v); }
  return v;
}
// A theme colour (a #rrggbb variable) at some opacity, for canvas drawing.
export function tint(name, alpha) {
  const h = color(name);
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return h;
  return `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${alpha})`;
}
// A faint overlay: white at `alpha` on a dark look, black on a light one.
export const ink = (alpha) => `rgba(${color("ink")}, ${alpha})`;

if (media) media.addEventListener("change", apply);
window.addEventListener("storage", (e) => { if (e.key === "gs.look") apply(); }); // picked in the studio's Settings while Help is open
apply();
