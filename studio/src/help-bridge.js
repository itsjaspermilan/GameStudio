// Messages between the studio's window and the Help window, which is a window of its own so a tutorial can stay open beside the
// studio. In the app they are Tauri events; in a plain browser (development, the mock backend) a BroadcastChannel between the two tabs.
// Each side listens to the names the other sends (to-help:..., to-studio:...), so neither hears its own messages.
// `native`: the real app (not the browser, where the mock backend fakes Tauri's commands but not its events or windows).
export async function createBridge(native) {
  if (native) {
    const { emit, listen } = await import("@tauri-apps/api/event");
    return { send: (type, payload) => emit(type, payload ?? null), on: (type, fn) => listen(type, (e) => fn(e.payload)) };
  }
  const ch = new BroadcastChannel("gamestudio-help"), handlers = {};
  ch.onmessage = (e) => { const f = handlers[e.data.type]; if (f) f(e.data.payload); };
  return { send: (type, payload) => ch.postMessage({ type, payload: payload ?? null }), on: (type, fn) => { handlers[type] = fn; } };
}
