// Reading just enough of a WAV file to import it: is it a WAV, how long is it. (The runtime loads it with SDL.)

// bytes: Uint8Array. Returns {channels, rate, bits, seconds} or {error}.
export function parseWav(bytes) {
  if (bytes.length < 44) return { error: "That file is too small to be a WAV sound." };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return { error: "That isn't a WAV file." };
  let fmt = null, dataLen = null;
  for (let p = 12; p + 8 <= bytes.length;) {
    const id = tag(p), len = dv.getUint32(p + 4, true);
    if (id === "fmt " && p + 8 + 16 <= bytes.length) {
      fmt = { format: dv.getUint16(p + 8, true), channels: dv.getUint16(p + 10, true), rate: dv.getUint32(p + 12, true), byteRate: dv.getUint32(p + 16, true), bits: dv.getUint16(p + 22, true) };
    } else if (id === "data") {
      dataLen = Math.min(len, bytes.length - (p + 8));
      break;
    }
    p += 8 + len + (len & 1);
  }
  if (!fmt) return { error: "That WAV file has no format information." };
  if (dataLen === null) return { error: "That WAV file has no sound data." };
  if (!fmt.byteRate || !fmt.rate || !fmt.channels) return { error: "That WAV file's format isn't valid." };
  return { channels: fmt.channels, rate: fmt.rate, bits: fmt.bits, seconds: dataLen / fmt.byteRate };
}

// A resource name from a file name ("Coin Pickup!.wav" -> "coin_pickup"), unique among `taken`.
export function sampleName(filename, taken) {
  let base = String(filename).replace(/\.[^.]*$/, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "sample";
  if (base.startsWith(".")) base = "sample";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) { const n = `${base.slice(0, 36)}_${i}`; if (!used.has(n)) return n; }
}
