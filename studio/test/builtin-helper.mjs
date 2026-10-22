// The ready-made instruments, as the studio loads them from engine/instruments.json.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { setBuiltinInstruments } from "../src/audio-core.js";
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../engine/instruments.json");
export const builtinDoc = JSON.parse(readFileSync(file, "utf8"));
setBuiltinInstruments(builtinDoc);
