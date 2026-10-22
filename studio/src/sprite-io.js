// Browser-side PNG encode/decode for sprite strips (uses canvas; the pure logic lives in sprite-core.js).
import { packStrip, unpackStrip } from "./sprite-core.js";

function canvasFor(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// Returns base64 PNG data (no data: prefix) for the sprite's horizontal frame strip.
export async function encodeSpritePng(sprite) {
  const strip = packStrip(sprite);
  const c = canvasFor(strip.width, strip.height);
  c.getContext("2d").putImageData(new ImageData(strip.data, strip.width, strip.height), 0, 0);
  const blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("PNG encode failed"))), "image/png"));
  const url = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(",") + 1);
}

// Decodes base64 PNG data into {w, h, frames} given the number of frames in the strip.
export async function decodeSpritePng(b64, frames) {
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
  const c = canvasFor(bmp.width, bmp.height);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  return unpackStrip(bmp.width, bmp.height, img.data, Math.max(1, frames | 0));
}
