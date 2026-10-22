// The top bar is the window's title bar. On macOS the window keeps its traffic lights but has no title strip of its own
// (tauri.macos.conf.json: titleBarStyle Overlay), so the bar leaves room for them on the left. In fullscreen macOS shows them in its own
// strip when the pointer reaches the top of the screen, so the bar needs no room for them there. On Windows the window has no system title bar (tauri.windows.conf.json: decorations false) and the bar draws Windows 11 caption buttons on the right.
// Empty parts of the bar move the window (data-tauri-drag-region; a double click zooms or maximises).
// In a plain browser nothing changes, unless ?chrome=mac or ?chrome=windows asks to see the bar as the app draws it.
import { getCurrentWindow } from "@tauri-apps/api/window";

const ICONS = {
  minimize: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5.5h10" stroke="currentColor"/></svg>',
  maximize: '<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" rx="1" fill="none" stroke="currentColor"/></svg>',
  restore: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" fill="none" stroke="currentColor"/><rect x="0.5" y="2.5" width="7" height="7" rx="1" fill="none" stroke="currentColor"/></svg>',
  close: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor"/></svg>',
};

export function setupWindowChrome(bar, { native }) {
  const root = document.documentElement, os = root.dataset.os;
  const asked = new URLSearchParams(location.search).get("chrome");
  const chrome = native ? (os === "mac" || os === "windows" ? os : "") : asked === "mac" || asked === "windows" ? asked : "";
  if (!chrome) return;
  root.dataset.chrome = chrome;
  // the bar and its empty parts move the window; buttons and fields inside keep working as usual
  for (const el of [bar, ...bar.querySelectorAll(".group, .spacer, #status")]) el.setAttribute("data-tauri-drag-region", "");
  const win = native ? getCurrentWindow() : null;

  if (chrome === "windows") {
    const box = document.createElement("div"); box.className = "caption";
    const make = (kind, title, act) => {
      const b = document.createElement("button"); b.className = `caption-${kind}`; b.title = title; b.innerHTML = ICONS[kind]; b.tabIndex = -1;
      b.onclick = () => win && act();
      box.appendChild(b); return b;
    };
    make("minimize", "Minimise", () => win.minimize());
    const max = make("maximize", "Maximise", () => win.toggleMaximize());
    make("close", "Close", () => win.close());
    bar.appendChild(box);
    const sync = async () => {
      const on = win ? await win.isMaximized() : false;
      max.innerHTML = on ? ICONS.restore : ICONS.maximize; max.title = on ? "Restore down" : "Maximise";
    };
    if (win) { win.onResized(sync); sync(); }
  }

  if (chrome === "mac") {
    const setFull = async () => { root.dataset.fullscreen = win && (await win.isFullscreen()) ? "true" : "false"; };
    if (win) { win.onResized(setFull); setFull(); }
  }
}
