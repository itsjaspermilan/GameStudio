// A small grid of colour swatches, used wherever a console with a fixed palette lets you choose a colour.
export function renderSwatches(box, colors, selected, onPick) {
  box.replaceChildren();
  const sel = String(selected || "").toLowerCase();
  for (const hex of colors) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "swatch" + (hex.toLowerCase() === sel ? " sel" : "");
    b.style.background = hex; b.title = hex;
    b.onclick = () => onPick(hex);
    box.appendChild(b);
  }
}
