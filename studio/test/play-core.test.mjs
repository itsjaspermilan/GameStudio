import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeFrame, keyBit, fitScale, BUTTONS } from "../src/play-core.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const gs = join(root, "build/gs");

// A frame message as the runtime writes it: 'F', u16 w, u16 h, u32 length, runs of (count-1, r, g, b, a)
function frame(w, h, runs) {
  const body = runs.flatMap(([n, c]) => [n - 1, ...c]);
  const len = body.length;
  return new Uint8Array([0x46, w & 255, w >> 8, h & 255, h >> 8, len & 255, (len >> 8) & 255, (len >> 16) & 255, len >>> 24, ...body]);
}

test("decodeFrame spreads the runs into RGBA pixels and refuses broken frames", () => {
  const f = decodeFrame(frame(4, 2, [[3, [1, 2, 3, 0]], [5, [9, 8, 7, 255]]]));
  assert.equal(f.width, 4); assert.equal(f.height, 2);
  assert.deepEqual([...f.pixels.slice(0, 4)], [1, 2, 3, 255], "a screen is opaque");
  assert.deepEqual([...f.pixels.slice(12, 16)], [9, 8, 7, 255]);
  assert.equal(decodeFrame(frame(4, 2, [[3, [1, 2, 3, 255]]])), null, "too few pixels");
  assert.equal(decodeFrame(frame(4, 2, [[8, [0, 0, 0, 255]]]).slice(0, 12)), null, "cut short");
  const into = new Uint8ClampedArray(4 * 2 * 4);
  assert.equal(decodeFrame(frame(4, 2, [[8, [5, 5, 5, 255]]]), into).pixels, into, "decodes into the panel's own buffer");
});

test("keys are the runtime's own, and the screen grows by whole numbers", () => {
  assert.equal(keyBit("ArrowLeft"), 1 << BUTTONS.indexOf("left"));
  assert.equal(keyBit("KeyZ"), 1 << BUTTONS.indexOf("a"));
  assert.equal(keyBit("Enter"), 1 << BUTTONS.indexOf("start"));
  assert.equal(keyBit("KeyP"), 0);
  assert.equal(fitScale(320, 240, 1000, 760), 3);
  assert.equal(fitScale(320, 240, 200, 100), 1, "never smaller than 1x");
});

test("the runtime sends its frames to the studio and takes buttons back", { skip: !existsSync(gs) && "build/gs is missing: run scripts/build.sh" }, async () => {
  const frames = [];
  await new Promise((done, failed) => {
    const srv = net.createServer((sock) => {
      let buf = Buffer.alloc(0);
      sock.on("data", (d) => {
        buf = Buffer.concat([buf, d]);
        while (buf.length >= 9) {
          const len = buf.readUInt32LE(5);
          if (buf.length < 9 + len) break;
          frames.push(decodeFrame(new Uint8Array(buf.subarray(0, 9 + len))));
          buf = buf.subarray(9 + len);
        }
      });
      sock.write(Buffer.from([0x42, 0x10, 0x00])); // A held
      setTimeout(() => sock.write("Q"), 1500);
    });
    srv.listen(0, "127.0.0.1", () => {
      const p = spawn(gs, [join(root, "carts/breakout")], {
        env: { ...process.env, GS_EMBED: String(srv.address().port), GS_EMBED_SIZE: "256x192", GS_SAVE_DIR: mkdtempSync(join(tmpdir(), "gs-play-")), SDL_AUDIODRIVER: "dummy" },
        stdio: "ignore",
      });
      const timer = setTimeout(() => { p.kill(); failed(new Error("the game did not leave when asked")); }, 15000);
      p.on("exit", (code) => { clearTimeout(timer); srv.close(); code === 0 ? done() : failed(new Error("exit " + code)); });
    });
  });
  assert.ok(frames.length >= 2, `frames: ${frames.length}`);
  assert.ok(frames.every((f) => f && f.width === 256 && f.height === 192), "every message is a whole frame at the console's size");
  assert.ok(frames.some((f) => f.pixels.some((v, i) => i % 4 !== 3 && v > 0)), "something is drawn");
});

test("as the Play panel runs it, the game has the Brick's RAM and saves and loads states", { skip: !existsSync(gs) && "build/gs is missing: run scripts/build.sh" }, async () => {
  let out = "", err = "";
  await new Promise((done, failed) => {
    const srv = net.createServer((sock) => {
      sock.on("data", () => {}); // the frames
      sock.on("error", () => {});
      // asked in turn as the earlier answer arrives: a load before any save is refused politely
      const steps = [["L", /no state saved yet/], ["S", /state saved/], ["L", /state loaded/]];
      const next = () => {
        if (!steps.length) return sock.write("Q");
        const [cmd, want] = steps[0];
        sock.write(cmd);
        const wait = setInterval(() => { if (want.test(out + err)) { clearInterval(wait); steps.shift(); next(); } }, 50);
      };
      const ready = setInterval(() => { if (/"ram_size_kb":8192/.test(err)) { clearInterval(ready); next(); } }, 50);
    });
    srv.listen(0, "127.0.0.1", () => {
      const p = spawn(gs, [join(root, "carts/breakout")], {
        env: { ...process.env, GS_EMBED: String(srv.address().port), GS_EMBED_SIZE: "256x192", GS_RAM: "1", GS_STATS: "1", GS_SAVE_DIR: mkdtempSync(join(tmpdir(), "gs-play-")), SDL_AUDIODRIVER: "dummy" },
      });
      p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
      const timer = setTimeout(() => { p.kill(); failed(new Error("timed out\n" + out + err)); }, 20000);
      p.on("exit", (code) => { clearTimeout(timer); srv.close(); code === 0 ? done() : failed(new Error("exit " + code + "\n" + err)); });
    });
  });
  const stats = err.split("\n").filter((l) => l.startsWith("@@gs ")).map((l) => JSON.parse(l.slice(5)));
  const last = stats.at(-1);
  assert.ok(last.ram_kb > 100 && last.ram_kb < 8192 && last.ram_peak_kb >= last.ram_kb, JSON.stringify(last));
  assert.ok(Number.isFinite(last.screens) && Number.isFinite(last.calls), "what the Brick estimate needs");
  assert.match(out, /state saved\nstate loaded/);
  assert.doesNotMatch(err, /lua error|could not/);
});
