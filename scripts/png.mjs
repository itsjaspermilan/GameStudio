// A small PNG writer for Node (RGBA, 8 bits), for scripts and tests that make pictures without a browser canvas.
import { deflateSync, inflateSync } from "node:zlib";

function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}

// rgba: a Uint8Array or Uint8ClampedArray of width * height * 4 bytes. Returns a Buffer.
export function png(width, height, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// The first frame of a sprite strip (frames side by side), enlarged by a whole number so each pixel stays a block: what the studio does for
// "Use this sprite" as box art. Returns { width, height, data }.
export function enlargeFirstFrame(strip, frames, target = 480) {
  const fw = Math.floor(strip.width / Math.max(1, frames)), fh = strip.height;
  const k = Math.max(1, Math.floor(target / fh)), w = fw * k, h = fh * k;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (Math.floor(y / k) * strip.width + Math.floor(x / k)) * 4, d = (y * w + x) * 4;
    data[d] = strip.data[s]; data[d + 1] = strip.data[s + 1]; data[d + 2] = strip.data[s + 2]; data[d + 3] = strip.data[s + 3];
  }
  return { width: w, height: h, data };
}

// Reads an 8-bit RGB or RGBA PNG that is not interlaced. Returns { width, height, data } with data as RGBA bytes.
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8, width = 0, height = 0, type = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), name = buf.toString("latin1", pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") { width = body.readUInt32BE(0); height = body.readUInt32BE(4); if (body[8] !== 8 || body[12] !== 0 || (body[9] !== 6 && body[9] !== 2)) throw new Error("only 8-bit RGB/RGBA PNGs that are not interlaced"); type = body[9]; }
    else if (name === "IDAT") idat.push(body);
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { data[i * 4] = out[i * bpp]; data[i * 4 + 1] = out[i * bpp + 1]; data[i * 4 + 2] = out[i * bpp + 2]; data[i * 4 + 3] = type === 6 ? out[i * bpp + 3] : 255; }
  return { width, height, data };
}

// Reads an uncompressed 24- or 32-bit BMP (what the runtime's GS_DUMP_FRAME writes). Returns { width, height, data } with data as RGBA bytes.
export function decodeBmp(buf) {
  if (buf.toString("latin1", 0, 2) !== "BM") throw new Error("not a BMP");
  const offset = buf.readUInt32LE(10), width = buf.readInt32LE(18), rawHeight = buf.readInt32LE(22), bits = buf.readUInt16LE(28), height = Math.abs(rawHeight);
  if ((bits !== 24 && bits !== 32) || (buf.readUInt32LE(30) !== 0 && buf.readUInt32LE(30) !== 3)) throw new Error("only uncompressed 24 or 32 bit BMPs (32 bit ones may carry channel masks, assumed to be the usual BGRA)");
  const bpp = bits / 8, stride = Math.ceil(width * bpp / 4) * 4, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = offset + (rawHeight > 0 ? height - 1 - y : y) * stride;
    for (let x = 0; x < width; x++) {
      const s = row + x * bpp, d = (y * width + x) * 4;
      data[d] = buf[s + 2]; data[d + 1] = buf[s + 1]; data[d + 2] = buf[s]; data[d + 3] = bits === 32 ? buf[s + 3] : 255;
    }
  }
  return { width, height, data };
}
