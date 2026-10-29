import test from "node:test";
import assert from "node:assert/strict";
import { bindPinchZoom, zoomCanvasView } from "../src/canvas-zoom.js";

function fixture() {
  const viewport = new EventTarget();
  Object.assign(viewport, { scrollLeft: 100, scrollTop: 50, clientHeight: 200 });
  let scale = 1, loaded = true;
  const content = {
    getBoundingClientRect: () => ({
      left: 20 - viewport.scrollLeft, top: 10 - viewport.scrollTop, width: 400 * scale, height: 300 * scale,
    }),
  };
  bindPinchZoom(viewport, {
    content: () => loaded && content, min: 0.25, max: 8,
    getScale: () => scale, setScale: (next) => { scale = next; },
  });
  const fire = (type, fields = {}) => {
    const event = new Event(type, { cancelable: true, bubbles: true });
    Object.assign(event, { clientX: 120, clientY: 110, deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, scale: 1 }, fields);
    viewport.dispatchEvent(event);
    return event;
  };
  return { viewport, fire, scale: () => scale, unload: () => { loaded = false; } };
}

test("two-finger scrolling pans both axes, never zooms, and stays inside the canvas", () => {
  const f = fixture();
  const event = f.fire("wheel", { deltaX: 25.5, deltaY: -10.25 });
  assert.equal(f.viewport.scrollLeft, 125.5);
  assert.equal(f.viewport.scrollTop, 39.75);
  assert.equal(f.scale(), 1);
  assert.equal(event.defaultPrevented, true);
});

test("mouse wheel line, page and Shift scrolling also pan", () => {
  const f = fixture();
  f.fire("wheel", { deltaY: 2, deltaMode: 1 });
  assert.equal(f.viewport.scrollTop, 82);
  f.fire("wheel", { deltaY: 1, deltaMode: 2 });
  assert.equal(f.viewport.scrollTop, 282);
  f.fire("wheel", { deltaY: 20, shiftKey: true });
  assert.equal(f.viewport.scrollLeft, 120);
  assert.equal(f.viewport.scrollTop, 282);
});

test("Chromium pinch zooms around the pointer and reverses without drifting", () => {
  const f = fixture(), deltaY = -Math.log(2) / 0.01;
  assert.equal(f.fire("wheel", { ctrlKey: true, deltaY }).defaultPrevented, true);
  assert.equal(f.scale(), 2);
  assert.equal(f.viewport.scrollLeft, 300);
  assert.equal(f.viewport.scrollTop, 200);
  f.fire("wheel", { ctrlKey: true, deltaY: -deltaY });
  assert.equal(f.scale(), 1);
  assert.equal(f.viewport.scrollLeft, 100);
  assert.equal(f.viewport.scrollTop, 50);
});

test("WebKit uses cumulative gesture scales without applying duplicate wheel zoom", () => {
  const f = fixture();
  assert.equal(f.fire("gesturestart").defaultPrevented, true);
  f.fire("gesturechange", { scale: 2 });
  assert.equal(f.scale(), 2);
  f.fire("wheel", { ctrlKey: true, deltaY: -20 });
  assert.equal(f.scale(), 2);
  f.fire("gesturechange", { scale: 3 });
  assert.equal(f.scale(), 3);
  assert.equal(f.fire("gestureend").defaultPrevented, true);
  f.fire("gesturestart");
  f.fire("gesturechange", { scale: 0.5 });
  assert.equal(f.scale(), 1.5);
  f.fire("gestureend");
  f.fire("wheel", { ctrlKey: true, deltaY: -Math.log(2) / 0.01 });
  assert.equal(f.scale(), 3);
});

test("zoom is bounded and invalid deltas do not corrupt the view", () => {
  const f = fixture();
  f.fire("wheel", { ctrlKey: true, deltaY: -500 });
  assert.equal(f.scale(), 8);
  f.fire("wheel", { ctrlKey: true, deltaY: 1000 });
  assert.equal(f.scale(), 0.25);
  f.fire("wheel", { ctrlKey: true, deltaY: NaN });
  assert.equal(f.scale(), 0.25);
});

test("an unloaded canvas does not capture scrolling", () => {
  const f = fixture();
  f.unload();
  assert.equal(f.fire("wheel", { deltaY: 20 }).defaultPrevented, false);
  assert.equal(f.viewport.scrollTop, 50);
});

test("small canvas views resize the view, not the pixels, and keep their aspect ratio", () => {
  const viewport = new EventTarget();
  Object.assign(viewport, { scrollLeft: 0, scrollTop: 0, clientHeight: 200 });
  const canvas = {
    width: 128, height: 64, style: {},
    getBoundingClientRect() {
      const width = parseFloat(this.style.width) || this.width;
      return { left: -viewport.scrollLeft, top: -viewport.scrollTop, width, height: width * this.height / this.width };
    },
  };
  zoomCanvasView(canvas, viewport);
  const event = new Event("wheel", { cancelable: true });
  Object.assign(event, { ctrlKey: true, deltaY: -Math.log(2) / 0.01, deltaMode: 0, clientX: 32, clientY: 16 });
  viewport.dispatchEvent(event);
  assert.equal(canvas.style.width, "256px");
  assert.equal(canvas.style.height, "auto");
  assert.equal(canvas.style.maxWidth, "none");
  assert.equal(canvas.width, 128);
  assert.equal(canvas.height, 64);
  assert.equal(viewport.scrollLeft, 32);
  assert.equal(viewport.scrollTop, 16);
  canvas.height = 128;
  assert.equal(canvas.getBoundingClientRect().height, 256, "a different sprite or tileset still has its own proportions");
});
