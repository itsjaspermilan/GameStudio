// Reading just enough of a WAV file to import it: is it a WAV, how long is it (the runtime loads it with SDL); and fitting it to the console.

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

// A WAV fitted to the console: mono, at most `maxRate` samples a second (the runtime mixes samples as mono anyway). Uncompressed PCM
// (8, 16, 24 or 32 bit) and 32-bit float are read; anything else, or a sound already within the limits, comes back as it was.
// Returns {bytes, rate, changed}. Going down in rate, each output sample is the average of the input it covers, so nothing aliases.
export function fitWav(bytes, maxRate) {
  const info = parseWav(bytes);
  if (info.error) return { bytes, rate: 0, changed: false };
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  let fmt = 0, start = 0, len = 0;
  for (let p = 12; p + 8 <= bytes.length;) {
    const id = tag(p), n = dv.getUint32(p + 4, true);
    if (id === "fmt ") fmt = dv.getUint16(p + 8, true);
    else if (id === "data") { start = p + 8; len = Math.min(n, bytes.length - start); break; }
    p += 8 + n + (n & 1);
  }
  const { channels, rate, bits } = info, size = bits / 8;
  const readable = (fmt === 1 && [8, 16, 24, 32].includes(bits)) || (fmt === 3 && bits === 32);
  if (!readable || (rate <= maxRate && channels === 1)) return { bytes, rate, changed: false };
  const frames = Math.floor(len / (size * channels));
  const at = (o) => (fmt === 3 ? dv.getFloat32(o, true) : bits === 8 ? (bytes[o] - 128) / 128 : bits === 16 ? dv.getInt16(o, true) / 32768
    : bits === 24 ? ((bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) << 8 >> 8) / 8388608 : dv.getInt32(o, true) / 2147483648);
  const mono = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0; for (let c = 0; c < channels; c++) s += at(start + (f * channels + c) * size); mono[f] = s / channels; }
  const outRate = Math.min(rate, maxRate), ratio = rate / outRate, n = Math.max(1, Math.floor(frames / ratio));
  const out = new Uint8Array(44 + n * 2), ov = new DataView(out.buffer);
  const put = (o, s) => { for (let i = 0; i < 4; i++) out[o + i] = s.charCodeAt(i); };
  put(0, "RIFF"); ov.setUint32(4, 36 + n * 2, true); put(8, "WAVE"); put(12, "fmt "); ov.setUint32(16, 16, true);
  ov.setUint16(20, 1, true); ov.setUint16(22, 1, true); ov.setUint32(24, outRate, true); ov.setUint32(28, outRate * 2, true);
  ov.setUint16(32, 2, true); ov.setUint16(34, 16, true); put(36, "data"); ov.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.min(frames, Math.floor((i + 1) * ratio)));
    let s = 0; for (let k = a; k < b; k++) s += mono[k];
    ov.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round((s / (b - a)) * 32767))), true);
  }
  return { bytes: out, rate: outRate, changed: true };
}
