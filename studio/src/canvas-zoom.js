// WebKit sends gesture events; Chromium sends Ctrl+wheel for a trackpad pinch.
export function bindPinchZoom(viewport, { content, getScale, setScale, min, max }) {
  let gestureScale = null;
  const zoom = (factor, event) => {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const element = content(event), scale = getScale();
    if (!element || !Number.isFinite(scale)) return;
    const before = element.getBoundingClientRect();
    if (!before.width || !before.height) return;
    const next = Math.max(min, Math.min(max, scale * factor));
    if (next === scale) return;
    const x = (event.clientX - before.left) / before.width, y = (event.clientY - before.top) / before.height;
    setScale(next);
    const after = element.getBoundingClientRect();
    viewport.scrollLeft += after.left + x * after.width - event.clientX;
    viewport.scrollTop += after.top + y * after.height - event.clientY;
  };
  viewport.addEventListener("wheel", (event) => {
    if (!content(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    if (!event.ctrlKey) {
      viewport.scrollLeft += (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * unit;
      viewport.scrollTop += (event.shiftKey && !event.deltaX ? 0 : event.deltaY) * unit;
      return;
    }
    if (gestureScale !== null) return; // Some WebKit versions also send wheel during a native gesture.
    zoom(Math.exp(-event.deltaY * unit * 0.01), event);
  }, { passive: false });
  viewport.addEventListener("gesturestart", (event) => {
    event.preventDefault();
    gestureScale = event.scale;
  }, { passive: false });
  viewport.addEventListener("gesturechange", (event) => {
    event.preventDefault();
    if (gestureScale !== null) zoom(event.scale / gestureScale, event);
    gestureScale = event.scale;
  }, { passive: false });
  viewport.addEventListener("gestureend", (event) => {
    event.preventDefault();
    gestureScale = null;
  }, { passive: false });
}

// Small canvas views have no drawing zoom of their own. Keep their pixels and hit testing intact by resizing only the view.
export function zoomCanvasView(canvas, viewport) {
  if (!viewport) {
    viewport = document.createElement("div");
    viewport.className = "canvas-zoom-view";
    canvas.before(viewport);
    viewport.appendChild(canvas);
  }
  viewport.title = "Pinch to zoom. Two-finger scroll to pan.";
  let scale = 1;
  bindPinchZoom(viewport, {
    content: () => canvas, getScale: () => scale, min: 0.25, max: 8,
    setScale(next) {
      const bounds = canvas.getBoundingClientRect(), ratio = next / scale;
      canvas.style.width = bounds.width * ratio + "px";
      canvas.style.height = "auto";
      canvas.style.maxWidth = "none";
      scale = next;
    },
  });
}
