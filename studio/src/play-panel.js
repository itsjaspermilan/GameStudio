// The Play panel: the running game inside the studio, on a screen the console's size enlarged by whole numbers. The game itself runs in the
// runtime as usual (sound, live reload, the Handheld and Inspector tabs); this shows its frames and sends it the keys held while it has focus.
import { decodeFrame, fitScale, keyBit } from "./play-core.js";

// hooks: { sendButtons(mask), popOut(), close() }
export function createPlayPanel(root, hooks) {
  root.innerHTML = `
    <div class="pp-head">
      <span class="pp-title">Game</span><span class="pp-info"></span>
      <span class="spacer"></span>
      <select class="pp-scale" title="How big the screen is drawn: Fit is the biggest whole-number size that fits">
        <option value="fit">Fit</option><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option>
      </select>
      <button class="small pp-out" title="Run the game in a window of its own from now on (Settings can bring it back here)">Own window</button>
      <button class="small pp-close" title="Stop the game and hide this panel">×</button>
    </div>
    <div class="pp-stage"><div class="pp-screen"><canvas tabindex="0"></canvas><div class="pp-cover"></div></div></div>
    <div class="pp-keys"></div>`;
  const q = (s) => root.querySelector(s);
  const canvas = q("canvas"), ctx = canvas.getContext("2d"), stage = q(".pp-stage"), cover = q(".pp-cover"), scaleSel = q(".pp-scale");
  q(".pp-keys").innerHTML = "Arrows move · <kbd>Z</kbd> A · <kbd>X</kbd> B · <kbd>A</kbd> X · <kbd>S</kbd> Y · <kbd>Q</kbd> <kbd>W</kbd> L R · <kbd>Enter</kbd> Start · <kbd>Right Shift</kbd> Select. A gamepad works too.";
  let screen = { width: 320, height: 240 }, image = null, running = false, mask = 0;
  try { scaleSel.value = localStorage.getItem("gs.playScale") || "fit"; } catch { /* the usual size */ }

  const layout = () => {
    const k = scaleSel.value === "fit" ? fitScale(screen.width, screen.height, stage.clientWidth - 16, stage.clientHeight - 16) : Number(scaleSel.value);
    canvas.style.width = screen.width * k + "px"; canvas.style.height = screen.height * k + "px";
  };
  new ResizeObserver(layout).observe(stage);
  scaleSel.onchange = () => { try { localStorage.setItem("gs.playScale", scaleSel.value); } catch { /* not remembered */ } layout(); canvas.focus(); };

  const showCover = () => {
    const focused = document.activeElement === canvas;
    cover.hidden = running && focused;
    cover.textContent = !running ? "Stopped. Press Run to play again." : "Click here to play";
    root.classList.toggle("stopped", !running);
  };
  const send = (m) => { if (m !== mask) { mask = m; hooks.sendButtons(mask); } };
  canvas.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // the studio's own shortcuts (Save, Run) still work
    const bit = keyBit(e.code); if (!bit) return;
    e.preventDefault(); send(mask | bit);
  });
  canvas.addEventListener("keyup", (e) => { const bit = keyBit(e.code); if (bit) { e.preventDefault(); send(mask & ~bit); } });
  // a key held while the panel loses focus would stay down in the game
  canvas.addEventListener("blur", () => { send(0); showCover(); });
  canvas.addEventListener("focus", showCover);
  cover.addEventListener("mousedown", (e) => { e.preventDefault(); canvas.focus(); });
  q(".pp-out").onclick = () => hooks.popOut();
  q(".pp-close").onclick = () => hooks.close();

  return {
    // a new run: the console's screen and name
    start(s, name) {
      screen = { width: s.width, height: s.height }; running = true; mask = 0;
      canvas.width = screen.width; canvas.height = screen.height;
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height); // the screen of a console that is starting
      image = ctx.createImageData(screen.width, screen.height);
      q(".pp-info").textContent = `${name} · ${screen.width}×${screen.height}`;
      layout(); canvas.focus(); showCover();
    },
    frame(buffer) {
      const f = decodeFrame(buffer, image && image.width ? image.data : null);
      if (!f) return;
      if (f.width !== canvas.width || f.height !== canvas.height) { // the game changed its resolution
        canvas.width = screen.width = f.width; canvas.height = screen.height = f.height; image = ctx.createImageData(f.width, f.height); layout();
      }
      if (f.pixels !== image.data) image.data.set(f.pixels);
      ctx.putImageData(image, 0, 0);
    },
    stopped() { running = false; mask = 0; showCover(); },
    focus() { canvas.focus(); },
  };
}
