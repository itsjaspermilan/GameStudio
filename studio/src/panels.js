// Panel sizes: drag the line between two panels to make one wider or taller, double-click it to go back to the usual size.
// Sizes are CSS variables (--side-w and --log-h on #app, --split-w on #code-area) so style.css keeps the layout; this only moves them.
// They are remembered in localStorage, which is a convenience and may be missing.

const KEY = "gs.panels";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const keep = (sizes) => { try { localStorage.setItem(KEY, JSON.stringify(sizes)); } catch { /* not remembered */ } };

// gutters: [{ handle, target, prop, axis: "x" | "y", from: "start" | "end", min, max: () => px, unit: "px" | "%" }]
// from "end" means the panel grows when the line moves towards the start (the output grows as its top edge goes up).
export function setupPanels(gutters) {
  const sizes = load();
  const apply = (g, v) => g.target.style.setProperty(g.prop, v == null ? "" : v + g.unit);
  for (const g of gutters) {
    if (sizes[g.prop] != null) apply(g, sizes[g.prop]);
    g.handle.addEventListener("dblclick", () => { delete sizes[g.prop]; apply(g, null); keep(sizes); window.dispatchEvent(new Event("resize")); });
    g.handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      try { g.handle.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
      const box = g.target.getBoundingClientRect();
      document.body.classList.add(g.axis === "x" ? "resizing-x" : "resizing-y");
      const move = (ev) => {
        const p = g.axis === "x" ? ev.clientX : ev.clientY;
        const start = g.axis === "x" ? box.left : box.top, end = g.axis === "x" ? box.right : box.bottom, whole = end - start;
        let px = g.from === "start" ? p - start : end - p;
        if (g.unit === "%") px = whole - px; // a split's size is the right-hand side's share
        px = Math.max(g.min, Math.min(g.max(), px));
        const v = g.unit === "%" ? Math.round((px / whole) * 1000) / 10 : Math.round(px);
        sizes[g.prop] = v; apply(g, v);
      };
      const up = () => {
        g.handle.removeEventListener("pointermove", move); g.handle.removeEventListener("pointerup", up); g.handle.removeEventListener("pointercancel", up);
        document.body.classList.remove("resizing-x", "resizing-y");
        keep(sizes);
        window.dispatchEvent(new Event("resize")); // canvas editors fit themselves to their new room
      };
      g.handle.addEventListener("pointermove", move); g.handle.addEventListener("pointerup", up); g.handle.addEventListener("pointercancel", up);
    });
  }
}
